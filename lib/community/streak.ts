import { supabase } from "@/lib/supabase/client";

export const STREAK_MILESTONES: ReadonlyArray<{ days: number; badgeId: string; rarity: "common" | "rare" | "epic" | "legendary" }> = [
  { days: 3, badgeId: "streak_3", rarity: "common" },
  { days: 7, badgeId: "streak_7", rarity: "common" },
  { days: 14, badgeId: "streak_14", rarity: "rare" },
  { days: 30, badgeId: "streak_30", rarity: "rare" },
  { days: 50, badgeId: "streak_50", rarity: "epic" },
  { days: 100, badgeId: "streak_100", rarity: "epic" },
  { days: 365, badgeId: "streak_365", rarity: "legendary" },
];

export type StreakState = {
  currentStreak: number;
  longestStreak: number;
  lastCheckInDate: string | null;
  totalCheckIns: number;
};

export type StreakCheckInResult = StreakState & {
  /** 이번 호출에서 새로 도달한 연속 일수. 이정표 도달 여부 판단에 사용. */
  milestoneReached: number | null;
  /** 오늘 처음 체크인했는지 여부. false면 동일 일자 중복 호출이라 무시되었다. */
  recorded: boolean;
};

export type StreakGrantedBadge = {
  badgeId: string;
  earnedAt: string;
  wasNew: boolean;
};

function isMilestoneDay(days: number): boolean {
  return STREAK_MILESTONES.some((m) => m.days === days);
}

/**
 * 연속 출석 체크인. 로그인 직후 1회 호출한다.
 * - KST 기준 동일 일자 중복 호출은 서버에서 멱등 처리된다.
 * - milestoneReached 가 이정표 일수와 일치하면 보상 모달을 띄우면 된다.
 */
export async function checkInStreak(): Promise<StreakCheckInResult | null> {
  const { data, error } = await supabase.rpc("check_in_streak");

  if (error) {
    if (error.message?.toLowerCase().includes("auth required")) return null;
    console.warn("[streak] check-in failed:", error.message);
    return null;
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;

  const milestoneReachedRaw = (row as { milestone_reached: number | null }).milestone_reached;
  const milestoneReached = typeof milestoneReachedRaw === "number" ? milestoneReachedRaw : null;

  return {
    currentStreak: (row as { current_streak: number }).current_streak ?? 0,
    longestStreak: (row as { longest_streak: number }).longest_streak ?? 0,
    lastCheckInDate: (row as { last_check_in_date: string | null }).last_check_in_date ?? null,
    totalCheckIns: (row as { total_check_ins: number }).total_check_ins ?? 0,
    milestoneReached,
    recorded: milestoneReached !== null,
  };
}

/**
 * 현재 streak가 도달한 이정표 배지를 일괄 지급한다.
 * checkInStreak() 결과의 milestoneReached가 이정표일 때만 호출하면 충분하지만,
 * 과거에 누락된 배지를 회수하는 용도로도 안전하게 재호출 가능하다.
 */
export async function grantStreakBadges(): Promise<StreakGrantedBadge[]> {
  const { data, error } = await supabase.rpc("grant_streak_badges");

  if (error) {
    if (error.message?.toLowerCase().includes("auth required")) return [];
    console.warn("[streak] grant badges failed:", error.message);
    return [];
  }

  if (!Array.isArray(data)) return [];
  return data.map((row) => ({
    badgeId: (row as { badge_id: string }).badge_id,
    earnedAt: (row as { earned_at: string }).earned_at,
    wasNew: Boolean((row as { was_new: boolean }).was_new),
  }));
}

/**
 * 특정 사용자의 streak 상태를 조회한다.
 * RLS는 SELECT 전체 공개라 본인/타인 모두 호출 가능 (공개 프로필 노출용).
 */
export async function fetchStreak(userId: string): Promise<StreakState | null> {
  if (!userId) return null;

  const { data, error } = await supabase
    .from("user_streaks")
    .select("current_streak, longest_streak, last_check_in_date, total_check_ins")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    if (error.message?.toLowerCase().includes("does not exist")) return null;
    console.warn("[streak] fetch failed:", error.message);
    return null;
  }
  if (!data) return null;

  return {
    currentStreak: (data as { current_streak: number }).current_streak ?? 0,
    longestStreak: (data as { longest_streak: number }).longest_streak ?? 0,
    lastCheckInDate: (data as { last_check_in_date: string | null }).last_check_in_date ?? null,
    totalCheckIns: (data as { total_check_ins: number }).total_check_ins ?? 0,
  };
}

/**
 * 다음 이정표까지의 진행도를 계산한다.
 * - currentMilestone: 현재 이미 도달한 가장 큰 이정표 (없으면 null)
 * - nextMilestone:   아직 도달하지 않은 가장 가까운 이정표 (없으면 null = 모두 달성)
 * - progress:        0~1 사이 진행도 (currentMilestone과 nextMilestone 사이 비율)
 */
export function getStreakProgress(currentStreak: number): {
  currentMilestone: number | null;
  nextMilestone: number | null;
  progress: number;
} {
  const sorted = [...STREAK_MILESTONES].sort((a, b) => a.days - b.days);

  let current: number | null = null;
  let next: number | null = null;

  for (const m of sorted) {
    if (currentStreak >= m.days) {
      current = m.days;
    } else if (next === null) {
      next = m.days;
      break;
    }
  }

  if (next === null) {
    return { currentMilestone: current, nextMilestone: null, progress: 1 };
  }

  const base = current ?? 0;
  const span = next - base;
  const advanced = currentStreak - base;
  const progress = span <= 0 ? 1 : Math.max(0, Math.min(1, advanced / span));

  return { currentMilestone: current, nextMilestone: next, progress };
}

/**
 * 새로 도달한 milestone 이정표 정보를 돌려준다.
 * checkInStreak() 결과의 milestoneReached를 그대로 넣으면 된다.
 */
export function getReachedMilestone(milestoneReached: number | null): {
  days: number;
  badgeId: string;
  rarity: "common" | "rare" | "epic" | "legendary";
} | null {
  if (milestoneReached === null) return null;
  if (!isMilestoneDay(milestoneReached)) return null;
  return STREAK_MILESTONES.find((m) => m.days === milestoneReached) ?? null;
}
