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
    attention: { group: "", index: 1 },
    tap_other: { group: "", index: 2 },
    greet: { group: "", index: 3 },
    cheer: { group: "", index: 4 },
    celebrate: { group: "", index: 4 },
    typing: { group: "", index: 5 },
    special: { group: "", index: 5 },
  },

  hitAreaMap: [
    { hitAreaId: "HitAreaHead", action: "tap_head" },
    { hitAreaId: "HitAreaBody", action: "attention" },
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
      happy: ["좋은 소식이에요.", "기분 좋은 흐름이네요.", "좋아요, 계속 가볼까요?"],
      sad: ["잠깐 쉬어가도 괜찮아요.", "천천히 다시 보면 돼요.", "아쉬운 부분이 있었네요."],
      angry: ["잠깐 숨 고르고 정리해볼까요?", "이건 차분히 확인해봐요.", "조금 날카로운 이슈네요."],
      surprised: ["오, 새로운 소식이에요.", "예상 밖인데요?", "확인해볼 만하겠어요."],
      shy: ["조용히 지켜볼게요.", "살짝 떨리지만 괜찮아요.", "천천히 해도 돼요."],
      love: ["관심 작품으로 저장해둘까요?", "취향에 꽤 맞을지도 몰라요.", "좋아하는 포인트가 보여요."],
      wink: ["작은 힌트 하나 줄게요.", "이건 체크해두면 좋아요.", "놓치지 말고 봐요."],
    },
    actions: {
      tap_head: ["불렀나요?", "여기 있어요.", "무엇을 찾아볼까요?"],
      attention: ["네, 확인해볼게요.", "필요한 걸 골라볼까요?", "지금 보고 있는 내용부터 정리해볼게요."],
      tap_other: ["도움이 필요하면 말해줘요.", "작품을 찾아볼까요?", "추천이 필요할까요?"],
      greet: ["어서와요.", "오늘 볼 작품을 찾아볼까요?", "새 소식부터 볼까요?"],
      typing: ["리뷰를 정리 중이군요.", "한 줄 평부터 써볼까요?", "생각을 천천히 적어봐요."],
      cheer: ["좋아요, 계속 가봐요.", "괜찮은 흐름이에요.", "이 기세로 정리해봐요."],
      thinking: ["잠깐 생각해볼게요.", "조건을 조금 더 좁혀볼까요?", "비슷한 작품을 찾아볼게요."],
      celebrate: ["축하해요.", "좋은 반응이네요.", "이 글은 더 많은 사람이 볼 만해요."],
      special: ["오늘의 추천을 열어볼까요?", "새로운 작품을 골라볼까요?", "취향에 맞는 후보를 찾아볼게요."],
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
