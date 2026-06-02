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
  return mergeCandidates(mapped);
}

export function buildCoverMap(candidates: AnimeCandidate[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const c of candidates) {
    if (c.coverImageUrl) map[c.title] = c.coverImageUrl;
  }
  return map;
}
