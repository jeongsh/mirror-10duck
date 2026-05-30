import { supabase } from "@/lib/supabase/client";
import type { OshiAnalysisCharacter } from "@/lib/supabase/oshiAnalysis";
import type { CharacterTrait, InterestField, PreferredGenre } from "@/lib/fortune/dailyFortune";
import { hashSeed, pickFromSeed } from "@/lib/fortune/seed";

const CHARACTER_SELECT = [
  "id",
  "work_id",
  "slug",
  "name",
  "original_name",
  "tags",
  "meme_tags",
  "profile_image_url",
  "sort_order",
  "official_works!inner(id, title, category, genres, cover_image_url)",
].join(", ");

export type FortuneRecommendedCharacter = {
  id: string;
  name: string;
  workTitle: string;
  workId: string;
  imageUrl: string | null;
};

const TRAIT_TO_TAGS: Record<CharacterTrait, string[]> = {
  열혈: ["열혈", "정의감"],
  쿨: ["냉정", "쿨데레"],
  다정함: ["다정", "순애"],
  츤데레: ["츤데레", "갭모에"],
  천재: ["천재", "지능캐"],
  노력형: ["노력파", "성장형"],
  장난기: ["능글", "밝음"],
  신비로움: ["미스터리", "카리스마"],
  보호자형: ["자기희생", "서포터"],
  라이벌형: ["라이벌"],
};

const GENRE_TO_LABELS: Record<PreferredGenre, string[]> = {
  action: ["액션", "전투"],
  fantasy: ["판타지", "모험"],
  romance: ["로맨스", "순애"],
  daily: ["일상", "학원"],
  comedy: ["개그", "코미디"],
  sports: ["스포츠"],
  mystery: ["미스터리", "추리"],
  sf: ["SF", "SF·기타"],
  idol: ["아이돌", "음악"],
  healing: ["치유", "힐링"],
  horror: ["공포", "호러"],
  other: [],
};

const INTEREST_TO_CATEGORY: Record<InterestField, string[]> = {
  anime: ["anime"],
  manga: ["manga"],
  game: ["other"],
  vtuber: ["other"],
  light_novel: ["light_novel"],
  other: [],
};

type ScoredCandidate = {
  char: OshiAnalysisCharacter;
  score: number;
};

export async function fetchFortuneCharacterCandidates(tags: string[]): Promise<OshiAnalysisCharacter[]> {
  if (!tags.length) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("official_oshi_characters")
    .select(CHARACTER_SELECT)
    .eq("status", "PUBLISHED")
    .overlaps("tags", tags)
    .limit(150);

  if (error) {
    console.error("[fortune] character fetch error:", error.message);
    return [];
  }

  return (data ?? []) as OshiAnalysisCharacter[];
}

export function buildMatchTags(
  finalTags: string[],
  trait: CharacterTrait,
): string[] {
  const traitTags = TRAIT_TO_TAGS[trait] ?? [];
  return Array.from(new Set([...finalTags, ...traitTags]));
}

export function scoreFortuneCharacter(
  char: OshiAnalysisCharacter,
  finalTags: string[],
  interest: InterestField,
  genre: PreferredGenre,
  recentCharacterIds: string[],
  recentWorkIds: string[],
): number {
  const charTags = new Set([...(char.tags ?? []), ...(char.meme_tags ?? [])]);
  const positions = char.positions ?? [];
  let score = 0;

  for (const tag of finalTags) {
    if (charTags.has(tag)) score += 10;
    if (positions.includes(tag as never)) score += 10;
  }

  const genreLabels = GENRE_TO_LABELS[genre] ?? [];
  const workGenres = char.official_works?.genres ?? [];
  if (genreLabels.some((g) => workGenres.some((wg) => wg.includes(g) || g.includes(wg)))) {
    score += 5;
  }

  const categories = INTEREST_TO_CATEGORY[interest] ?? [];
  const workCategory = char.official_works?.category ?? "";
  if (categories.includes(workCategory)) score += 5;

  if (recentCharacterIds.includes(char.id)) score -= 10;

  const workId = char.work_id ?? char.official_works?.id;
  if (workId && recentWorkIds.includes(workId)) score -= 5;

  return score;
}

export async function matchFortuneCharacter(options: {
  finalTags: string[];
  trait: CharacterTrait;
  interest: InterestField;
  genre: PreferredGenre;
  personalSeed: string;
  recentCharacterIds: string[];
  recentWorkIds: string[];
}): Promise<FortuneRecommendedCharacter | null> {
  const searchTags = buildMatchTags(options.finalTags, options.trait);
  const candidates = await fetchFortuneCharacterCandidates(searchTags);
  if (!candidates.length) return null;

  const scored: ScoredCandidate[] = candidates
    .map((char) => ({
      char,
      score: scoreFortuneCharacter(
        char,
        options.finalTags,
        options.interest,
        options.genre,
        options.recentCharacterIds,
        options.recentWorkIds,
      ),
    }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.char.sort_order - b.char.sort_order);

  if (!scored.length) return null;

  const topScore = scored[0].score;
  const tied = scored.filter((s) => s.score === topScore);
  const picked = pickFromSeed(
    tied.map((t) => t.char),
    `${options.personalSeed}|character`,
  );

  return {
    id: picked.id,
    name: picked.name,
    workTitle: picked.official_works?.title ?? "",
    workId: picked.work_id,
    imageUrl: picked.profile_image_url ?? picked.official_works?.cover_image_url ?? null,
  };
}

export const RECENT_CHARACTERS_KEY = "10duck:fortune-recent-characters";
const RECENT_MAX = 12;

export function loadRecentFortuneCharacters(): { ids: string[]; workIds: string[] } {
  if (typeof window === "undefined") return { ids: [], workIds: [] };
  try {
    const raw = window.localStorage.getItem(RECENT_CHARACTERS_KEY);
    if (!raw) return { ids: [], workIds: [] };
    const parsed = JSON.parse(raw) as { ids?: string[]; workIds?: string[] };
    return {
      ids: parsed.ids ?? [],
      workIds: parsed.workIds ?? [],
    };
  } catch {
    return { ids: [], workIds: [] };
  }
}

export function saveRecentFortuneCharacter(id: string, workId: string): void {
  if (typeof window === "undefined") return;
  const prev = loadRecentFortuneCharacters();
  const ids = [id, ...prev.ids.filter((x) => x !== id)].slice(0, RECENT_MAX);
  const workIds = [workId, ...prev.workIds.filter((x) => x !== workId)].slice(0, RECENT_MAX);
  window.localStorage.setItem(RECENT_CHARACTERS_KEY, JSON.stringify({ ids, workIds }));
}
