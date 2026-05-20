import { supabase } from "@/lib/supabase/client";
import { bumpMissionProgress } from "@/lib/community/missions";

const ATTENDANCE_MISSION_SLUG = "attendance";

export type AttendanceMonthSummary = {
  /** 해당 월에 출석 완료한 날짜 (YYYY-MM-DD) */
  attendedYmds: string[];
  /** 이번 달 출석 일수 */
  monthCount: number;
  /** 누적 출석 일수 */
  totalCount: number;
};

export function ymdLocal(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

async function getAttendanceMissionId(): Promise<string | null> {
  const { data: mission, error } = await supabase
    .from("daily_missions")
    .select("id")
    .eq("slug", ATTENDANCE_MISSION_SLUG)
    .maybeSingle();

  if (error || !mission?.id) return null;
  return mission.id as string;
}

function isAttendedRow(row: { completed_at: string | null; progress_count: number | null }): boolean {
  return Boolean(row.completed_at) || (row.progress_count ?? 0) >= 1;
}

/** 캘린더 출석 도장·횟수 표시용 (해당 월 + 누적). */
export async function fetchAttendanceMonthSummary(
  userId: string,
  monthCursor: Date,
): Promise<AttendanceMonthSummary> {
  const empty: AttendanceMonthSummary = { attendedYmds: [], monthCount: 0, totalCount: 0 };
  if (!userId) return empty;

  const missionId = await getAttendanceMissionId();
  if (!missionId) return empty;

  const year = monthCursor.getFullYear();
  const month = monthCursor.getMonth();
  const startYmd = ymdLocal(new Date(year, month, 1));
  const endYmd = ymdLocal(new Date(year, month + 1, 0));

  const [monthResult, totalResult] = await Promise.all([
    supabase
      .from("user_mission_progress")
      .select("ymd_key, completed_at, progress_count")
      .eq("user_id", userId)
      .eq("mission_id", missionId)
      .gte("ymd_key", startYmd)
      .lte("ymd_key", endYmd)
      .order("ymd_key", { ascending: true }),
    supabase
      .from("user_mission_progress")
      .select("ymd_key, completed_at, progress_count", { count: "exact", head: false })
      .eq("user_id", userId)
      .eq("mission_id", missionId),
  ]);

  if (monthResult.error) {
    console.warn("[attendance] fetch month summary failed:", monthResult.error.message);
    return empty;
  }

  const attendedYmds = (monthResult.data ?? [])
    .filter((row) => {
      const ymd = row.ymd_key as string;
      return Boolean(ymd) && isAttendedRow(row);
    })
    .map((row) => row.ymd_key as string);

  let totalCount = 0;
  if (!totalResult.error && totalResult.data) {
    totalCount = totalResult.data.filter((row) => isAttendedRow(row)).length;
  } else if (totalResult.error) {
    console.warn("[attendance] fetch total count failed:", totalResult.error.message);
    totalCount = attendedYmds.length;
  }

  return {
    attendedYmds,
    monthCount: attendedYmds.length,
    totalCount,
  };
}
