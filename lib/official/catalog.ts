import type {
  OfficialCharacterPosition,
  OfficialCatalogStatus,
  OfficialWorkCategory,
} from "@/types/official";

export const OFFICIAL_WORK_CATEGORY_OPTIONS: {
  value: OfficialWorkCategory;
  label: string;
}[] = [
  { value: "anime", label: "애니" },
  { value: "manga", label: "만화" },
  { value: "light_novel", label: "라이트노벨" },
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

export const OFFICIAL_CHARACTER_POSITIONS: OfficialCharacterPosition[] = [
  "주인공",
  "서브주인공",
  "히로인",
  "라이벌",
  "빌런",
  "조력자",
  "스승",
  "마스코트",
  "흑막",
  "최종보스",
  "기타",
];

export const OFFICIAL_CHARACTER_TAGS = [
  "냉정",
  "열혈",
  "밝음",
  "소심",
  "다정",
  "까칠",
  "능글",
  "무뚝뚝",
  "순수",
  "현실주의",
  "정의감",
  "자기희생",
  "허세",
  "독설",
  "츤데레",
  "쿨데레",
  "얀데레",
  "갭모에",
  "순애",
  "집착",
  "처연",
  "병약",
  "미스터리",
  "카리스마",
  "귀여움",
  "섹시함",
  "엄마미",
  "아빠미",
  "성장형",
  "복수자",
  "구원서사",
  "타락",
  "희생",
  "트라우마",
  "고독",
  "비극",
  "배신",
  "재기",
  "운명",
  "이중생활",
  "천재",
  "먼치킨",
  "노력파",
  "전략가",
  "리더",
  "서포터",
  "전투캐",
  "지능캐",
  "힐러",
  "마법사",
  "검사",
  "저격수",
  "파일럿",
];

export const OFFICIAL_CHARACTER_MEME_TAGS = [
  "작가가 굴림",
  "죽을수록 인기 많음",
  "밈캐",
  "짤 생성기",
  "얼굴은 천사 성격은 재앙",
  "멘탈이 이미 박살남",
  "세계관 최강자 후보",
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

export function splitList(value: string) {
  return value
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function uniqueList(values: string[]) {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)));
}

export function joinList(value: string[] | null | undefined) {
  return Array.isArray(value) ? value.join(", ") : "";
}
