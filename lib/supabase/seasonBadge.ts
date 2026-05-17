import { supabase } from "./client";

export type SeasonCode = "spring" | "summer" | "fall" | "winter";

export const SEASON_META: Record<SeasonCode, { label: string; icon: string; months: number[] }> = {
  spring: { label: "봄",  icon: "🌸", months: [4, 5, 6] },
  summer: { label: "여름", icon: "☀️", months: [7, 8, 9] },
  fall:   { label: "가을", icon: "🍂", months: [10, 11, 12] },
  winter: { label: "겨울", icon: "❄️", months: [1, 2, 3] },
};

export const SEASON_ORDER: SeasonCode[] = ["spring", "summer", "fall", "winter"];

export function getSeasonBadgeId(season: SeasonCode): string {
  return `season_${season}`;
}

/**
 * Supabase RPC `grant_my_season_badge` 호출.
 * SECURITY DEFINER 함수이므로 RLS 우회 → 뱃지 지급 원자 처리.
 */
export async function grantSeasonBadgeToUser(): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.rpc as any)("grant_my_season_badge");
}
