/**
 * 캐릭터 모델 관련 도메인 타입.
 *
 * 설계 요점:
 * - `CharacterProfile` 은 "런타임이 모델 하나를 다루기 위해 필요한 모든 설정"의
 *   통합 서술. 업로드 시 저장되고, 모델 로드 시 Live2DWrapper 가 이걸 읽어서
 *   모델 고유 ID(표정/모션/파츠) 를 우리 서비스의 추상 키로 매핑한다.
 * - 모델마다 표정/모션/히트 영역 ID 가 제각각이기 때문에 기존처럼 mao_pro 기준으로
 *   하드코딩하면 새 모델을 붙이는 순간 전부 깨진다. 매핑 테이블로 해결.
 */

export type CharacterEmotion =
  | "idle"
  | "happy"
  | "sad"
  | "angry"
  | "surprised"
  | "shy"
  | "love"
  | "wink";

export const ALL_EMOTIONS: CharacterEmotion[] = [
  "idle",
  "happy",
  "sad",
  "angry",
  "surprised",
  "shy",
  "love",
  "wink",
];

/**
 * 제품 표면에서 우선 노출할 기본 감정.
 * ALL_EMOTIONS 는 내부 호환/고급 매핑 후보이고, 일반 사용자 UI 는 캐릭터가
 * 실제 지원하는 CORE_EMOTIONS 중심으로 시작한다.
 */
export const CORE_EMOTIONS: CharacterEmotion[] = [
  "idle",
  "happy",
  "sad",
  "surprised",
  "angry",
];

export const OPTIONAL_EMOTIONS: CharacterEmotion[] = ["shy", "love", "wink"];

/**
 * 사용자 상호작용 액션. Live2DWrapper 의 hit / idle 로직이 이 키를 참조한다.
 */
export type CharacterActionKey =
  | "tap_head"
  /** @deprecated 신규 제품 액션에서는 사용하지 않는다. 런타임에서 attention 으로 정규화한다. */
  | "tap_body"
  | "tap_other"
  | "attention"
  | "cheer"
  | "thinking"
  | "celebrate"
  | "idle"
  | "greet"
  | "typing"
  | "special";

export const ALL_ACTIONS: CharacterActionKey[] = [
  "tap_head",
  "tap_other",
  "attention",
  "cheer",
  "thinking",
  "celebrate",
  "idle",
  "greet",
  "typing",
  "special",
];

/**
 * Live2D motion3 파일은 `Motions: { [groupName]: MotionEntry[] }` 구조이므로
 * 특정 모션을 지정하려면 그룹 이름과 인덱스가 모두 필요하다.
 */
export interface MotionRef {
  group: string;
  index: number;
}

export type CharacterScenarioKey =
  | "login"
  | "logout"
  | "notification"
  | "writing"
  | "idle_return";

export interface CharacterScenarioDefinition {
  key: CharacterScenarioKey;
  label: string;
  description: string;
}

export const CHARACTER_SCENARIOS: CharacterScenarioDefinition[] = [
  {
    key: "login",
    label: "로그인",
    description: "사용자가 접속했을 때의 첫 인사",
  },
  {
    key: "logout",
    label: "로그아웃",
    description: "사용자가 나갈 때의 짧은 인사",
  },
  {
    key: "notification",
    label: "알림 공통",
    description: "댓글, 답글, 리액션, 팔로우, 시스템 알림에 공통으로 쓰는 움직임",
  },
  {
    key: "writing",
    label: "글쓰기 중",
    description: "사용자가 글을 작성하거나 정리할 때",
  },
  {
    key: "idle_return",
    label: "기본 복귀",
    description: "상호작용이 끝나고 기본 상태로 돌아갈 때",
  },
];

export interface CharacterScenarioMapping {
  expressionId?: string | null;
  motion?: MotionRef | null;
}

/**
 * 옷/파츠 세트. Live2D 의 파츠 opacity 토글로 구현된다.
 *
 * - `parts` 의 각 항목은 "선택지" 역할.
 * - 사용자가 하나를 선택하면 해당 파츠만 opacity=1, 나머지는 0 으로 전환한다.
 *   (예: 머리카락 A 세트 / B 세트 / 머리끈 세트)
 */
export interface OutfitGroup {
  id: string;
  name: string;
  parts: {
    id: string;
    label: string;
    /** 이 옵션 선택 시 opacity=1 로 만들 파츠 ID 들 */
    partIds: string[];
  }[];
  /** 기본 선택 옵션 id. 없으면 첫 번째. */
  defaultPartId?: string;
}

/**
 * 파라미터 프리셋. 여러 파라미터를 한 번에 특정 값으로 돌려서
 * "츤데레 모드" / "얀데레 모드" 같은 캐릭터성 변주를 제공한다.
 */
export interface ParameterPreset {
  id: string;
  name: string;
  description?: string;
  values: {
    paramId: string;
    value: number;
    /** 해당 파라미터의 원본 최소/최대 (UI 표시용, 없으면 추론) */
    min?: number;
    max?: number;
  }[];
}

/**
 * 라이브 모핑 슬라이더. 업로드 시 노출할 파라미터 목록을 큐레이션.
 * cdi3.json 의 DisplayInfo 를 이용해 표시명을 붙일 수 있다.
 */
export interface MorphSlider {
  paramId: string;
  label: string;
  min: number;
  max: number;
  defaultValue: number;
}

/**
 * 사운드 매핑. 감정/액션 전환 시 재생할 오디오.
 * 오디오 파일 자체는 ObjectURL 혹은 정적 경로. 휘발성이므로 재업로드 시 재생성.
 */
export interface SoundMap {
  /** 감정 → 오디오 URL (voice line) */
  emotions: Partial<Record<CharacterEmotion, string>>;
  /** 액션 → 오디오 URL (tap 등 효과음 + 대사) */
  actions: Partial<Record<CharacterActionKey, string>>;
}

/**
 * 말풍선 대사. 액션/감정 발동 시 SpeechBubble 로 띄울 멘트.
 * 여러 개면 랜덤으로 뽑아서 같은 모션도 덜 지루하게.
 */
export interface DialogueMap {
  emotions: Partial<Record<CharacterEmotion, string[]>>;
  actions: Partial<Record<CharacterActionKey, string[]>>;
}

export interface CharacterViewConfig {
  scale: number;
  x: number;
  y: number;
}

/**
 * 업로드된 캐릭터 한 개 단위의 설정 블록.
 *
 * 파일 자체는 `modelFiles` 에 저장된 blob URL 레퍼런스로 접근한다.
 * (Supabase 연동 전까지는 휘발성 = 새로고침하면 재업로드 필요)
 */
export interface CharacterProfile {
  id: string;
  name: string;
  description?: string;
  /** 최종적으로 Live2DModel.from() 에 넘길 URL. 보통 model3.json 의 blob URL. */
  modelPath: string;
  /** 썸네일 이미지 URL (업로드 시 첫 프레임 캡처) */
  thumbnailUrl?: string;

  /** 감정 → 모델의 표정(exp3) ID. null 이면 이 감정은 해당 모델에서 사용 불가. */
  expressionMap: Partial<Record<CharacterEmotion, string | null>>;
  /** 추상 액션 → 모션 그룹/인덱스. */
  motionMap: Partial<Record<CharacterActionKey, MotionRef | null>>;
  /** 제품 상황 → 실제 표정/모션. 관리 UI 의 기본 매핑 단위. */
  scenarioMap?: Partial<Record<CharacterScenarioKey, CharacterScenarioMapping>>;

  /** 히트 영역 ID → 발동할 액션 키. */
  hitAreaMap: { hitAreaId: string; action: CharacterActionKey }[];

  /** 옷/파츠 토글 그룹. */
  outfits: OutfitGroup[];

  /** 라이브 조작 가능한 파라미터 슬라이더들. */
  morphSliders: MorphSlider[];
  /** 프리셋 (여러 파라미터 일괄 설정). */
  parameterPresets: ParameterPreset[];

  sounds: SoundMap;
  dialogues: DialogueMap;

  defaultView: CharacterViewConfig;

  /**
   * blob URL → 실제 파일명 매핑. 캐릭터 언로드 시 revokeObjectURL 일괄 해제용.
   * (메모리 누수 방지)
   */
  blobUrls: string[];

  /**
   * 해당 프로필이 기본 내장 캐릭터인지 (mao_pro 샘플).
   * 내장 캐릭터는 blob 정리 대상 아님.
   */
  isBuiltIn: boolean;

  createdAt: number;
}

function firstDefined<T>(...values: (T | null | undefined)[]): T | null {
  return values.find((value): value is T => value != null) ?? null;
}

/**
 * 업로드 자동 매핑 결과를 제품 상황 단위 기본값으로 접어 넣는다.
 * 크리에이터가 처음부터 모든 상황을 빈칸으로 마주하지 않게 하는 추천 매핑이다.
 */
export function buildRecommendedScenarioMap(source: {
  expressionMap: Partial<Record<CharacterEmotion, string | null>>;
  motionMap: Partial<Record<CharacterActionKey, MotionRef | null>>;
}): Partial<Record<CharacterScenarioKey, CharacterScenarioMapping>> {
  const exp = (...keys: CharacterEmotion[]) =>
    firstDefined(...keys.map((key) => source.expressionMap[key]));
  const motion = (...keys: CharacterActionKey[]) =>
    firstDefined(...keys.map((key) => source.motionMap[key]));

  return {
    login: {
      expressionId: exp("happy", "idle"),
      motion: motion("greet", "attention", "tap_head", "idle"),
    },
    logout: {
      expressionId: exp("sad", "idle"),
      motion: motion("greet", "attention", "idle"),
    },
    notification: {
      expressionId: exp("happy", "surprised", "idle"),
      motion: motion("attention", "idle"),
    },
    writing: {
      expressionId: exp("idle", "happy"),
      motion: motion("typing", "attention", "idle"),
    },
    idle_return: {
      expressionId: exp("idle"),
      motion: motion("idle"),
    },
  };
}

export function withRecommendedScenarioMap(profile: CharacterProfile): CharacterProfile {
  const recommended = buildRecommendedScenarioMap(profile);
  const current = profile.scenarioMap ?? {};
  const legacyScenarioMap = current as Partial<Record<string, CharacterScenarioMapping>>;
  const legacyNotification =
    legacyScenarioMap.notification ??
    legacyScenarioMap.new_comment ??
    legacyScenarioMap.new_reply ??
    legacyScenarioMap.reaction ??
    legacyScenarioMap.follow ??
    legacyScenarioMap.hot_promoted ??
    legacyScenarioMap.system_notice;
  const scenarioMap: CharacterProfile["scenarioMap"] = {};

  for (const scenario of CHARACTER_SCENARIOS) {
    scenarioMap[scenario.key] =
      scenario.key === "notification"
        ? legacyNotification ?? recommended.notification
        : current[scenario.key] ?? recommended[scenario.key];
  }

  return {
    ...profile,
    scenarioMap,
  };
}

interface SupportedEmotionOptions {
  includeOptional?: boolean;
  requireExpression?: boolean;
}

export function isCharacterEmotionSupported(
  profile: CharacterProfile | null | undefined,
  emotion: CharacterEmotion,
  options: SupportedEmotionOptions = {}
): boolean {
  if (!profile) return emotion === "idle";
  if (emotion === "idle") return true;

  const hasExpression = Boolean(profile.expressionMap[emotion]);
  if (options.requireExpression) return hasExpression;

  return (
    hasExpression ||
    Boolean(profile.sounds.emotions[emotion]) ||
    Boolean(profile.dialogues.emotions[emotion]?.length)
  );
}

export function getCharacterSupportedEmotions(
  profile: CharacterProfile | null | undefined,
  options: SupportedEmotionOptions = {}
): CharacterEmotion[] {
  const includeOptional = options.includeOptional ?? true;
  const candidates = includeOptional
    ? [...CORE_EMOTIONS, ...OPTIONAL_EMOTIONS]
    : CORE_EMOTIONS;
  return candidates.filter((emotion) =>
    isCharacterEmotionSupported(profile, emotion, options)
  );
}

const EMOTION_FALLBACKS: Record<CharacterEmotion, CharacterEmotion[]> = {
  idle: ["idle"],
  happy: ["idle"],
  sad: ["idle"],
  angry: ["idle"],
  surprised: ["happy", "idle"],
  shy: ["idle"],
  love: ["happy", "idle"],
  wink: ["happy", "idle"],
};

export function resolveSupportedEmotion(
  profile: CharacterProfile | null | undefined,
  emotion: CharacterEmotion
): CharacterEmotion {
  if (isCharacterEmotionSupported(profile, emotion)) return emotion;
  return (
    EMOTION_FALLBACKS[emotion].find((candidate) =>
      isCharacterEmotionSupported(profile, candidate)
    ) ?? "idle"
  );
}
