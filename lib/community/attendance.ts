import { supabase } from "@/lib/supabase/client";
import type { CalendarEvent } from "@/lib/otaku/hub";
import { bumpMissionProgress } from "@/lib/community/missions";

const ATTENDANCE_MISSION_SLUG = "attendance";

export function ymdLocal(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function ymdToKstMorningIso(ymd: string): string {
  return `${ymd}T09:00:00+09:00`;
}

export async function hasAttendanceToday(userId: string, now: Date = new Date()): Promise<boolean> {
  const day = ymdLocal(now);

  const { data: mission, error: missionError } = await supabase
    .from("daily_missions")
    .select("id")
    .eq("slug", ATTENDANCE_MISSION_SLUG)
    .eq("active", true)
    .maybeSingle();

  if (missionError || !mission?.id) return false;

  const { data: progress, error: progressError } = await supabase
    .from("user_mission_progress")
    .select("progress_count, completed_at")
    .eq("user_id", userId)
    .eq("mission_id", mission.id)
    .eq("ymd_key", day)
    .maybeSingle();

  if (progressError) return false;
  if (!progress) return false;
  return Boolean(progress.completed_at) || (progress.progress_count ?? 0) >= 1;
}

/** 로그인 시 하루 1회 출석 미션을 자동 완료한다. */
export async function recordAutoAttendance(userId: string): Promise<{ recorded: boolean }> {
  if (!userId) return { recorded: false };

  const already = await hasAttendanceToday(userId);
  if (already) return { recorded: false };

  await bumpMissionProgress(userId, "attendance", 1);
  return { recorded: true };
}

/** 캘린더에 표시할 출석 완료 이벤트 목록 (해당 월). */
export async function fetchAttendanceCalendarEvents(
  userId: string,
  monthCursor: Date,
): Promise<CalendarEvent[]> {
  if (!userId) return [];

  const year = monthCursor.getFullYear();
  const month = monthCursor.getMonth();
  const startYmd = ymdLocal(new Date(year, month, 1));
  const endYmd = ymdLocal(new Date(year, month + 1, 0));

  const { data: mission, error: missionError } = await supabase
    .from("daily_missions")
    .select("id")
    .eq("slug", ATTENDANCE_MISSION_SLUG)
    .maybeSingle();

  if (missionError || !mission?.id) return [];

  const { data: rows, error } = await supabase
    .from("user_mission_progress")
    .select("ymd_key, completed_at, progress_count")
    .eq("user_id", userId)
    .eq("mission_id", mission.id)
    .gte("ymd_key", startYmd)
    .lte("ymd_key", endYmd)
    .order("ymd_key", { ascending: true });

  if (error) {
    console.warn("[attendance] fetch calendar events failed:", error.message);
    return [];
  }

  return (rows ?? [])
    .filter((row) => {
      const ymd = row.ymd_key as string;
      if (!ymd) return false;
      return Boolean(row.completed_at) || (row.progress_count ?? 0) >= 1;
    })
    .map((row) => {
      const ymd = row.ymd_key as string;
      return {
        id: `attendance-${userId}-${ymd}`,
        category: "personal" as const,
        type: "attendance" as const,
        title: "출석완료",
        startsAt: ymdToKstMorningIso(ymd),
        timezone: "Asia/Seoul",
        platform: "10duck",
        isFollowing: true,
        reminderOffsetMinutes: null,
      };
    });
}
