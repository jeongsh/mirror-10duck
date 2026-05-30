"use client";

import DailyLoginXp from "./DailyLoginXp";
import Live2DCubismCoreScript from "./Live2DCubismCoreScript";
import ViralSideAds from "./ViralSideAds";

/** 캐릭터 운세·카드 뷰 — 페이지 배경은 콘텐츠, 좌·우 광고 슬롯은 ViralSideAds 공통 */
export default function ViralLayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative w-full" data-layout-viral="">
      <Live2DCubismCoreScript />
      <DailyLoginXp />
      <ViralSideAds />
      <div className="relative w-full">{children}</div>
    </div>
  );
}
