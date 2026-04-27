"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Board } from "@/types/community";

export default function BoardDirectoryPage() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBoards = async () => {
      const { data, error } = await supabase
        .from("boards")
        .select("*")
        .order("created_at", { ascending: true });
      if (data) setBoards(data);
      setLoading(false);
    };
    fetchBoards();
  }, []);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 p-6">
      <header className="border border-dashed border-gray-500 bg-white/70 p-4">
        <h1 className="text-xl font-bold">게시판 채널 목록</h1>
        <p className="text-sm text-gray-600">원하는 채널에 입장하세요.</p>
      </header>

      {loading ? (
        <p className="text-center text-sm text-gray-500">로딩 중...</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          {boards.map((board) => (
            <Link
              key={board.id}
              href={`/board/${board.slug}`}
              className="border border-dashed border-gray-500 bg-white/70 p-4 transition-colors hover:bg-gray-100"
            >
              <h2 className="text-lg font-bold">{board.name}</h2>
              <p className="mt-1 text-sm text-gray-600">{board.description}</p>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
