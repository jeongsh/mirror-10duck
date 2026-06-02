import { supabase } from "./client";

export interface AnimeRecommendation {
  title: string;
  reason: string;
}

const V1_TYPE_GENRES: Record<string, string[]> = {
  SDM: ["아이돌", "음악"],
  SDL: ["일상", "로맨스", "코미디"],
  SCM: ["힐링", "일상"],
  SCL: ["힐링", "일상"],
  NDM: ["판타지", "SF", "이세계", "배틀"],
  NDL: ["판타지", "액션", "모험"],
  NCM: ["SF", "심리", "다크 판타지"],
  NCL: ["SF", "심리"],
};

const V2_TYPE_GENRES: Record<string, string[]> = {
  idol: ["아이돌", "음악"],
  munchkin: ["이세계", "판타지"],
  school: ["학원", "청춘"],
  animal: ["힐링", "일상"],
  monster: ["배틀", "판타지"],
  sports: ["스포츠"],
  adventure: ["모험", "판타지"],
  bishounen: ["로맨스"],
  family: ["일상", "힐링"],
};

export async function getAnimeRecommendationsByType(
  version: "v1" | "v2",
  typeCode: string,
  limit = 4,
): Promise<AnimeRecommendation[]> {
  const genres = version === "v1" ? V1_TYPE_GENRES[typeCode] : V2_TYPE_GENRES[typeCode];
  if (!genres?.length) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("official_works")
    .select("title, genres")
    .eq("status", "PUBLISHED")
    .overlaps("genres", genres)
    .order("sort_order", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("[animeRec] fetch error:", error.message);
    return [];
  }

  return (data ?? []).map((work: { title: string; genres: string[] | null }) => ({
    title: work.title,
    reason: (work.genres ?? []).join(" · "),
  }));
}

function normalizeWorkTitle(value: string) {
  return value.toLowerCase().replace(/[\s!?.·\-]/g, "");
}

/** 처방 후보 제목과 DB official_works 표지를 매칭한다. */
export async function getWorkCoversByTitles(
  titles: string[],
): Promise<Record<string, string>> {
  const unique = [...new Set(titles.map((title) => title.trim()).filter(Boolean))];
  if (!unique.length) return {};

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("official_works")
    .select("title, original_title, cover_image_url")
    .eq("status", "PUBLISHED")
    .not("cover_image_url", "is", null)
    .limit(500);

  if (error) {
    console.error("[animeRec] cover fetch error:", error.message);
    return {};
  }

  const byNormalized = new Map<string, string>();
  for (const work of (data ?? []) as Array<{
    title: string;
    original_title: string | null;
    cover_image_url: string;
  }>) {
    byNormalized.set(normalizeWorkTitle(work.title), work.cover_image_url);
    if (work.original_title) {
      byNormalized.set(normalizeWorkTitle(work.original_title), work.cover_image_url);
    }
  }

  const result: Record<string, string> = {};
  for (const title of unique) {
    const cover = byNormalized.get(normalizeWorkTitle(title));
    if (cover) result[title] = cover;
  }
  return result;
}
