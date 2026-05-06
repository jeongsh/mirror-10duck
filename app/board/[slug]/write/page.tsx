"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useAuthUser } from "@/lib/supabase/useAuthUser";
import { Board } from "@/types/community";
import CommunityEditor from "@/components/community/editor/CommunityEditor";

export default function WritePostPage() {
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;
  const authUser = useAuthUser();

  const [board, setBoard] = useState<Board | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const userId = authUser?.id ?? "";
  const userEmail = authUser?.email ?? "";

  useEffect(() => {
    let cancelled = false;

    const fetchBoard = async () => {
      if (!slug) return;
      const { data } = await supabase
        .from("boards")
        .select("*")
        .eq("slug", slug)
        .single();
      if (!cancelled) setBoard((data as Board | null) ?? null);
    };

    void fetchBoard();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!userId || !userEmail) {
      setMessage("글쓰기는 로그인 후 가능합니다.");
      return;
    }
    if (!board) {
      setMessage("게시판 정보를 불러오지 못했습니다.");
      return;
    }

    setLoading(true);
    setMessage("");

    const { data, error } = await supabase
      .from("posts")
      .insert({
        title,
        content,
        board_id: board.id,
        source_type: "BOARD",
        author_id: userId,
        author_email: userEmail,
      })
      .select("id")
      .single();

    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    router.push(`/board/${slug}/${data.id}`);
  };

  return (
    <main className="flex w-full flex-col gap-4">
      <header className="border border-dashed border-gray-500 bg-white/70 p-4">
        <h1 className="text-lg font-bold">
          {board ? `${board.name} - 글쓰기` : "게시글 작성"}
        </h1>

      </header>

      {!userId ? (
        <div className="border border-dashed border-gray-500 bg-white/70 p-4 text-sm">
          글쓰기를 위해 먼저 로그인해 주세요.{" "}
          <Link href="/auth" className="underline">
            로그인 페이지로 이동
          </Link>
        </div>
      ) : null}

      <form
        onSubmit={onSubmit}
        className="flex flex-col gap-3 border border-dashed border-gray-500 bg-white/70 p-4"
      >
        <label className="text-sm">
          제목
          <input
            required
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="mt-1 w-full border border-dashed border-gray-500 bg-white px-3 py-2"
            placeholder="제목을 입력해 주세요"
          />
        </label>

        <div className="flex flex-col gap-1">
          <span className="text-sm">내용</span>
          <CommunityEditor
            content={content}
            onChange={setContent}
            userId={userId}
            placeholder="내용을 작성해 주세요."
          />
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading || !userId || !board}
            className="border border-dashed border-gray-500 bg-gray-200 px-3 py-2 text-sm disabled:opacity-50"
          >
            {loading ? "등록 중..." : "등록"}
          </button>
          <Link
            href={`/board/${slug}`}
            className="border border-dashed border-gray-500 bg-white px-3 py-2 text-sm"
          >
            취소
          </Link>
        </div>
      </form>

      {message ? (
        <p className="border border-dashed border-gray-500 bg-white/70 p-3 text-sm">
          {message}
        </p>
      ) : null}
    </main>
  );
}
