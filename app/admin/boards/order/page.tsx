"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { Board } from "@/types/community";
import {
  BOARD_CATEGORY_OPTIONS,
  boardCategoryLabel,
  normalizeBoardCategory,
  type BoardCategory,
} from "@/lib/community/boardCategories";
import {
  orderedCategoriesFromRows,
  sortBoardsForDisplay,
  type BoardCategoryOrderRow,
} from "@/lib/community/boardDisplayOrder";

async function persistBoardSortOrder(ordered: Board[]): Promise<string | null> {
  for (let i = 0; i < ordered.length; i++) {
    const { error } = await supabase
      .from("boards")
      .update({ sort_order: (i + 1) * 10 })
      .eq("id", ordered[i].id);
    if (error) return error.message;
  }
  return null;
}

export default function AdminBoardDisplayOrderPage() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [categoryRows, setCategoryRows] = useState<BoardCategoryOrderRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setNotice(null);
    const [boardsRes, catRes] = await Promise.all([
      supabase.from("boards").select("*").order("name", { ascending: true }),
      supabase.from("board_category_order").select("category, position").order("position", {
        ascending: true,
      }),
    ]);
    if (boardsRes.data) setBoards(boardsRes.data as Board[]);
    if (catRes.error) {
      setCategoryRows(null);
      setNotice(
        "카테고리 순서 테이블을 불러오지 못했습니다. docs/migrations/2026-05-13-board-display-order.sql 적용 여부를 확인하세요.",
      );
    } else {
      setCategoryRows((catRes.data as BoardCategoryOrderRow[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const categorySequence = useMemo(
    () => orderedCategoriesFromRows(categoryRows ?? undefined),
    [categoryRows],
  );

  const boardsByCategory = useMemo(() => {
    const m = new Map<BoardCategory, Board[]>();
    for (const opt of BOARD_CATEGORY_OPTIONS) m.set(opt.value, []);
    for (const b of boards) {
      const c = normalizeBoardCategory(b.category);
      if (!m.has(c)) m.set(c, []);
      m.get(c)!.push(b);
    }
    for (const [, list] of m) list.sort(sortBoardsForDisplay);
    return m;
  }, [boards]);

  const moveCategory = async (cat: BoardCategory, dir: -1 | 1) => {
    const seq = [...categorySequence];
    const i = seq.indexOf(cat);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= seq.length) return;
    [seq[i], seq[j]] = [seq[j], seq[i]];
    setSaving(true);
    const { error } = await supabase.from("board_category_order").upsert(
      seq.map((category, position) => ({ category, position })),
      { onConflict: "category" },
    );
    setSaving(false);
    if (error) {
      alert("저장 실패: " + error.message);
      return;
    }
    setCategoryRows(seq.map((category, position) => ({ category, position })));
  };

  const moveBoardInCategory = async (cat: BoardCategory, boardId: string, dir: -1 | 1) => {
    const list = [...(boardsByCategory.get(cat) ?? [])].sort(sortBoardsForDisplay);
    const i = list.findIndex((b) => b.id === boardId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    setSaving(true);
    const errMsg = await persistBoardSortOrder(list);
    setSaving(false);
    if (errMsg) {
      alert("저장 실패: " + errMsg);
      return;
    }
    setBoards((prev) => {
      const others = prev.filter((b) => normalizeBoardCategory(b.category) !== cat);
      const nextList = list.map((b, idx) => ({
        ...b,
        sort_order: (idx + 1) * 10,
      }));
      return [...others, ...nextList];
    });
  };

  const seedCategoryOrder = async () => {
    setSaving(true);
    const seq = BOARD_CATEGORY_OPTIONS.map((o) => o.value);
    const { error } = await supabase.from("board_category_order").upsert(
      seq.map((category, position) => ({ category, position })),
      { onConflict: "category" },
    );
    setSaving(false);
    if (error) {
      alert("초기화 실패: " + error.message);
      return;
    }
    setCategoryRows(seq.map((category, position) => ({ category, position })));
    setNotice(null);
  };

  if (loading) return <div className="p-6 text-sm text-gray-500">로딩 중...</div>;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-dashed border-gray-500 pb-4">
        <div>
          <h2 className="text-xl font-bold">채널·카테고리 표시 순서</h2>
          <p className="mt-1 text-sm text-gray-600">
            채널 목록(`/board`)에서 보이는 카테고리 블록 순서와, 각 카테고리 안에서 게시판 링크 순서를
            바꿉니다.
          </p>
          {notice ? <p className="mt-2 text-sm text-amber-800">{notice}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/boards"
            className="rounded border border-gray-300 bg-gray-100 px-3 py-2 text-sm hover:bg-gray-200"
          >
            ← 게시판 목록
          </Link>
          {categoryRows === null ? (
            <button
              type="button"
              onClick={() => void seedCategoryOrder()}
              disabled={saving}
              className="rounded bg-black px-3 py-2 text-sm text-white disabled:opacity-50"
            >
              기본 카테고리 순서 생성
            </button>
          ) : null}
        </div>
      </div>

      <section className="rounded border border-dashed border-gray-500 bg-white/70 p-5">
        <h3 className="text-sm font-bold text-gray-900">카테고리 섹션 순서</h3>
        <p className="mb-3 text-xs text-gray-500">위·아래 버튼으로 순서를 바꾸면 즉시 저장됩니다.</p>
        <ul className="flex flex-col divide-y divide-dashed divide-gray-300 border border-dashed border-gray-300">
          {categorySequence.map((cat, i) => (
              <li
                key={cat}
                className="flex items-center justify-between gap-2 bg-white px-3 py-2 text-sm"
              >
                <span className="font-medium">
                  {boardCategoryLabel(cat)}
                  <span className="ml-2 text-xs text-gray-400">({cat})</span>
                </span>
                <span className="flex gap-1">
                  <button
                    type="button"
                    disabled={saving || i === 0}
                    onClick={() => void moveCategory(cat, -1)}
                    className="rounded border border-gray-300 p-1 hover:bg-gray-50 disabled:opacity-30"
                    aria-label="위로"
                  >
                    <ChevronUp className="size-4" />
                  </button>
                  <button
                    type="button"
                    disabled={saving || i >= categorySequence.length - 1}
                    onClick={() => void moveCategory(cat, 1)}
                    className="rounded border border-gray-300 p-1 hover:bg-gray-50 disabled:opacity-30"
                    aria-label="아래로"
                  >
                    <ChevronDown className="size-4" />
                  </button>
                </span>
              </li>
            ))}
        </ul>
      </section>

      <section className="rounded border border-dashed border-gray-500 bg-white/70 p-5">
        <h3 className="text-sm font-bold text-gray-900">카테고리별 게시판 순서</h3>
        <p className="mb-3 text-xs text-gray-500">같은 카테고리 안에서만 이동합니다. 변경 시 즉시 저장됩니다.</p>
        <div className="flex flex-col gap-3">
          {categorySequence.map((cat) => {
            const list = boardsByCategory.get(cat) ?? [];
            return (
              <details
                key={cat}
                className="rounded border border-dashed border-gray-300 bg-white open:pb-2"
                open={list.length > 0 && list.length <= 12}
              >
                <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold text-blue-900 hover:bg-gray-50">
                  {boardCategoryLabel(cat)}
                  <span className="ml-2 font-normal text-gray-500">({list.length})</span>
                </summary>
                {list.length === 0 ? (
                  <p className="px-3 pb-2 text-xs text-gray-500">이 카테고리에 게시판이 없습니다.</p>
                ) : (
                  <ul className="flex flex-col divide-y divide-gray-100">
                    {list.map((b, idx) => (
                      <li
                        key={b.id}
                        className="flex items-center justify-between gap-2 px-3 py-1.5 text-sm"
                      >
                        <span className="truncate">{b.name}</span>
                        <span className="flex shrink-0 gap-1">
                          <button
                            type="button"
                            disabled={saving || idx === 0}
                            onClick={() => void moveBoardInCategory(cat, b.id, -1)}
                            className="rounded border border-gray-300 p-1 hover:bg-gray-50 disabled:opacity-30"
                            aria-label="위로"
                          >
                            <ChevronUp className="size-4" />
                          </button>
                          <button
                            type="button"
                            disabled={saving || idx >= list.length - 1}
                            onClick={() => void moveBoardInCategory(cat, b.id, 1)}
                            className="rounded border border-gray-300 p-1 hover:bg-gray-50 disabled:opacity-30"
                            aria-label="아래로"
                          >
                            <ChevronDown className="size-4" />
                          </button>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </details>
            );
          })}
        </div>
      </section>
    </div>
  );
}
