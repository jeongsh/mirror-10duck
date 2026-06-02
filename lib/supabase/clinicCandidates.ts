import { supabase } from "./client";
import { mapWorkToClinicCandidate, mergeCandidates, FALLBACK_CANDIDATES } from "@/lib/clinic/workMapping";
import type { AnimeCandidate } from "@/lib/clinic/types";

export async function getClinicCandidates(limit = 120): Promise<AnimeCandidate[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("official_works")
    .select(
      "title, original_title, genres, episode_count, end_date, synopsis, cover_image_url",
    )
    .eq("status", "PUBLISHED")
    .eq("category", "anime")
    .order("sort_order", { ascending: true })
    .order("title", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("[clinic] candidate fetch error:", error.message);
    return FALLBACK_CANDIDATES;
  }

  const mapped = ((data ?? []) as Parameters<typeof mapWorkToClinicCandidate>[0][]).map(
    mapWorkToClinicCandidate,
  );

  // DB 후보가 충분하면 시드(FALLBACK)를 강제로 섞지 않는다. 시드가 항상 풀에 들어가면
  // 카구야/토라도라 같은 시드 작품이 반복 노출되므로, 후보가 적을 때만 백필로 보충한다.
  if (mapped.length >= 24) {
    const byTitle = new Map<string, AnimeCandidate>();
    for (const item of mapped) byTitle.set(item.title, item);
    return [...byTitle.values()];
  }

  return mergeCandidates(mapped);
}

export function buildCoverMap(candidates: AnimeCandidate[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const c of candidates) {
    if (c.coverImageUrl) map[c.title] = c.coverImageUrl;
  }
  return map;
}
