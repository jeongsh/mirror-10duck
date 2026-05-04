"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Board, CommunityPost, postAggregateDefaults } from "@/types/community";
import { useParams } from "next/navigation";
import IdentityBadge from "@/components/community/IdentityBadge";
import { formatCommunityDate } from "@/lib/utils/formatDate";

export default function BoardPage() {
  const params = useParams();
  const slug = params.slug as string;
  
  const [board, setBoard] = useState<Board | null>(null);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const fetchBoardAndPosts = async () => {
      setLoading(true);

      const { data: authData } = await supabase.auth.getUser();
      const currentUserId = authData.user?.id;
      if (currentUserId) setUserId(currentUserId);

      // 1. 게시판 채널 정보 조회
      const { data: boardData } = await supabase.from("boards").select("*").eq("slug", slug).single();
      
      if (boardData) {
        setBoard(boardData);

        if (currentUserId) {
          const { data: followData } = await supabase
            .from("follows_board")
            .select("*")
            .eq("user_id", currentUserId)
            .eq("board_id", boardData.id)
            .single();
          if (followData) setIsFollowing(true);
        }

        // 2. 해당 채널의 게시글 목록 조회 (작성자 프로필 조인)
        const { data: postsData } = await supabase
          .from("posts")
          .select("*, profiles(*)")
          .eq("board_id", boardData.id)
          .order("created_at", { ascending: false });
        
        if (postsData) setPosts(postsData as CommunityPost[]);
      }
      setLoading(false);
    };

    if (slug) fetchBoardAndPosts();
  }, [slug]);

  const toggleFollowBoard = async () => {
    if (!userId) {
      alert("로그인이 필요합니다.");
      return;
    }
    if (!board) return;

    if (isFollowing) {
      await supabase.from("follows_board").delete().eq("user_id", userId).eq("board_id", board.id);
      setIsFollowing(false);
    } else {
      await supabase.from("follows_board").insert({ user_id: userId, board_id: board.id });
      setIsFollowing(true);
    }
  };

  if (loading) return <main className="p-6 text-center text-gray-500">로딩 중...</main>;
  if (!board) return <main className="p-6 text-center text-red-500">게시판을 찾을 수 없습니다.</main>;

  return (
    <main className="flex w-full flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-2 border border-dashed border-gray-500 bg-white/70 p-4">
        <div>
          <h1 className="text-lg font-bold">{board.name}</h1>
          <p className="text-sm text-gray-600">{board.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={toggleFollowBoard}
            className={`border border-dashed border-gray-500 px-3 py-2 text-sm transition-colors ${isFollowing ? "bg-red-100 text-red-700" : "bg-white hover:bg-gray-100"}`}
          >
            {isFollowing ? "팔로잉 취소" : "게시판 팔로우"}
          </button>
          <Link href="/board" className="border border-dashed border-gray-500 bg-white px-3 py-2 text-sm hover:bg-gray-100">
            채널 목록
          </Link>
          <Link href={`/board/${slug}/write`} className="border border-dashed border-gray-500 bg-gray-200 px-3 py-2 text-sm">
            글쓰기
          </Link>
        </div>
      </header>

      <section className="border border-dashed border-gray-500 bg-white/70 p-4">
        <div className="overflow-x-auto border border-dashed border-gray-500">
          <div className="grid min-w-[800px] grid-cols-[60px_1fr_120px_60px_50px_50px_60px] bg-gray-100 px-3 py-2 text-xs font-bold uppercase tracking-widest text-gray-500">
            <span className="text-center">번호</span>
            <span>제목</span>
            <span>작성자</span>
            <span className="text-center">날짜</span>
            <span className="text-center">조회</span>
            <span className="text-center">추천</span>
            <span className="text-center">비추</span>
          </div>
          {posts.map((post) => (
            <Link
              key={post.id}
              href={`/board/${slug}/${post.id}`}
              className="grid min-w-[800px] grid-cols-[60px_1fr_120px_60px_50px_50px_60px] items-center border-t border-dashed border-gray-300 px-3 py-2.5 text-sm transition-colors hover:bg-white"
            >
              <span className="text-center text-xs text-gray-400 tabular-nums">
                {post.id.slice(0, 4)}
              </span>
              <span className="flex items-center gap-1 overflow-hidden">
                <span className="truncate font-medium text-gray-800">
                  {post.is_hot && <span className="mr-1 text-red-500">🔥</span>}
                  {post.source_type === 'FEED' ? '🔄 피드 공유' : post.title || '제목 없음'}
                </span>
                {postAggregateDefaults(post).comment_count > 0 && (
                  <span className="text-[11px] font-bold text-orange-500 tabular-nums">
                    [{postAggregateDefaults(post).comment_count}]
                  </span>
                )}
              </span>
              <div className="flex items-center overflow-hidden">
                <IdentityBadge 
                  profile={post.profiles} 
                  fallback={{ nickname: post.author_email.split('@')[0] }}
                  size="sm"
                />
              </div>
              <span className="text-center text-xs text-gray-500 tabular-nums">
                {formatCommunityDate(post.created_at)}
              </span>
              <span className="text-center text-xs text-gray-500 tabular-nums">
                {postAggregateDefaults(post).view_count}
              </span>
              <span className="text-center text-xs font-bold text-blue-600 tabular-nums">
                {postAggregateDefaults(post).upvote_count}
              </span>
              <span className="text-center text-xs text-gray-400 tabular-nums">
                {postAggregateDefaults(post).downvote_count}
              </span>
            </Link>
          ))}
          {!loading && posts.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-gray-600">아직 게시글이 없습니다. 첫 글을 작성해보세요.</p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
