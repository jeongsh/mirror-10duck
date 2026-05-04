export type Board = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  created_at: string;
};

export type PostSourceType = "FEED" | "BOARD";

export type CommunityPost = {
  id: string;
  created_at: string;
  title: string | null; // 피드 글은 제목이 없을 수 있음
  content: string;
  author_id: string;
  author_email: string;
  
  // 하이브리드 게시판-피드용 필드
  board_id: string | null;
  source_type: PostSourceType;
  origin_post_id: string | null;
  is_hot: boolean;
  hot_promoted_at: string | null;
};

/**
 * Phase 2.3 캐릭터-커뮤니티 연결 도메인 타입.
 *
 * - 스티커: 사용자의 캐릭터 라이브러리 항목을 디시콘 스타일로 본문/댓글에 임베드.
 * - 리액션: 글에 6종 감정 리액션 + 반응자의 캐릭터 썸네일 누적 표시.
 * - 댓글: 텍스트 댓글 또는 스티커-only "스티커 답글".
 */

/**
 * 스티커 = (characterId, emotion) 한 쌍.
 * 본문에는 `:sticker/{characterId}/{emotion}:` 토큰으로 직렬화된다.
 *
 * - characterId 는 라이브러리에 등록된 `CharacterProfile.id` (예: builtin-mao-pro).
 * - emotion 은 `CharacterEmotion` 키 (idle/happy/...).
 *
 * 토큰을 그대로 보관하고 렌더 시 라이브러리에서 매칭되는 캐릭터의 썸네일/이름으로 변환한다.
 * (= 캐릭터 매핑이 바뀌어도 토큰은 "어느 캐릭터의 어떤 표정"인지 의미를 잃지 않는다.)
 */
export type StickerToken = {
  characterId: string;
  emotion: string;
  /** 본문에 들어가는 직렬화 형식. */
  raw: string;
};

/** 글/댓글에 달 수 있는 6종 감정 리액션. */
export type ReactionType =
  | "happy"
  | "empathy"
  | "surprise"
  | "sad"
  | "funny"
  | "cheer";

export const ALL_REACTION_TYPES: ReactionType[] = [
  "happy",
  "empathy",
  "surprise",
  "sad",
  "funny",
  "cheer",
];

/**
 * 리액션 한 개.
 * - 같은 (post_id, user_id, reaction_type) 조합은 1개 (UNIQUE).
 * - `character_id` / `character_thumbnail_url` 은 반응자의 활성 캐릭터 스냅샷.
 *   캐릭터 삭제/교체와 무관하게 당시 모습으로 노출하기 위해 스냅샷 보관.
 */
export type PostReaction = {
  id: string;
  post_id: string;
  user_id: string;
  reaction_type: ReactionType;
  character_id: string | null;
  character_thumbnail_url: string | null;
  /** 리액션 시점 `user_metadata.nickname` 스냅샷 (마이그레이션 이전 행은 생략 가능) */
  display_name?: string | null;
  /** 리액션 시점 `user_metadata.avatar_url` 스냅샷 (마이그레이션 이전 행은 생략 가능) */
  avatar_url?: string | null;
  created_at: string;
};

/** 한 게시글의 리액션 집계 + 내가 누른 종류. */
export type PostReactionSummary = {
  /** reaction_type → 카운트 */
  counts: Record<ReactionType, number>;
  /** 내가 누른 reaction_type 집합 */
  mine: Set<ReactionType>;
  /** 최근 반응자 (유저 프로필 우선, 없으면 캐릭터 썸네일) */
  recentReactors: {
    userId: string;
    displayName: string | null;
    avatarUrl: string | null;
    characterThumbnailUrl: string | null;
  }[];
};

/**
 * 댓글 = 텍스트 OR 스티커-only.
 *
 * - `content` 가 있으면 본문 텍스트 댓글 (내부에 스티커 토큰 포함 가능).
 * - `sticker_token` 이 있으면 스티커 한 장만 찍는 "스티커 답글" 모드.
 * - 둘 다 동시 채우는 케이스는 허용하되 UI 는 sticker_token 우선 표시.
 */
export type Comment = {
  id: string;
  post_id: string;
  author_id: string;
  author_email: string;
  content: string | null;
  sticker_token: string | null;
  created_at: string;
};
