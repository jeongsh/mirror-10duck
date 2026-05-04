"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useAuthUser } from "@/lib/supabase/useAuthUser";
import { Board } from "@/types/community";

type FollowBoardRow = {
  board_id: string;
};

export default function FollowedBoardsSnb() {
  const authUser = useAuthUser();
  const [loading, setLoading] = useState(true);
  const [boards, setBoards] = useState<Board[]>([]);

  const userId = authUser?.id ?? null;

  useEffect(() => {
    let isMounted = true;

    const fetchFollowedBoards = async () => {
      if (authUser === undefined) {
        setLoading(true);
        return;
      }

      if (!userId) {
        setBoards([]);
        setLoading(false);
        return;
      }

      setLoading(true);

      const { data: followRows } = await supabase
        .from("follows_board")
        .select("board_id")
        .eq("user_id", userId);

      if (!isMounted) return;

      const boardIds =
        (followRows as FollowBoardRow[] | null)?.map((row) => row.board_id) ?? [];

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

      if (!isMounted) return;
      setBoards((boardRows as Board[] | null) ?? []);
      setLoading(false);
    };

    void fetchFollowedBoards();

    return () => {
      isMounted = false;
    };
  }, [authUser, userId]);

  return (
    <div className="w-full">
      <div className="sticky top-20 border border-dashed border-gray-500 bg-white/70 p-4">
        <h2 className="border-b border-dashed border-gray-400 pb-2 text-sm font-bold">
          팔로우 채널
        </h2>

        {loading ? (
          <p className="pt-3 text-xs text-gray-500">불러오는 중...</p>
        ) : !userId ? (
          <div className="pt-3">
            <p className="text-xs text-gray-600">
              로그인하면 팔로우한 채널을 빠르게 볼 수 있어요.
            </p>
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
    </div>
  );
}
