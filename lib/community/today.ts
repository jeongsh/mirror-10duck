import { supabase } from "@/lib/supabase/client";

export type TodayActivitySummary = {
  reactionCount: number;
  commentCount: number;
  replyCount: number;
  newFollowerCount: number;
  total: number;
  generatedAt: string;
};

const EMPTY_SUMMARY: TodayActivitySummary = {
  reactionCount: 0,
  commentCount: 0,
  replyCount: 0,
  newFollowerCount: 0,
  total: 0,
  generatedAt: new Date(0).toISOString(),
};

function startOfTodayISO(now: Date): string {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  return start.toISOString();
}

async function countTable(params: {
  table: string;
  filters: Array<["eq" | "neq" | "gte" | "in", string, string | string[]]>;
}): Promise<number> {
  let query = supabase.from(params.table).select("*", { count: "exact", head: true });

  for (const [op, column, value] of params.filters) {
    if (op === "eq") query = query.eq(column, value as string);
    else if (op === "neq") query = query.neq(column, value as string);
    else if (op === "gte") query = query.gte(column, value as string);
    else if (op === "in") query = query.in(column, value as string[]);
  }

  const { count, error } = await query;
  if (error) {
    console.warn(`[today] count ${params.table} failed:`, error.message);
    return 0;
  }
  return count ?? 0;
}

export async function fetchTodayActivitySummary(
  userId: string,
  now: Date = new Date(),
): Promise<TodayActivitySummary> {
  if (!userId) {
    return { ...EMPTY_SUMMARY, generatedAt: now.toISOString() };
  }

  const todayStart = startOfTodayISO(now);

  const [{ data: myPosts }, { data: myComments }, newFollowerCount] = await Promise.all([
    supabase.from("posts").select("id").eq("author_id", userId),
    supabase.from("comments").select("id").eq("author_id", userId),
    countTable({
      table: "follows_user",
      filters: [
        ["eq", "following_id", userId],
        ["gte", "created_at", todayStart],
      ],
    }),
  ]);

  const myPostIds = (myPosts ?? []).map((row) => row.id as string);
  const myCommentIds = (myComments ?? []).map((row) => row.id as string);

  const reactionCount =
    myPostIds.length > 0
      ? await countTable({
          table: "post_reactions",
          filters: [
            ["in", "post_id", myPostIds],
            ["neq", "user_id", userId],
            ["gte", "created_at", todayStart],
          ],
        })
      : 0;

  const commentCount =
    myPostIds.length > 0
      ? await countTable({
          table: "comments",
          filters: [
            ["in", "post_id", myPostIds],
            ["neq", "author_id", userId],
            ["gte", "created_at", todayStart],
          ],
        })
      : 0;

  const replyCount =
    myCommentIds.length > 0
      ? await countTable({
          table: "comments",
          filters: [
            ["in", "parent_comment_id", myCommentIds],
            ["neq", "author_id", userId],
            ["gte", "created_at", todayStart],
          ],
        })
      : 0;

  const total = reactionCount + commentCount + replyCount + newFollowerCount;

  return {
    reactionCount,
    commentCount,
    replyCount,
    newFollowerCount,
    total,
    generatedAt: new Date().toISOString(),
  };
}

export function summarizeTodayActivity(summary: TodayActivitySummary): string {
  if (summary.total === 0) return "아직 새 활동이 없어요. 글 하나 올려볼까요?";

  const parts: string[] = [];
  if (summary.reactionCount > 0) parts.push(`리액션 ${summary.reactionCount}`);
  if (summary.commentCount > 0) parts.push(`댓글 ${summary.commentCount}`);
  if (summary.replyCount > 0) parts.push(`답글 ${summary.replyCount}`);
  if (summary.newFollowerCount > 0) parts.push(`새 팔로워 ${summary.newFollowerCount}`);

  return `오늘은 ${parts.join(", ")}를 받았어요!`;
}
