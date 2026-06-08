"use client";

import { useCallback, useEffect, useState } from "react";
import {
  STREAK_MILESTONE_EVENT,
  STREAK_BROKEN_EVENT,
  type StreakMilestoneEventDetail,
} from "@/components/AttendanceRecorder";

const BADGE_DISPLAY: Record<string, { name: string; copy: string }> = {
  streak_3: {
    name: "사흘짜리 다짐",
    copy: "사흘은 결심, 일주일은 습관. 한 발자국 더.",
  },
  streak_7: {
    name: "일주일의 약속",
    copy: "본방 사수보다 어렵다는 일주일 출석 완료.",
  },
  streak_14: {
    name: "본방사수 14일",
    copy: "이 정도면 분기 신작 한 작품을 따라잡았어요.",
  },
  streak_30: {
    name: "한 달 만근개근",
    copy: "월간 출석왕. 다음은 안방 출퇴근러 50일.",
  },
  streak_50: {
    name: "안방 출퇴근러",
    copy: "출퇴근 50일. 100일 회차 정주행이 보입니다.",
  },
  streak_100: {
    name: "100일 회차 정주행",
    copy: "100화짜리 한 작품을 완주한 셈이에요.",
  },
  streak_365: {
    name: "1년차 고인물",
    copy: "씹덕 1년차 고인물 인증. 전설의 시작.",
  },
};

const RARITY_TONE: Record<"common" | "rare" | "epic" | "legendary", { ring: string; chip: string; chipText: string }> = {
  common: {
    ring: "ring-orange-300",
    chip: "bg-orange-100",
    chipText: "text-orange-700",
  },
  rare: {
    ring: "ring-sky-300",
    chip: "bg-sky-100",
    chipText: "text-sky-700",
  },
  epic: {
    ring: "ring-purple-300",
    chip: "bg-purple-100",
    chipText: "text-purple-700",
  },
  legendary: {
    ring: "ring-amber-300",
    chip: "bg-amber-100",
    chipText: "text-amber-800",
  },
};

const SEEN_STORAGE_KEY = "streak_milestones_seen";

function loadSeen(): Record<string, true> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(SEEN_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, true>) : {};
  } catch {
    return {};
  }
}

function markSeen(badgeId: string) {
  if (typeof window === "undefined") return;
  try {
    const next = loadSeen();
    next[badgeId] = true;
    window.localStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

/**
 * 전역 마운트형 모달.
 * - `streak:milestone-reached` → 이정표 보상 카드
 * - `streak:broken`           → 끊김 회복 안내 카드
 * 같은 badgeId는 로컬 1회만 표시.
 */
export default function StreakMilestoneModal() {
  const [detail, setDetail] = useState<StreakMilestoneEventDetail | null>(null);
  const [brokenStreak, setBrokenStreak] = useState<number | null>(null);

  useEffect(() => {
    function handler(event: Event) {
      const next = (event as CustomEvent<StreakMilestoneEventDetail>).detail;
      if (!next) return;
      const seen = loadSeen();
      if (seen[next.badgeId]) return;
      setDetail(next);
    }
    function brokenHandler(event: Event) {
      const d = (event as CustomEvent<{ longestStreak: number }>).detail;
      if (!d) return;
      setBrokenStreak(d.longestStreak);
    }
    window.addEventListener(STREAK_MILESTONE_EVENT, handler);
    window.addEventListener(STREAK_BROKEN_EVENT, brokenHandler);
    return () => {
      window.removeEventListener(STREAK_MILESTONE_EVENT, handler);
      window.removeEventListener(STREAK_BROKEN_EVENT, brokenHandler);
    };
  }, []);

  const close = useCallback(() => {
    if (detail) markSeen(detail.badgeId);
    setDetail(null);
    setBrokenStreak(null);
  }, [detail]);

  const share = useCallback(() => {
    if (!detail) return;
    const display = BADGE_DISPLAY[detail.badgeId];
    const shareText = `씹덕 연속 출석 ${detail.days}일 달성! 호칭 「${display?.name ?? detail.badgeId}」 획득.`;
    const shareUrl = typeof window !== "undefined" ? window.location.origin : "";

    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      void navigator
        .share({ title: "씹덕 연속 출석 인증", text: shareText, url: shareUrl })
        .catch(() => {
          /* 사용자가 취소한 경우는 무시 */
        });
      return;
    }

    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(`${shareText} ${shareUrl}`).then(
        () => {
          alert("클립보드에 복사했어요. 트위터/디스코드에 붙여넣어 공유해보세요.");
        },
        () => {
          /* 실패 시 폴백 없음 */
        },
      );
    }
  }, [detail]);

  // 끊김 안내 모달 (이정표 모달보다 우선순위 낮음)
  if (!detail && brokenStreak !== null) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 px-4"
        onClick={() => setBrokenStreak(null)}
      >
        <div
          className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl ring-2 ring-gray-200"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col items-center text-center gap-3">
            <p className="text-4xl">💔</p>
            <h2 className="text-lg font-black text-gray-900">연속 출석이 끊겼어요</h2>
            <p className="text-sm text-gray-600 leading-6">
              최장 기록은 <span className="font-bold text-orange-700">{brokenStreak}일</span>이에요.
              <br />오늘부터 다시 시작하면 새 기록을 세울 수 있어요.
            </p>
            <button
              type="button"
              onClick={() => setBrokenStreak(null)}
              className="mt-2 w-full rounded-lg bg-orange-500 px-3 py-2 text-sm font-bold text-white hover:bg-orange-600"
            >
              다시 시작하기 🔥
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!detail) return null;

  const display = BADGE_DISPLAY[detail.badgeId] ?? { name: detail.badgeId, copy: "이정표 달성!" };
  const tone = RARITY_TONE[detail.rarity];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="streak-modal-title"
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 px-4 py-6"
      onClick={close}
    >
      <div
        className={`w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl ring-4 ${tone.ring}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex flex-col items-center text-center">
          <p className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${tone.chip} ${tone.chipText}`}>
            {detail.rarity} milestone
          </p>

          <div className="mt-4 text-6xl">🔥</div>

          <p className="mt-3 text-xs text-gray-500">연속 출석</p>
          <p className="text-4xl font-black leading-none text-orange-700">
            {detail.days}
            <span className="ml-1 text-xl font-bold text-orange-500">일째</span>
          </p>

          <h2 id="streak-modal-title" className="mt-4 text-xl font-black text-gray-900">
            {display.name}
          </h2>
          <p className="mt-2 text-sm leading-6 text-gray-600">{display.copy}</p>

          <div className="mt-4 grid w-full grid-cols-2 gap-2 rounded-lg bg-gray-50 p-3 text-center">
            <div>
              <p className="text-[10px] font-bold uppercase text-gray-400">현재</p>
              <p className="text-base font-black text-gray-900">{detail.currentStreak}일</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase text-gray-400">최장</p>
              <p className="text-base font-black text-gray-900">{detail.longestStreak}일</p>
            </div>
          </div>

          {detail.grantedBadges.length > 0 && (
            <p className="mt-3 text-[11px] text-gray-500">
              지급된 배지 {detail.grantedBadges.filter((b) => b.wasNew).length}개 · 누적 보유 {detail.grantedBadges.length}개
            </p>
          )}

          <div className="mt-5 flex w-full gap-2">
            <button
              type="button"
              onClick={share}
              className="flex-1 rounded-lg bg-orange-500 px-3 py-2 text-sm font-bold text-white hover:bg-orange-600"
            >
              자랑하기
            </button>
            <button
              type="button"
              onClick={close}
              className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
