import { supabase } from "./client";
import { Badge, UserBadge } from "@/types/community";

const DEFAULT_BADGES: Badge[] = [
  {
    id: "first_oshi",
    name: "입덕 완료",
    description: "최애 첫 등록",
    icon: "✨",
    rarity: "common",
    condition_type: "oshi_count",
    condition_value: 1,
    created_at: new Date().toISOString(),
  },
  {
    id: "oshi_trio",
    name: "삼각편대",
    description: "최애 3개 등록",
    icon: "🎯",
    rarity: "common",
    condition_type: "oshi_count",
    condition_value: 3,
    created_at: new Date().toISOString(),
  },
  {
    id: "oshi_max",
    name: "덕후의 증명",
    description: "최애 5개 등록",
    icon: "🏅",
    rarity: "rare",
    condition_type: "oshi_count",
    condition_value: 5,
    created_at: new Date().toISOString(),
  },
  {
    id: "first_post",
    name: "첫 발자국",
    description: "게시글 첫 작성",
    icon: "📝",
    rarity: "common",
    condition_type: "post_count",
    condition_value: 1,
    created_at: new Date().toISOString(),
  },
  {
    id: "first_comment",
    name: "첫 마디",
    description: "댓글 첫 작성",
    icon: "💬",
    rarity: "common",
    condition_type: "comment_count",
    condition_value: 1,
    created_at: new Date().toISOString(),
  },
  {
    id: "hot_post_author",
    name: "개념글 달성",
    description: "내 글 개념글 등극 1회",
    icon: "🔥",
    rarity: "rare",
    condition_type: "hot_post",
    condition_value: 1,
    created_at: new Date().toISOString(),
  },
  {
    id: "hot_post_3",
    name: "개념글 3회",
    description: "내 글 개념글 등극 3회",
    icon: "🏆",
    rarity: "epic",
    condition_type: "hot_post",
    condition_value: 3,
    created_at: new Date().toISOString(),
  },
  {
    id: "follow_start",
    name: "인연의 시작",
    description: "팔로우 5명 이상",
    icon: "🤝",
    rarity: "common",
    condition_type: "follow_start",
    condition_value: 5,
    created_at: new Date().toISOString(),
  },
  {
    id: "early_bird",
    name: "초기 멤버",
    description: "가입 후 1주일 이내 최애 등록",
    icon: "🌅",
    rarity: "rare",
    condition_type: "early_bird",
    condition_value: 1,
    created_at: new Date().toISOString(),
  },
  // 연속 출석 Streak 이정표 배지 (DB 연동 전 폴백용)
  { id: "streak_3",   name: "사흘짜리 다짐",     description: "연속 출석 3일 달성",   icon: "🔥", rarity: "common",    condition_type: "streak_days", condition_value: 3,   created_at: new Date().toISOString() },
  { id: "streak_7",   name: "일주일의 약속",     description: "연속 출석 7일 달성",   icon: "🔥", rarity: "common",    condition_type: "streak_days", condition_value: 7,   created_at: new Date().toISOString() },
  { id: "streak_14",  name: "본방사수 14일",     description: "연속 출석 14일 달성",  icon: "🔥", rarity: "rare",      condition_type: "streak_days", condition_value: 14,  created_at: new Date().toISOString() },
  { id: "streak_30",  name: "한 달 만근개근",    description: "연속 출석 30일 달성",  icon: "🔥", rarity: "rare",      condition_type: "streak_days", condition_value: 30,  created_at: new Date().toISOString() },
  { id: "streak_50",  name: "안방 출퇴근러",     description: "연속 출석 50일 달성",  icon: "🔥", rarity: "epic",      condition_type: "streak_days", condition_value: 50,  created_at: new Date().toISOString() },
  { id: "streak_100", name: "100일 회차 정주행", description: "연속 출석 100일 달성", icon: "🔥", rarity: "epic",      condition_type: "streak_days", condition_value: 100, created_at: new Date().toISOString() },
  { id: "streak_365", name: "1년차 고인물",      description: "연속 출석 365일 달성", icon: "🔥", rarity: "legendary", condition_type: "streak_days", condition_value: 365, created_at: new Date().toISOString() },
];

export async function getAllBadges(): Promise<Badge[]> {
  const { data, error } = await supabase
    .from("badges")
    .select("*")
    .order("rarity", { ascending: true });

  if (error) {
    console.error("Error fetching badges:", error);
    return DEFAULT_BADGES;
  }

  const badges = data ?? [];
  return badges.length > 0 ? badges : DEFAULT_BADGES;
}

export async function getUserBadges(userId: string): Promise<UserBadge[]> {
  const { data, error } = await supabase
    .from("user_badges")
    .select("*, badge:badges(*)")
    .eq("user_id", userId)
    .order("earned_at", { ascending: false });

  if (error) {
    console.error("Error fetching user badges:", error);
    return [];
  }
  return data ?? [];
}

export async function checkAndGrantOshiBadges(userId: string): Promise<string[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)("check_and_grant_oshi_badges", {
    p_user_id: userId,
  });

  if (error) {
    console.error("Error granting badges:", error);
    return [];
  }
  return data ?? [];
}

export async function checkAndGrantActivityBadges(userId: string): Promise<string[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)("check_and_grant_activity_badges", {
    p_user_id: userId,
  });

  if (error) return [];
  return data ?? [];
}
