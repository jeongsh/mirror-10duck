import type { CommunityPost } from "@/types/community";

/** 제목 말머리 `[…]` 첫 번째 조각 (없으면 null) */
export function parseBoardTitlePrefix(title: string | null | undefined): string | null {
  const m = title?.match(/^\[([^\]]+)\]\s*/);
  return m ? m[1].trim() : null;
}

/** 스포일러 표시용 말머리인지 (태그와 무관, 제목만 기준) */
export function postHasSpoilerTitlePrefix(post: CommunityPost | null | undefined): boolean {
  const p = parseBoardTitlePrefix(post?.title ?? null);
  if (!p) return false;
  const n = p.toLowerCase();
  return p === "스포" || p === "스포일러" || n === "spoil" || n === "spoiler";
}
