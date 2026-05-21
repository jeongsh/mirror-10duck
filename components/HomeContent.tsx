"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useAuthUser } from "@/lib/supabase/useAuthUser";
import { fetchFollowedOfficialWorkIds } from "@/lib/supabase/officialWorkFollows";
import { Board, CommunityPost, postAggregateDefaults } from "@/types/community";

function buildPostHref(post: CommunityPost, boardSlugById: Map<string, string>): string {
  if (post.source_type === "BOARD" && post.board_id) {
    const slug = boardSlugById.get(post.board_id);
    if (slug) return `/board/${slug}/${post.id}`;
  }
  return "/feed";
}

function truncateNickname(nickname: string, maxLength: number = 6): string {
  return nickname.length > maxLength ? nickname.substring(0, maxLength) + "..." : nickname;
}

export default function HomeContent() {
  const authUser = useAuthUser();
  const [boards, setBoards] = useState<Board[]>([]);
  const [hotPosts, setHotPosts] = useState<CommunityPost[]>([]);
  const [postBoards, setPostBoards] = useState<Board[]>([]);
  const [interestCount, setInterestCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authUser?.id) {
      setInterestCount(null);
      return;
    }

    let cancelled = false;
    fetchFollowedOfficialWorkIds(authUser.id)
      .then((ids) => {
        if (!cancelled) setInterestCount(ids.size);
      })
      .catch(() => {
        if (!cancelled) setInterestCount(null);
      });

    return () => {
      cancelled = true;
    };
  }, [authUser?.id]);

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
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

      if (cancelled) return;

      const nextBoards = (boardResponse.data as Board[] | null) ?? [];
      const nextPosts = (postResponse.data as CommunityPost[] | null) ?? [];
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
      {authUser && interestCount !== null && interestCount < 3 ? (
        <div className="border border-dashed border-pink-400 bg-pink-50 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold text-pink-900">
                관심작을 {3 - interestCount}개 더 고르면 개인화 준비가 끝납니다.
              </p>
              <p className="mt-1 text-xs text-pink-700">
                선택한 작품은 캘린더, 신작 알림, 공개 프로필 기준으로 사용됩니다.
              </p>
            </div>
            <Link
              href="/onboarding/interests"
              className="inline-flex shrink-0 border border-dashed border-pink-500 bg-white px-3 py-2 text-xs font-bold text-pink-700 hover:bg-pink-100"
            >
              관심작 고르기
            </Link>
          </div>
        </div>
      ) : null}

      <div className="border border-dashed border-gray-500 bg-white/70 p-4">
        <div className="mb-4 flex items-end justify-between border-b border-dashed border-gray-400 pb-2">
          <h2 className="text-xl font-bold text-gray-800">실시간 베스트</h2>
          <span className="text-xs text-gray-500">통합 추천글</span>
        </div>

        {loading ? (
          <p className="py-10 text-center text-sm text-gray-500">로딩 중...</p>
        ) : hotPosts.length > 0 ? (
          <ul className="flex flex-col divide-y divide-dashed divide-gray-300">
            {hotPosts.map((post) => {
              const boardLabel =
                post.source_type === "FEED"
                  ? "피드"
                  : (post.board_id && boardNameById.get(post.board_id)) || "게시판";

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
                    <span className="w-8 shrink-0 text-right text-xs font-bold text-red-500">
                      {post.is_hot ? "HOT" : "N"}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="py-10 text-center text-sm text-gray-500">
            아직 등록된 게시물이 없습니다.
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
