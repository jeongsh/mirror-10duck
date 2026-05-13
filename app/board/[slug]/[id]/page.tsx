"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useAuthUser } from "@/lib/supabase/useAuthUser";
import { CommunityPost, Board, postAggregateDefaults } from "@/types/community";
import RichContent from "@/components/stickers/RichContent";
import ReactionBar from "@/components/community/ReactionBar";
import PostVoteBar from "@/components/community/PostVoteBar";
import CommentSection from "@/components/community/CommentSection";
import IdentityBadge from "@/components/community/IdentityBadge";
import { createNotification } from "@/lib/community/notifications";
import { formatIp } from "@/lib/utils/formatIp";
import AuthorProfileCard from "@/components/community/AuthorProfileCard";
import { isAdminUser } from "@/lib/supabase/admin";
import { splitFeedShareHeader } from "@/lib/community/feedContentDisplay";
import UserActionModal from "@/components/community/UserActionModal";
import { normalizeBoardSlug } from "@/lib/community/boardSlug";
import { postHasSpoilerTitlePrefix, splitBoardTitle } from "@/lib/community/boardTitlePrefix";

export default function BoardPostDetailPage() {
  const router = useRouter();
  const params = useParams();
  const rawSlug = params.slug;
  const rawSlugParam =
    typeof rawSlug === "string" ? rawSlug : Array.isArray(rawSlug) ? (rawSlug[0] ?? "") : "";
  const slug = normalizeBoardSlug(rawSlugParam);
  const postId = params.id as string;
  const authUser = useAuthUser();

  const [post, setPost] = useState<CommunityPost | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [isFollowingAuthor, setIsFollowingAuthor] = useState(false);
  const [loading, setLoading] = useState(true);
  const [shareLoading, setShareLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isSpoilerBodyCollapsed, setIsSpoilerBodyCollapsed] = useState(false);
  const [hasSpoilerBodyRevealed, setHasSpoilerBodyRevealed] = useState(false);

  const refetchPost = useCallback(async () => {
    const { data, error } = await supabase.from("posts").select("*, profiles(*)").eq("id", postId).single();
    if (error) {
      setMessage(error.message);
      setPost(null);
      return;
    }
    const next = data as CommunityPost;
    if ((next.status ?? "NORMAL") === "HIDDEN" && !isAdminUser(authUser ?? undefined)) {
      setPost(null);
      setMessage("이 글은 숨김 처리되었거나 존재하지 않습니다.");
      return;
    }
    setPost(next);
  }, [postId, authUser]);

  useEffect(() => {
    const fetchData = async () => {
      if (authUser === undefined) return;

      setLoading(true);
      setMessage("");

      const [postResponse, boardFirst] = await Promise.all([
        supabase.from("posts").select("*, profiles(*)").eq("id", postId).single(),
        supabase.from("boards").select("*").eq("slug", slug).maybeSingle(),
      ]);

      setUserId(authUser?.id ?? "");
      setUserEmail(authUser?.email ?? "");
      setIsFollowingAuthor(false);

      let boardRow = !boardFirst.error ? ((boardFirst.data as Board | null) ?? null) : null;
      const trimmedRaw = rawSlugParam.trim();
      if (!boardFirst.error && !boardRow && trimmedRaw !== slug) {
        const boardSecond = await supabase.from("boards").select("*").eq("slug", trimmedRaw).maybeSingle();
        if (!boardSecond.error) boardRow = (boardSecond.data as Board | null) ?? null;
      }
      if (boardRow) setBoard(boardRow);
      else setBoard(null);

      if (postResponse.error) {
        setMessage(postResponse.error.message);
        setPost(null);
      } else {
        const postData = postResponse.data as CommunityPost;
        const hidden =
          (postData.status ?? "NORMAL") === "HIDDEN" && !isAdminUser(authUser ?? undefined);
        if (hidden) {
          setPost(null);
          setMessage("이 글은 숨김 처리되었거나 존재하지 않습니다.");
          setLoading(false);
          return;
        }
        setPost(postData as CommunityPost);

        // 작성자 팔로우 여부 확인
        if (authUser?.id && postData.author_id) {
          if (authUser.id === postData.author_id) {
            // 본인인 경우 체크 생략
          } else {
            const { data: followData } = await supabase
              .from("follows_user")
              .select("*")
              .eq("follower_id", authUser.id)
              .eq("following_id", postData.author_id)
              .single();
            if (followData) setIsFollowingAuthor(true);
          }
        }

        // 탭 세션당 1회 조회수 반영 (마이그레이션된 RPC가 있을 때만 유효)
        const viewKey = `post_view:${postId}`;
        let shouldBump = false;
        try {
          shouldBump = typeof sessionStorage !== "undefined" && !sessionStorage.getItem(viewKey);
        } catch {
          shouldBump = true;
        }
        if (shouldBump) {
          const { error: viewErr } = await supabase.rpc("increment_post_view", { pid: postId });
          if (!viewErr) {
            try {
              sessionStorage.setItem(viewKey, "1");
            } catch {
              /* ignore */
            }
            const { data: refreshed } = await supabase.from("posts").select("*, profiles(*)").eq("id", postId).single();
            if (refreshed) setPost(refreshed as CommunityPost);
          }
        }
      }

      setLoading(false);
    };

    if (postId && (slug || rawSlugParam.trim())) fetchData();
  }, [authUser, postId, slug, rawSlugParam]);

  const canEdit = useMemo(() => {
    if (!post || !userId) return false;
    return post.author_id === userId;
  }, [post, userId]);

  const renderedPostContent = useMemo(() => {
    if (!post) return "";
    if (post.source_type !== "FEED") return post.content;
    return splitFeedShareHeader(post.content).rawBody;
  }, [post]);
  const isSpoilerPost = useMemo(() => postHasSpoilerTitlePrefix(post), [post]);

  useEffect(() => {
    setIsSpoilerBodyCollapsed(isSpoilerPost);
    setHasSpoilerBodyRevealed(false);
  }, [postId, isSpoilerPost]);

  const toggleFollowUser = async () => {
    if (!userId) {
      alert("로그인이 필요합니다.");
      return;
    }
    if (!post || !post.author_id || post.author_id === userId) return;

    if (isFollowingAuthor) {
      await supabase
        .from("follows_user")
        .delete()
        .eq("follower_id", userId)
        .eq("following_id", post.author_id);
      setIsFollowingAuthor(false);
    } else {
      await supabase
        .from("follows_user")
        .insert({ follower_id: userId, following_id: post.author_id });
      setIsFollowingAuthor(true);
      await createNotification({
        receiverId: post.author_id,
        senderId: userId,
        type: "FOLLOW",
        title: "새 팔로워",
        content: "회원님을 새로 팔로우했습니다.",
        linkUrl: "/profile",
      });
    }
  };

  const onDelete = async () => {
    if (!canEdit || !post) return;
    const isConfirmed = window.confirm("정말 삭제할까요?");
    if (isConfirmed) {
      const { error } = await supabase.from("posts").delete().eq("id", post.id);
      if (error) {
        alert(error.message);
        return;
      }
      router.push(`/board/${board?.slug ?? slug}`);
    }
  };

  const shareToFeed = async () => {
    if (!userId) {
      alert("로그인이 필요합니다.");
      return;
    }
    if (!post) return;
    
    setShareLoading(true);

    const { data: dup } = await supabase
      .from("posts")
      .select("id")
      .eq("origin_post_id", post.id)
      .eq("author_id", userId)
      .eq("source_type", "FEED")
      .maybeSingle();

    if (dup) {
      setShareLoading(false);
      alert("이미 이 글을 피드에 공유했습니다.");
      return;
    }

    // 피드에 맞게 제목과 본문을 조합하여 새 글 생성
    const feedContent = `[${board?.name}에서 공유됨] ${post.title}\n\n${post.content}`;

    const { error } = await supabase.from("posts").insert({
      board_id: null,
      title: null,
      content: feedContent,
      source_type: "FEED",
      origin_post_id: post.id,
      author_id: userId,
      author_email: userEmail,
    });

    setShareLoading(false);

    if (!error) {
      alert("내 피드에 성공적으로 공유되었습니다!");
    } else {
      const msg =
        error.code === "23505" ? "이미 이 글을 피드에 공유했습니다." : error.message;
      alert("공유 실패: " + msg);
    }
  };

  const handleReportPost = async () => {
    if (!userId) {
      alert("로그인이 필요합니다.");
      return;
    }
    if (!post) return;
    
    const categoryInput = window.prompt(
      "신고 유형을 선택하세요: 1) 일반 신고  2) 스포일러 미표기",
      "1",
    );
    if (!categoryInput) return;
    const reasonCategory = categoryInput.trim() === "2" ? "스포일러 미표기" : "기타";
    const reason = window.prompt("게시글 신고 사유를 입력해주세요 (상세 설명)");
    if (!reason) return;

    const { error } = await supabase.from("reports").insert({
      reporter_id: userId,
      target_type: "POST",
      target_id: post.id,
      reason_category: reasonCategory,
      reason_detail: reason
    });

    if (error) {
      alert(`신고 실패: ${error.message}`);
    } else {
      alert("게시글 신고가 접수되었습니다.");
    }
  };

  const toggleHotPost = async () => {
    if (!post) return;
    const newHotStatus = !post.is_hot;
    const { error } = await supabase
      .from("posts")
      .update({ 
        is_hot: newHotStatus,
        hot_promoted_at: newHotStatus ? new Date().toISOString() : null
      })
      .eq("id", post.id);

    if (error) {
      alert(error.message);
    } else {
      setPost({ ...post, is_hot: newHotStatus });
      if (newHotStatus && userId && post.author_id && post.author_id !== userId) {
        await createNotification({
          receiverId: post.author_id,
          senderId: userId || null,
          type: "HOT_PROMOTED",
          title: "인기글 선정",
          content: "작성한 글이 인기글로 선정되었습니다.",
          linkUrl: window.location.pathname,
        });
      }
    }
  };

  if (loading) {
    return (
      <main className="flex w-full flex-col gap-4">
        <div className="border border-dashed border-gray-500 bg-white/70 p-4 text-sm text-gray-500">로딩 중...</div>
      </main>
    );
  }

  return (
    <main className="flex w-full flex-col gap-4">
      <header className="border border-dashed border-gray-500 bg-white/70 p-4">
        <div className="mb-2 text-sm text-gray-500">
          <Link href="/board" className="hover:underline">게시판</Link> &gt;{" "}
          <Link href={`/board/${board?.slug ?? slug}`} className="hover:underline">{board?.name ?? slug}</Link>
        </div>
        <h1 className="flex items-center gap-2 text-xl font-bold">
          {post?.is_hot && <span className="text-red-500">🔥</span>}
          {(() => {
            const titleInfo = splitBoardTitle(post?.title);
            if (titleInfo.prefix) {
              return (
                <>
                  <span className="flex-shrink-0 text-sm font-bold text-gray-500">
                    [{titleInfo.prefix}]
                  </span>
                  <span>{titleInfo.body}</span>
                </>
              );
            }
            return <span>{post?.title ?? "게시글 없음"}</span>;
          })()}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-gray-600">
          <div className="flex items-center gap-1.5 min-w-0 text-sm text-gray-500 flex-wrap">
            <button
              type="button"
              onClick={() => {
                if (!post?.author_id) return;
                setSelectedUserId(post.author_id);
              }}
            >
              <IdentityBadge 
                profile={post?.profiles} 
                fallback={{ nickname: post?.anonymous_nickname || post?.author_email?.split('@')[0] || "익명" }}
                isAnonymous={post?.is_anonymous || !post?.author_id}
                ip={formatIp(post?.author_ip)}
                size="md"
              />
            </button>
          </div>
          <span>|</span>
          <span>{post ? new Date(post.created_at).toLocaleString("ko-KR") : "-"}</span>
          {post?.updated_at && 
           new Date(post.updated_at).getTime() - new Date(post.created_at).getTime() > 60000 && (
            <span className="text-xs text-gray-400">
              (수정됨: {new Date(post.updated_at).toLocaleString("ko-KR")})
            </span>
          )}
        </div>
        {post ? (
          <p className="mt-2 text-xs text-gray-500">
            조회 {postAggregateDefaults(post).view_count} · 댓글 {postAggregateDefaults(post).comment_count}
          </p>
        ) : null}
      </header>

      <article className="min-h-[320px] border border-dashed border-gray-500 bg-white/70 p-4 text-sm">
        {post?.source_type === 'FEED' ? (
          <div className="mb-4 rounded bg-gray-100 p-3 text-xs text-gray-600">
            ℹ️ 이 글은 피드에서 공유된 글의 스냅샷입니다.
          </div>
        ) : null}
        {isSpoilerPost && !hasSpoilerBodyRevealed ? (
          <div className="mb-4 flex items-center justify-between rounded border border-red-200 bg-red-50 px-3 py-2">
            <p className="text-xs text-red-900">
              스포일러 글입니다. 본문을 펼치면 스포일러 내용이 표시됩니다.
            </p>
            <button
              type="button"
              onClick={() => {
                setIsSpoilerBodyCollapsed(false);
                setHasSpoilerBodyRevealed(true);
              }}
              className="rounded border border-red-300 bg-white px-2 py-1 text-xs font-medium text-red-800"
            >
              본문 펼치기
            </button>
          </div>
        ) : null}
        {post ? (
          isSpoilerPost && isSpoilerBodyCollapsed ? null : <RichContent content={renderedPostContent} />
        ) : (
          <p className="text-gray-500">게시글을 찾을 수 없습니다.</p>
        )}
      </article>

      <AuthorProfileCard
        profile={post?.profiles}
        authorId={post?.author_id ?? null}
        viewerId={userId || null}
        isFollowing={isFollowingAuthor}
        onToggleFollow={toggleFollowUser}
      />

      {post ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start">
          <PostVoteBar
            postId={post.id}
            viewerId={userId || null}
            upvoteCount={postAggregateDefaults(post).upvote_count}
            downvoteCount={postAggregateDefaults(post).downvote_count}
            onCountsSynced={(next) =>
              setPost((p) => (p ? { ...p, upvote_count: next.upvote_count, downvote_count: next.downvote_count } : null))
            }
          />
          <ReactionBar postId={post.id} viewerId={userId || null} authorId={post.author_id ?? undefined} />
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Link href={`/board/${board?.slug ?? slug}`} className="border border-dashed border-gray-500 bg-white px-3 py-2 text-sm">
          목록
        </Link>
        <Link href={`/board/${board?.slug ?? slug}/write`} className="border border-dashed border-gray-500 bg-white px-3 py-2 text-sm">
          새 글
        </Link>
        {canEdit && post ? (
          <>
            <Link
              href={`/board/${board?.slug ?? slug}/write?edit=${post.id}`}
              className="border border-dashed border-gray-500 bg-white px-3 py-2 text-sm"
            >
              수정
            </Link>
            <button
              type="button"
              onClick={onDelete}
              className="border border-dashed border-red-500 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              삭제
            </button>
          </>
        ) : null}

        <button
          type="button"
          onClick={shareToFeed}
          disabled={shareLoading}
          className="border border-dashed border-gray-400 bg-blue-50 px-3 py-2 text-sm text-blue-700 hover:bg-blue-100 disabled:opacity-50"
        >
          {shareLoading ? "공유 중..." : "내 피드에 공유"}
        </button>

        {!canEdit && (
          <button
            type="button"
            onClick={handleReportPost}
            className="border border-dashed border-gray-400 bg-white px-3 py-2 text-sm text-gray-500 hover:bg-gray-50"
          >
            신고
          </button>
        )}

        {/* 테스트용 개념글 토글 (개발 환경에서만 노출) */}
        {process.env.NODE_ENV === "development" && post && (
          <button
            type="button"
            onClick={toggleHotPost}
            className={`border border-dashed px-3 py-2 text-sm transition-colors ${
              post.is_hot 
                ? "border-orange-500 bg-orange-50 text-orange-700" 
                : "border-gray-400 bg-gray-50 text-gray-500"
            }`}
          >
            {post.is_hot ? "🔥 개념글 해제" : "✨ 개념글로 등극"}
          </button>
        )}
      </div>

      {post ? (
        <CommentSection
          postId={post.id}
          postAuthorId={post.author_id ?? undefined}
          viewerId={userId || null}
          viewerEmail={userEmail || null}
          allowAnonymous={board?.allow_anonymous ?? false}
          onThreadChanged={refetchPost}
          onOpenUserAction={(authorId) => setSelectedUserId(authorId)}
        />
      ) : null}

      <UserActionModal
        open={Boolean(selectedUserId)}
        onClose={() => setSelectedUserId(null)}
        viewerId={userId || null}
        targetUserId={selectedUserId}
      />

      {message ? (
        <p className="border border-dashed border-red-500 bg-red-50 p-3 text-sm text-red-700">{message}</p>
      ) : null}
    </main>
  );
}
