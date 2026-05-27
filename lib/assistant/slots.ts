export type AssistantSlotKey =
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
  "today_activity",
  "unreplied_queue",
  "daily_missions",
];

type SlotMatcher = {
  test: (pathname: string) => boolean;
  slots: AssistantSlotKey[];
};

const SLOT_MATCHERS: SlotMatcher[] = [
  {
    test: (pathname) => /^\/board\/[^\/]+\/write\b/.test(pathname),
    slots: ["draft_resume", "today_activity", "daily_missions"],
  },
  {
    test: (pathname) => /^\/board\/[^\/]+\/[^\/]+(?:\/.*)?$/.test(pathname),
    slots: ["sticker_reply", "unreplied_queue", "daily_missions"],
  },
  {
    test: (pathname) => /^\/calendar(?:\/|$)/.test(pathname),
    slots: ["today_schedule", "week_schedule", "oshi_updates"],
  },
  {
    test: (pathname) => /^\/releases(?:\/|$)/.test(pathname) || /^\/season(?:\/|$)/.test(pathname),
    slots: ["today_schedule", "week_schedule", "oshi_updates"],
  },
];

export function getAssistantSlots(pathname: string | null | undefined): AssistantSlotKey[] {
  if (!pathname) return DEFAULT_SLOTS;
  for (const matcher of SLOT_MATCHERS) {
    if (matcher.test(pathname)) return matcher.slots;
  }
  return DEFAULT_SLOTS;
}

export function getAssistantSlotDefinitions(
  pathname: string | null | undefined,
): AssistantSlotDefinition[] {
  return getAssistantSlots(pathname).map((key) => ASSISTANT_SLOT_DEFINITIONS[key]);
}
