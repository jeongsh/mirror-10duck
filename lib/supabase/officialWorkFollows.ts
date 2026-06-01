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

export async function fetchFollowedOfficialWorkTitles(userId: string) {
  const { data, error } = await supabase
    .from("user_official_work_follows")
    .select("official_works(title, original_title)")
    .eq("user_id", userId)
    .eq("notify_enabled", true);

  if (error) throw error;

  const titles = new Set<string>();
  for (const row of (data ?? []) as Array<{
    official_works: { title?: string | null; original_title?: string | null } | { title?: string | null; original_title?: string | null }[] | null;
  }>) {
    const works = Array.isArray(row.official_works) ? row.official_works : row.official_works ? [row.official_works] : [];
    for (const work of works) {
      if (work.title) titles.add(work.title);
      if (work.original_title) titles.add(work.original_title);
    }
  }

  return titles;
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
