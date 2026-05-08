import { supabase } from "./client";
import { Badge, UserBadge } from "@/types/community";

export async function getAllBadges(): Promise<Badge[]> {
  const { data, error } = await supabase
    .from("badges")
    .select("*")
    .order("rarity", { ascending: true });

  if (error) {
    console.error("Error fetching badges:", error);
    return [];
  }
  return data ?? [];
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
