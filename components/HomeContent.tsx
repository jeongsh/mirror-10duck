"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Board, CommunityPost } from "@/types/community";

export default function HomeContent() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [hotPosts, setHotPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHomeData = async () => {
      // 인기 채널 (일부 6개)
      const { data: boardData } = await supabase
        .from("boards")
        .select("*")
        .limit(6);
      
      // 개념글/실시간 베스트 (최근 10개)
      // 실제로는 is_hot = true 이거나 좋아요 순으로 정렬하는 뷰/RPC가 필요함
      const { data: postData } = await supabase
        .from("posts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);

      if (boardData) setBoards(boardData);
      if (postData) setHotPosts(postData);
      setLoading(false);
    };

    fetchHomeData();
  }, []);

  return (
    <section className="w-full flex flex-col gap-6">
      
      {/* 실시간 베스트 (념글/실베) 영역 */}
      <div className="border border-dashed border-gray-500 bg-white/70 p-4">
        <div className="flex justify-between items-end mb-4 border-b border-dashed border-gray-400 pb-2">
          <h2 className="text-xl font-bold text-gray-800">실시간 베스트</h2>
          <span className="text-xs text-gray-500">통합 추천글</span>
        </div>
        
        {loading ? (
           <p className="text-center text-sm text-gray-500 py-10">로딩 중...</p>
        ) : hotPosts.length > 0 ? (
          <ul className="flex flex-col divide-y divide-dashed divide-gray-300">
            {hotPosts.map((post) => (
              <li key={post.id} className="py-2 hover:bg-gray-100 transition-colors">
                <Link href={`/board/${post.board_id}/post/${post.id}`} className="flex items-center gap-3 px-2">
                  <span className="shrink-0 text-xs text-gray-500 border border-gray-300 bg-gray-100 px-1 rounded-sm w-12 text-center truncate">
                    {/* 가상의 게시판 이름 매핑. 실제로는 Join 쿼리 필요 */}
                    게시판
                  </span>
                  <span className="flex-1 text-sm text-gray-800 font-medium truncate">
                    {post.title || "제목 없음 (피드 글)"} 
                  </span>
                  <span className="shrink-0 text-xs text-gray-500 w-24 text-right truncate">
                    {post.author_email.split('@')[0]}
                  </span>
                  <span className="shrink-0 text-xs text-red-500 font-bold w-8 text-right">
                    {post.is_hot ? "🔥" : "N"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="py-10 text-center text-sm text-gray-500">
            아직 등록된 베스트 게시물이 없습니다.
          </div>
        )}
      </div>

      {/* 인기 채널 (게시판) 썸네일/카드 영역 */}
      <div className="border border-dashed border-gray-500 bg-white/70 p-4">
        <div className="flex justify-between items-end mb-4 border-b border-dashed border-gray-400 pb-2">
          <h2 className="text-xl font-bold text-gray-800">인기 채널</h2>
          <Link href="/board" className="text-xs text-gray-500 hover:underline">전체 보기 »</Link>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {boards.map(board => (
            <Link 
              key={board.id} 
              href={`/board/${board.slug}`}
              className="flex flex-col items-center justify-center border border-dashed border-gray-400 p-4 transition-all hover:bg-gray-100 hover:border-gray-600"
            >
              <div className="w-12 h-12 bg-gray-200 mb-2 flex items-center justify-center text-xl">
                {board.name.charAt(0)}
              </div>
              <span className="text-sm font-bold text-gray-800">{board.name}</span>
            </Link>
          ))}
        </div>
      </div>

    </section>
  );
}
