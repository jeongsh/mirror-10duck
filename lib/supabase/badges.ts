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
