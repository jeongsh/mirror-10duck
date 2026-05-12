/** 게시판 분류 — DB `boards.category` 값과 동기화 */
export const BOARD_CATEGORY_KEYS = [
  "general",
  "anime",
  "game",
  "hobby",
  "life",
  "media",
  "other",
] as const;

export type BoardCategory = (typeof BOARD_CATEGORY_KEYS)[number];

export const BOARD_CATEGORY_OPTIONS: { value: BoardCategory; label: string }[] = [
  { value: "general", label: "일반" },
  { value: "anime", label: "애니·만화" },
  { value: "game", label: "게임" },
  { value: "hobby", label: "취미" },
  { value: "life", label: "일상" },
  { value: "media", label: "영상·방송" },
  { value: "other", label: "기타" },
];

const LABEL_BY_VALUE = Object.fromEntries(
  BOARD_CATEGORY_OPTIONS.map((o) => [o.value, o.label]),
) as Record<BoardCategory, string>;

export function boardCategoryLabel(category: string): string {
  return LABEL_BY_VALUE[category as BoardCategory] ?? category;
}

export function isBoardCategory(v: string): v is BoardCategory {
  return (BOARD_CATEGORY_KEYS as readonly string[]).includes(v);
}

export function normalizeBoardCategory(v: string | null | undefined): BoardCategory {
  if (v && isBoardCategory(v)) return v;
  return "general";
}

/** 목록·설정 화면에서의 정렬 순서 */
export const BOARD_CATEGORY_ORDER: BoardCategory[] = BOARD_CATEGORY_KEYS.slice();
