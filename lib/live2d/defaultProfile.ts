import type { CharacterProfile } from "@/types/character";

/**
 * mao_pro 샘플을 우리 서비스의 기본 내장 캐릭터로 래핑.
 * 업로드 플로우 없이 늘 라이브러리에 존재해 "로드 예시" 역할을 한다.
 */
export const MAO_PRO_PROFILE: CharacterProfile = {
  id: "builtin-mao-pro",
  name: "마오쨩 (샘플)",
  description:
    "Cubism SDK 공식 샘플 캐릭터. 기본 내장. 업로드 없이 바로 로드되며 매핑/모핑/옷 기능 데모용으로 사용된다.",
  modelPath: "/live2d/mao_pro/mao_pro.model3.json",

  expressionMap: {
    idle: "exp_01",
    happy: "exp_02",
    sad: "exp_03",
    angry: "exp_04",
    surprised: "exp_05",
    shy: "exp_06",
    love: "exp_07",
    wink: "exp_08",
  },

  motionMap: {
    idle: { group: "Idle", index: 0 },
    tap_head: { group: "", index: 0 },
    tap_body: { group: "", index: 1 },
    tap_other: { group: "", index: 2 },
    greet: { group: "", index: 3 },
    special: { group: "", index: 4 },
    typing: { group: "", index: 5 },
  },

  hitAreaMap: [
    { hitAreaId: "HitAreaHead", action: "tap_head" },
    { hitAreaId: "HitAreaBody", action: "tap_body" },
  ],

  /**
   * mao_pro 의 pose3.json 그룹은 팔 A/B 토글 두 쌍. 크리에이터가 원본에서 예비
   * 의상 파츠를 붙이지 않았으므로 옷 그룹 하나로 묶고 "기본 / 왼팔 들기 / 오른팔 들기"
   * 3가지 프리셋을 제공.
   */
  outfits: [
    {
      id: "arms",
      name: "팔 포즈",
      defaultPartId: "arms-default",
      parts: [
        { id: "arms-default", label: "기본", partIds: ["PartArmLA", "PartArmRA"] },
        { id: "arms-left-up", label: "왼팔 들기", partIds: ["PartArmLB", "PartArmRA"] },
        { id: "arms-right-up", label: "오른팔 들기", partIds: ["PartArmLA", "PartArmRB"] },
        { id: "arms-both-up", label: "만세!", partIds: ["PartArmLB", "PartArmRB"] },
      ],
    },
  ],

  /**
   * cdi3.json 에서 큐레이션 한 파라미터들. 오타쿠 취향 포인트.
   */
  morphSliders: [
    { paramId: "ParamCheek", label: "볼 홍조", min: 0, max: 1, defaultValue: 0 },
    { paramId: "ParamEyeLSmile", label: "왼쪽 눈 웃음", min: 0, max: 1, defaultValue: 0 },
    { paramId: "ParamEyeRSmile", label: "오른쪽 눈 웃음", min: 0, max: 1, defaultValue: 0 },
    { paramId: "ParamEyeEffect", label: "눈 반짝임", min: 0, max: 1, defaultValue: 0 },
    { paramId: "ParamMouthForm", label: "입꼬리", min: -1, max: 1, defaultValue: 0 },
    { paramId: "ParamMouthOpenY", label: "입 벌림", min: 0, max: 1, defaultValue: 0 },
    { paramId: "ParamBrowLY", label: "왼쪽 눈썹 상하", min: -1, max: 1, defaultValue: 0 },
    { paramId: "ParamBrowRY", label: "오른쪽 눈썹 상하", min: -1, max: 1, defaultValue: 0 },
    { paramId: "ParamBustY", label: "가슴 흔들림", min: -1, max: 1, defaultValue: 0 },
  ],

  parameterPresets: [
    {
      id: "preset-tsundere",
      name: "츤데레 모드",
      description: "볼은 빨갛고 입꼬리는 내려간, 그 느낌",
      values: [
        { paramId: "ParamCheek", value: 0.8 },
        { paramId: "ParamMouthForm", value: -0.4 },
        { paramId: "ParamBrowLY", value: -0.3 },
        { paramId: "ParamBrowRY", value: -0.3 },
        { paramId: "ParamEyeEffect", value: 0 },
      ],
    },
    {
      id: "preset-yandere",
      name: "얀데레 모드",
      description: "눈이 풀리고 웃음이 묘하게 굳은...",
      values: [
        { paramId: "ParamEyeLSmile", value: 1 },
        { paramId: "ParamEyeRSmile", value: 1 },
        { paramId: "ParamEyeEffect", value: 0 },
        { paramId: "ParamMouthForm", value: 0.6 },
        { paramId: "ParamCheek", value: 0.3 },
      ],
    },
    {
      id: "preset-kirakira",
      name: "키라키라 모드",
      description: "눈 안에 우주를 담은 눈빛",
      values: [
        { paramId: "ParamEyeEffect", value: 1 },
        { paramId: "ParamCheek", value: 0.5 },
        { paramId: "ParamMouthForm", value: 0.8 },
        { paramId: "ParamMouthOpenY", value: 0.3 },
        { paramId: "ParamBrowLY", value: 0.4 },
        { paramId: "ParamBrowRY", value: 0.4 },
      ],
    },
    {
      id: "preset-reset",
      name: "리셋",
      description: "모든 파라미터를 0 으로",
      values: [
        { paramId: "ParamCheek", value: 0 },
        { paramId: "ParamEyeLSmile", value: 0 },
        { paramId: "ParamEyeRSmile", value: 0 },
        { paramId: "ParamEyeEffect", value: 0 },
        { paramId: "ParamMouthForm", value: 0 },
        { paramId: "ParamMouthOpenY", value: 0 },
        { paramId: "ParamBrowLY", value: 0 },
        { paramId: "ParamBrowRY", value: 0 },
        { paramId: "ParamBustY", value: 0 },
      ],
    },
  ],

  // 사운드 없음 (사용자가 업로드한 모델에서만 지정 가능)
  sounds: {
    emotions: {},
    actions: {},
  },

  dialogues: {
    emotions: {
      happy: ["에헤헷~", "좋아해!", "룰루랄라~"],
      sad: ["흐앵...", "싫어...", "울어버릴거야..."],
      angry: ["바보!", "칫!", "흥!"],
      surprised: ["꺄앗!?", "헉!?", "이게뭐야?!"],
      shy: ["보, 보지마...", "부끄러워...", "그렇게 쳐다보지 마아..."],
      love: ["좋아해...", "두근두근...", "너만 있으면 돼"],
      wink: ["후훗 ;)", "윙크윙크~", "이거 비밀이야"],
    },
    actions: {
      tap_head: ["헤헷!", "머리 쓰다듬지 마!", "간지러워~"],
      tap_body: ["아앗, 거긴 안돼요!", "꺅!", "성희롱이야!"],
      tap_other: ["응?", "뭐야뭐야", "간지럽다구요"],
      greet: ["어서와!", "기다렸어~", "오늘도 만났네"],
      typing: ["타자 빠르네~", "뭐 쓰는거야?", "집중 집중!"],
      special: ["짜잔!", "특별 서비스야♡", "좋은 거 보여줄게"],
    },
  },

  defaultView: { scale: 0.09, x: -96, y: -55 },

  blobUrls: [],
  isBuiltIn: true,
  createdAt: 0,
};

/**
 * Pichu 모델 기본 내장 프로필.
 * 사용자가 처음 진입했을 때 기본 캐릭터로 로드된다.
 */
export const PICHU_PROFILE: CharacterProfile = {
  id: "builtin-pichu",
  name: "피츄",
  description: "가볍게 사용할 수 있는 기본 내장 캐릭터.",
  modelPath: "/live2d/Pichu/Pichu.model3.json",

  expressionMap: {
    idle: null,
    happy: "Happy",
    sad: "Sad",
    angry: "Angry",
    surprised: "Shock",
    shy: null,
    love: null,
    wink: null,
  },

  motionMap: {},
  hitAreaMap: [],
  outfits: [],
  morphSliders: [],
  parameterPresets: [],

  sounds: {
    emotions: {},
    actions: {},
  },

  dialogues: {
    emotions: {
      happy: ["좋은 하루 보내요.", "작업 파이팅!"],
      sad: ["괜찮아요, 다시 하면 돼요."],
      angry: ["잠깐 쉬고 다시 시작해요."],
      surprised: ["오, 새로운 변화네요."],
    },
    actions: {
      greet: ["안녕하세요!"],
      typing: ["집중 중..."],
    },
  },

  defaultView: { scale: 0.22, x: -63, y: 15 },

  blobUrls: [],
  isBuiltIn: true,
  createdAt: 0,
};
