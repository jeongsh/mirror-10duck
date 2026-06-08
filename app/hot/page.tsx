"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import IdentityBadge from "@/components/community/IdentityBadge";
import { supabase } from "@/lib/supabase/client";
import {
  REALTIME_BEST_FETCH_LIMIT,
  REALTIME_BEST_MIN_SCORE,
  REALTIME_BEST_PAGE_LIMIT,
  compareRealtimeBestPosts,
  isRealtimeBestPost,
} from "@/lib/community/realtimeBest";
import { formatCommunityDate } from "@/lib/utils/formatDate";
import { Board, CommunityPost, postAggregateDefaults } from "@/types/community";

function buildPostHref(post: CommunityPost, boardSlugById: Map<string, string>) {
  if (!post.board_id) return "/board";
  const slug = boardSlugById.get(post.board_id);
  return slug ? `/board/${slug}/${post.id}` : "/board";
}

export default function HotPage() {
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchHotPosts = async () => {
      setLoading(true);

      const { data } = await supabase
        .from("posts")
        .select("*, profiles(*)")
        .eq("status", "NORMAL")
        .eq("source_type", "BOARD")
        .order("created_at", { ascending: false })
        .limit(REALTIME_BEST_FETCH_LIMIT);

      if (cancelled) return;

      const nextPosts = ((data as CommunityPost[] | null) ?? [])
        .filter(isRealtimeBestPost)
        .sort(compareRealtimeBestPosts)
        .slice(0, REALTIME_BEST_PAGE_LIMIT);

      setPosts(nextPosts);

      const boardIds = Array.from(
        new Set(nextPosts.map((post) => post.board_id).filter((id): id is string => Boolean(id))),
      );

      if (boardIds.length === 0) {
        setBoards([]);
        setLoading(false);
        return;
      }

      const { data: boardData } = await supabase.from("boards").select("*").in("id", boardIds);

      if (cancelled) return;
      setBoards((boardData as Board[] | null) ?? []);
      setLoading(false);
    };

    void fetchHotPosts();

    return () => {
      cancelled = true;
    };
  }, []);

  const boardById = useMemo(() => {
    const map = new Map<string, Board>();
    for (const board of boards) map.set(board.id, board);
    return map;
  }, [boards]);

  const boardSlugById = useMemo(() => {
    const map = new Map<string, string>();
    for (const board of boards) map.set(board.id, board.slug);
    return map;
  }, [boards]);

  return (
    <main className="flex w-full flex-col gap-4">
      <header className="border border-dashed border-gray-500 bg-white/80 p-4">
        <div className="mb-2 text-sm text-gray-500">
          <Link href="/" className="hover:underline">
            홈
          </Link>{" "}
          &gt; 실시간 베스트
        </div>
        <h1 className="text-xl font-bold text-gray-900">실시간 베스트 게시판</h1>
        <p className="mt-2 text-sm text-gray-600">
          추천 5점, 댓글 3점, 조회 0.2점으로 계산해 {REALTIME_BEST_MIN_SCORE}점 이상인 게시글을 누적합니다.
        </p>
      </header>

      <section className="border border-dashed border-gray-500 bg-white/70">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-500">불러오는 중...</div>
        ) : posts.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            아직 베스트 기준을 넘긴 게시물이 없습니다.
          </div>
        ) : (
          <ul className="divide-y divide-dashed divide-gray-300">
            {posts.map((post, index) => {
              const board = post.board_id ? boardById.get(post.board_id) : null;
              const stats = postAggregateDefaults(post);

              return (
                <li key={post.id} className="transition-colors hover:bg-white">
                  <Link
                    href={buildPostHref(post, boardSlugById)}
                    className="grid gap-2 px-4 py-3 sm:grid-cols-[44px_96px_minmax(0,1fr)_120px_72px] sm:items-center"
                  >
                    <span className="text-sm font-bold tabular-nums text-gray-500">
                      #{index + 1}
                    </span>
                    <span className="w-fit border border-dashed border-gray-300 bg-gray-50 px-2 py-1 text-xs text-gray-500">
                      {board?.name ?? "게시판"}
                    </span>
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        {post.is_hot ? <span className="shrink-0 text-red-500">HOT</span> : null}
                        <span className="truncate text-sm font-semibold text-gray-900">
                          {post.title || "제목 없음"}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                        <IdentityBadge
                          profile={post.profiles}
                          fallback={{
                            nickname:
                              post.anonymous_nickname ||
                              post.author_email?.split("@")[0] ||
                              "익명",
                          }}
                          isAnonymous={post.is_anonymous || !post.author_id}
                          size="sm"
                          showAvatar={false}
                        />
                      </div>
                    </div>
                    <span className="text-xs text-gray-500 tabular-nums sm:text-right">
                      조회 {stats.view_count} · 댓글 {stats.comment_count} · 추천 {stats.upvote_count}
                    </span>
                    <span className="text-xs text-gray-500 sm:text-right">
                      {formatCommunityDate(post.created_at)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
