"use client";

import { useEffect, useRef } from "react";
import { recordAutoAttendance } from "@/lib/community/attendance";
import { useAuthUser } from "@/lib/supabase/useAuthUser";

/**
 * 로그인 사용자의 일일 출석을 앱 진입 시 자동 기록한다.
 * 미션 진행(user_mission_progress)과 캘린더 출석 이벤트의 공통 소스다.
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

    void recordAutoAttendance(userId);
  }, [userId]);

  return null;
}
