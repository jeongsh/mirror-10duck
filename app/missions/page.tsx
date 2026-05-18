"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchMissionBoard, type MissionBoard } from "@/lib/community/missions";
import { useAuthUser } from "@/lib/supabase/useAuthUser";

export default function MissionsPage() {
  const authUser = useAuthUser();
  const userId = authUser?.id ?? null;
  const [board, setBoard] = useState<MissionBoard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!userId) {
        setLoading(false);
        return;
      }
      const next = await fetchMissionBoard(userId);
      if (!cancelled) {
        setBoard(next);
        setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (!userId) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-xl font-bold">오늘의 미션</h1>
        <p className="mt-4 text-sm text-gray-500">
          로그인하면 미션을 확인할 수 있어요.{" "}
          <Link href="/login" className="text-pink-600 underline">로그인</Link>
        </p>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-xl font-bold">오늘의 미션</h1>
        <p className="mt-4 text-sm text-gray-500">불러오는 중이에요.</p>
      </main>
    );
  }

  if (!board || board.totalCount === 0) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-xl font-bold">오늘의 미션</h1>
        <p className="mt-4 text-sm text-gray-500">오늘은 활성화된 미션이 없어요.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold">오늘의 미션</h1>
        <p className="text-xs text-gray-500">
          {board.completedCount} / {board.totalCount} 완료
        </p>
      </div>

      <ul className="space-y-3">
        {board.items.map((item) => {
          const target = Math.max(1, item.mission.targetCount);
          const ratio = Math.min(1, item.progressCount / target);
          const done = item.completedAt !== null;
          return (
            <li
              key={item.mission.id}
              className={`rounded border bg-white p-4 shadow-sm ${
                done ? "border-pink-300" : "border-gray-200"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">{item.mission.title}</p>
                <p className="text-xs text-gray-500">
                  {done ? "완료" : `${item.progressCount}/${target}`}
                </p>
              </div>
              {item.mission.description && (
                <p className="mt-1 text-xs text-gray-500">{item.mission.description}</p>
              )}
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className={`h-full ${done ? "bg-pink-500" : "bg-pink-300"}`}
                  style={{ width: `${Math.round(ratio * 100)}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>

      <p className="mt-6 text-xs text-gray-400">
        출석은 로그인 시 자동으로 완료되고, 댓글·추천·글쓰기는 해당 액션 시 자동으로 카운트됩니다.
      </p>
    </main>
  );
}
