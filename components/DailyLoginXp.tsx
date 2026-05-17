"use client";

import { useEffect, useRef } from "react";
import { useAuthUser } from "@/lib/supabase/useAuthUser";
import { checkAndGrantDailyLogin } from "@/lib/supabase/experience";
import { grantSeasonBadgeToUser } from "@/lib/supabase/seasonBadge";

/** 로그인 상태일 때 하루 1회 접속 XP 지급 + 시즌 가입 뱃지 자동 지급 */
export default function DailyLoginXp() {
  const user = useAuthUser();
  const grantedRef = useRef(false);

  useEffect(() => {
    if (!user?.id || grantedRef.current) return;
    grantedRef.current = true;
    checkAndGrantDailyLogin(user.id);
    grantSeasonBadgeToUser();
  }, [user?.id]);

  return null;
}
