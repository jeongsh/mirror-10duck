import { supabase } from "@/lib/supabase/client";
import { setOfficialWorkFollow } from "@/lib/supabase/officialWorkFollows";

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
  const releaseIds = new Set(
    ((data ?? []) as Array<{ release_item_id: string }>).map((item) => item.release_item_id),
  );

  const { data: officialRows, error: officialError } = await supabase
    .from("user_official_work_follows")
    .select("official_work_id")
    .eq("user_id", userId)
    .eq("notify_enabled", true);

  if (officialError) {
    if (officialError.code !== "42P01" && officialError.code !== "42703") throw officialError;
    return releaseIds;
  }

  const officialWorkIds = ((officialRows ?? []) as Array<{ official_work_id: string }>).map(
    (item) => item.official_work_id,
  );
  if (officialWorkIds.length === 0) return releaseIds;

  const { data: linkedRows, error: linkedError } = await supabase
    .from("release_items")
    .select("id")
    .in("official_work_id", officialWorkIds);

  if (linkedError) {
    if (linkedError.code !== "42703") throw linkedError;
    return releaseIds;
  }

  for (const row of (linkedRows ?? []) as Array<{ id: string }>) {
    releaseIds.add(row.id);
  }

  return releaseIds;
}

export async function setReleaseFollow(userId: string, releaseItemId: string, enabled: boolean) {
  const { data: releaseRow, error: releaseError } = await supabase
    .from("release_items")
    .select("official_work_id")
    .eq("id", releaseItemId)
    .maybeSingle();

  if (releaseError && releaseError.code !== "42703") throw releaseError;
  const officialWorkId = (releaseRow as { official_work_id?: string | null } | null)?.official_work_id;

  if (officialWorkId) {
    await setOfficialWorkFollow(userId, officialWorkId, enabled);
  }

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
