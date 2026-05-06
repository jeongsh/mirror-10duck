import { supabase } from "./client";
import { UserProfile } from "@/types/community";

export async function getProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error) {
    console.error("Error fetching profile:", error);
    return null;
  }

  return data;
}

export async function updateProfile(
  userId: string,
  updates: Partial<Omit<UserProfile, "id" | "user_id" | "created_at" | "updated_at">>
) {
  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function checkHandleAvailability(handle: string, excludeUserId?: string): Promise<boolean> {
  let query = supabase.from("profiles").select("id").eq("handle", handle);
  if (excludeUserId) {
    query = query.neq("user_id", excludeUserId);
  }
  
  const { data, error } = await query.limit(1);
  if (error) {
    throw error;
  }
  
  return data.length === 0;
}

export async function blockUser(blockerId: string, blockedId: string) {
  const { error } = await supabase
    .from("blocked_users")
    .insert({ blocker_id: blockerId, blocked_id: blockedId });
  if (error) throw error;
}

export async function unblockUser(blockerId: string, blockedId: string) {
  const { error } = await supabase
    .from("blocked_users")
    .delete()
    .eq("blocker_id", blockerId)
    .eq("blocked_id", blockedId);
  if (error) throw error;
}

export async function checkIsBlocked(blockerId: string, blockedId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("blocked_users")
    .select("id")
    .eq("blocker_id", blockerId)
    .eq("blocked_id", blockedId)
    .limit(1);
  
  if (error) return false;
  return data.length > 0;
}

