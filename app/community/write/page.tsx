"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { COMMUNITY_CATEGORIES, CommunityCategory } from "@/types/community";

export default function WritePostPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<CommunityCategory>("일반");
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
      setMessage("글쓰기는 로그인 후 가능합니다.");
      return;
    }

    setLoading(true);
    setMessage("");

    const { data, error } = await supabase
      .from("posts")
      .insert({
        title,
        content,
        category,
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

    router.push(`/community/${data.id}`);
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-4 p-6">
      <header className="border border-dashed border-gray-500 bg-white/70 p-4">
        <h1 className="text-lg font-bold">게시글 작성</h1>
        <p className="mt-1 text-sm text-gray-600">
          로그인 계정: {userEmail || "미로그인"}
        </p>
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
          카테고리
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value as CommunityCategory)}
            className="mt-1 w-full border border-dashed border-gray-500 bg-white px-3 py-2"
          >
            {COMMUNITY_CATEGORIES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          제목
          <input
            required
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="mt-1 w-full border border-dashed border-gray-500 bg-white px-3 py-2"
            placeholder="제목을 입력해 주세요."
          />
        </label>

        <label className="text-sm">
          내용
          <textarea
            required
            rows={12}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            className="mt-1 w-full border border-dashed border-gray-500 bg-white px-3 py-2"
            placeholder="덕질 얘기를 마음껏 작성해 주세요."
          />
        </label>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading || !userId}
            className="border border-dashed border-gray-500 bg-gray-200 px-3 py-2 text-sm disabled:opacity-50"
          >
            {loading ? "등록 중..." : "등록"}
          </button>
          <Link
            href="/community"
            className="border border-dashed border-gray-500 bg-white px-3 py-2 text-sm"
          >
            목록으로
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
