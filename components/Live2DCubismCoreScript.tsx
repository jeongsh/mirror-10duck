"use client";

import Script from "next/script";

type Live2DCubismCoreScriptProps = {
  onReady?: () => void;
};

/** Live2D Cubism Core — RightSidebar·바이럴 등 여러 진입점에서 공유 */
export default function Live2DCubismCoreScript({ onReady }: Live2DCubismCoreScriptProps) {
  const handleReady = () => {
    onReady?.();
  };

  return (
    <Script
      src="/live2dcubismcore.min.js"
      strategy="afterInteractive"
      onLoad={handleReady}
      onReady={handleReady}
    />
  );
}
