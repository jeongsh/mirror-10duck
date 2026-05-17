import { supabase } from "./client";

export const XP_AMOUNTS = {
  POST_CREATED: 30,
  FEED_CREATED: 20,
  COMMENT_CREATED: 10,
  UPVOTE_RECEIVED: 5,
  REACTION_RECEIVED: 3,
  DAILY_LOGIN: 5,
  HOT_PROMOTED: 50,
} as const;

/**
 * 각 레벨에 필요한 누적 총 XP.
 * 인덱스 0 = Lv.1 (0 XP), 인덱스 1 = Lv.2 (100 XP) ...
 */
export const LEVEL_THRESHOLDS = [
  0,       // Lv.1
  100,     // Lv.2  (+100)
  300,     // Lv.3  (+200)
  650,     // Lv.4  (+350)
  1_200,   // Lv.5  (+550)
  2_000,   // Lv.6  (+800)
  3_100,   // Lv.7  (+1,100)
  4_600,   // Lv.8  (+1,500)
  6_600,   // Lv.9  (+2,000)
  9_200,   // Lv.10 (+2,600)
  12_600,  // Lv.11 (+3,400)
  17_000,  // Lv.12 (+4,400)
  22_500,  // Lv.13 (+5,500)
  29_500,  // Lv.14 (+7,000)
  38_000,  // Lv.15 (+8,500)
  48_500,  // Lv.16 (+10,500)
  61_500,  // Lv.17 (+13,000)
  77_500,  // Lv.18 (+16,000)
  97_000,  // Lv.19 (+19,500)
  120_000, // Lv.20 (+23,000)
] as const;

export function getLevelFromXp(xp: number): number {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i]) return i + 1;
  }
  return 1;
}

export function getLevelInfo(xp: number) {
  const level = getLevelFromXp(xp);
  const currentThreshold = LEVEL_THRESHOLDS[level - 1] ?? 0;
  const nextThreshold = LEVEL_THRESHOLDS[level] ?? null;
  const xpInLevel = xp - currentThreshold;
  const xpNeeded = nextThreshold !== null ? nextThreshold - currentThreshold : null;
  const progress = xpNeeded ? Math.min(100, (xpInLevel / xpNeeded) * 100) : 100;
  return { level, xp, currentThreshold, nextThreshold, xpInLevel, xpNeeded, progress };
}

/** userId 에게 amount XP를 지급하고 레벨을 동기화 */
export async function grantExperience(userId: string, amount: number): Promise<void> {
  if (!userId || amount <= 0) return;
  const { data: profile } = await supabase
    .from("profiles")
    .select("experience_points")
    .eq("user_id", userId)
    .single();

  if (!profile) return;

  const newXp = ((profile as { experience_points?: number }).experience_points ?? 0) + amount;
  const newLevel = getLevelFromXp(newXp);

  await supabase
    .from("profiles")
    .update({ experience_points: newXp, level: newLevel })
    .eq("user_id", userId);
}

/**
 * 일일 접속 XP 지급 (하루 1회).
 * @returns 실제로 지급됐으면 true
 */
export async function checkAndGrantDailyLogin(userId: string): Promise<boolean> {
  if (!userId) return false;
  const today = new Date().toISOString().split("T")[0];

  const { data: profile } = await supabase
    .from("profiles")
    .select("experience_points, level, last_daily_xp_at")
    .eq("user_id", userId)
    .single();

  if (!profile) return false;
  const p = profile as { experience_points?: number; level?: number; last_daily_xp_at?: string | null };

  if (p.last_daily_xp_at === today) return false;

  const newXp = (p.experience_points ?? 0) + XP_AMOUNTS.DAILY_LOGIN;
  const newLevel = getLevelFromXp(newXp);

  const { error } = await supabase
    .from("profiles")
    .update({ experience_points: newXp, level: newLevel, last_daily_xp_at: today })
    .eq("user_id", userId);

  return !error;
}
