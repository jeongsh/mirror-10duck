"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { Board } from "@/types/community";
import {
  boardCategoryLabel,
  normalizeBoardCategory,
  type BoardCategory,
} from "@/lib/community/boardCategories";
import {
  orderedCategoriesFromRows,
  sortBoardsForDisplay,
  type BoardCategoryOrderRow,
} from "@/lib/community/boardDisplayOrder";

function boardMatchesQuery(board: Board, q: string): boolean {
  if (!q) return true;
  const n = q.toLowerCase();
  return (
    board.name.toLowerCase().includes(n) ||
    board.slug.toLowerCase().includes(n) ||
    (board.description?.toLowerCase().includes(n) ?? false)
  );
}

export default function BoardDirectoryPage() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [categoryRows, setCategoryRows] = useState<BoardCategoryOrderRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [boardsRes, catRes] = await Promise.all([
        supabase
          .from("boards")
          .select("*")
          .order("category", { ascending: true })
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true }),
        supabase.from("board_category_order").select("category, position").order("position", {
          ascending: true,
        }),
      ]);
      if (boardsRes.data) setBoards(boardsRes.data as Board[]);
      if (!catRes.error && catRes.data) {
        setCategoryRows(catRes.data as BoardCategoryOrderRow[]);
      } else {
        setCategoryRows(null);
      }
      setLoading(false);
    };
    void load();
  }, []);

  const categorySequence = useMemo(
    () => orderedCategoriesFromRows(categoryRows ?? undefined),
    [categoryRows],
  );

  const filteredBoards = useMemo(() => {
    const q = search.trim();
    if (!q) return boards;
    return boards.filter((b) => boardMatchesQuery(b, q));
  }, [boards, search]);

  const grouped = useMemo(() => {
    const map = new Map<BoardCategory, Board[]>();
    for (const cat of categorySequence) map.set(cat, []);
    for (const b of filteredBoards) {
      const c = normalizeBoardCategory(b.category);
      if (!map.has(c)) map.set(c, []);
      map.get(c)!.push(b);
    }
    for (const [, list] of map) list.sort(sortBoardsForDisplay);
    return categorySequence
      .map((cat) => ({
        category: cat,
        boards: map.get(cat) ?? [],
      }))
      .filter((g) => g.boards.length > 0);
  }, [filteredBoards, categorySequence]);

  return (
    <main className="flex w-full flex-col gap-6">
      <header className="border border-dashed border-neutral-800 bg-white p-4">
        <h1 className="text-xl font-bold text-neutral-900">게시판 채널 목록</h1>
        <p className="mt-1 text-sm text-neutral-600">
          최근 방문 채널, 검색, 카테고리별 링크로 빠르게 이동할 수 있습니다.
        </p>
        <div className="relative mt-4 max-w-md">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-neutral-500"
            aria-hidden
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="채널 이름, 주소(slug), 설명 검색…"
            className="w-full border border-dashed border-neutral-800 bg-white py-2 pl-9 pr-3 text-sm text-neutral-900 focus:border-neutral-900 focus:outline-none"
            autoComplete="off"
          />
        </div>
      </header>

      {loading ? (
        <p className="text-center text-sm text-neutral-600">로딩 중...</p>
      ) : boards.length === 0 ? (
        <p className="text-center text-sm text-neutral-600">등록된 채널이 없습니다.</p>
      ) : (
        <div className="flex flex-col gap-5">
          {search.trim() && grouped.length === 0 ? (
            <p className="border border-dashed border-neutral-800 bg-white p-6 text-center text-sm text-neutral-600">
              검색 결과가 없습니다.
            </p>
          ) : null}

          {grouped.map(({ category, boards: list }) => (
            <section
              key={category}
              className="overflow-hidden border border-dashed border-neutral-800 bg-white"
            >
              <div className="flex items-center justify-between border-b border-dashed border-neutral-800 bg-white px-3 py-2">
                <h2 className="text-sm font-bold text-neutral-900">
                  {boardCategoryLabel(category)}
                  <span className="ml-1.5 font-normal text-neutral-600">({list.length})</span>
                </h2>
              </div>
              <div className="p-3">
                <div className="columns-2 gap-x-6 text-[12px] leading-snug text-neutral-900 sm:columns-3 md:columns-4">
                  {list.map((board) => (
                    <Link
                      key={board.id}
                      href={`/board/${board.slug}`}
                      className="mb-1.5 block break-inside-avoid underline-offset-2 hover:underline"
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
