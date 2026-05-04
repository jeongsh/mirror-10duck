"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { CommunityPost, Board, postAggregateDefaults } from "@/types/community";
import RichContent from "@/components/stickers/RichContent";
import ReactionBar from "@/components/community/ReactionBar";
import PostVoteBar from "@/components/community/PostVoteBar";
import IdentityBadge from "@/components/community/IdentityBadge";
import { formatCommunityDate } from "@/lib/utils/formatDate";

export default function FeedPage() {
  const [posts, setPosts] = useState<CommunityPost[]>([]);

  const patchPostStats = (postId: string, patch: Partial<CommunityPost>) => {
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, ...patch } : p)),
    );
  };
  const [loading, setLoading] = useState(true);
  
  const [boards, setBoards] = useState<Board[]>([]);
  const [sharePostId, setSharePostId] = useState<string | null>(null);
  const [shareBoardId, setShareBoardId] = useState("");
  const [shareTitle, setShareTitle] = useState("");
  const [shareLoading, setShareLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    // Phase 2 MVP: 아직 팔로우 로직 필터가 완전히 구현되기 전이므로
    // 피드 전체 글(최신 글)을 조회하여 형태를 보여주는 역할입니다.
    const fetchFeed = async () => {
      setLoading(true);
      
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id;
      if (authData.user) setCurrentUser(authData.user);

      // 공유할 타겟을 위해 게시판 목록 조회
      const { data: boardsData } = await supabase.from("boards").select("*");
      if (boardsData) setBoards(boardsData as Board[]);

      let postsData = [];

      if (!userId) {
        // 비로그인: 전체 최신 글을 임시로 보여줌
        const { data } = await supabase
          .from("posts")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(30);
        if (data) postsData = data;
      } else {
        // 로그인 상태: 팔로우 기반 하이브리드 피드 쿼리 (RPC) 호출
        const { data, error } = await supabase.rpc("get_hybrid_feed", {
          viewer_id: userId,
          limit_cnt: 30,
          offset_cnt: 0
        });
        
        if (data) {
          postsData = data;
        } else if (error) {
          console.error("Feed Fetch Error:", error);
        }
      }

      setPosts(postsData as CommunityPost[]);
      setLoading(false);
    };

    fetchFeed();
  }, []);

  const submitShare = async () => {
    if (!sharePostId || !shareBoardId || !shareTitle.trim() || !currentUser) return;
    
    setShareLoading(true);
    const originPost = posts.find((p) => p.id === sharePostId);
    
    if (originPost) {
      const { error } = await supabase.from("posts").insert({
        board_id: shareBoardId,
        title: shareTitle,
        content: originPost.content, // 스냅샷 복사
        source_type: "BOARD",
        origin_post_id: originPost.id, // 원본 글 연결 고리
        author_id: currentUser.id,
        author_email: currentUser.email,
      });

      if (!error) {
        alert("선택한 게시판에 성공적으로 공유되었습니다!");
        setSharePostId(null);
        setShareTitle("");
        setShareBoardId("");
      } else {
        alert("공유 실패: " + error.message);
      }
    }
    setShareLoading(false);
  };

  return (
    <main className="flex w-full flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-2 border border-dashed border-gray-500 bg-white/70 p-4">
        <div>
          <h1 className="text-xl font-bold">내 타임라인 (Feed)</h1>
          <p className="text-sm text-gray-600">내가 팔로우한 유저 및 게시판의 글이 노출됩니다.</p>
        </div>
        <Link href="/feed/write" className="border border-dashed border-gray-500 bg-gray-200 px-3 py-2 text-sm hover:bg-gray-300">
          피드 작성
        </Link>
      </header>

      {/* 공유 모달 */}
      {sharePostId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm border border-dashed border-gray-500 bg-white p-6">
            <h2 className="mb-4 text-lg font-bold">게시판에 공유하기</h2>
            <div className="mb-4 flex flex-col gap-3">
              <label className="text-sm">
                게시판 선택
                <select 
                  className="mt-1 w-full border border-dashed border-gray-400 bg-white p-2 text-sm"
                  value={shareBoardId}
                  onChange={(e) => setShareBoardId(e.target.value)}
                >
                  <option value="">게시판을 선택하세요</option>
                  {boards.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                공유할 제목
                <input 
                  type="text"
                  placeholder="게시판에 표시될 제목을 입력하세요"
                  className="mt-1 w-full border border-dashed border-gray-400 bg-white p-2 text-sm"
                  value={shareTitle}
                  onChange={(e) => setShareTitle(e.target.value)}
                />
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button 
                onClick={() => setSharePostId(null)}
                className="border border-dashed border-gray-400 px-3 py-1 text-sm hover:bg-gray-100"
              >
                취소
              </button>
              <button 
                onClick={submitShare}
                disabled={!shareBoardId || !shareTitle.trim() || shareLoading}
                className="border border-dashed border-gray-500 bg-blue-50 px-3 py-1 text-sm text-blue-700 hover:bg-blue-100 disabled:opacity-50"
              >
                {shareLoading ? "공유 중..." : "공유하기"}
              </button>
            </div>
          </div>
        </div>
      )}

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
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-gray-600">
                <IdentityBadge 
                  profile={post.profiles} 
                  fallback={{ nickname: post.author_email.split('@')[0] }}
                  size="sm"
                />
                <span className="tabular-nums text-xs text-gray-500">
                  👁 {postAggregateDefaults(post).view_count} · 💬 {postAggregateDefaults(post).comment_count}
                </span>
                <span className="text-[10px] tabular-nums text-gray-400">
                  {formatCommunityDate(post.created_at)}
                </span>
              </div>
              
              <div className="flex gap-2">
                {post.source_type === 'BOARD' && post.is_hot && (
                  <span className="inline-block rounded bg-red-100 px-2 py-0.5 text-xs text-red-700">
                    🔥 {(post as any).board_name || "게시판"} 개념글
                  </span>
                )}
              </div>
              
              {post.title && post.source_type === 'BOARD' && (
                <div className="mt-1 font-bold">
                  {post.title}
                </div>
              )}
              
              <div className="mt-2">
                <RichContent content={post.content} />
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <PostVoteBar
                  postId={post.id}
                  viewerId={currentUser?.id ?? null}
                  upvoteCount={postAggregateDefaults(post).upvote_count}
                  downvoteCount={postAggregateDefaults(post).downvote_count}
                  onCountsSynced={(next) =>
                    patchPostStats(post.id, {
                      upvote_count: next.upvote_count,
                      downvote_count: next.downvote_count,
                    })
                  }
                />
                <ReactionBar postId={post.id} viewerId={currentUser?.id ?? null} />
              </div>

              {post.source_type === 'FEED' && (
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => setSharePostId(post.id)}
                    className="border border-dashed border-gray-400 px-3 py-1 text-xs text-gray-600 hover:bg-gray-200"
                  >
                    게시판에 공유 (Cross-post)
                  </button>
                </div>
              )}
            </article>
          ))
        )}
      </section>
    </main>
  );
}
