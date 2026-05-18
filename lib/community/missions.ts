import { supabase } from "@/lib/supabase/client";

export type MissionActionType = "attendance" | "comment" | "reaction" | "post";

export type DailyMission = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  actionType: MissionActionType;
  targetCount: number;
  rewardType: string | null;
  rewardPayload: Record<string, unknown> | null;
  active: boolean;
  sortOrder: number;
};

export type MissionProgress = {
  mission: DailyMission;
  progressCount: number;
  completedAt: string | null;
  rewardClaimedAt: string | null;
};

export type MissionBoard = {
  ymdKey: string;
  items: MissionProgress[];
  completedCount: number;
  totalCount: number;
};

function ymdLocal(now: Date): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function rowToMission(row: Record<string, unknown>): DailyMission {
  return {
    id: row.id as string,
    slug: row.slug as string,
    title: row.title as string,
    description: (row.description as string | null) ?? null,
    actionType: row.action_type as MissionActionType,
    targetCount: (row.target_count as number) ?? 1,
    rewardType: (row.reward_type as string | null) ?? null,
    rewardPayload: (row.reward_payload as Record<string, unknown> | null) ?? null,
    active: Boolean(row.active),
    sortOrder: (row.sort_order as number) ?? 0,
  };
}

export async function fetchActiveMissions(): Promise<DailyMission[]> {
  const { data, error } = await supabase
    .from("daily_missions")
    .select(
      "id, slug, title, description, action_type, target_count, reward_type, reward_payload, active, sort_order",
    )
    .eq("active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    if (error.message.toLowerCase().includes("does not exist")) return [];
    console.warn("[missions] fetch active failed:", error.message);
    return [];
  }

  return (data ?? []).map((row) => rowToMission(row as Record<string, unknown>));
}

export async function fetchMissionBoard(userId: string, now: Date = new Date()): Promise<MissionBoard> {
  const ymdKey = ymdLocal(now);
  const missions = await fetchActiveMissions();

  if (!userId || missions.length === 0) {
    return {
      ymdKey,
      items: missions.map((mission) => ({
        mission,
        progressCount: 0,
        completedAt: null,
        rewardClaimedAt: null,
      })),
      completedCount: 0,
      totalCount: missions.length,
    };
  }

  const { data, error } = await supabase
    .from("user_mission_progress")
    .select("mission_id, progress_count, completed_at, reward_claimed_at")
    .eq("user_id", userId)
    .eq("ymd_key", ymdKey);

  if (error) {
    console.warn("[missions] fetch progress failed:", error.message);
  }

  const progressByMissionId = new Map<
    string,
    { progressCount: number; completedAt: string | null; rewardClaimedAt: string | null }
  >();
  for (const row of (data ?? []) as Array<{
    mission_id: string;
    progress_count: number | null;
    completed_at: string | null;
    reward_claimed_at: string | null;
  }>) {
    progressByMissionId.set(row.mission_id, {
      progressCount: row.progress_count ?? 0,
      completedAt: row.completed_at,
      rewardClaimedAt: row.reward_claimed_at,
    });
  }

  const items: MissionProgress[] = missions.map((mission) => {
    const progress = progressByMissionId.get(mission.id);
    return {
      mission,
      progressCount: progress?.progressCount ?? 0,
      completedAt: progress?.completedAt ?? null,
      rewardClaimedAt: progress?.rewardClaimedAt ?? null,
    };
  });

  const completedCount = items.filter((item) => item.completedAt !== null).length;

  return {
    ymdKey,
    items,
    completedCount,
    totalCount: items.length,
  };
}

export async function bumpMissionProgress(
  userId: string,
  actionType: MissionActionType,
  delta = 1,
  now: Date = new Date(),
): Promise<void> {
  if (!userId || delta <= 0) return;

  const ymdKey = ymdLocal(now);
  const missions = await fetchActiveMissions();
  const targets = missions.filter((mission) => mission.actionType === actionType);
  if (targets.length === 0) return;

  for (const mission of targets) {
    const { data: existing, error: existingError } = await supabase
      .from("user_mission_progress")
      .select("id, progress_count, completed_at")
      .eq("user_id", userId)
      .eq("mission_id", mission.id)
      .eq("ymd_key", ymdKey)
      .maybeSingle();

    if (existingError && !existingError.message.toLowerCase().includes("no rows")) {
      console.warn("[missions] read existing failed:", existingError.message);
      continue;
    }

    if (!existing) {
      const nextCount = Math.min(delta, mission.targetCount);
      const completed = nextCount >= mission.targetCount;
      const { error } = await supabase.from("user_mission_progress").insert({
        user_id: userId,
        mission_id: mission.id,
        ymd_key: ymdKey,
        progress_count: nextCount,
        completed_at: completed ? new Date().toISOString() : null,
      });
      if (error) console.warn("[missions] insert progress failed:", error.message);
      continue;
    }

    if (existing.completed_at) continue;

    const previousCount = existing.progress_count ?? 0;
    const nextCount = Math.min(previousCount + delta, mission.targetCount);
    const completed = nextCount >= mission.targetCount;

    const { error } = await supabase
      .from("user_mission_progress")
      .update({
        progress_count: nextCount,
        completed_at: completed ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (error) console.warn("[missions] update progress failed:", error.message);
  }
}

export function summarizeMissionBoard(board: MissionBoard): string {
  if (board.totalCount === 0) return "오늘의 미션이 없어요.";
  const parts = board.items.map((item) => {
    const slugLabel = item.mission.title;
    if (item.completedAt) return `${slugLabel} ✓`;
    if (item.mission.targetCount <= 1) return `${slugLabel} ${item.progressCount}/1`;
    return `${slugLabel} ${item.progressCount}/${item.mission.targetCount}`;
  });
  return `오늘의 미션: ${parts.join(" · ")}`;
}
