"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Board } from "@/types/community";

type FollowBoardRow = {
  board_id: string;
};

export default function FollowedBoardsSnb() {
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [boards, setBoards] = useState<Board[]>([]);

  useEffect(() => {
    const fetchFollowedBoards = async () => {
      setLoading(true);

      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id;

      if (!userId) {
        setIsLoggedIn(false);
        setBoards([]);
        setLoading(false);
        return;
      }

      setIsLoggedIn(true);

      const { data: followRows } = await supabase
        .from("follows_board")
        .select("board_id")
        .eq("user_id", userId);

      const boardIds = (followRows as FollowBoardRow[] | null)?.map((row) => row.board_id) ?? [];

      if (boardIds.length === 0) {
        setBoards([]);
        setLoading(false);
        return;
      }

      const { data: boardRows } = await supabase
        .from("boards")
        .select("*")
        .in("id", boardIds)
        .order("created_at", { ascending: true });

      setBoards((boardRows as Board[] | null) ?? []);
      setLoading(false);
    };

    fetchFollowedBoards();
  }, []);

  return (
    <aside className="hidden w-64 shrink-0 lg:block">
      <div className="sticky top-20 border border-dashed border-gray-500 bg-white/70 p-4">
        <h2 className="border-b border-dashed border-gray-400 pb-2 text-sm font-bold">내 팔로우 채널</h2>

        {loading ? (
          <p className="pt-3 text-xs text-gray-500">불러오는 중...</p>
        ) : !isLoggedIn ? (
          <div className="pt-3">
            <p className="text-xs text-gray-600">로그인 후 팔로우 채널을 확인할 수 있어요.</p>
            <Link
              href="/auth"
              className="mt-2 inline-block border border-dashed border-gray-500 bg-white px-2 py-1 text-xs hover:bg-gray-100"
            >
              로그인
            </Link>
          </div>
        ) : boards.length === 0 ? (
          <div className="pt-3 text-xs text-gray-600">
            <p>아직 팔로우한 채널이 없습니다.</p>
            <Link
              href="/board"
              className="mt-2 inline-block border border-dashed border-gray-500 bg-white px-2 py-1 hover:bg-gray-100"
            >
              채널 둘러보기
            </Link>
          </div>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {boards.map((board) => (
              <li key={board.id}>
                <Link
                  href={`/board/${board.slug}`}
                  className="block border border-dashed border-gray-400 bg-white px-2 py-2 text-sm hover:bg-gray-100"
                >
                  {board.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
