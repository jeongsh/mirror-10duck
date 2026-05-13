import type { SupabaseClient } from "@supabase/supabase-js";
import type { PostTagJoin, TagRow } from "@/types/community";

export function makeUserTagSlug(displayName: string): string {
  const trimmed = displayName.trim();
  const asciiSlug = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  if (asciiSlug.length >= 2) return `${asciiSlug}-${Math.random().toString(36).slice(2, 6)}`;
  return `u-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function tagKindAccentClass(kind: TagRow["kind"]): string {
  switch (kind) {
    case "spoiler":
      return "border border-red-300 bg-red-100 text-red-900";
    case "content_warning":
      return "border border-amber-300 bg-amber-100 text-amber-950";
    default:
      return "border border-gray-300 bg-gray-100 text-gray-800";
  }
}

export function dedupeTagsById(rows: TagRow[]): TagRow[] {
  const seen = new Set<string>();
  const out: TagRow[] = [];
  for (const r of rows) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    out.push(r);
  }
  return out;
}

export async function searchTags(
  supabase: SupabaseClient,
  query: string,
  limit = 18,
): Promise<TagRow[]> {
  const q = query.trim();
  if (!q) return [];

  const pattern = `%${q.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;

  const [byDisplay, bySlug, byAlias] = await Promise.all([
    supabase
      .from("tags")
      .select("id, slug, kind, display_name, official")
      .ilike("display_name", pattern)
      .order("official", { ascending: false })
      .limit(limit),
    supabase
      .from("tags")
      .select("id, slug, kind, display_name, official")
      .ilike("slug", pattern)
      .order("official", { ascending: false })
      .limit(limit),
    supabase
      .from("tag_aliases")
      .select("tags(id, slug, kind, display_name, official)")
      .ilike("alias", pattern)
      .limit(limit),
  ]);

  const fromName = dedupeTagsById([
    ...((byDisplay.data ?? []) as TagRow[]),
    ...((bySlug.data ?? []) as TagRow[]),
  ]);
  const fromAlias = (byAlias.data ?? [])
    .map((row: { tags: TagRow | TagRow[] | null }) => {
      const t = row.tags;
      if (Array.isArray(t)) return t[0] ?? null;
      return t;
    })
    .filter(Boolean) as TagRow[];

  return dedupeTagsById([...fromName, ...fromAlias]).slice(0, limit);
}

export async function createUserMetaTag(
  supabase: SupabaseClient,
  displayName: string,
  userId: string,
): Promise<{ data: TagRow | null; error: Error | null }> {
  const slug = makeUserTagSlug(displayName);
  const { data, error } = await supabase
    .from("tags")
    .insert({
      slug,
      kind: "meta",
      display_name: displayName.trim(),
      official: false,
      created_by: userId,
    })
    .select("id, slug, kind, display_name, official")
    .single();

  if (error) return { data: null, error: new Error(error.message) };
  return { data: data as TagRow, error: null };
}

export async function syncPostTags(
  supabase: SupabaseClient,
  postId: string,
  tagIds: string[],
): Promise<{ error: Error | null }> {
  const { error: delErr } = await supabase.from("post_tags").delete().eq("post_id", postId);
  if (delErr) return { error: new Error(delErr.message) };
  if (tagIds.length === 0) return { error: null };

  const { error } = await supabase.from("post_tags").insert(
    tagIds.map((tag_id) => ({
      post_id: postId,
      tag_id,
      weight: 1,
    })),
  );
  if (error) return { error: new Error(error.message) };
  return { error: null };
}

export async function fetchOfficialPresetTags(supabase: SupabaseClient): Promise<TagRow[]> {
  const { data, error } = await supabase
    .from("tags")
    .select("id, slug, kind, display_name, official")
    .eq("official", true)
    .in("slug", ["spoiler", "content-warning"])
    .order("slug");

  if (error) return [];
  return (data ?? []) as TagRow[];
}

/** 글 id 목록에 대한 `post_tags` + `tags` 행. 게시판 목록 등에서 일괄 로드 */
export async function fetchPostTagsByPostIds(
  supabase: SupabaseClient,
  postIds: string[],
): Promise<Map<string, PostTagJoin[]>> {
  const map = new Map<string, PostTagJoin[]>();
  if (postIds.length === 0) return map;

  const { data, error } = await supabase
    .from("post_tags")
    .select("post_id, tag_id, weight, tags(id, slug, kind, display_name, official)")
    .in("post_id", postIds);

  if (error || !data) return map;

  for (const raw of data) {
    const row = raw as PostTagJoin & { tags?: TagRow | TagRow[] | null };
    const pid = row.post_id;
    if (!pid) continue;
    let tag = row.tags ?? null;
    if (Array.isArray(tag)) tag = tag[0] ?? null;
    const normalized: PostTagJoin = { ...row, tags: tag };
    const arr = map.get(pid) ?? [];
    arr.push(normalized);
    map.set(pid, arr);
  }
  return map;
}
