"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export default function WriteFeedPage() {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const user = data.user;
      setUserId(user?.id ?? "");
      setUserEmail(user?.email ?? "");
    });
  }, []);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!userId || !userEmail) {
      setMessage("로그인 후 작성 가능합니다.");
      return;
    }

    setLoading(true);
    setMessage("");

    const { error } = await supabase
      .from("posts")
      .insert({
        content,
        source_type: "FEED",
        author_id: userId,
        author_email: userEmail,
        board_id: null, // 피드 전용 글은 게시판에 귀속되지 않음
      });

    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    router.push("/feed");
  };

  return (
    <main className="flex w-full flex-col gap-4">
      <header className="border border-dashed border-gray-500 bg-white/70 p-4">
        <h1 className="text-lg font-bold">피드 작성</h1>
        <p className="mt-1 text-sm text-gray-600">
          가볍게 일상을 공유해 보세요. (게시판이 아닌 나만의 타임라인에 등록됩니다)
        </p>
      </header>

      {!userId ? (
        <div className="border border-dashed border-gray-500 bg-white/70 p-4 text-sm">
          글쓰기를 위해 먼저 로그인해 주세요.{" "}
          <Link href="/auth" className="underline hover:text-blue-600">로그인 페이지로 이동</Link>
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="flex flex-col gap-3 border border-dashed border-gray-500 bg-white/70 p-4">
        <label className="text-sm">
          내용
          <textarea
            required
            rows={6}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            className="mt-1 w-full border border-dashed border-gray-500 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-gray-300"
            placeholder="무슨 일이 일어나고 있나요?"
          />
        </label>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading || !userId}
            className="border border-dashed border-gray-500 bg-gray-200 px-4 py-2 text-sm font-semibold hover:bg-gray-300 disabled:opacity-50"
          >
            {loading ? "작성 중..." : "등록"}
          </button>
          <Link href="/feed" className="border border-dashed border-gray-500 bg-white px-4 py-2 text-sm hover:bg-gray-100">
            취소
          </Link>
        </div>
      </form>

      {message ? (
        <p className="border border-dashed border-gray-500 bg-white/70 p-3 text-sm text-red-600">{message}</p>
      ) : null}
    </main>
  );
}
