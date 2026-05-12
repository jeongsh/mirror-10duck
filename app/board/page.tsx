"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Board } from "@/types/community";
import {
  BOARD_CATEGORY_ORDER,
  boardCategoryLabel,
  normalizeBoardCategory,
  type BoardCategory,
} from "@/lib/community/boardCategories";

export default function BoardDirectoryPage() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBoards = async () => {
      const { data } = await supabase
        .from("boards")
        .select("*")
        .order("created_at", { ascending: true });
      if (data) setBoards(data as Board[]);
      setLoading(false);
    };
    fetchBoards();
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<BoardCategory, Board[]>();
    for (const cat of BOARD_CATEGORY_ORDER) map.set(cat, []);
    for (const b of boards) {
      const c = normalizeBoardCategory(b.category);
      map.get(c)!.push(b);
    }
    return BOARD_CATEGORY_ORDER.map((cat) => ({
      category: cat,
      boards: (map.get(cat) ?? []).sort((a, b) =>
        a.name.localeCompare(b.name, "ko", { sensitivity: "base" }),
      ),
    })).filter((g) => g.boards.length > 0);
  }, [boards]);

  return (
    <main className="flex w-full flex-col gap-6">
      <header className="border border-dashed border-gray-500 bg-white/70 p-4">
        <h1 className="text-xl font-bold">게시판 채널 목록</h1>
        <p className="text-sm text-gray-600">
          카테고리별로 묶인 채널입니다. 항목이 많아도 한 화면에서 빠르게 찾을 수 있도록 링크만 촘촘히
          모았습니다.
        </p>
      </header>

      {loading ? (
        <p className="text-center text-sm text-gray-500">로딩 중...</p>
      ) : boards.length === 0 ? (
        <p className="text-center text-sm text-gray-500">등록된 채널이 없습니다.</p>
      ) : (
        <div className="flex flex-col gap-5">
          {grouped.map(({ category, boards: list }) => (
            <section
              key={category}
              className="overflow-hidden rounded border border-dashed border-gray-400 bg-white/80"
            >
              <div className="flex items-center justify-between border-b border-gray-200 bg-gray-100 px-3 py-2">
                <h2 className="text-sm font-bold text-blue-800">
                  {boardCategoryLabel(category)}
                  <span className="ml-1.5 font-normal text-gray-600">({list.length})</span>
                </h2>
              </div>
              <div className="p-3">
                <div className="columns-2 gap-x-6 text-[12px] leading-snug text-gray-800 sm:columns-3 md:columns-4">
                  {list.map((board) => (
                    <Link
                      key={board.id}
                      href={`/board/${board.slug}`}
                      className="mb-1.5 block break-inside-avoid text-gray-800 underline-offset-2 hover:text-blue-700 hover:underline"
                      title={board.description ?? undefined}
                    >
                      {board.name}
                    </Link>
                  ))}
                </div>
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
