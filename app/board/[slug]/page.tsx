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

  // UI 상태
  const [activeTab, setActiveTab] = useState<"all" | "hot">("all");
  const [sortBy, setSortBy] = useState<"latest" | "comments" | "upvotes" | "views">("latest");
  const [searchQuery, setSearchQuery] = useState("");

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

        // 2. 해당 채널의 게시글 목록 조회 (필터 및 정렬 적용)
        let query = supabase
          .from("posts")
          .select("*, profiles(*)")
          .eq("board_id", boardData.id);

        if (activeTab === "hot") {
          query = query.eq("is_hot", true);
        }

        if (searchQuery) {
          query = query.ilike("title", `%${searchQuery}%`);
        }

        // 정렬 적용
        switch (sortBy) {
          case "comments":
            query = query.order("comment_count", { ascending: false });
            break;
          case "upvotes":
            query = query.order("upvote_count", { ascending: false });
            break;
          case "views":
            query = query.order("view_count", { ascending: false });
            break;
          case "latest":
          default:
            query = query.order("created_at", { ascending: false });
            break;
        }

        const { data: postsData } = await query;
        
        if (postsData) setPosts(postsData as CommunityPost[]);
      }
      setLoading(false);
    };

    if (slug) fetchBoardAndPosts();
  }, [slug, activeTab, sortBy, searchQuery]);

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

      <section className="flex flex-col gap-4 border border-dashed border-gray-500 bg-white/70 p-4">
        {/* 탭 및 필터 바 */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-dashed border-gray-300 pb-4">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab("all")}
              className={`px-4 py-1.5 text-sm font-bold transition-colors ${
                activeTab === "all"
                  ? "bg-gray-800 text-white"
                  : "bg-white text-gray-600 hover:bg-gray-100 border border-dashed border-gray-400"
              }`}
            >
              전체글
            </button>
            <button
              onClick={() => setActiveTab("hot")}
              className={`px-4 py-1.5 text-sm font-bold transition-colors ${
                activeTab === "hot"
                  ? "bg-red-600 text-white"
                  : "bg-white text-red-600 hover:bg-red-50 border border-dashed border-red-400"
              }`}
            >
              개념글 🔥
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* 검색어 입력 */}
            <div className="relative">
              <input
                type="text"
                placeholder="제목 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-48 border border-dashed border-gray-400 bg-white px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-gray-400"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              )}
            </div>

            {/* 정렬 드롭다운 */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="border border-dashed border-gray-400 bg-white px-2 py-1.5 text-xs font-medium focus:outline-none"
            >
              <option value="latest">최신순</option>
              <option value="upvotes">추천순</option>
              <option value="comments">댓글순</option>
              <option value="views">조회순</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto border border-dashed border-gray-500">
          <div className="grid min-w-[800px] grid-cols-[60px_1fr_140px_80px_60px_60px] bg-gray-100 px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-gray-500">
            <span className="text-center">번호</span>
            <span>제목</span>
            <span>작성자</span>
            <span className="text-center">날짜</span>
            <span className="text-center">조회</span>
            <span className="text-center">추천</span>
          </div>
          {posts.map((post) => (
            <Link
              key={post.id}
              href={`/board/${slug}/${post.id}`}
              className={`grid min-w-[800px] grid-cols-[60px_1fr_140px_80px_60px_60px] items-center border-t border-dashed border-gray-300 px-3 py-2 text-sm transition-colors hover:bg-white ${
                post.is_hot ? "bg-red-50/30" : ""
              }`}
            >
              <span className="text-center text-[11px] text-gray-400 tabular-nums">
                {post.id.slice(0, 4)}
              </span>
              <div className="flex items-center gap-1.5 overflow-hidden">
                <div className="flex flex-shrink-0 items-center gap-1">
                  {post.is_hot && (
                    <span className="bg-red-600 px-1 py-0.5 text-[10px] font-bold text-white">
                      HOT
                    </span>
                  )}
                  {post.source_type === 'FEED' && (
                    <span className="bg-blue-500 px-1 py-0.5 text-[10px] font-bold text-white">
                      피드
                    </span>
                  )}
                </div>
                <span className="truncate font-medium text-gray-800">
                  {post.source_type === 'FEED' ? '🔄 피드에서 공유된 포스트입니다' : post.title || '제목 없음'}
                </span>
                {/* 콘텐츠 아이콘 (스티커/이미지 등 추후 연동) */}
                <div className="flex items-center gap-1 text-gray-400">
                  {post.content.includes(":sticker/") && (
                    <span title="스티커 포함" className="text-[10px] opacity-70">🖼️</span>
                  )}
                </div>
                {postAggregateDefaults(post).comment_count > 0 && (
                  <span className="text-[11px] font-bold text-orange-600 tabular-nums">
                    [{postAggregateDefaults(post).comment_count}]
                  </span>
                )}
              </div>
              <div className="flex items-center overflow-hidden">
                <IdentityBadge 
                  profile={post.profiles} 
                  fallback={{ nickname: post.author_email.split('@')[0] }}
                  size="sm"
                />
              </div>
              <span className="text-center text-[11px] text-gray-500 tabular-nums">
                {formatCommunityDate(post.created_at)}
              </span>
              <span className="text-center text-xs text-gray-500 tabular-nums">
                {postAggregateDefaults(post).view_count}
              </span>
              <div className="flex flex-col items-center leading-none">
                <span className={`text-xs font-bold tabular-nums ${
                  postAggregateDefaults(post).upvote_count >= 10 ? "text-red-600" : "text-blue-600"
                }`}>
                  {postAggregateDefaults(post).upvote_count}
                </span>
                {postAggregateDefaults(post).downvote_count > 0 && (
                  <span className="text-[9px] text-gray-400 tabular-nums">
                    -{postAggregateDefaults(post).downvote_count}
                  </span>
                )}
              </div>
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
