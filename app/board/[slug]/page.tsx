"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useAuthUser } from "@/lib/supabase/useAuthUser";
import { Board, CommunityPost, postAggregateDefaults } from "@/types/community";
import IdentityBadge from "@/components/community/IdentityBadge";
import { formatCommunityDate } from "@/lib/utils/formatDate";
import { formatIp } from "@/lib/community/actions";

function useDebouncedValue(value: string, delayMs: number) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [delayMs, value]);

  return debounced;
}

export default function BoardPage() {
  const params = useParams();
  const slug = params.slug as string;
  const authUser = useAuthUser();

  const [board, setBoard] = useState<Board | null>(null);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [notices, setNotices] = useState<CommunityPost[]>([]);
  const [boardLoading, setBoardLoading] = useState(true);
  const [postsLoading, setPostsLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);

  const [activeTab, setActiveTab] = useState<"all" | "hot">("all");
  const [selectedPrefix, setSelectedPrefix] = useState<string>("전체");
  const [sortBy, setSortBy] = useState<"latest" | "comments" | "upvotes" | "views">("latest");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMode, setSearchMode] = useState<"title" | "content" | "author" | "all">("title");
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 250);

  const userId = authUser?.id ?? null;

  const PREFIXES = ["전체", "잡담", "정보", "질문", "창작", "공지"];

  useEffect(() => {
    let cancelled = false;

    const fetchBoard = async () => {
      setBoardLoading(true);
      const { data } = await supabase
        .from("boards")
        .select("*")
        .eq("slug", slug)
        .single();

      if (cancelled) return;
      setBoard((data as Board | null) ?? null);
      setBoardLoading(false);
    };

    if (slug) void fetchBoard();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    let cancelled = false;

    const fetchFollowState = async () => {
      setIsFollowing(false);
      if (!userId || !board?.id) return;

      const { data } = await supabase
        .from("follows_board")
        .select("board_id")
        .eq("user_id", userId)
        .eq("board_id", board.id)
        .maybeSingle();

      if (!cancelled) setIsFollowing(Boolean(data));
    };

    void fetchFollowState();

    return () => {
      cancelled = true;
    };
  }, [board?.id, userId]);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      if (!board?.id) {
        setPosts([]);
        setNotices([]);
        setPostsLoading(false);
        return;
      }

      setPostsLoading(true);

      // 공지사항 가져오기 (항상 최신순 5개)
      const { data: noticeData } = await supabase
        .from("posts")
        .select("*, profiles(*)")
        .eq("board_id", board.id)
        .ilike("title", "[공지]%")
        .order("created_at", { ascending: false })
        .limit(5);

      if (cancelled) return;
      setNotices((noticeData as CommunityPost[] | null) ?? []);

      // 일반 게시글 쿼리
      let query = supabase
        .from("posts")
        .select("*, profiles(*)")
        .eq("board_id", board.id)
        .not("title", "ilike", "[공지]%"); // 공지는 위에서 따로 보여주므로 제외

      if (activeTab === "hot") query = query.eq("is_hot", true);
      
      if (selectedPrefix !== "전체") {
        query = query.ilike("title", `[${selectedPrefix}]%`);
      }

      const trimmedSearch = debouncedSearchQuery.trim();
      if (trimmedSearch) {
        switch (searchMode) {
          case "title":
            query = query.ilike("title", `%${trimmedSearch}%`);
            break;
          case "content":
            query = query.ilike("content", `%${trimmedSearch}%`);
            break;
          case "author":
            query = query.ilike("author_email", `%${trimmedSearch}%`);
            break;
          case "all":
          default:
            query = query.or(`title.ilike.%${trimmedSearch}%,content.ilike.%${trimmedSearch}%`);
            break;
        }
      }

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

      const { data } = await query.limit(50);
      if (cancelled) return;
      
      let finalPosts = (data as CommunityPost[] | null) ?? [];

      // 차단 유저 필터링 (로그인한 경우)
      if (userId) {
        const { data: blockedRows } = await supabase
          .from("blocked_users")
          .select("blocked_id")
          .eq("blocker_id", userId);
        const blockedIds = new Set(blockedRows?.map((b: any) => b.blocked_id) || []);
        if (blockedIds.size > 0) {
          finalPosts = finalPosts.filter(post => !blockedIds.has(post.author_id));
        }
      }

      setPosts(finalPosts);
      setPostsLoading(false);
    };


    void fetchData();

    return () => {
      cancelled = true;
    };
  }, [activeTab, board?.id, debouncedSearchQuery, sortBy, searchMode, selectedPrefix]);

  const toggleFollowBoard = async () => {
    if (!userId) {
      alert("로그인이 필요합니다.");
      return;
    }
    if (!board) return;

    if (isFollowing) {
      await supabase
        .from("follows_board")
        .delete()
        .eq("user_id", userId)
        .eq("board_id", board.id);
      setIsFollowing(false);
    } else {
      await supabase.from("follows_board").insert({ user_id: userId, board_id: board.id });
      setIsFollowing(true);
    }
  };

  if (boardLoading) {
    return <main className="p-6 text-center text-gray-500">로딩 중...</main>;
  }

  if (!board) {
    return <main className="p-6 text-center text-red-500">게시판을 찾을 수 없습니다.</main>;
  }

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
            className={`border border-dashed border-gray-500 px-3 py-2 text-sm transition-colors ${
              isFollowing ? "bg-red-100 text-red-700" : "bg-white hover:bg-gray-100"
            }`}
          >
            {isFollowing ? "팔로우 취소" : "게시판 팔로우"}
          </button>
          <Link
            href="/board"
            className="border border-dashed border-gray-500 bg-white px-3 py-2 text-sm hover:bg-gray-100"
          >
            채널 목록
          </Link>
          <Link
            href={`/board/${slug}/write`}
            className="border border-dashed border-gray-500 bg-gray-200 px-3 py-2 text-sm"
          >
            글쓰기
          </Link>
        </div>
      </header>

      <section className="flex flex-col gap-4 border border-dashed border-gray-500 bg-white/70 p-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-dashed border-gray-300 pb-4">
          <div className="flex flex-wrap items-center gap-1">
            <button
              onClick={() => setActiveTab("all")}
              className={`px-3 py-1.5 text-xs font-bold transition-colors ${
                activeTab === "all"
                  ? "bg-gray-800 text-white"
                  : "border border-dashed border-gray-400 bg-white text-gray-600 hover:bg-gray-100"
              }`}
            >
              전체글
            </button>
            <button
              onClick={() => setActiveTab("hot")}
              className={`px-3 py-1.5 text-xs font-bold transition-colors ${
                activeTab === "hot"
                  ? "bg-red-600 text-white"
                  : "border border-dashed border-red-400 bg-white text-red-600 hover:bg-red-50"
              }`}
            >
              인기글
            </button>
            <div className="mx-2 h-6 w-px bg-gray-300" />
            <div className="flex flex-wrap items-center gap-1">
              {PREFIXES.map(p => (
                <button
                  key={p}
                  onClick={() => setSelectedPrefix(p)}
                  className={`px-2 py-1 text-xs transition-colors ${
                    selectedPrefix === p
                      ? "bg-gray-200 font-bold text-gray-900 underline underline-offset-4"
                      : "text-gray-500 hover:text-gray-800"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center border border-dashed border-gray-400 bg-white">
              <select
                value={searchMode}
                onChange={(e) => setSearchMode(e.target.value as typeof searchMode)}
                className="border-r border-dashed border-gray-300 bg-transparent px-2 py-1.5 text-xs focus:outline-none"
              >
                <option value="title">제목</option>
                <option value="all">제목+내용</option>
                <option value="content">내용</option>
                <option value="author">작성자</option>
              </select>
              <div className="relative">
                <input
                  type="text"
                  placeholder="검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-40 bg-transparent px-3 py-1.5 text-xs focus:outline-none"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    x
                  </button>
                )}
              </div>
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
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

          {postsLoading ? (
            <p className="px-3 py-6 text-center text-sm text-gray-600">불러오는 중...</p>
          ) : posts.length === 0 && notices.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-gray-600">
              아직 게시글이 없습니다.
            </p>
          ) : (
            <>
              {/* 공지사항 렌더링 */}
              {notices.map((post) => {
                const hasStickers = post.content.includes(":sticker/");
                const hasImages = post.content.includes("!image[") || post.content.includes("\"type\":\"image\"");
                const hasYoutube = post.content.includes("youtube.com") || post.content.includes("youtu.be");
                
                const titleMatch = post.title?.match(/^\[([^\]]+)\]\s*(.*)$/);
                const titleText = titleMatch ? titleMatch[2] : (post.title || "제목 없음");

                return (
                  <Link
                    key={post.id}
                    href={`/board/${slug}/${post.id}`}
                    className="grid min-w-[800px] grid-cols-[60px_1fr_140px_80px_60px_60px] items-center border-t border-dashed border-gray-300 bg-yellow-50/50 px-3 py-2 text-sm transition-colors hover:bg-yellow-50"
                  >
                    <span className="text-center">
                      <span className="bg-gray-800 px-1 py-0.5 text-[10px] font-bold text-white">공지</span>
                    </span>
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      <span className="truncate font-bold text-gray-900">
                        {titleText}
                      </span>
                      
                      <div className="flex items-center gap-1 opacity-60">
                        {hasImages && (
                          <span title="이미지 포함" className="text-[10px] bg-green-100 text-green-700 px-1 rounded border border-green-200">
                            IMG
                          </span>
                        )}
                        {hasStickers && (
                          <span title="스티커 포함" className="text-[10px] bg-purple-100 text-purple-700 px-1 rounded border border-purple-200">
                            ST
                          </span>
                        )}
                        {hasYoutube && (
                          <span title="유튜브 포함" className="text-[10px] bg-red-100 text-red-700 px-1 rounded border border-red-200">
                            YT
                          </span>
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
                        fallback={{ nickname: post.anonymous_nickname || post.author_email.split("@")[0] || "익명" }}
                        isAnonymous={post.is_anonymous || !post.author_id}
                        ip={formatIp(post.author_ip)}
                        size="sm"
                      />
                    </div>
                    <span className="text-center text-[11px] text-gray-500 tabular-nums">
                      {formatCommunityDate(post.created_at)}
                    </span>
                    <span className="text-center text-xs text-gray-500 tabular-nums">
                      {postAggregateDefaults(post).view_count}
                    </span>
                    <span className="text-center text-xs font-bold text-gray-400">-</span>
                  </Link>
                );
              })}

              {/* 일반 게시글 렌더링 */}
              {posts.map((post) => {
                const hasStickers = post.content.includes(":sticker/");
                const hasImages = post.content.includes("!image[") || post.content.includes("\"type\":\"image\"");
                const hasYoutube = post.content.includes("youtube.com") || post.content.includes("youtu.be");

                return (
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
                        {post.source_type === "FEED" && (
                          <span className="bg-blue-500 px-1 py-0.5 text-[10px] font-bold text-white">
                            FEED
                          </span>
                        )}
                      </div>
                      
                      {/* 말머리 파싱 및 렌더링 */}
                      {(() => {
                        const titleMatch = post.title?.match(/^\[([^\]]+)\]\s*(.*)$/);
                        if (titleMatch) {
                          return (
                            <>
                              <span className="flex-shrink-0 text-[11px] font-bold text-gray-500">
                                [{titleMatch[1]}]
                              </span>
                              <span className="truncate font-medium text-gray-800">
                                {titleMatch[2]}
                              </span>
                            </>
                          );
                        }
                        return (
                          <span className="truncate font-medium text-gray-800">
                            {post.source_type === "FEED" ? "피드에서 공유된 포스트" : post.title || "제목 없음"}
                          </span>
                        );
                      })()}
                      
                      <div className="flex items-center gap-1 opacity-60">
                        {hasImages && (
                          <span title="이미지 포함" className="text-[10px] bg-green-100 text-green-700 px-1 rounded border border-green-200">
                            IMG
                          </span>
                        )}
                        {hasStickers && (
                          <span title="스티커 포함" className="text-[10px] bg-purple-100 text-purple-700 px-1 rounded border border-purple-200">
                            ST
                          </span>
                        )}
                        {hasYoutube && (
                          <span title="유튜브 포함" className="text-[10px] bg-red-100 text-red-700 px-1 rounded border border-red-200">
                            YT
                          </span>
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
                        fallback={{ nickname: post.anonymous_nickname || post.author_email.split("@")[0] || "익명" }}
                        isAnonymous={post.is_anonymous || !post.author_id}
                        ip={formatIp(post.author_ip)}
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
                      <span
                        className={`text-xs font-bold tabular-nums ${
                          postAggregateDefaults(post).upvote_count >= 10
                            ? "text-red-600"
                            : "text-blue-600"
                        }`}
                      >
                        {postAggregateDefaults(post).upvote_count}
                      </span>
                      {postAggregateDefaults(post).downvote_count > 0 && (
                        <span className="text-[9px] text-gray-400 tabular-nums">
                          -{postAggregateDefaults(post).downvote_count}
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </>
          )}
        </div>

      </section>
    </main>
  );
}
