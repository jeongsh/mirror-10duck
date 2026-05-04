"use client";

import {
  Bookmark,
  Eye,
  MessageCircle,
  MoreHorizontal,
  Share,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import FeedComposer from "@/components/community/feed/FeedComposer";
import FeedMediaGrid from "@/components/community/feed/FeedMediaGrid";
import IdentityBadge from "@/components/community/IdentityBadge";
import ReactionBar from "@/components/community/ReactionBar";
import RichContent from "@/components/stickers/RichContent";
import { supabase } from "@/lib/supabase/client";
import { useAuthUser } from "@/lib/supabase/useAuthUser";
import { splitContentSegments } from "@/lib/stickers/token";
import { formatCommunityDate } from "@/lib/utils/formatDate";
import { Board, CommunityPost, postAggregateDefaults } from "@/types/community";

type TimelineTab = "for-you" | "following";
type FollowUserRow = { following_id: string };
type FollowBoardRow = { board_id: string };

function splitFeedBody(content: string) {
  const trimmed = content.trim();
  const isJson = trimmed.startsWith("{") && trimmed.endsWith("}");

  if (isJson) return { body: content, imageUrls: [] };

  const imageUrls: string[] = [];
  const body = splitContentSegments(content)
    .map((segment) => {
      if (segment.type === "image") {
        imageUrls.push(segment.url);
        return "";
      }
      if (segment.type === "sticker") return segment.token.raw;
      return segment.value;
    })
    .join("")
    .trim();

  return { body, imageUrls };
}

export default function FeedPage() {
  const authUser = useAuthUser();
  const [activeTab, setActiveTab] = useState<TimelineTab>("for-you");
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [boards, setBoards] = useState<Board[]>([]);
  const [sharePostId, setSharePostId] = useState<string | null>(null);
  const [shareBoardId, setShareBoardId] = useState("");
  const [shareTitle, setShareTitle] = useState("");
  const [shareLoading, setShareLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [latestNoticeCount, setLatestNoticeCount] = useState(0);
  const [openPostMenuId, setOpenPostMenuId] = useState<string | null>(null);

  const fetchFeed = useCallback(async () => {
    if (authUser === undefined) return;

    setLoading(true);
    setCurrentUser(authUser ?? null);

    const userId = authUser?.id;

    const boardsResponse = await supabase.from("boards").select("*");
    setBoards((boardsResponse.data as Board[] | null) ?? []);

    if (!userId) {
      const { data } = await supabase
        .from("posts")
        .select("*, profiles(*)")
        .order("created_at", { ascending: false })
        .limit(30);

      setPosts((data as CommunityPost[] | null) ?? []);
      setLoading(false);
      return;
    }

    if (activeTab === "following") {
      const [followUsersResponse, followBoardsResponse] = await Promise.all([
        supabase.from("follows_user").select("following_id").eq("follower_id", userId),
        supabase.from("follows_board").select("board_id").eq("user_id", userId),
      ]);

      const followedUserIds =
        (followUsersResponse.data as FollowUserRow[] | null)?.map((row) => row.following_id) ?? [];
      const followedBoardIds =
        (followBoardsResponse.data as FollowBoardRow[] | null)?.map((row) => row.board_id) ?? [];
      const queries: PromiseLike<{ data: unknown[] | null }>[] = [];

      if (followedUserIds.length > 0) {
        queries.push(
          supabase
            .from("posts")
            .select("*, profiles(*)")
            .in("author_id", followedUserIds)
            .order("created_at", { ascending: false })
            .limit(30),
        );
      }

      if (followedBoardIds.length > 0) {
        queries.push(
          supabase
            .from("posts")
            .select("*, profiles(*)")
            .in("board_id", followedBoardIds)
            .order("created_at", { ascending: false })
            .limit(30),
        );
      }

      const responses = await Promise.all(queries);
      const merged = new Map<string, CommunityPost>();

      responses.forEach((response) => {
        ((response.data as CommunityPost[] | null) ?? []).forEach((post) => {
          merged.set(post.id, post);
        });
      });

      setPosts(
        Array.from(merged.values())
          .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
          .slice(0, 30),
      );
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.rpc("get_hybrid_feed", {
      viewer_id: userId,
      limit_cnt: 30,
      offset_cnt: 0,
    });

    if (error) console.error("Feed Fetch Error:", error);
    setPosts((data as CommunityPost[] | null) ?? []);
    setLoading(false);
  }, [activeTab, authUser]);

  useEffect(() => {
    void fetchFeed();
  }, [fetchFeed]);

  const handlePosted = async () => {
    setLatestNoticeCount((count) => count + 1);
    await fetchFeed();
  };

  const showLatestPosts = async () => {
    setLatestNoticeCount(0);
    await fetchFeed();
  };

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
        setSharePostId(null);
        setShareTitle("");
        setShareBoardId("");
      } else {
        alert(`공유 실패: ${error.message}`);
      }
    }

    setShareLoading(false);
  };

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col border-x border-dashed border-gray-500 bg-white/40">
      <header className="sticky top-0 z-20 border-b border-dashed border-gray-500 bg-white/90">
        <div className="grid grid-cols-2">
          <button
            type="button"
            onClick={() => setActiveTab("for-you")}
            className={`relative px-4 py-4 text-sm font-bold ${activeTab === "for-you" ? "text-gray-950" : "text-gray-500"
              }`}
          >
            For you
            {activeTab === "for-you" ? (
              <span className="absolute bottom-0 left-1/2 h-1 w-14 -translate-x-1/2 bg-gray-800" />
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("following")}
            className={`relative px-4 py-4 text-sm font-bold ${activeTab === "following" ? "text-gray-950" : "text-gray-500"
              }`}
          >
            Following
            {activeTab === "following" ? (
              <span className="absolute bottom-0 left-1/2 h-1 w-14 -translate-x-1/2 bg-gray-800" />
            ) : null}
          </button>
        </div>
      </header>

      <FeedComposer
        userId={authUser?.id ?? ""}
        userEmail={authUser?.email ?? ""}
        disabled={!authUser?.id}
        onPosted={handlePosted}
      />

      {latestNoticeCount > 0 ? (
        <button
          type="button"
          onClick={showLatestPosts}
          className="border-b border-dashed border-gray-500 bg-white/70 px-4 py-3 text-center text-sm font-medium text-gray-700 hover:bg-gray-100"
        >
          Show {latestNoticeCount} post{latestNoticeCount > 1 ? "s" : ""}
        </button>
      ) : null}

      {sharePostId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm border border-dashed border-gray-500 bg-white p-6">
            <h2 className="mb-4 text-lg font-bold">게시판에 공유하기</h2>
            <div className="mb-4 flex flex-col gap-3">
              <label className="text-sm">
                게시판
                <select
                  className="mt-1 w-full border border-dashed border-gray-400 bg-white p-2 text-sm"
                  value={shareBoardId}
                  onChange={(event) => setShareBoardId(event.target.value)}
                >
                  <option value="">게시판을 선택하세요</option>
                  {boards.map((board) => (
                    <option key={board.id} value={board.id}>
                      {board.name}
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
                  onChange={(event) => setShareTitle(event.target.value)}
                />
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSharePostId(null)}
                className="border border-dashed border-gray-400 px-3 py-1 text-sm hover:bg-gray-100"
              >
                취소
              </button>
              <button
                type="button"
                onClick={submitShare}
                disabled={!shareBoardId || !shareTitle.trim() || shareLoading}
                className="border border-dashed border-gray-500 bg-gray-200 px-3 py-1 text-sm text-gray-900 hover:bg-gray-300 disabled:opacity-50"
              >
                {shareLoading ? "공유 중..." : "공유하기"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <section className="flex flex-col">
        {loading ? (
          <div className="border-b border-dashed border-gray-500 bg-white/70 p-6 text-center text-sm text-gray-500">
            Loading...
          </div>
        ) : posts.length === 0 ? (
          <div className="border-b border-dashed border-gray-500 bg-white/70 p-8 text-center text-sm text-gray-500">
            {activeTab === "following"
              ? "팔로우한 유저나 게시판의 글이 아직 없습니다."
              : "아직 표시할 피드가 없습니다."}
          </div>
        ) : (
          posts.map((post) => {
            const stats = postAggregateDefaults(post);
            const { body, imageUrls } = splitFeedBody(post.content);
            const authorHandle = post.author_email.split("@")[0];

            return (
              <article
                key={post.id}
                className="border-b border-dashed border-gray-500 bg-white/70 px-4 py-3 transition-colors hover:bg-gray-50"
              >
                <div className="flex gap-3">
                  <div className="pt-1">
                    <IdentityBadge
                      profile={post.profiles}
                      fallback={{ nickname: authorHandle }}
                      size="md"
                      showAvatar
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 text-sm text-gray-500">
                        <span className="font-semibold text-gray-900">{authorHandle}</span>{" "}
                        <span>@{authorHandle}</span>
                        <span> · {formatCommunityDate(post.created_at)}</span>
                      </div>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() =>
                            setOpenPostMenuId((current) =>
                              current === post.id ? null : post.id,
                            )
                          }
                          className="text-gray-500 hover:text-gray-900"
                          title="더보기"
                        >
                          <MoreHorizontal size={18} />
                        </button>
                        {openPostMenuId === post.id ? (
                          <div className="absolute right-0 top-6 z-20 w-40 border border-dashed border-gray-500 bg-white p-1 shadow-sm">
                            <button
                              type="button"
                              onClick={() => {
                                setSharePostId(post.id);
                                setOpenPostMenuId(null);
                              }}
                              className="block w-full px-3 py-2 text-left text-xs hover:bg-gray-100"
                            >
                              게시판에 공유
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    {post.source_type === "BOARD" ? (
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
                        <span className="border border-dashed border-gray-300 px-1.5 py-0.5">
                          Board
                        </span>
                        {post.is_hot ? (
                          <span className="border border-dashed border-gray-300 bg-white px-1.5 py-0.5 text-gray-700">
                            HOT
                          </span>
                        ) : null}
                      </div>
                    ) : null}

                    {post.title && post.source_type === "BOARD" ? (
                      <h2 className="mt-2 font-bold text-gray-950">{post.title}</h2>
                    ) : null}

                    {body ? (
                      <div className="mt-2">
                        <RichContent content={body} />
                      </div>
                    ) : null}

                    <FeedMediaGrid imageUrls={imageUrls} />

                    <div className="mt-3 flex items-center justify-between gap-2 text-xs text-gray-500">
                      <button
                        type="button"
                        className="flex items-center gap-1 hover:text-gray-900"
                        title="댓글"
                      >
                        <MessageCircle size={17} />
                        {stats.comment_count}
                      </button>

                      <ReactionBar
                        postId={post.id}
                        viewerId={currentUser?.id ?? null}
                        authorId={post.author_id}
                      />

                      <span className="flex items-center gap-1">
                        <Eye size={17} />
                        {stats.view_count}
                      </span>

                      <button type="button" className="hover:text-gray-900" title="북마크">
                        <Bookmark size={17} />
                      </button>
                      <button type="button" className="hover:text-gray-900" title="공유">
                        <Share size={17} />
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </section>
    </main>
  );
}
