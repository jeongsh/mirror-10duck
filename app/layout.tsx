import type { Metadata } from "next";
import Script from "next/script";
import Live2DClientOnly from "@/components/Live2DClientOnly";
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
        {children}
        <Live2DClientOnly />
      </body>
    </html>
  );
}
