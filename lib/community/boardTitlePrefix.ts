import type { CommunityPost } from "@/types/community";

export const SPOILER_PREFIXES = new Set(["스포", "스포일러", "spoil", "spoiler"]);

/** 제목 말머리 `[…]` 첫 번째 조각 (없으면 null) */
export function parseBoardTitlePrefix(title: string | null | undefined): string | null {
  const m = title?.match(/^\[([^\]]+)\]\s*/);
  return m ? m[1].trim() : null;
}

export function isSpoilerPrefix(prefix: string | null | undefined): boolean {
  if (!prefix) return false;
  return SPOILER_PREFIXES.has(prefix.trim().toLowerCase());
}

export function splitBoardTitle(title: string | null | undefined): { prefix: string | null; body: string } {
  const m = title?.match(/^\[([^\]]+)\]\s*(.*)$/);
  if (!m) return { prefix: null, body: title ?? "" };
  return { prefix: m[1].trim(), body: m[2] ?? "" };
}

/** 스포일러 표시용 말머리인지 (태그와 무관, 제목만 기준) */
export function postHasSpoilerTitlePrefix(post: CommunityPost | null | undefined): boolean {
  return isSpoilerPrefix(parseBoardTitlePrefix(post?.title ?? null));
}
