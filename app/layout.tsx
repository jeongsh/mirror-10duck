import type { Metadata } from "next";
import Script from "next/script";
import GlobalNavigation from "@/components/GlobalNavigation";
import Live2DClientOnly from "@/components/Live2DClientOnly";
import RightSidebar from "@/components/RightSidebar";
import "./globals.css";

export const metadata: Metadata = {
  title: "씹덕 | Subculture Community",
  description: "서브컬처 오타쿠 커뮤니티 플랫폼 - 와이어프레임 검증 빌드",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="min-h-screen antialiased">
        {/*
         * Live2D Cubism Core 전역 로드 (가장 중요)
         * - `beforeInteractive` 로 React hydration 이전에 동기 로드되어야 한다.
         *   (PixiJS Live2D 래퍼는 window.Live2DCubismCore 가 존재해야만 모델 파싱 가능)
         */}
        <Script
          src="/live2dcubismcore.min.js"
          strategy="beforeInteractive"
        />
        <GlobalNavigation />
        <div className="relative mx-auto w-full max-w-7xl px-4 pt-6 pb-4">
          {/* 좌측 윙배너 (해상도 1536px 이상에서만 보임) - 스티키 적용 */}
          <div className="sticky top-20 z-10 hidden h-0 w-0 2xl:block">
            <aside className="absolute right-[calc(100%+20px)] top-0 h-[600px] w-[200px] flex-col items-center justify-center border border-dashed border-gray-400 bg-gray-100/50 text-center text-xs text-gray-400 flex">
              [좌측<br />세로 배너]
            </aside>
          </div>

          <div className="flex flex-col lg:flex-row items-start gap-6">
            <div className="min-w-0 flex-1 w-full">{children}</div>
            <RightSidebar />
          </div>
        </div>
        <Live2DClientOnly />
      </body>
    </html>
  );
}
