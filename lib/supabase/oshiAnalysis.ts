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

function compareOshiAnalysisCharacterNames(
  a: OshiAnalysisCharacter,
  b: OshiAnalysisCharacter,
): number {
  const byName = a.name.localeCompare(b.name, "ko", { sensitivity: "base" });
  if (byName !== 0) return byName;

  const aOriginal = a.original_name ?? "";
  const bOriginal = b.original_name ?? "";
  const byOriginal = aOriginal.localeCompare(bOriginal, "ko", { sensitivity: "base" });
  if (byOriginal !== 0) return byOriginal;

  return a.id.localeCompare(b.id);
}

export function sortOshiAnalysisCharactersByName(
  characters: OshiAnalysisCharacter[],
): OshiAnalysisCharacter[] {
  return [...characters].sort(compareOshiAnalysisCharacterNames);
}

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

  const { data, error } = await req;

  if (error) {
    console.error("[oshiAnalysis] search error:", error.message);
    return [];
  }

  const sorted = sortOshiAnalysisCharactersByName(
    (data ?? []) as OshiAnalysisCharacter[],
  );
  return sorted.slice(offset, offset + limit);
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

  return orderOshiAnalysisCharacters(ids, (data ?? []) as OshiAnalysisCharacter[]);
}

export function orderOshiAnalysisCharacters(
  ids: string[],
  characters: OshiAnalysisCharacter[],
): OshiAnalysisCharacter[] {
  const byId = new Map(characters.map((character) => [character.id, character]));
  return ids
    .map((id) => byId.get(id))
    .filter((character): character is OshiAnalysisCharacter => Boolean(character));
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
    .map((char) => ({
      char,
      overlap: scoreTagOverlap([...(char.tags ?? []), ...(char.meme_tags ?? [])], tagSet),
    }))
    .filter((s) => s.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap || a.char.sort_order - b.char.sort_order);

  return scored.slice(0, limit).map((s) => s.char);
}

function scoreTagOverlap(charTags: string[], tagSet: Set<string>): number {
  return charTags.reduce((sum, tag) => sum + (tagSet.has(tag) ? 1 : 0), 0);
}

/**
 * 시그니처 태그와 맞는 캐릭터를 작품(work) 단위로 묶어 추천한다.
 * 캐릭터 추천과 달리, 한 작품 안의 태그 겹침을 합산해 작품 순위를 매긴다.
 */
export async function getOshiWorkRecommendations(
  tags: string[],
  excludeWorkIds: string[],
  limit = 5,
): Promise<OshiAnalysisWork[]> {
  if (!tags.length) return [];

  const excludeSet = new Set(excludeWorkIds);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("official_oshi_characters")
    .select(CHARACTER_SELECT)
    .eq("status", "PUBLISHED")
    .overlaps("tags", tags)
    .limit(300);

  if (error) {
    console.error("[oshiAnalysis] work recommendation error:", error.message);
    return [];
  }

  const tagSet = new Set(tags);
  const workScores = new Map<string, { work: OshiAnalysisWork; score: number; matches: number }>();

  for (const char of (data ?? []) as OshiAnalysisCharacter[]) {
    const work = char.official_works;
    if (!work || excludeSet.has(work.id)) continue;

    const overlap = scoreTagOverlap([...(char.tags ?? []), ...(char.meme_tags ?? [])], tagSet);
    if (overlap === 0) continue;

    const prev = workScores.get(work.id);
    if (prev) {
      prev.score += overlap;
      prev.matches += 1;
    } else {
      workScores.set(work.id, { work, score: overlap, matches: 1 });
    }
  }

  return [...workScores.values()]
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.matches - a.matches ||
        a.work.title.localeCompare(b.work.title, "ko", { sensitivity: "base" }),
    )
    .slice(0, limit)
    .map((entry) => entry.work);
}
