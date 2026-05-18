import { supabase } from "@/lib/supabase/client";

export type UnrepliedItemSource = "post_comment" | "comment_reply" | "mention";

export type UnrepliedItem = {
  source: UnrepliedItemSource;
  commentId: string | null;
  postId: string | null;
  postTitle: string | null;
  parentCommentId: string | null;
  preview: string;
  authorLabel: string | null;
  createdAt: string;
  linkUrl: string;
};

export type UnrepliedQueue = {
  items: UnrepliedItem[];
  total: number;
};

const PREVIEW_LIMIT = 60;

function truncate(text: string, max = PREVIEW_LIMIT): string {
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function commentPreview(content: string | null, stickerToken: string | null): string {
  if (content && content.trim().length > 0) return truncate(content.trim());
  if (stickerToken) return "(스티커)";
  return "(내용 없음)";
}

function postPath(slug: string | null, postId: string | null, commentId: string | null): string {
  if (!slug || !postId) return "/notifications";
  if (commentId) return `/board/${slug}/${postId}#comment-${commentId}`;
  return `/board/${slug}/${postId}`;
}

type PostMeta = { id: string; title: string | null; slug: string | null };

function flattenBoards(value: unknown): { slug: string | null } | null {
  if (!value) return null;
  if (Array.isArray(value)) {
    const head = value[0];
    if (head && typeof head === "object" && "slug" in (head as Record<string, unknown>)) {
      return { slug: ((head as Record<string, unknown>).slug as string) ?? null };
    }
    return null;
  }
  if (typeof value === "object" && "slug" in (value as Record<string, unknown>)) {
    return { slug: ((value as Record<string, unknown>).slug as string) ?? null };
  }
  return null;
}

async function fetchPostMetaMap(postIds: string[]): Promise<Map<string, PostMeta>> {
  if (postIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from("posts")
    .select("id, title, boards(slug)")
    .in("id", postIds);
  if (error) {
    console.warn("[unreplied] fetch post meta failed:", error.message);
    return new Map();
  }
  const out = new Map<string, PostMeta>();
  for (const row of (data ?? []) as Array<{ id: string; title: string | null; boards: unknown }>) {
    out.set(row.id, {
      id: row.id,
      title: row.title,
      slug: flattenBoards(row.boards)?.slug ?? null,
    });
  }
  return out;
}

export async function fetchUnrepliedQueue(
  userId: string,
  limit = 20,
): Promise<UnrepliedQueue> {
  if (!userId) return { items: [], total: 0 };

  const [postCommentItems, replyItems, mentionItems] = await Promise.all([
    fetchUnrepliedPostComments(userId, limit),
    fetchUnrepliedCommentReplies(userId, limit),
    fetchUnrepliedMentions(userId, limit),
  ]);

  const merged = [...postCommentItems, ...replyItems, ...mentionItems]
    .filter((item, index, arr) => {
      if (!item.commentId) return true;
      return arr.findIndex((other) => other.commentId === item.commentId) === index;
    })
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  return {
    items: merged.slice(0, limit),
    total: merged.length,
  };
}

async function fetchUnrepliedPostComments(userId: string, limit: number): Promise<UnrepliedItem[]> {
  const { data: myPosts, error: postsError } = await supabase
    .from("posts")
    .select("id, title, boards(slug)")
    .eq("author_id", userId);

  if (postsError) {
    console.warn("[unreplied] fetch posts failed:", postsError.message);
    return [];
  }

  const postRows = (myPosts ?? []) as Array<{
    id: string;
    title: string | null;
    boards: unknown;
  }>;
  if (postRows.length === 0) return [];

  const metaByPostId = new Map<string, PostMeta>();
  for (const row of postRows) {
    metaByPostId.set(row.id, {
      id: row.id,
      title: row.title,
      slug: flattenBoards(row.boards)?.slug ?? null,
    });
  }
  const postIds = Array.from(metaByPostId.keys());

  const { data: rootComments, error: rootError } = await supabase
    .from("comments")
    .select("id, post_id, author_id, content, sticker_token, created_at, parent_comment_id, status")
    .in("post_id", postIds)
    .is("parent_comment_id", null)
    .neq("author_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit * 3);

  if (rootError) {
    console.warn("[unreplied] fetch root comments failed:", rootError.message);
    return [];
  }

  const candidates = (rootComments ?? []) as Array<{
    id: string;
    post_id: string;
    author_id: string | null;
    content: string | null;
    sticker_token: string | null;
    created_at: string;
    parent_comment_id: string | null;
    status: string | null;
  }>;

  if (candidates.length === 0) return [];

  const visibleCandidates = candidates.filter(
    (row) => row.status === null || row.status === "active" || row.status === "visible",
  );
  if (visibleCandidates.length === 0) return [];

  const rootIds = visibleCandidates.map((row) => row.id);

  const { data: myReplies, error: repliesError } = await supabase
    .from("comments")
    .select("parent_comment_id")
    .in("parent_comment_id", rootIds)
    .eq("author_id", userId);

  if (repliesError) {
    console.warn("[unreplied] fetch my replies failed:", repliesError.message);
  }

  const repliedTo = new Set<string>(
    ((myReplies ?? []) as Array<{ parent_comment_id: string | null }>)
      .map((row) => row.parent_comment_id)
      .filter((value): value is string => Boolean(value)),
  );

  return visibleCandidates
    .filter((row) => !repliedTo.has(row.id))
    .map((row) => {
      const meta = metaByPostId.get(row.post_id);
      return {
        source: "post_comment" as const,
        commentId: row.id,
        postId: row.post_id,
        postTitle: meta?.title ?? null,
        parentCommentId: null,
        preview: commentPreview(row.content, row.sticker_token),
        authorLabel: null,
        createdAt: row.created_at,
        linkUrl: postPath(meta?.slug ?? null, row.post_id, row.id),
      };
    });
}

async function fetchUnrepliedCommentReplies(userId: string, limit: number): Promise<UnrepliedItem[]> {
  const { data: myComments, error: myCommentsError } = await supabase
    .from("comments")
    .select("id, post_id")
    .eq("author_id", userId);

  if (myCommentsError) {
    console.warn("[unreplied] fetch my comments failed:", myCommentsError.message);
    return [];
  }

  const myCommentRows = (myComments ?? []) as Array<{ id: string; post_id: string | null }>;
  if (myCommentRows.length === 0) return [];

  const myCommentIds = myCommentRows.map((row) => row.id);
  const postIdByCommentId = new Map<string, string | null>();
  for (const row of myCommentRows) postIdByCommentId.set(row.id, row.post_id);

  const { data: replies, error: repliesError } = await supabase
    .from("comments")
    .select("id, post_id, author_id, content, sticker_token, created_at, parent_comment_id, status")
    .in("parent_comment_id", myCommentIds)
    .neq("author_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit * 3);

  if (repliesError) {
    console.warn("[unreplied] fetch replies failed:", repliesError.message);
    return [];
  }

  const replyRows = (replies ?? []) as Array<{
    id: string;
    post_id: string | null;
    author_id: string | null;
    content: string | null;
    sticker_token: string | null;
    created_at: string;
    parent_comment_id: string | null;
    status: string | null;
  }>;

  const visibleReplies = replyRows.filter(
    (row) => row.status === null || row.status === "active" || row.status === "visible",
  );
  if (visibleReplies.length === 0) return [];

  const replyIds = visibleReplies.map((row) => row.id);

  const { data: replyReplies, error: replyRepliesError } = await supabase
    .from("comments")
    .select("parent_comment_id")
    .in("parent_comment_id", replyIds)
    .eq("author_id", userId);

  if (replyRepliesError) {
    console.warn("[unreplied] fetch reply replies failed:", replyRepliesError.message);
  }

  const repliedTo = new Set<string>(
    ((replyReplies ?? []) as Array<{ parent_comment_id: string | null }>)
      .map((row) => row.parent_comment_id)
      .filter((value): value is string => Boolean(value)),
  );

  const candidates = visibleReplies.filter((row) => !repliedTo.has(row.id));
  const relevantPostIds = Array.from(
    new Set(
      candidates
        .map((row) => row.post_id ?? postIdByCommentId.get(row.parent_comment_id ?? "") ?? null)
        .filter((value): value is string => Boolean(value)),
    ),
  );

  const postMeta = await fetchPostMetaMap(relevantPostIds);

  return candidates.map((row) => {
    const resolvedPostId =
      row.post_id ?? postIdByCommentId.get(row.parent_comment_id ?? "") ?? null;
    const meta = resolvedPostId ? postMeta.get(resolvedPostId) ?? null : null;
    return {
      source: "comment_reply" as const,
      commentId: row.id,
      postId: resolvedPostId,
      postTitle: meta?.title ?? null,
      parentCommentId: row.parent_comment_id,
      preview: commentPreview(row.content, row.sticker_token),
      authorLabel: null,
      createdAt: row.created_at,
      linkUrl: postPath(meta?.slug ?? null, resolvedPostId, row.id),
    };
  });
}

async function fetchUnrepliedMentions(userId: string, limit: number): Promise<UnrepliedItem[]> {
  const { data, error } = await supabase
    .from("mentions")
    .select("id, source_type, source_id, created_at")
    .eq("mentioned_user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (error.code === "PGRST205" || error.message.toLowerCase().includes("does not exist")) {
      return [];
    }
    console.warn("[unreplied] fetch mentions failed:", error.message);
    return [];
  }

  const rows = (data ?? []) as Array<{
    id: string;
    source_type: "post" | "comment";
    source_id: string;
    created_at: string;
  }>;

  if (rows.length === 0) return [];

  const postIds = rows.filter((row) => row.source_type === "post").map((row) => row.source_id);
  const commentIds = rows.filter((row) => row.source_type === "comment").map((row) => row.source_id);

  const [postMetaMap, commentMap] = await Promise.all([
    fetchPostMetaMap(postIds),
    fetchCommentPreviews(commentIds),
  ]);

  const commentPostIds = Array.from(
    new Set(
      Array.from(commentMap.values())
        .map((comment) => comment.post_id)
        .filter((value): value is string => Boolean(value)),
    ),
  );
  const commentPostMetaMap = await fetchPostMetaMap(commentPostIds);

  return rows.map((row) => {
    if (row.source_type === "post") {
      const meta = postMetaMap.get(row.source_id);
      return {
        source: "mention" as const,
        commentId: null,
        postId: row.source_id,
        postTitle: meta?.title ?? null,
        parentCommentId: null,
        preview: truncate(meta?.title ?? "글에서 멘션됨"),
        authorLabel: null,
        createdAt: row.created_at,
        linkUrl: postPath(meta?.slug ?? null, row.source_id, null),
      };
    }

    const comment = commentMap.get(row.source_id);
    const meta = comment?.post_id ? commentPostMetaMap.get(comment.post_id) ?? null : null;
    return {
      source: "mention" as const,
      commentId: row.source_id,
      postId: comment?.post_id ?? null,
      postTitle: meta?.title ?? null,
      parentCommentId: null,
      preview: comment ? commentPreview(comment.content, comment.sticker_token) : "댓글에서 멘션됨",
      authorLabel: null,
      createdAt: row.created_at,
      linkUrl: postPath(meta?.slug ?? null, comment?.post_id ?? null, row.source_id),
    };
  });
}

async function fetchCommentPreviews(
  commentIds: string[],
): Promise<Map<string, { post_id: string | null; content: string | null; sticker_token: string | null }>> {
  if (commentIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from("comments")
    .select("id, post_id, content, sticker_token")
    .in("id", commentIds);
  if (error) {
    console.warn("[unreplied] fetch comment previews failed:", error.message);
    return new Map();
  }
  const out = new Map<
    string,
    { post_id: string | null; content: string | null; sticker_token: string | null }
  >();
  for (const row of (data ?? []) as Array<{
    id: string;
    post_id: string | null;
    content: string | null;
    sticker_token: string | null;
  }>) {
    out.set(row.id, {
      post_id: row.post_id,
      content: row.content,
      sticker_token: row.sticker_token,
    });
  }
  return out;
}

export function summarizeUnreplied(queue: UnrepliedQueue): string {
  if (queue.total === 0) return "답장 다 했어요. 멋져요!";
  const head = queue.items[0];
  if (!head) return `답장 안 한 댓글이 ${queue.total}개 있어요`;
  const preview = head.preview ? ` (${head.preview})` : "";
  return `답장 안 한 댓글이 ${queue.total}개 있어요${preview}`;
}
