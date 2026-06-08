"use client";

import { useEffect, useRef } from "react";
import { recordAutoAttendance, type AutoAttendanceResult } from "@/lib/community/attendance";
import { useAuthUser } from "@/lib/supabase/useAuthUser";

export const STREAK_MILESTONE_EVENT = "streak:milestone-reached";
export const STREAK_BROKEN_EVENT = "streak:broken";

export type StreakMilestoneEventDetail = NonNullable<AutoAttendanceResult["streakReward"]> & {
  currentStreak: number;
  longestStreak: number;
};

/**
 * 로그인 사용자의 일일 출석을 앱 진입 시 자동 기록한다.
 * 미션 진행(user_mission_progress), 캘린더 출석 이벤트, 연속 출석(streak) 체크인의 공통 소스다.
 * Streak 이정표 도달 시 `streak:milestone-reached` 커스텀 이벤트를 발행한다.
 */
export default function AttendanceRecorder() {
  const authUser = useAuthUser();
  const userId = authUser?.id ?? null;
  const lastUserRef = useRef<string | null>(null);

  useEffect(() => {
    if (!userId) {
      lastUserRef.current = null;
      return;
    }
    if (lastUserRef.current === userId) return;
    lastUserRef.current = userId;

    void (async () => {
      const result = await recordAutoAttendance(userId);
      if (typeof window === "undefined") return;
      if (result.streakReward && result.streak) {
        const detail: StreakMilestoneEventDetail = {
          ...result.streakReward,
          currentStreak: result.streak.currentStreak,
          longestStreak: result.streak.longestStreak,
        };
        window.dispatchEvent(new CustomEvent(STREAK_MILESTONE_EVENT, { detail }));
      } else if (
        result.recorded &&
        result.streak?.currentStreak === 1 &&
        result.streak.longestStreak > 1
      ) {
        // 끊긴 후 재시작: 이전 최장 streak가 1보다 크면 끊긴 것
        window.dispatchEvent(
          new CustomEvent(STREAK_BROKEN_EVENT, {
            detail: { longestStreak: result.streak.longestStreak },
          }),
        );
      }
    })();
  }, [userId]);

  return null;
}
