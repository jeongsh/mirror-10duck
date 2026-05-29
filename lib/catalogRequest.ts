import type { OfficialWorkCategory } from "@/types/official";

export const CATALOG_REQUEST_REASONS = [
  { value: "analysis", label: "분석에 넣고 싶어요" },
  { value: "worldcup", label: "월드컵 후보로 쓰고 싶어요" },
  { value: "card", label: "카드 만들기에 쓰고 싶어요" },
  { value: "missing_character", label: "작품에는 있는데 캐릭터가 빠졌어요" },
  { value: "missing_work", label: "작품 자체가 DB에 없어요" },
  { value: "other", label: "기타" },
] as const;

export type CatalogRequestReason = (typeof CATALOG_REQUEST_REASONS)[number]["value"];

export const CATALOG_REQUEST_SOURCES = [
  "oshi-analysis",
  "oshi-card",
  "worldcup",
  "profile",
  "play-hub",
] as const;

export type CatalogRequestSource = (typeof CATALOG_REQUEST_SOURCES)[number];

export type CatalogEditChanges = {
  name?: string;
  original_name?: string;
  work_id?: string;
  work_title?: string;
  tags?: string[];
  meme_tags?: string[];
  positions?: string[];
  /** @deprecated 제출 시 tags/meme_tags/positions 전체 배열 사용 */
  tags_add?: string[];
  tags_remove?: string[];
  positions_add?: string[];
  positions_remove?: string[];
  description?: string;
  profile_image_url?: string;
  profile_image_note?: string;
  title?: string;
  original_title?: string;
  category?: OfficialWorkCategory;
  genres?: string[];
  cover_image_note?: string;
  duplicate_note?: string;
};

export function arraysEqual(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((value, index) => value === sortedB[index]);
}

export function mergeTagOptions(catalog: readonly string[], current: string[] | null | undefined) {
  return Array.from(new Set([...catalog, ...(current ?? [])]));
}

export function catalogRequestPath(
  kind: "hub" | "character-add" | "work-add" | "character-edit" | "work-edit",
  options?: {
    id?: string;
    from?: string;
    returnTo?: string;
    q?: string;
    work?: string;
    characterId?: string;
  }
) {
  const params = new URLSearchParams();
  if (options?.from) params.set("from", options.from);
  if (options?.returnTo) params.set("returnTo", options.returnTo);
  if (options?.q) params.set("q", options.q);
  if (options?.work) params.set("work", options.work);
  if (options?.characterId) params.set("characterId", options.characterId);
  const qs = params.toString();

  const paths: Record<typeof kind, string> = {
    hub: "/play/catalog-request",
    "character-add": "/play/catalog-request/character/add",
    "work-add": "/play/catalog-request/work/add",
    "character-edit": `/play/catalog-request/character/${options?.id ?? options?.characterId ?? ""}/edit`,
    "work-edit": `/play/catalog-request/work/${options?.id ?? ""}/edit`,
  };

  return qs ? `${paths[kind]}?${qs}` : paths[kind];
}

export function reasonLabel(value: string) {
  return CATALOG_REQUEST_REASONS.find((r) => r.value === value)?.label ?? value;
}
