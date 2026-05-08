import type { User } from "@supabase/supabase-js";

function readRoleFromMetadata(user: User | null | undefined): string | null {
  if (!user) return null;
  const appRole = user.app_metadata?.role;
  if (typeof appRole === "string" && appRole.trim()) return appRole.trim().toUpperCase();
  const userRole = user.user_metadata?.role;
  if (typeof userRole === "string" && userRole.trim()) return userRole.trim().toUpperCase();
  return null;
}

export function isAdminUser(user: User | null | undefined): boolean {
  return readRoleFromMetadata(user) === "ADMIN";
}
