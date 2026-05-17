import type { BoardCategory } from "@/lib/community/boardCategories";

export type { BoardCategory } from "@/lib/community/boardCategories";

export type Board = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  /** 분류: 애니, 게임, 취미 등 (`lib/community/boardCategories`) */
  category: BoardCategory;
  /** 같은 category 안 목록 정렬 (오름차순) */
  sort_order: number;
  created_at: string;
  hot_threshold: number;
  allow_anonymous: boolean;
  allow_media: boolean;
  is_nsfw: boolean;
  /** 실험 A3: 게시판별 태그 정책(JSON). 마이그레이션 전에는 없을 수 있음 */
  tag_policy?: Record<string, unknown> | null;
};

/** `public.tag_kind` / `tags.kind` */
export type TagKind =
  | "work"
  | "character"
  | "pair"
  | "spoiler"
  | "content_warning"
  | "genre"
  | "meta";

export type TagRow = {
  id: string;
  slug: string;
  kind: TagKind;
  display_name: string;
  official: boolean;
};

  /** `posts` 조회 시 `post_tags` + `tags` 조인(별도 쿼리로 채움) */
export type PostTagJoin = {
  post_id?: string;
  tag_id: string;
  weight?: number;
  tags: TagRow | null;
};

export type NicknameType = "FIXED" | "TEMPORARY";

export type CardTheme = "default" | "dark" | "neon" | "pastel" | "sakura" | "ocean" | "galaxy";

export type UserProfile = {
  id: string;
  user_id: string;
  nickname: string;
  display_name: string | null;
  handle: string | null;
  handle_updated_at: string | null;
  avatar_url: string | null;
  bio: string | null;
  representative_character_id: string | null;
  nickname_type: NicknameType;
  role: "USER" | "ADMIN";
  experience_points?: number;
  level?: number;
  last_daily_xp_at?: string | null;
  // 프로필 카드 커스터마이징
  card_theme: CardTheme | null;
  card_accent: string | null;
  card_show_oshi: boolean | null;
  card_badge_ids: string[] | null;
  card_image_url: string | null;
  card_nickname_color: string | null;
  card_nickname_font: string | null;
  card_avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

export type PostSourceType = "FEED" | "BOARD";

/** 피드 공유 등으로 조회한 원본 게시글 스냅샷 (`origin_post_id` 조인) */
export type PostSharedFrom = {
  id: string;
  title: string | null;
  author_id: string | null;
  board_id: string | null;
  source_type: PostSourceType;
  profiles?: UserProfile | null;
  boards?: { slug: string; name: string } | null;
};

export type CommunityPost = {
  id: string;
  created_at: string;
  updated_at?: string | null;
  title: string | null; // 피드 글은 제목이 없을 수 있음
  content: string;
  author_id: string | null;
  author_email: string | null;
  anonymous_nickname?: string | null;
  anonymous_password_hash?: string | null;
  is_anonymous?: boolean;
  author_ip?: string | null;
  
  /** 조인된 작성자 프로필 */
  profiles?: UserProfile | null;

  // 하이브리드 게시판-피드용 필드
  board_id: string | null;
  /** 일부 목록 쿼리에서 `boards(...)` 조인 */
  boards?: { slug: string; name?: string } | null;
  source_type: PostSourceType;
  origin_post_id: string | null;
  /** `enrichPostsSharedFrom` 로 채움 */
  shared_from?: PostSharedFrom | null;
  is_hot: boolean;
  hot_promoted_at: string | null;

  /** 목록/상세 집계 (마이그레이션 전 DB에서는 undefined) */
  view_count?: number;
  comment_count?: number;
  upvote_count?: number;
  downvote_count?: number;

  /** 게시글 공개 상태 (`NORMAL`, `HIDDEN` 등). 관리자 숨김·원본 숨김 전파에 사용 */
  status?: string;

  /** `post_tags`+`tags` 조인 (게시판 목록에서는 비사용·DB·추후 검색·교차축용) */
  post_tags?: PostTagJoin[] | null;
};

/** 클라이언트 표시용 기본값 */
export function postAggregateDefaults(post: CommunityPost) {
  return {
    view_count: post.view_count ?? 0,
    comment_count: post.comment_count ?? 0,
    upvote_count: post.upvote_count ?? 0,
    downvote_count: post.downvote_count ?? 0,
  };
}

export type PostVoteType = "up" | "down";

/**
 * Phase 2.3 캐릭터-커뮤니티 연결 도메인 타입.
 *
 * - 스티커: 사용자가 직접 등록하거나 AI 생성 플로우로 만든 별도 에셋을 본문/댓글에 임베드.
 * - 리액션: 글에 6종 감정 리액션 + 반응자의 캐릭터 썸네일 누적 표시.
 * - 댓글: 텍스트 댓글 또는 스티커-only "스티커 답글".
 */

/**
 * 레거시 스티커 토큰 = (characterId, emotion) 한 쌍.
 * 본문에는 `:sticker/{characterId}/{emotion}:` 토큰으로 직렬화된다.
 *
 * 이 구조는 현재 렌더러 하위 호환용이다. 정식 스티커는 캐릭터의 Live2D 표정 지원
 * 여부와 분리된 `stickers` / `sticker_assets` 기반 에셋으로 관리한다.
 *
 * - characterId 는 라이브러리에 등록된 `CharacterProfile.id` (예: builtin-mao-pro).
 * - emotion 은 레거시 감정 키 (idle/happy/...).
 */
export type StickerToken = {
  characterId: string;
  emotion: string;
  /** 본문에 들어가는 직렬화 형식. */
  raw: string;
};

export type StickerVisibility = "PRIVATE" | "UNLISTED" | "PUBLIC";
export type StickerSourceType = "USER_UPLOAD" | "AI_GENERATED";

export type StickerAsset = {
  id: string;
  sticker_id: string;
  label: string;
  storage_key: string;
  width: number | null;
  height: number | null;
  source_type: StickerSourceType;
};

export type StickerPack = {
  id: string;
  owner_user_id: string;
  character_id: string | null;
  name: string;
  visibility: StickerVisibility;
  source_type: StickerSourceType;
  assets?: StickerAsset[];
  created_at: string;
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
  /** 조인된 작성자 프로필 */
  profiles?: UserProfile | null;
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
  author_id: string | null;
  author_email: string | null;
  anonymous_nickname?: string | null;
  anonymous_password_hash?: string | null;
  is_anonymous?: boolean;
  author_ip?: string | null;
  
  /** 조인된 작성자 프로필 */
  profiles?: UserProfile | null;

  parent_comment_id: string | null;
  content: string | null;
  sticker_token: string | null;
  created_at: string;
  
  /** 댓글 추천/비추천 집계 */
  upvote_count?: number;
  downvote_count?: number;
};

// =============================================
// 오시(推し) 등록 & 배지
// =============================================

export type OshiType =
  | "anime"
  | "manga"
  | "game"
  | "character"
  | "other"
  | "voice_actor"
  | "creator"
  | "pair"
  | "idol_group";

/** CP 방향성 (A=member_index 1, B=member_index 2) */
export type OshiPairDirection = "a_to_b" | "b_to_a" | "reversible" | "unknown";

export type OshiPairMember = {
  id: string;
  oshi_id: string;
  member_index: 1 | 2;
  character_title: string;
  direction: OshiPairDirection | null;
};

export type OshiRegistration = {
  id: string;
  user_id: string;
  rank: number;
  title: string;
  oshi_type: OshiType;
  image_url: string | null;
  description: string | null;
  is_public: boolean;
  /** 성우·아이돌 그룹 등 소속 */
  affiliation: string | null;
  /** 성우 대표 출연작, 크리에이터 대표 작 등 */
  reference_work: string | null;
  created_at: string;
  updated_at: string;
  /** oshi_type === "pair" 일 때만 채워짐 */
  pair_members?: OshiPairMember[];
};

export type BadgeRarity = "common" | "rare" | "epic" | "legendary" | "season";

export type Badge = {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: BadgeRarity;
  condition_type: string;
  condition_value: number;
  created_at: string;
};

export type UserBadge = {
  id: string;
  user_id: string;
  badge_id: string;
  earned_at: string;
  badge?: Badge;
};

export type Report = {
  id: string;
  created_at: string;
  reporter_id: string;
  target_type: "POST" | "COMMENT" | "PROFILE" | "STICKER";
  target_id: string;
  reason_category: string;
  reason_detail: string | null;
  status: "PENDING" | "REVIEWING" | "RESOLVED" | "REJECTED";
  admin_note: string | null;
  processed_at: string | null;
};
