import { supabase } from "./client";
import type { OfficialOshiCharacter, OfficialWork } from "@/types/official";

export type OshiAnalysisWork = Pick<
  OfficialWork,
  "id" | "title" | "original_title" | "category" | "genres" | "cover_image_url"
>;

export type OshiAnalysisCharacter = OfficialOshiCharacter & {
  official_works: OshiAnalysisWork;
};

const CHARACTER_SELECT = [
  "id",
  "work_id",
  "slug",
  "name",
  "original_name",
  "aliases",
  "gender",
  "positions",
  "tags",
  "meme_tags",
  "description",
  "profile_image_url",
  "status",
  "sort_order",
  "created_at",
  "updated_at",
  "official_works!inner(id, title, original_title, category, genres, cover_image_url)",
].join(", ");

export async function searchOshiAnalysisCharacters(
  query: string,
  workId?: string,
  limit = 30,
  offset = 0
): Promise<OshiAnalysisCharacter[]> {
  const trimmed = query.trim();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let req = (supabase as any)
    .from("official_oshi_characters")
    .select(CHARACTER_SELECT)
    .eq("status", "PUBLISHED");

  if (workId) {
    req = req.eq("work_id", workId);
  }

  if (trimmed) {
    req = req.or(`name.ilike.%${trimmed}%,original_name.ilike.%${trimmed}%`);
  }

  const { data, error } = await req
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("[oshiAnalysis] search error:", error.message);
    return [];
  }

  return (data ?? []) as OshiAnalysisCharacter[];
}

export async function searchOshiAnalysisWorks(
  query: string,
  limit = 10
): Promise<OshiAnalysisWork[]> {
  const trimmed = query.trim();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let req = (supabase as any)
    .from("official_works")
    .select("id, title, original_title, category, genres, cover_image_url")
    .eq("status", "PUBLISHED");

  if (trimmed) {
    req = req.or(`title.ilike.%${trimmed}%,original_title.ilike.%${trimmed}%`);
  }

  const { data, error } = await req
    .order("sort_order", { ascending: true })
    .order("title", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("[oshiAnalysis] work search error:", error.message);
    return [];
  }

  return (data ?? []) as OshiAnalysisWork[];
}

export async function getOshiAnalysisCharactersByIds(
  ids: string[]
): Promise<OshiAnalysisCharacter[]> {
  if (!ids.length) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("official_oshi_characters")
    .select(CHARACTER_SELECT)
    .in("id", ids)
    .eq("status", "PUBLISHED");

  if (error) {
    console.error("[oshiAnalysis] fetch by ids error:", error.message);
    return [];
  }

  return (data ?? []) as OshiAnalysisCharacter[];
}

/**
 * 시그니처 태그와 가장 많이 겹치는 (선택하지 않은) 캐릭터를 추천한다.
 * 후보를 DB에서 받아 클라이언트에서 태그 겹침 수로 정렬한다.
 */
export async function getOshiRecommendations(
  tags: string[],
  excludeIds: string[],
  limit = 3
): Promise<OshiAnalysisCharacter[]> {
  if (!tags.length) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let req = (supabase as any)
    .from("official_oshi_characters")
    .select(CHARACTER_SELECT)
    .eq("status", "PUBLISHED")
    .overlaps("tags", tags);

  if (excludeIds.length) {
    req = req.not("id", "in", `(${excludeIds.map((id) => `"${id}"`).join(",")})`);
  }

  const { data, error } = await req.limit(120);

  if (error) {
    console.error("[oshiAnalysis] recommendation error:", error.message);
    return [];
  }

  const tagSet = new Set(tags);
  const scored = ((data ?? []) as OshiAnalysisCharacter[])
    .map((char) => {
      const charTags = [...(char.tags ?? []), ...(char.meme_tags ?? [])];
      const overlap = charTags.reduce((sum, tag) => sum + (tagSet.has(tag) ? 1 : 0), 0);
      return { char, overlap };
    })
    .filter((s) => s.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap || a.char.sort_order - b.char.sort_order);

  return scored.slice(0, limit).map((s) => s.char);
}
