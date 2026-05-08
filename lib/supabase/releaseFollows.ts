import { supabase } from "@/lib/supabase/client";

export async function getCurrentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user?.id ?? null;
}

export async function fetchFollowedReleaseIds(userId: string) {
  const { data, error } = await supabase
    .from("user_release_follows")
    .select("release_item_id")
    .eq("user_id", userId)
    .eq("notify_enabled", true);

  if (error) throw error;
  return new Set(((data ?? []) as Array<{ release_item_id: string }>).map((item) => item.release_item_id));
}

export async function setReleaseFollow(userId: string, releaseItemId: string, enabled: boolean) {
  if (enabled) {
    const { error } = await supabase.from("user_release_follows").upsert(
      {
        user_id: userId,
        release_item_id: releaseItemId,
        notify_enabled: true,
      },
      { onConflict: "user_id,release_item_id" },
    );
    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from("user_release_follows")
    .delete()
    .eq("user_id", userId)
    .eq("release_item_id", releaseItemId);

  if (error) throw error;
}
