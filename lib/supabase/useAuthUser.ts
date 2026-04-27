"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";

/**
 * 현재 로그인한 Supabase 사용자 상태를 구독한다.
 *
 * - 초기값: `undefined` (아직 확인 전, hydration / 첫 fetch 대기)
 * - 비로그인: `null`
 * - 로그인: `User`
 *
 * `undefined` 와 `null` 을 구분하기 때문에 호출부는 첫 렌더에서 깜빡거림 없이
 * 로딩/비로그인/로그인 분기를 안전하게 처리할 수 있다.
 */
export function useAuthUser(): User | null | undefined {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      setUser(data.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return user;
}
