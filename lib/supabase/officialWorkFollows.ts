import { supabase } from "@/lib/supabase/client";

export async function fetchFollowedOfficialWorkIds(userId: string) {
  const { data, error } = await supabase
    .from("user_official_work_follows")
    .select("official_work_id")
    .eq("user_id", userId)
    .eq("notify_enabled", true);

  if (error) throw error;

  return new Set(
    ((data ?? []) as Array<{ official_work_id: string }>).map(
      (item) => item.official_work_id,
    ),
  );
}

export async function setOfficialWorkFollow(
  userId: string,
  officialWorkId: string,
  enabled: boolean,
) {
  if (enabled) {
    const { error } = await supabase.from("user_official_work_follows").upsert(
      {
        user_id: userId,
        official_work_id: officialWorkId,
        notify_enabled: true,
      },
      { onConflict: "user_id,official_work_id" },
    );
    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from("user_official_work_follows")
    .delete()
    .eq("user_id", userId)
    .eq("official_work_id", officialWorkId);

  if (error) throw error;
}
