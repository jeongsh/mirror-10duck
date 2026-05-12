import {
  BOARD_CATEGORY_KEYS,
  normalizeBoardCategory,
  type BoardCategory,
} from "@/lib/community/boardCategories";
import type { Board } from "@/types/community";

export type BoardCategoryOrderRow = {
  category: string;
  position: number;
};

/** DB `board_category_order` 행 기준으로 섹션 순서 결정 (행 없으면 기본 키 순) */
export function orderedCategoriesFromRows(
  rows: BoardCategoryOrderRow[] | null | undefined,
): BoardCategory[] {
  const pos = new Map<BoardCategory, number>();
  for (const r of rows ?? []) {
    pos.set(normalizeBoardCategory(r.category), r.position);
  }
  return [...BOARD_CATEGORY_KEYS].sort((a, b) => {
    const pa = pos.has(a) ? pos.get(a)! : BOARD_CATEGORY_KEYS.indexOf(a) * 10;
    const pb = pos.has(b) ? pos.get(b)! : BOARD_CATEGORY_KEYS.indexOf(b) * 10;
    if (pa !== pb) return pa - pb;
    return BOARD_CATEGORY_KEYS.indexOf(a) - BOARD_CATEGORY_KEYS.indexOf(b);
  });
}

export function sortBoardsForDisplay(a: Board, b: Board): number {
  const ao = a.sort_order ?? 0;
  const bo = b.sort_order ?? 0;
  if (ao !== bo) return ao - bo;
  return a.name.localeCompare(b.name, "ko", { sensitivity: "base" });
}
