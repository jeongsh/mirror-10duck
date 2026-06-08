"use client";

import { useEffect, useMemo, useState } from "react";
import {
  STREAK_MILESTONES,
  fetchStreak,
  getStreakProgress,
  type StreakState,
} from "@/lib/community/streak";
import {
  STREAK_MILESTONE_EVENT,
  type StreakMilestoneEventDetail,
} from "@/components/AttendanceRecorder";

type StreakCardProps = {
  userId: string;
  /** false면 컴팩트 버전(프로필 위젯 등). 기본 true */
  full?: boolean;
};

const RARITY_TONE: Record<"common" | "rare" | "epic" | "legendary", string> = {
  common: "text-gray-700",
  rare: "text-sky-600",
  epic: "text-purple-600",
  legendary: "text-amber-600",
};

function findBadgeName(days: number | null): string | null {
  if (days === null) return null;
  const milestone = STREAK_MILESTONES.find((m) => m.days === days);
  if (!milestone) return null;
  const map: Record<string, string> = {
    streak_3: "사흘짜리 다짐",
    streak_7: "일주일의 약속",
    streak_14: "본방사수 14일",
    streak_30: "한 달 만근개근",
    streak_50: "안방 출퇴근러",
    streak_100: "100일 회차 정주행",
    streak_365: "1년차 고인물",
  };
  return map[milestone.badgeId] ?? null;
}

export default function StreakCard({ userId, full = true }: StreakCardProps) {
  const [streak, setStreak] = useState<StreakState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const next = await fetchStreak(userId);
      if (!cancelled) {
        setStreak(next);
        setLoading(false);
      }
    }
    if (userId) load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    function handler(event: Event) {
      const detail = (event as CustomEvent<StreakMilestoneEventDetail>).detail;
      if (!detail) return;
      setStreak((prev) => ({
        currentStreak: detail.currentStreak,
        longestStreak: detail.longestStreak,
        lastCheckInDate: prev?.lastCheckInDate ?? null,
        totalCheckIns: prev?.totalCheckIns ?? 0,
      }));
    }
    window.addEventListener(STREAK_MILESTONE_EVENT, handler);
    return () => window.removeEventListener(STREAK_MILESTONE_EVENT, handler);
  }, []);

  const current = streak?.currentStreak ?? 0;
  const longest = streak?.longestStreak ?? 0;

  const { currentMilestone, nextMilestone, progress } = useMemo(
    () => getStreakProgress(current),
    [current],
  );

  const nextBadgeName = findBadgeName(nextMilestone);
  const currentBadgeName = findBadgeName(currentMilestone);

  if (loading) {
    return (
      <div className="rounded border border-gray-200 bg-white p-4 shadow-sm">
        <p className="text-sm text-gray-400">연속 출석 불러오는 중…</p>
      </div>
    );
  }

  if (!full) {
    return (
      <div className="rounded border border-gray-200 bg-white p-3 text-sm shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-500">연속 출석</span>
          <span className="text-xs text-gray-400">최장 {longest}일</span>
        </div>
        <p className="mt-1 text-lg font-black text-gray-900">🔥 {current}일째</p>
      </div>
    );
  }

  return (
    <section className="rounded border border-orange-200 bg-gradient-to-br from-amber-50 to-orange-50 p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wider text-orange-700">연속 출석</p>
        <p className="text-xs text-gray-500">최장 기록 {longest}일</p>
      </div>

      <div className="mt-3 flex items-end gap-2">
        <span className="text-5xl">🔥</span>
        <p className="text-4xl font-black leading-none text-orange-700">
          {current}
          <span className="ml-1 text-lg font-bold text-orange-500">일째</span>
        </p>
      </div>

      {nextMilestone !== null ? (
        <div className="mt-4">
          <div className="h-2 w-full overflow-hidden rounded-full bg-orange-100">
            <div
              className="h-full bg-gradient-to-r from-orange-400 to-amber-500 transition-[width] duration-500"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-gray-600">
            다음 이정표:
            <span className="ml-1 font-bold text-orange-700">{nextBadgeName ?? `${nextMilestone}일`}</span>
            <span className="ml-1 text-gray-400">
              (D-{Math.max(0, nextMilestone - current)})
            </span>
          </p>
        </div>
      ) : (
        <p className="mt-4 rounded bg-amber-100 px-3 py-2 text-xs font-bold text-amber-800">
          🏆 모든 이정표를 달성했어요. 1년차 고인물의 길.
        </p>
      )}

      {currentBadgeName && (
        <p className={`mt-3 text-xs ${RARITY_TONE[STREAK_MILESTONES.find((m) => m.days === currentMilestone)!.rarity]}`}>
          최근 획득: {currentBadgeName}
        </p>
      )}
    </section>
  );
}
