export type AssistantSlotKey =
  | "what_now"
  | "work_recommendation"
  | "recommended_posts"
  | "guest_browse"
  | "guest_login_benefits"
  | "guest_meet_character"
  | "guest_hot_posts"
  | "guest_login"
  | "open_notifications"
  | "open_profile"
  | "open_character_room"
  | "open_write"
  | "open_notification_settings"
  | "today_activity"
  | "unreplied_queue"
  | "daily_missions"
  | "today_schedule"
  | "week_schedule"
  | "oshi_updates"
  | "sticker_reply"
  | "draft_resume";

export type AssistantSlotDefinition = {
  key: AssistantSlotKey;
  label: string;
  busyLabel: string;
};

export const ASSISTANT_SLOT_DEFINITIONS: Record<AssistantSlotKey, AssistantSlotDefinition> = {
  what_now: { key: "what_now", label: "지금 뭐하지?", busyLabel: "질문 중" },
  work_recommendation: { key: "work_recommendation", label: "작품 추천", busyLabel: "질문 중" },
  recommended_posts: { key: "recommended_posts", label: "볼만한 글", busyLabel: "찾는 중" },
  guest_browse: { key: "guest_browse", label: "둘러보기", busyLabel: "안내 중" },
  guest_login_benefits: { key: "guest_login_benefits", label: "로그인하면?", busyLabel: "정리 중" },
  guest_meet_character: { key: "guest_meet_character", label: "캐릭터는?", busyLabel: "소개 중" },
  guest_hot_posts: { key: "guest_hot_posts", label: "베스트 보기", busyLabel: "이동 중" },
  guest_login: { key: "guest_login", label: "로그인하기", busyLabel: "이동 중" },
  open_notifications: { key: "open_notifications", label: "알림", busyLabel: "이동 중" },
  open_profile: { key: "open_profile", label: "프로필", busyLabel: "이동 중" },
  open_character_room: { key: "open_character_room", label: "캐릭터", busyLabel: "이동 중" },
  open_write: { key: "open_write", label: "글쓰기", busyLabel: "이동 중" },
  open_notification_settings: { key: "open_notification_settings", label: "알림 설정", busyLabel: "이동 중" },
  today_activity: { key: "today_activity", label: "오늘 내 활동", busyLabel: "확인 중" },
  unreplied_queue: { key: "unreplied_queue", label: "내 미답글", busyLabel: "확인 중" },
  daily_missions: { key: "daily_missions", label: "오늘 미션", busyLabel: "확인 중" },
  today_schedule: { key: "today_schedule", label: "오늘 일정", busyLabel: "확인 중" },
  week_schedule: { key: "week_schedule", label: "이번 주", busyLabel: "확인 중" },
  oshi_updates: { key: "oshi_updates", label: "최애 새 소식", busyLabel: "확인 중" },
  sticker_reply: { key: "sticker_reply", label: "스티커 답글", busyLabel: "등록 중" },
  draft_resume: { key: "draft_resume", label: "임시저장 복귀", busyLabel: "여는 중" },
};

const DEFAULT_SLOTS: AssistantSlotKey[] = [
  "what_now",
  "work_recommendation",
  "recommended_posts",
  "unreplied_queue",
  "oshi_updates",
];

const GUEST_DEFAULT_SLOTS: AssistantSlotKey[] = [
  "what_now",
  "work_recommendation",
  "recommended_posts",
  "guest_login",
];

type SlotMatcher = {
  test: (pathname: string) => boolean;
  slots: AssistantSlotKey[];
};

const SLOT_MATCHERS: SlotMatcher[] = [
  {
    test: (pathname) => /^\/board\/[^\/]+\/write\b/.test(pathname),
    slots: ["draft_resume", "what_now", "recommended_posts", "daily_missions"],
  },
  {
    test: (pathname) => /^\/board\/[^\/]+\/[^\/]+(?:\/.*)?$/.test(pathname),
    slots: ["sticker_reply", "recommended_posts", "what_now", "unreplied_queue"],
  },
  {
    test: (pathname) => /^\/calendar(?:\/|$)/.test(pathname),
    slots: ["what_now", "work_recommendation", "today_schedule", "week_schedule", "oshi_updates"],
  },
  {
    test: (pathname) => /^\/releases(?:\/|$)/.test(pathname) || /^\/season(?:\/|$)/.test(pathname),
    slots: ["what_now", "work_recommendation", "today_schedule", "week_schedule", "oshi_updates"],
  },
  {
    test: (pathname) => /^\/profile(?:\/|$)/.test(pathname) || /^\/user(?:\/|$)/.test(pathname),
    slots: ["what_now", "work_recommendation", "unreplied_queue", "daily_missions", "oshi_updates"],
  },
  {
    test: (pathname) => /^\/notifications(?:\/|$)/.test(pathname),
    slots: ["what_now", "recommended_posts", "unreplied_queue", "daily_missions"],
  },
];

export function getAssistantSlots(pathname: string | null | undefined): AssistantSlotKey[] {
  if (!pathname) return DEFAULT_SLOTS;
  for (const matcher of SLOT_MATCHERS) {
    if (matcher.test(pathname)) return matcher.slots;
  }
  return DEFAULT_SLOTS;
}

export function getGuestAssistantSlots(pathname: string | null | undefined): AssistantSlotKey[] {
  if (!pathname) return GUEST_DEFAULT_SLOTS;
  if (/^\/board(?:\/|$)/.test(pathname)) {
    return ["what_now", "recommended_posts", "work_recommendation", "guest_login"];
  }
  if (/^\/calendar(?:\/|$)/.test(pathname) || /^\/releases(?:\/|$)/.test(pathname) || /^\/season(?:\/|$)/.test(pathname)) {
    return ["what_now", "work_recommendation", "recommended_posts", "guest_login"];
  }
  return GUEST_DEFAULT_SLOTS;
}

export function getAssistantSlotDefinitions(
  pathname: string | null | undefined,
): AssistantSlotDefinition[] {
  return getAssistantSlots(pathname).map((key) => ASSISTANT_SLOT_DEFINITIONS[key]);
}
