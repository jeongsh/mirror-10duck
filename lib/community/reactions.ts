import { supabase } from "@/lib/supabase/client";
import {
  ALL_REACTION_TYPES,
  type PostReaction,
  type PostReactionSummary,
  type ReactionType,
} from "@/types/community";

/**
 * 6종 감정 리액션의 표시 메타데이터.
 *
 * - emoji: 폴백/기본 표시 (캐릭터 썸네일이 없을 때).
 * - label: 한국어 라벨.
 * - color: 카운트 강조 색 (Tailwind 클래스).
 */
export const REACTION_META: Record<ReactionType, { emoji: string; label: string; color: string }> = {
  happy: { emoji: "😆", label: "기쁨", color: "text-yellow-600" },
  empathy: { emoji: "🤝", label: "공감", color: "text-blue-600" },
  surprise: { emoji: "😮", label: "놀람", color: "text-purple-600" },
  sad: { emoji: "😢", label: "슬픔", color: "text-sky-600" },
  funny: { emoji: "🤣", label: "웃김", color: "text-orange-600" },
  cheer: { emoji: "🔥", label: "응원", color: "text-red-600" },
};

/** 빈 카운트 객체. (Object.fromEntries 결과를 ReactionType 키로 단언) */
export function emptyReactionCounts(): Record<ReactionType, number> {
  const init = {} as Record<ReactionType, number>;
  for (const t of ALL_REACTION_TYPES) init[t] = 0;
  return init;
}

/**
 * 한 게시글에 대한 모든 리액션 행을 받아 (집계 + 내가 누른 것 + 최근 썸네일) 형태로 변환.
 */
export function summarizeReactions(
  rows: PostReaction[],
  viewerId: string | null,
  thumbnailLimit = 6,
): PostReactionSummary {
  const counts = emptyReactionCounts();
  const mine = new Set<ReactionType>();
  const seenUsers = new Set<string>();
  const recentThumbnails: PostReactionSummary["recentThumbnails"] = [];

  // created_at 내림차순 정렬 (최신부터)
  const sorted = [...rows].sort((a, b) =>
    a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0,
  );

  for (const row of sorted) {
    counts[row.reaction_type] = (counts[row.reaction_type] ?? 0) + 1;
    if (viewerId && row.user_id === viewerId) mine.add(row.reaction_type);

    if (
      row.character_thumbnail_url &&
      !seenUsers.has(row.user_id) &&
      recentThumbnails.length < thumbnailLimit
    ) {
      seenUsers.add(row.user_id);
      recentThumbnails.push({
        url: row.character_thumbnail_url,
        characterId: row.character_id,
        userId: row.user_id,
      });
    }
  }

  return { counts, mine, recentThumbnails };
}

/**
 * 게시글 1개의 모든 리액션을 가져온다.
 */
export async function fetchReactionsByPost(postId: string): Promise<PostReaction[]> {
  const { data, error } = await supabase
    .from("post_reactions")
    .select("*")
    .eq("post_id", postId);

  if (error) {
    console.error("[reactions] fetch error:", error.message);
    return [];
  }
  return (data ?? []) as PostReaction[];
}

/**
 * 한 사용자는 한 글에 1리액션만 갖는다는 정책 하에서의 단일 진입점.
 *
 * - `currentMineType` 이 클릭한 종류와 같으면 → 해제(삭제, 토글 OFF)
 * - 그 외(없거나 다른 종류) → upsert 로 (post_id, user_id) 충돌 시 갱신
 *
 * DB 측에는 `unique (post_id, user_id)` 가 걸려 있어야 하며,
 * 마이그레이션은 `docs/migrations/2026-04-29-phase23-reactions-single-per-user.sql` 참고.
 */
export async function setReaction(params: {
  postId: string;
  userId: string;
  reactionType: ReactionType;
  currentMineType: ReactionType | null;
  characterId: string | null;
  characterThumbnailUrl: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const { postId, userId, reactionType, currentMineType } = params;

  if (currentMineType === reactionType) {
    const { error } = await supabase
      .from("post_reactions")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", userId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }

  const { error } = await supabase
    .from("post_reactions")
    .upsert(
      {
        post_id: postId,
        user_id: userId,
        reaction_type: reactionType,
        character_id: params.characterId,
        character_thumbnail_url: params.characterThumbnailUrl,
      },
      { onConflict: "post_id,user_id" },
    );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
