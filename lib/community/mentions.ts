import { supabase } from "@/lib/supabase/client";
import { buildGroupKey, createNotification } from "@/lib/community/notifications";

export type MentionSource = "post" | "comment";

const HANDLE_PATTERN = /(?:^|[^A-Za-z0-9_])@([A-Za-z0-9_][A-Za-z0-9_.-]{1,29})/g;

export function extractHandlesFromText(text: string | null | undefined): string[] {
  if (!text) return [];
  const matches = new Set<string>();
  const pattern = new RegExp(HANDLE_PATTERN.source, "g");
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    if (match[1]) matches.add(match[1].toLowerCase());
  }
  return Array.from(matches);
}

export function hasMentionHandles(text: string | null | undefined): boolean {
  return extractHandlesFromText(text).length > 0;
}

export type MentionCandidate = {
  userId: string;
  handle: string;
  label: string;
  avatarUrl: string | null;
};

export async function fetchFollowedMentionCandidates(userId: string): Promise<MentionCandidate[]> {
  if (!userId) return [];

  const { data: follows, error: followsError } = await supabase
    .from("follows_user")
    .select("following_id")
    .eq("follower_id", userId);

  if (followsError) {
    console.warn("[mentions] fetch follows failed:", followsError.message);
    return [];
  }

  const followingIds = Array.from(
    new Set((follows ?? []).map((row) => row.following_id as string).filter(Boolean)),
  );
  if (followingIds.length === 0) return [];

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("user_id, handle, nickname, display_name, avatar_url")
    .in("user_id", followingIds)
    .not("handle", "is", null);

  if (profilesError) {
    console.warn("[mentions] fetch mention candidates failed:", profilesError.message);
    return [];
  }

  return ((profiles ?? []) as Array<{
    user_id: string;
    handle: string;
    nickname: string | null;
    display_name: string | null;
    avatar_url: string | null;
  }>)
    .filter((row) => row.handle)
    .map((row) => ({
      userId: row.user_id,
      handle: row.handle,
      label: row.display_name || row.nickname || row.handle,
      avatarUrl: row.avatar_url,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "ko"));
}

type ResolvedHandle = { handle: string; userId: string };

export async function resolveHandlesToUserIds(handles: string[]): Promise<ResolvedHandle[]> {
  if (handles.length === 0) return [];

  const normalized = Array.from(new Set(handles.map((h) => h.toLowerCase())));
  const orFilter = normalized.map((h) => `handle.ilike.${h}`).join(",");

  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, handle")
    .or(orFilter);

  if (error) {
    console.warn("[mentions] resolve handles failed:", error.message);
    return [];
  }

  return ((data ?? []) as Array<{ user_id: string; handle: string }>).map((row) => ({
    handle: row.handle,
    userId: row.user_id,
  }));
}

async function fetchActorMentionLabel(actorId: string): Promise<string> {
  const { data } = await supabase
    .from("profiles")
    .select("handle, nickname, display_name")
    .eq("user_id", actorId)
    .maybeSingle();

  if (!data) return "누군가";
  const row = data as { handle?: string | null; nickname?: string | null; display_name?: string | null };
  if (row.handle) return `@${row.handle}`;
  return row.display_name || row.nickname || "누군가";
}

/** @handle 파싱 없이 특정 사용자 1명에게 멘션 알림 (게시판 답글 등). */
export async function processMentionForUser(params: {
  mentionedUserId: string;
  sourceType: MentionSource;
  sourceId: string;
  actorId: string;
  linkUrl: string;
  notificationContent?: string;
}): Promise<void> {
  if (!params.mentionedUserId || params.mentionedUserId === params.actorId) return;

  const actorLabel = await fetchActorMentionLabel(params.actorId);
  const content =
    params.notificationContent ??
    (params.sourceType === "comment"
      ? `${actorLabel}님이 댓글 답글에서 나를 멘션했습니다.`
      : `${actorLabel}님이 나를 멘션했습니다.`);

  const { error } = await supabase.from("mentions").upsert(
    {
      source_type: params.sourceType,
      source_id: params.sourceId,
      mentioned_user_id: params.mentionedUserId,
      actor_id: params.actorId,
    },
    { onConflict: "source_type,source_id,mentioned_user_id" },
  );

  if (error && !error.message.toLowerCase().includes("does not exist")) {
    console.warn("[mentions] upsert single failed:", error.message);
  }

  await createNotification({
    receiverId: params.mentionedUserId,
    senderId: params.actorId,
    type: "MENTION",
    title: "새 멘션",
    content,
    linkUrl: params.linkUrl,
    groupKey: buildGroupKey(["MENTION", params.sourceType, params.sourceId, params.mentionedUserId]),
  });
}

export async function processMentionsForComment(params: {
  text: string;
  commentId: string;
  actorId: string;
  linkUrl: string;
}): Promise<void> {
  const actorLabel = await fetchActorMentionLabel(params.actorId);
  await processMentionsFromText({
    text: params.text,
    sourceType: "comment",
    sourceId: params.commentId,
    actorId: params.actorId,
    notificationTitle: "새 멘션",
    notificationContent: `${actorLabel}님이 댓글에서 나를 멘션했습니다.`,
    linkUrl: params.linkUrl,
  });
}

/** 피드 댓글: 팔로우한 계정의 @handle만 멘션 알림. */
export async function processMentionsForFeedComment(params: {
  text: string;
  commentId: string;
  actorId: string;
  linkUrl: string;
}): Promise<void> {
  const handles = extractHandlesFromText(params.text);
  if (handles.length === 0) return;

  const followed = await fetchFollowedMentionCandidates(params.actorId);
  const allowedHandles = new Set(followed.map((row) => row.handle.toLowerCase()));
  const allowedText = handles
    .filter((handle) => allowedHandles.has(handle))
    .map((handle) => `@${handle}`)
    .join(" ");
  if (!allowedText.trim()) return;

  const actorLabel = await fetchActorMentionLabel(params.actorId);
  await processMentionsFromText({
    text: allowedText,
    sourceType: "comment",
    sourceId: params.commentId,
    actorId: params.actorId,
    notificationTitle: "새 멘션",
    notificationContent: `${actorLabel}님이 피드 댓글에서 나를 멘션했습니다.`,
    linkUrl: params.linkUrl,
  });
}

export async function processMentionsForFeedPost(params: {
  text: string;
  postId: string;
  actorId: string;
}): Promise<void> {
  const handles = extractHandlesFromText(params.text);
  if (handles.length === 0) return;

  const followed = await fetchFollowedMentionCandidates(params.actorId);
  const allowedHandles = new Set(followed.map((row) => row.handle.toLowerCase()));
  const allowedText = handles
    .filter((handle) => allowedHandles.has(handle))
    .map((handle) => `@${handle}`)
    .join(" ");
  if (!allowedText.trim()) return;

  const actorLabel = await fetchActorMentionLabel(params.actorId);
  await processMentionsFromText({
    text: allowedText,
    sourceType: "post",
    sourceId: params.postId,
    actorId: params.actorId,
    notificationTitle: "새 멘션",
    notificationContent: `${actorLabel}님이 피드에서 나를 멘션했습니다.`,
    linkUrl: `/feed?post=${encodeURIComponent(params.postId)}`,
  });
}

type ProcessMentionsParams = {
  text: string | null | undefined;
  sourceType: MentionSource;
  sourceId: string;
  actorId: string;
  notificationTitle: string;
  notificationContent: string;
  linkUrl: string;
};

export async function processMentionsFromText(params: ProcessMentionsParams): Promise<void> {
  const handles = extractHandlesFromText(params.text);
  if (handles.length === 0) return;

  const resolved = await resolveHandlesToUserIds(handles);
  if (resolved.length === 0) return;

  const targetIds = resolved
    .map((row) => row.userId)
    .filter((id) => id && id !== params.actorId);
  if (targetIds.length === 0) return;

  const records = targetIds.map((mentionedUserId) => ({
    source_type: params.sourceType,
    source_id: params.sourceId,
    mentioned_user_id: mentionedUserId,
    actor_id: params.actorId,
  }));

  const { error } = await supabase
    .from("mentions")
    .upsert(records, { onConflict: "source_type,source_id,mentioned_user_id" });

  if (error && !error.message.toLowerCase().includes("does not exist")) {
    console.warn("[mentions] upsert failed:", error.message);
  }

  await Promise.all(
    targetIds.map((mentionedUserId) =>
      createNotification({
        receiverId: mentionedUserId,
        senderId: params.actorId,
        type: "MENTION",
        title: params.notificationTitle,
        content: params.notificationContent,
        linkUrl: params.linkUrl,
        groupKey: buildGroupKey(["MENTION", params.sourceType, params.sourceId]),
      }),
    ),
  );
}
