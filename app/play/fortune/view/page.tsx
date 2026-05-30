"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MoonStar, Sparkles } from "lucide-react";
import { FortuneResultCard, FORTUNE_CARD_W } from "@/components/play/fortune/FortuneResultCard";
import type { FortuneResult } from "@/lib/fortune/dailyFortune";
import { parseFortuneShareSearch } from "@/lib/fortune/dailyFortune";

export default function FortuneViewPage() {
  const [result, setResult] = useState<FortuneResult | null>(null);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const payload = parseFortuneShareSearch(window.location.search);
    if (!payload) {
      setIsExpired(true);
      return;
    }
    setResult(payload.result);
  }, []);

  if (isExpired) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center gap-4 px-4"
        style={{
          background: "linear-gradient(180deg, #f8f1e3 0%, #ecddc6 100%)",
          color: "#4a3a78",
        }}
      >
        <MoonStar size={28} className="text-[#caa14e]" />
        <p className="text-center text-sm font-bold leading-6">
          공유 링크가 만료됐거나 찾을 수 없어요.
          <br />
          오늘의 캐릭터 운세는 자정(KST) 기준으로만 유효해요.
        </p>
        <Link
          href="/play/fortune"
          className="rounded-full px-5 py-2.5 text-sm font-black text-[#3a2d5c]"
          style={{ background: "linear-gradient(180deg, #f3cd72 0%, #d9a441 100%)" }}
        >
          오늘의 캐릭터 운세 보러 가기
        </Link>
      </div>
    );
  }

  if (!result) {
    return (
      <div
        className="flex min-h-screen items-center justify-center text-sm font-bold text-[#6b5b8a]"
        style={{ background: "linear-gradient(180deg, #f8f1e3 0%, #ecddc6 100%)" }}
      >
        운세 카드를 불러오는 중...
      </div>
    );
  }

  return (
    <div
      className="min-h-screen overflow-x-hidden px-4 py-8"
      style={{
        background:
          "radial-gradient(ellipse 70% 50% at 50% -8%, #fbf3e3 0%, transparent 60%), linear-gradient(180deg, #f8f1e3 0%, #ecddc6 100%)",
        color: "#4a3a78",
      }}
    >
      <div className="mx-auto flex max-w-lg flex-col items-center gap-5">
        <div className="flex flex-col items-center gap-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-[#b58a3c]">Character Fortune</p>
          <h1 className="flex items-center gap-2 text-xl font-black">
            <MoonStar size={18} className="text-[#caa14e]" />
            오늘의 캐릭터 운세
          </h1>
          <p className="flex items-center gap-1 text-[11px] font-semibold text-[#8a7a5c]">
            <Sparkles size={11} className="text-[#caa14e]" />
            공유된 운세 카드
          </p>
        </div>

        <div className="mx-auto min-w-0 shrink-0" style={{ width: `min(${FORTUNE_CARD_W}px, calc(100vw - 2rem))` }}>
          <FortuneResultCard result={result} />
        </div>

        <Link
          href="/play/fortune"
          className="rounded-full px-5 py-2.5 text-sm font-black text-[#3a2d5c] shadow-[0_4px_14px_rgba(217,164,65,0.35)]"
          style={{ background: "linear-gradient(180deg, #f3cd72 0%, #d9a441 100%)" }}
        >
          나도 오늘의 캐릭터 운세 보기
        </Link>
      </div>
    </div>
  );
}
