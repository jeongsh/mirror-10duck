import type { CharacterProfile } from "@/types/character";
import { withRecommendedScenarioMap } from "@/types/character";

/**
 * mao_pro 샘플을 우리 서비스의 기본 내장 캐릭터로 래핑.
 * 업로드 플로우 없이 늘 라이브러리에 존재해 "로드 예시" 역할을 한다.
 */
export const MAO_PRO_PROFILE: CharacterProfile = withRecommendedScenarioMap({
  id: "builtin-mao-pro",
  name: "마오쨩 (샘플)",
  description:
    "Cubism SDK 공식 샘플 캐릭터. 기본 내장. 업로드 없이 바로 로드되며 매핑/모핑/옷 기능 데모용으로 사용된다.",
  modelPath: "/live2d/mao_pro/mao_pro.model3.json",

  expressionMap: {
    idle: "exp_01",
    happy: "exp_02",
    sad: "exp_08",
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
      happy: [
        "좋아요. 이 흐름은 이어가도 괜찮겠어요.",
        "반응이 나쁘지 않아요. 지금 타이밍에 한 번 더 보면 좋아요.",
        "잘 챙겼어요. 다음에 볼 것도 제가 옆에서 정리해둘게요.",
        "방금 선택은 괜찮았어요. 이어서 볼 만한 것까지 같이 챙겨볼게요.",
        "지금은 분위기가 좋아요. 중요한 것부터 하나씩 처리해요.",
      ],
      sad: [
        "잠깐 막혔네요. 급하게 누르지 말고 한 번만 다시 확인해요.",
        "괜찮아요. 지금은 놓친 부분부터 천천히 보면 돼요.",
        "아쉬운 흐름이에요. 그래도 되돌릴 수 있는 것부터 같이 볼게요.",
        "조금 아쉽지만 괜찮아요. 다음 행동으로 이어갈 수 있게 정리해볼게요.",
        "지금은 쉬어가도 돼요. 알림은 제가 조용히 챙겨둘게요.",
      ],
      angry: [
        "이건 조금 날카로운 이슈예요. 바로 반응하기 전에 맥락부터 볼까요?",
        "잠깐 숨 고르고 정리해요. 말머리와 댓글 흐름을 같이 보면 좋아요.",
        "분위기가 세요. 필요한 정보만 먼저 골라볼게요.",
      ],
      surprised: [
        "어, 방금 흐름이 바뀐 것 같아요. 새 글이나 알림을 확인해볼까요?",
        "예상 밖이네요. 바로 판단하지 말고 원문부터 열어봐요.",
        "새로운 신호가 보여요. 제가 표시해둘게요.",
      ],
      shy: [
        "저는 조용히 옆에 있을게요. 필요한 때만 불러주세요.",
        "지금은 크게 끼어들지 않을게요. 말풍선만 살짝 띄워둘게요.",
        "천천히 둘러봐도 괜찮아요. 처음부터 다 정하지 않아도 돼요.",
      ],
      love: [
        "이건 취향에 맞을지도 몰라요. 관심작으로 남겨둘까요?",
        "좋아하는 포인트가 보여요. 나중에 다시 볼 수 있게 저장하면 좋아요.",
        "이 흐름은 기억해둘 만해요. 로그인하면 더 잘 챙겨드릴게요.",
      ],
      wink: [
        "작은 힌트 하나만요. 반응 많은 글부터 보면 실패가 적어요.",
        "이건 체크해두면 좋아요. 나중에 놓치기 쉬운 정보예요.",
        "처음이면 최신순보다 반응순이 더 편할 때가 많아요.",
      ],
    },
    actions: {
      tap_head: [
        "네, 불렀죠? 지금 화면 기준으로 바로 도와드릴게요.",
        "여기 있어요. 글을 볼지, 알림을 볼지 먼저 골라볼까요?",
        "캐릭터 대기 중이에요. 필요한 것만 짧게 정리해드릴게요.",
        "불렀으면 대답해야죠. 지금 화면에서 할 수 있는 걸 골라봐요.",
        "어디부터 볼지 애매하면 제가 흐름을 먼저 잡아드릴게요.",
      ],
      attention: [
        "좋아요. 지금 화면에서 할 수 있는 걸 먼저 보여드릴게요.",
        "필요한 걸 골라볼까요? 너무 많이 말하지 않고 핵심만 챙길게요.",
        "지금 보고 있는 흐름부터 같이 정리해볼게요.",
        "제가 메뉴를 열어둘게요. 당장 필요한 것만 눌러주세요.",
        "복잡해 보이면 알림, 미션, 채널 순서로 보면 편해요.",
      ],
      tap_other: [
        "어디를 눌러도 괜찮아요. 필요한 메뉴만 띄워드릴게요.",
        "지금은 대화 메뉴를 열어둘게요. 보고 싶은 걸 골라주세요.",
        "제가 화면을 가리지 않게 짧게만 도와드릴게요.",
        "그쪽도 반응해요. 캐릭터는 한 부위만 누르는 버튼이 아니니까요.",
        "네, 들었어요. 지금 필요한 기능을 바로 고를 수 있게 해둘게요.",
      ],
      greet: [
        "어서와요. 오늘은 어떤 채널부터 볼까요?",
        "돌아왔네요. 새 글, 알림, 미션 중에 먼저 챙길 걸 골라봐요.",
        "오늘 흐름은 제가 옆에서 같이 볼게요.",
        "오랜만이면 베스트부터, 자주 왔다면 알림부터 보는 게 좋아요.",
        "오늘도 옆에 있을게요. 방해되지 않게 필요한 때만 말할게요.",
      ],
      typing: [
        "작성 중이네요. 말머리와 스포일러 표시만 먼저 확인해요.",
        "제목은 짧게, 본문은 핵심부터. 막히면 잠깐 정리해드릴게요.",
        "지금은 조용히 있을게요. 임시저장만 잊지 마세요.",
        "댓글을 부를 글이면 질문을 마지막에 남기는 것도 좋아요.",
        "본문이 길어지면 문단을 나눠요. 모바일에서 읽기 편해야 해요.",
      ],
      cheer: [
        "좋아요. 이 정도면 다음 행동으로 넘어가도 괜찮겠어요.",
        "괜찮은 흐름이에요. 지금 타이밍 놓치지 말고 이어가요.",
        "잘하고 있어요. 제가 옆에서 놓친 것만 챙겨볼게요.",
        "조금만 더 가면 오늘 미션도 채울 수 있겠어요.",
        "이 흐름이면 답글 하나 남겨도 괜찮겠어요.",
      ],
      thinking: [
        "잠깐만요. 조건을 조금 좁히면 더 빨리 찾을 수 있어요.",
        "비슷한 글이 많을 땐 말머리와 반응 수를 같이 보면 좋아요.",
        "지금은 바로 결론보다 흐름을 먼저 보는 게 낫겠어요.",
        "찾는 게 작품인지, 채널인지, 일정인지 먼저 나누면 빨라져요.",
        "정보가 많을 땐 새 글보다 저장된 관심 흐름부터 보는 게 나아요.",
      ],
      celebrate: [
        "축하해요. 이 반응은 기록해둘 만해요.",
        "좋은 반응이네요. 다음 글에도 이어갈 포인트가 보여요.",
        "방금 건 꽤 괜찮았어요. 알림이 더 오면 제가 챙겨둘게요.",
        "이건 그냥 넘기기 아깝네요. 프로필 기록에서도 확인해볼 수 있어요.",
        "좋은 타이밍이에요. 이어서 댓글 반응까지 확인해볼까요?",
      ],
      special: [
        "오늘의 추천을 열어볼까요? 너무 넓게 말고 취향에 가까운 것부터요.",
        "새로운 작품을 고를 땐 일정과 반응을 같이 보면 좋아요.",
        "취향에 맞는 후보를 천천히 추려볼게요.",
        "지금은 많이 고르는 것보다 하나를 제대로 남기는 게 좋아요.",
        "관심작이 늘어나면 제가 일정과 새 소식을 같이 챙겨드릴게요.",
      ],
    },
  },

  defaultView: { scale: 0.09, x: -96, y: -55 },

  blobUrls: [],
  isBuiltIn: true,
  createdAt: 0,
});

/**
 * Pichu 모델 기본 내장 프로필.
 * 사용자가 처음 진입했을 때 기본 캐릭터로 로드된다.
 */
export const PICHU_PROFILE: CharacterProfile = withRecommendedScenarioMap({
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
});
