"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { CommunityPost } from "@/types/community";

export default function FeedPage() {
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Phase 2 MVP: 아직 팔로우 로직 필터가 완전히 구현되기 전이므로
    // 피드 전체 글(최신 글)을 조회하여 형태를 보여주는 역할입니다.
    const fetchFeed = async () => {
      setLoading(true);
      
      const { data } = await supabase
        .from("posts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30);
        
      if (data) {
        setPosts(data as CommunityPost[]);
      }
      setLoading(false);
    };

    fetchFeed();
  }, []);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-4 p-6">
      <header className="flex flex-wrap items-center justify-between gap-2 border border-dashed border-gray-500 bg-white/70 p-4">
        <div>
          <h1 className="text-xl font-bold">내 타임라인 (Feed)</h1>
          <p className="text-sm text-gray-600">내가 팔로우한 유저 및 게시판의 글이 노출됩니다.</p>
        </div>
        <Link href="/feed/write" className="border border-dashed border-gray-500 bg-gray-200 px-3 py-2 text-sm hover:bg-gray-300">
          피드 작성
        </Link>
      </header>

      <section className="flex flex-col gap-4">
        {loading ? (
          <div className="border border-dashed border-gray-500 bg-white/70 p-4 text-center text-sm text-gray-500">
            로딩 중...
          </div>
        ) : posts.length === 0 ? (
          <div className="border border-dashed border-gray-500 bg-white/70 p-8 text-center text-gray-500">
            아직 피드에 표시할 글이 없습니다. 새로운 피드를 작성해 보세요!
          </div>
        ) : (
          posts.map((post) => (
            <article key={post.id} className="flex flex-col gap-2 border border-dashed border-gray-500 bg-white/70 p-4 transition-colors hover:bg-gray-50">
              <div className="flex items-center justify-between text-sm text-gray-600">
                <span className="font-semibold">{post.author_email}</span>
                <span>{new Date(post.created_at).toLocaleString("ko-KR")}</span>
              </div>
              
              <div className="flex gap-2">
                {post.source_type === 'BOARD' && (
                  <span className="inline-block rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                    게시판 공유글
                  </span>
                )}
                {post.is_hot && (
                  <span className="inline-block rounded bg-red-100 px-2 py-0.5 text-xs text-red-700">
                    🔥 개념글
                  </span>
                )}
              </div>
              
              {post.title && post.source_type === 'BOARD' && (
                <div className="mt-1 font-bold">
                  {post.title}
                </div>
              )}
              
              <div className="mt-2 whitespace-pre-wrap text-sm text-gray-800">
                {post.content}
              </div>
              
              <div className="mt-4 flex gap-2">
                <button className="border border-dashed border-gray-400 px-3 py-1 text-xs text-gray-600 hover:bg-gray-200">
                  좋아요
                </button>
                {post.source_type === 'FEED' && (
                  <button className="border border-dashed border-gray-400 px-3 py-1 text-xs text-gray-600 hover:bg-gray-200">
                    게시판에 공유 (Cross-post)
                  </button>
                )}
              </div>
            </article>
          ))
        )}
      </section>
    </main>
  );
}
