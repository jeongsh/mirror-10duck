"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import {
  COMMUNITY_CATEGORIES,
  CommunityCategory,
  CommunityPost,
} from "@/types/community";

export default function CommunityPage() {
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<CommunityCategory | "전체">(
    "전체",
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchPosts = async () => {
      setLoading(true);
      setError("");
      const query =
        selectedCategory === "전체"
          ? supabase.from("posts").select("*")
          : supabase.from("posts").select("*").eq("category", selectedCategory);

      const { data, error: queryError } = await query.order("created_at", {
        ascending: false,
      });

      if (queryError) {
        setError(queryError.message);
        setPosts([]);
      } else {
        setPosts((data ?? []) as CommunityPost[]);
      }
      setLoading(false);
    };

    fetchPosts();
  }, [selectedCategory]);

  const postCountLabel = useMemo(
    () => (loading ? "로딩 중..." : `${posts.length}개`),
    [loading, posts.length],
  );

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-4 p-6">
      <header className="flex flex-wrap items-center justify-between gap-2 border border-dashed border-gray-500 bg-white/70 p-4">
        <div>
          <h1 className="text-lg font-bold">오타쿠 커뮤니티 게시판</h1>
          <p className="text-sm text-gray-600">Supabase 기반 게시글 CRUD</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/auth"
            className="border border-dashed border-gray-500 bg-white px-3 py-2 text-sm"
          >
            로그인
          </Link>
          <Link
            href="/community/write"
            className="border border-dashed border-gray-500 bg-gray-200 px-3 py-2 text-sm"
          >
            글쓰기
          </Link>
        </div>
      </header>

      <section className="border border-dashed border-gray-500 bg-white/70 p-4">
        <div className="mb-3 flex flex-wrap gap-2">
          <button
            type="button"
            className={`border border-dashed px-3 py-2 text-sm ${selectedCategory === "전체" ? "bg-gray-200" : "bg-white"}`}
            onClick={() => setSelectedCategory("전체")}
          >
            전체
          </button>
          {COMMUNITY_CATEGORIES.map((category) => (
            <button
              key={category}
              type="button"
              className={`border border-dashed px-3 py-2 text-sm ${selectedCategory === category ? "bg-gray-200" : "bg-white"}`}
              onClick={() => setSelectedCategory(category)}
            >
              {category}
            </button>
          ))}
        </div>

        <p className="mb-3 text-sm text-gray-600">게시글 수: {postCountLabel}</p>

        {error ? (
          <div className="border border-dashed border-red-500 bg-red-50 p-3 text-sm text-red-700">
            데이터 조회 실패: {error}
          </div>
        ) : null}

        <div className="overflow-x-auto border border-dashed border-gray-500">
          <div className="grid min-w-[740px] grid-cols-[220px_100px_1fr_190px] bg-gray-200 px-3 py-2 text-sm font-semibold">
            <span>제목</span>
            <span>카테고리</span>
            <span>작성자</span>
            <span>작성일</span>
          </div>
          {posts.map((post) => (
            <Link
              key={post.id}
              href={`/community/${post.id}`}
              className="grid min-w-[740px] grid-cols-[220px_100px_1fr_190px] border-t border-dashed border-gray-400 px-3 py-3 text-sm hover:bg-gray-100"
            >
              <span className="truncate font-semibold">{post.title}</span>
              <span>{post.category}</span>
              <span className="truncate text-gray-600">{post.author_email}</span>
              <span className="text-gray-600">
                {new Date(post.created_at).toLocaleString("ko-KR")}
              </span>
            </Link>
          ))}
          {!loading && posts.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-gray-600">
              아직 게시글이 없습니다. 첫 글을 작성해보세요.
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
