"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import HomeTopicSections from "@/components/topics/HomeTopicSections";
import { supabase } from "@/lib/supabase/client";
import {
  REALTIME_BEST_FETCH_LIMIT,
  REALTIME_BEST_HOME_LIMIT,
  REALTIME_BEST_MIN_SCORE,
  compareRealtimeBestPosts,
  isRealtimeBestPost,
} from "@/lib/community/realtimeBest";
import { formatCommunityDate } from "@/lib/utils/formatDate";
import { Board, CommunityPost, postAggregateDefaults } from "@/types/community";

function buildPostHref(post: CommunityPost, boardSlugById: Map<string, string>): string {
  if (post.source_type === "BOARD" && post.board_id) {
    const slug = boardSlugById.get(post.board_id);
    if (slug) return `/board/${slug}/${post.id}`;
  }
  return "/board";
}

function truncateNickname(nickname: string, maxLength: number = 6): string {
  return nickname.length > maxLength ? nickname.substring(0, maxLength) + "..." : nickname;
}

export default function HomeContent() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [hotPosts, setHotPosts] = useState<CommunityPost[]>([]);
  const [postBoards, setPostBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchHomeData = async () => {
      setLoading(true);

      const [boardResponse, postResponse] = await Promise.all([
        supabase.from("boards").select("*").limit(6),
        supabase
          .from("posts")
          .select("*, profiles(id, nickname, display_name)")
          .eq("status", "NORMAL")
          .eq("source_type", "BOARD")
          .order("created_at", { ascending: false })
          .limit(REALTIME_BEST_FETCH_LIMIT),
      ]);

      if (cancelled) return;

      const nextBoards = (boardResponse.data as Board[] | null) ?? [];
      const nextPosts = ((postResponse.data as CommunityPost[] | null) ?? [])
        .filter(isRealtimeBestPost)
        .sort(compareRealtimeBestPosts)
        .slice(0, REALTIME_BEST_HOME_LIMIT);
      setBoards(nextBoards);
      setHotPosts(nextPosts);

      const boardIds = Array.from(
        new Set(
          nextPosts
            .map((p) => p.board_id)
            .filter((id): id is string => Boolean(id)),
        ),
      );

      if (boardIds.length === 0) {
        setPostBoards([]);
        setLoading(false);
        return;
      }

      const { data: postBoardData } = await supabase
        .from("boards")
        .select("*")
        .in("id", boardIds);

      if (cancelled) return;
      setPostBoards((postBoardData as Board[] | null) ?? []);
      setLoading(false);
    };

    void fetchHomeData();

    return () => {
      cancelled = true;
    };
  }, []);

  const boardSlugById = useMemo(() => {
    const map = new Map<string, string>();
    for (const b of postBoards) map.set(b.id, b.slug);
    return map;
  }, [postBoards]);

  const boardNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const b of postBoards) map.set(b.id, b.name);
    return map;
  }, [postBoards]);

  return (
    <section className="flex w-full flex-col gap-6">
      <HomeTopicSections />

      <div className="border border-dashed border-gray-500 bg-white/70 p-4">
        <div className="mb-4 flex items-end justify-between border-b border-dashed border-gray-400 pb-2">
          <h2 className="text-xl font-bold text-gray-800">실시간 베스트</h2>
          <Link href="/hot" className="text-xs text-gray-500 hover:underline">
            {REALTIME_BEST_MIN_SCORE}점 이상 누적 보기
          </Link>
        </div>

        {loading ? (
          <p className="py-10 text-center text-sm text-gray-500">로딩 중...</p>
        ) : hotPosts.length > 0 ? (
          <ul className="flex flex-col divide-y divide-dashed divide-gray-300">
            {hotPosts.map((post) => {
              const boardLabel = (post.board_id && boardNameById.get(post.board_id)) || "게시판";

              return (
                <li key={post.id} className="py-2 transition-colors hover:bg-gray-100">
                  <Link
                    href={buildPostHref(post, boardSlugById)}
                    className="flex items-center gap-3 px-2"
                  >
                    <span className="w-16 shrink-0 truncate rounded-sm border border-gray-300 bg-gray-100 px-1 text-center text-xs text-gray-500">
                      {boardLabel}
                    </span>
                    <span className="flex-1 truncate text-sm font-medium text-gray-800">
                      {post.title || "제목 없음"}
                    </span>
                    <span className="w-24 shrink-0 truncate text-right text-xs text-gray-500">
                      {truncateNickname(
                        (post.profiles?.nickname || post.profiles?.display_name || post.author_email?.split("@")[0]) ?? "익명",
                      )}
                    </span>
                    <span className="w-28 shrink-0 text-right text-[10px] text-gray-400 tabular-nums">
                      조회 {postAggregateDefaults(post).view_count} · 댓글{" "}
                      {postAggregateDefaults(post).comment_count} · 추천{" "}
                      {postAggregateDefaults(post).upvote_count}
                    </span>
                    <span className="w-16 shrink-0 text-right text-xs text-gray-500">
                      {formatCommunityDate(post.created_at)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="py-10 text-center text-sm text-gray-500">
            아직 베스트 기준을 넘긴 게시물이 없습니다.
          </div>
        )}
      </div>

      <div className="border border-dashed border-gray-500 bg-white/70 p-4">
        <div className="mb-4 flex items-end justify-between border-b border-dashed border-gray-400 pb-2">
          <h2 className="text-xl font-bold text-gray-800">인기 채널</h2>
          <Link href="/board" className="text-xs text-gray-500 hover:underline">
            전체 보기
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {boards.map((board) => (
            <Link
              key={board.id}
              href={`/board/${board.slug}`}
              className="flex flex-col items-center justify-center border border-dashed border-gray-400 p-4 transition-all hover:border-gray-600 hover:bg-gray-100"
            >
              <div className="mb-2 flex h-12 w-12 items-center justify-center bg-gray-200 text-xl">
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
