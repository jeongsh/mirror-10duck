"use client";

import { usePathname } from "next/navigation";
import { useLayoutEffect } from "react";

/** 클라이언트 라우트 전환 시 window 스크롤을 맨 위로 초기화 */
export default function ScrollToTop() {
  const pathname = usePathname();

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
