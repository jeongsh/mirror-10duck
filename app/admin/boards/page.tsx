"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Board } from "@/types/community";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function AdminBoardsPage() {
  const router = useRouter();
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBoards = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("boards")
      .select("*")
      .order("created_at", { ascending: true });
    if (data) setBoards(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchBoards();
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between border-b border-dashed border-gray-500 pb-4">
        <div>
          <h2 className="text-xl font-bold">게시판 관리</h2>
          <p className="mt-1 text-sm text-gray-600">게시판을 선택하여 상세 설정을 관리하세요.</p>
        </div>
        <Link
          href="/admin/boards/create"
          className="rounded bg-black px-4 py-2 text-sm text-white transition-opacity hover:opacity-80"
        >
          새 게시판 추가
        </Link>
      </div>

      <section className="rounded border border-dashed border-gray-500 bg-white/70 p-6">
        {loading ? (
          <p className="text-sm text-gray-500">로딩 중...</p>
        ) : boards.length === 0 ? (
          <p className="text-sm text-gray-500">생성된 게시판이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b">
                <tr>
                  <th className="p-3 font-semibold">이름</th>
                  <th className="p-3 font-semibold">슬러그</th>
                  <th className="p-3 font-semibold">개념글 컷</th>
                  <th className="p-3 font-semibold text-right">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dashed">
                {boards.map((board) => (
                  <tr 
                    key={board.id} 
                    className="cursor-pointer transition-colors hover:bg-gray-100"
                    onClick={() => router.push(`/admin/boards/${board.id}`)}
                  >
                    <td className="p-3 font-medium">{board.name}</td>
                    <td className="p-3 text-gray-600">/{board.slug}</td>
                    <td className="p-3 text-gray-600">{board.hot_threshold}</td>
                    <td className="p-3 text-right">
                      <span className="text-blue-600 hover:underline">
                        설정
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
