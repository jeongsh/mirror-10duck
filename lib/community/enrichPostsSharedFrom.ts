import { supabase } from "@/lib/supabase/client";
import type { CommunityPost, PostSharedFrom, UserProfile } from "@/types/community";

function firstOrSelf<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function rowToSharedFrom(row: Record<string, unknown>): PostSharedFrom {
  return {
    id: row.id as string,
    title: (row.title as string | null) ?? null,
    author_id: (row.author_id as string | null) ?? null,
    board_id: (row.board_id as string | null) ?? null,
    source_type: row.source_type as PostSharedFrom["source_type"],
    profiles: firstOrSelf(row.profiles as UserProfile | UserProfile[] | null) ?? null,
    boards: firstOrSelf(row.boards as PostSharedFrom["boards"] | PostSharedFrom["boards"][]) ?? null,
  };
}

/**
 * 피드/프로필 등에서 `origin_post_id`만 있는 글에 원 작성자·게시판 링크용 스냅샷을 붙인다.
 */
export async function enrichPostsSharedFrom(posts: CommunityPost[]): Promise<CommunityPost[]> {
  const ids = [...new Set(posts.map((p) => p.origin_post_id).filter(Boolean))] as string[];
  if (ids.length === 0) return posts;

  const { data, error } = await supabase
    .from("posts")
    .select("id, title, author_id, board_id, source_type, profiles(*), boards(slug, name)")
    .in("id", ids);

  if (error || !data) {
    console.warn("[enrichPostsSharedFrom]", error?.message);
    return posts.map((p) =>
      p.origin_post_id ? { ...p, shared_from: null } : { ...p },
    );
  }

  const map = new Map<string, PostSharedFrom>();
  for (const row of data as Record<string, unknown>[]) {
    const normalized = rowToSharedFrom(row);
    map.set(normalized.id, normalized);
  }

  return posts.map((p) => {
    if (!p.origin_post_id) return p;
    return { ...p, shared_from: map.get(p.origin_post_id) ?? null };
  });
}
