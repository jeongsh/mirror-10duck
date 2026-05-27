import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserProfile } from "@/types/community";

export type ProfileRole = UserProfile["role"];

/** `profiles.role` 기준 — 앱·DB RLS 공통 */
export function isAdminRole(role: string | null | undefined): boolean {
  return role === "ADMIN";
}

export async function getProfileRole(
  supabase: SupabaseClient,
  userId: string,
): Promise<ProfileRole | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data?.role) return null;
  return data.role as ProfileRole;
}

export async function isAdminUserId(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const role = await getProfileRole(supabase, userId);
  return isAdminRole(role);
}
