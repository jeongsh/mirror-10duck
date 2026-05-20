import type {
  OfficialCatalogStatus,
  OfficialWorkCategory,
} from "@/types/official";

export const OFFICIAL_WORK_CATEGORY_OPTIONS: {
  value: OfficialWorkCategory;
  label: string;
}[] = [
  { value: "anime", label: "애니" },
  { value: "manga", label: "만화" },
  { value: "light_novel", label: "라노벨" },
  { value: "webtoon", label: "웹툰" },
  { value: "other", label: "기타" },
];

export const OFFICIAL_CATALOG_STATUS_OPTIONS: {
  value: OfficialCatalogStatus;
  label: string;
}[] = [
  { value: "DRAFT", label: "초안" },
  { value: "PUBLISHED", label: "공개" },
  { value: "HIDDEN", label: "숨김" },
];

export function getWorkCategoryLabel(category: string) {
  return (
    OFFICIAL_WORK_CATEGORY_OPTIONS.find((option) => option.value === category)
      ?.label ?? category
  );
}

export function getCatalogStatusLabel(status: string) {
  return (
    OFFICIAL_CATALOG_STATUS_OPTIONS.find((option) => option.value === status)
      ?.label ?? status
  );
}

export function normalizeOfficialSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}
