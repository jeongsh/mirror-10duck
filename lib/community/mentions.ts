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

export async function processMentionsForPost(params: {
  text: string;
  postId: string;
  actorId: string;
  boardSlug: string;
}): Promise<void> {
  const actorLabel = await fetchActorMentionLabel(params.actorId);
  await processMentionsFromText({
    text: params.text,
    sourceType: "post",
    sourceId: params.postId,
    actorId: params.actorId,
    notificationTitle: "새 멘션",
    notificationContent: `${actorLabel}님이 글에서 나를 멘션했습니다.`,
    linkUrl: `/board/${params.boardSlug}/${params.postId}`,
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
