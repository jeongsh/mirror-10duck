"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import { useAuthUser } from "@/lib/supabase/useAuthUser";
import { CommunityPost, Board, postAggregateDefaults } from "@/types/community";
import RichContent from "@/components/stickers/RichContent";
import ReactionBar from "@/components/community/ReactionBar";
import PostVoteBar from "@/components/community/PostVoteBar";
import IdentityBadge from "@/components/community/IdentityBadge";
import { formatCommunityDate } from "@/lib/utils/formatDate";

export default function FeedPage() {
  const authUser = useAuthUser();
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [boards, setBoards] = useState<Board[]>([]);
  const [sharePostId, setSharePostId] = useState<string | null>(null);
  const [shareBoardId, setShareBoardId] = useState("");
  const [shareTitle, setShareTitle] = useState("");
  const [shareLoading, setShareLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const patchPostStats = (postId: string, patch: Partial<CommunityPost>) => {
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, ...patch } : p)),
    );
  };

  useEffect(() => {
    let cancelled = false;

    const fetchFeed = async () => {
      if (authUser === undefined) return;

      setLoading(true);
      setCurrentUser(authUser ?? null);

      const userId = authUser?.id;

      if (!userId) {
        const [boardsResponse, postsResponse] = await Promise.all([
          supabase.from("boards").select("*"),
          supabase
            .from("posts")
            .select("*, profiles(*)")
            .order("created_at", { ascending: false })
            .limit(30),
        ]);

        if (cancelled) return;
        setBoards((boardsResponse.data as Board[] | null) ?? []);
        setPosts((postsResponse.data as CommunityPost[] | null) ?? []);
        setLoading(false);
        return;
      }

      const [boardsResponse, feedResponse] = await Promise.all([
        supabase.from("boards").select("*"),
        supabase.rpc("get_hybrid_feed", {
          viewer_id: userId,
          limit_cnt: 30,
          offset_cnt: 0,
        }),
      ]);

      if (cancelled) return;
      setBoards((boardsResponse.data as Board[] | null) ?? []);
      setPosts((feedResponse.data as CommunityPost[] | null) ?? []);
      if (feedResponse.error) console.error("Feed Fetch Error:", feedResponse.error);
      setLoading(false);
    };

    void fetchFeed();

    return () => {
      cancelled = true;
    };
  }, [authUser]);

  const submitShare = async () => {
    if (!sharePostId || !shareBoardId || !shareTitle.trim() || !currentUser) return;

    setShareLoading(true);
    const originPost = posts.find((p) => p.id === sharePostId);

    if (originPost) {
      const { error } = await supabase.from("posts").insert({
        board_id: shareBoardId,
        title: shareTitle,
        content: originPost.content,
        source_type: "BOARD",
        origin_post_id: originPost.id,
        author_id: currentUser.id,
        author_email: currentUser.email,
      });

      if (!error) {
        alert("선택한 게시판에 공유했습니다.");
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
          <h1 className="text-xl font-bold">피드</h1>
          <p className="text-sm text-gray-600">
            팔로우와 최신 글을 모아 보여줍니다.
          </p>
        </div>
        <Link
          href="/feed/write"
          className="border border-dashed border-gray-500 bg-gray-200 px-3 py-2 text-sm hover:bg-gray-300"
        >
          피드 작성
        </Link>
      </header>

      {sharePostId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm border border-dashed border-gray-500 bg-white p-6">
            <h2 className="mb-4 text-lg font-bold">게시판에 공유하기</h2>
            <div className="mb-4 flex flex-col gap-3">
              <label className="text-sm">
                게시판
                <select
                  className="mt-1 w-full border border-dashed border-gray-400 bg-white p-2 text-sm"
                  value={shareBoardId}
                  onChange={(e) => setShareBoardId(e.target.value)}
                >
                  <option value="">게시판을 선택하세요</option>
                  {boards.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                공유 제목
                <input
                  type="text"
                  placeholder="게시판에 표시할 제목"
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
            아직 피드에 표시할 글이 없습니다.
          </div>
        ) : (
          posts.map((post) => (
            <article
              key={post.id}
              className="flex flex-col gap-2 border border-dashed border-gray-500 bg-white/70 p-4 transition-colors hover:bg-gray-50"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-gray-600">
                <IdentityBadge
                  profile={post.profiles}
                  fallback={{ nickname: post.author_email.split("@")[0] }}
                  size="sm"
                />
                <span className="tabular-nums text-xs text-gray-500">
                  조회 {postAggregateDefaults(post).view_count} · 댓글{" "}
                  {postAggregateDefaults(post).comment_count}
                </span>
                <span className="text-[10px] tabular-nums text-gray-400">
                  {formatCommunityDate(post.created_at)}
                </span>
              </div>

              <div className="flex gap-2">
                {post.source_type === "BOARD" && post.is_hot && (
                  <span className="inline-block rounded bg-red-100 px-2 py-0.5 text-xs text-red-700">
                    HOT {(post as CommunityPost & { board_name?: string }).board_name || "게시판"} 인기글
                  </span>
                )}
              </div>

              {post.title && post.source_type === "BOARD" && (
                <div className="mt-1 font-bold">{post.title}</div>
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

              {post.source_type === "FEED" && (
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => setSharePostId(post.id)}
                    className="border border-dashed border-gray-400 px-3 py-1 text-xs text-gray-600 hover:bg-gray-200"
                  >
                    게시판에 공유
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
