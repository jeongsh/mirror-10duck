"use client";

import dynamic from "next/dynamic";
import { useAuthUser } from "@/lib/supabase/useAuthUser";

/**
 * Live2DWrapper 는 window, WebGL, Live2DCubismCore 전역에 의존하므로
 * SSR 중에 번들 import 되면 안 된다.
 * Next.js 16 부터 `ssr: false` 는 Client Component 안에서만 허용되므로
 * 이 래퍼를 경유해서 동적 import 한다.
 */
const Live2DWrapper = dynamic(() => import("./Live2DWrapper"), {
  ssr: false,
  loading: () => (
    <div className="fixed bottom-6 right-6 z-50 border-2 border-dashed border-gray-500 bg-gray-200/60 p-4 text-[11px] tracking-widest text-gray-500 uppercase">
      [Live2D 영역 · 로딩 중...]
    </div>
  ),
});

export default function Live2DClientOnly() {
  const user = useAuthUser();
  if (!user) return null;
  return <Live2DWrapper />;
}
