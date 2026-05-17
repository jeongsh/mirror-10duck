"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthUser } from "@/lib/supabase/useAuthUser";
import { supabase } from "@/lib/supabase/client";
import {
  getLevelInfo,
  LEVEL_THRESHOLDS,
  XP_AMOUNTS,
} from "@/lib/supabase/experience";
import LevelBadge from "@/components/community/LevelBadge";

const XP_GUIDE = [
  { action: "게시판 글 작성", xp: XP_AMOUNTS.POST_CREATED },
  { action: "피드 글 작성", xp: XP_AMOUNTS.FEED_CREATED },
  { action: "댓글 작성", xp: XP_AMOUNTS.COMMENT_CREATED },
  { action: "내 글에 추천 받기", xp: XP_AMOUNTS.UPVOTE_RECEIVED },
  { action: "내 글에 리액션 받기", xp: XP_AMOUNTS.REACTION_RECEIVED },
  { action: "일일 접속 (하루 1회)", xp: XP_AMOUNTS.DAILY_LOGIN },
  { action: "글 인기글 선정", xp: XP_AMOUNTS.HOT_PROMOTED },
];

const TIER_LABELS = [
  { min: 1, max: 4, label: "입문", color: "bg-gray-400" },
  { min: 5, max: 9, label: "활동", color: "bg-blue-500" },
  { min: 10, max: 14, label: "고수", color: "bg-purple-600" },
  { min: 15, max: 19, label: "전문가", color: "bg-amber-500" },
  { min: 20, max: 99, label: "레전드", color: "bg-red-600" },
];

function getTierLabel(level: number) {
  return TIER_LABELS.find((t) => level >= t.min && level <= t.max) ?? TIER_LABELS[0];
}

export default function LevelPage() {
  const authUser = useAuthUser();
  const router = useRouter();
  const [xp, setXp] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authUser === undefined) return;
    if (!authUser) {
      router.replace("/auth");
      return;
    }
    supabase
      .from("profiles")
      .select("experience_points")
      .eq("user_id", authUser.id)
      .single()
      .then(({ data }) => {
        setXp((data as { experience_points?: number } | null)?.experience_points ?? 0);
        setLoading(false);
      });
  }, [authUser, router]);

  if (loading || xp === null) {
    return (
      <div className="flex flex-col gap-4">
        <header className="border border-dashed border-gray-500 bg-white/70 p-4">
          <p className="text-sm text-gray-500">불러오는 중...</p>
        </header>
      </div>
    );
  }

  const info = getLevelInfo(xp);
  const tier = getTierLabel(info.level);
  const isMaxLevel = info.nextThreshold === null;

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      {/* 헤더 */}
      <header className="border border-dashed border-gray-500 bg-white/70 p-4 flex items-center justify-between">
        <h1 className="text-lg font-bold tracking-tight">레벨 & 경험치</h1>
        <Link
          href="/profile"
          className="text-xs border border-dashed border-gray-400 px-2 py-1 text-gray-600 hover:bg-gray-100"
        >
          ← 프로필 설정
        </Link>
      </header>

      {/* 현재 레벨 카드 */}
      <section className="border border-dashed border-gray-500 bg-white/70 p-5 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <LevelBadge level={info.level} size="sm" />
          <div>
            <div className="text-2xl font-black tracking-tighter">Lv.{info.level}</div>
            <div className="text-xs text-gray-500 font-bold uppercase">{tier.label}</div>
          </div>
        </div>

        {/* XP 진행 바 */}
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-xs font-bold text-gray-600">
            <span>{info.xp.toLocaleString()} XP</span>
            {isMaxLevel ? (
              <span className="text-red-600 font-black">MAX LEVEL</span>
            ) : (
              <span>다음 레벨까지 {(info.nextThreshold! - info.xp).toLocaleString()} XP</span>
            )}
          </div>
          <div className="h-3 w-full border border-dashed border-gray-400 bg-gray-100 overflow-hidden">
            <div
              className={`h-full transition-all ${tier.color}`}
              style={{ width: `${info.progress}%` }}
            />
          </div>
          {!isMaxLevel && (
            <div className="text-[10px] text-gray-400 text-right">
              {info.currentThreshold.toLocaleString()} XP → {info.nextThreshold?.toLocaleString()} XP
            </div>
          )}
        </div>
      </section>

      {/* XP 획득 방법 */}
      <section className="border border-dashed border-gray-500 bg-white/70 p-5 flex flex-col gap-3">
        <h2 className="text-xs font-black uppercase tracking-widest text-gray-500">경험치 획득 방법</h2>
        <div className="flex flex-col divide-y divide-dashed divide-gray-200">
          {XP_GUIDE.map(({ action, xp: amount }) => (
            <div key={action} className="flex items-center justify-between py-2">
              <span className="text-sm text-gray-700">{action}</span>
              <span className="text-sm font-black text-gray-900">+{amount} XP</span>
            </div>
          ))}
        </div>
      </section>

      {/* 전체 레벨 표 */}
      <section className="border border-dashed border-gray-500 bg-white/70 p-5 flex flex-col gap-3">
        <h2 className="text-xs font-black uppercase tracking-widest text-gray-500">레벨 목록</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {LEVEL_THRESHOLDS.map((threshold, i) => {
            const lv = i + 1;
            const isCurrent = lv === info.level;
            const isPast = lv < info.level;
            return (
              <div
                key={lv}
                className={`flex items-center justify-between border border-dashed px-3 py-2 text-xs ${
                  isCurrent
                    ? "border-gray-700 bg-gray-100 font-black"
                    : isPast
                    ? "border-gray-300 bg-gray-50 text-gray-400"
                    : "border-gray-300 bg-white text-gray-600"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <LevelBadge level={lv} size="xs" />
                  {isCurrent && <span className="text-[9px] font-black text-gray-500">현재</span>}
                </div>
                <span className="tabular-nums">{threshold.toLocaleString()} XP</span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
