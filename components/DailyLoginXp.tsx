"use client";

import { useEffect, useRef } from "react";
import { useAuthUser } from "@/lib/supabase/useAuthUser";
import { checkAndGrantDailyLogin } from "@/lib/supabase/experience";

/** 로그인 상태일 때 하루 1회 접속 XP를 자동 지급하는 invisible 컴포넌트 */
export default function DailyLoginXp() {
  const user = useAuthUser();
  const grantedRef = useRef(false);

  useEffect(() => {
    if (!user?.id || grantedRef.current) return;
    grantedRef.current = true;
    checkAndGrantDailyLogin(user.id);
  }, [user?.id]);

  return null;
}
