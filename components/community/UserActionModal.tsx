"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createNotification } from "@/lib/community/notifications";
import { supabase } from "@/lib/supabase/client";
import { blockUser, checkIsBlocked, unblockUser } from "@/lib/supabase/profiles";
import { formatCommunityDate } from "@/lib/utils/formatDate";
import type { UserProfile } from "@/types/community";
import IdentityBadge from "@/components/community/IdentityBadge";

const PREVIEW_LIMIT = 3;

export interface UserActionModalProps {
  open: boolean;
  onClose: () => void;
  viewerId: string | null;
  targetUserId: string | null;
}

type BoardRef = { slug: string } | { slug: string }[] | null | undefined;

function firstRelation<T>(rel: T | T[] | null | undefined): T | null {
  if (rel == null) return null;
  return Array.isArray(rel) ? rel[0] ?? null : rel;
}

function boardSlug(ref: BoardRef): string | undefined {
  const row = firstRelation(ref);
  return row?.slug;
}

type NestedPostMeta = {
  title: string | null;
  source_type?: string | null;
  boards?: BoardRef;
};

type PreviewComment = {
  id: string;
  post_id: string;
  content: string | null;
  sticker_token: string | null;
  created_at: string;
  posts?: NestedPostMeta | NestedPostMeta[] | null;
};

type PreviewBoardPost = {
  id: string;
  title: string | null;
  content: string;
  source_type: string | null;
  created_at: string;
  boards?: BoardRef;
};

function profileSegment(profile: UserProfile | null): string | null {
  if (!profile) return null;
  return profile.handle || profile.nickname || null;
}

function postDetailHref(post: {
  id: string;
  source_type?: string | null;
  boards?: BoardRef;
}): string | null {
  const slug = boardSlug(post.boards);
  if (post.source_type === "BOARD" && slug) {
    return `/board/${slug}/${post.id}`;
  }
  if (post.source_type === "FEED") {
    return `/feed?post=${encodeURIComponent(post.id)}`;
  }
  return null;
}

function commentContextHref(c: PreviewComment): string | null {
  const meta = firstRelation(c.posts ?? null);
  if (!meta) return null;
  return postDetailHref({
    id: c.post_id,
    source_type: meta.source_type ?? null,
    boards: meta.boards,
  });
}

function snippet(text: string | null | undefined, max = 80): string {
  if (!text?.trim()) return "";
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length > max ? `${normalized.slice(0, max)}…` : normalized;
}

function commentPreviewLine(c: PreviewComment): string {
  if (c.sticker_token && !c.content?.trim()) return "스티커 답글";
  return snippet(c.content, 72) || "(내용 없음)";
}

function boardPostPreviewLine(p: PreviewBoardPost): string {
  const t = p.title?.trim();
  if (t) return t;
  return snippet(p.content, 72) || "(내용 없음)";
}

export default function UserActionModal({
  open,
  onClose,
  viewerId,
  targetUserId,
}: UserActionModalProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [recentBoardPosts, setRecentBoardPosts] = useState<PreviewBoardPost[]>([]);
  const [recentComments, setRecentComments] = useState<PreviewComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !targetUserId) return;

    let cancelled = false;
    setLoading(true);
    setProfile(null);
    setRecentBoardPosts([]);
    setRecentComments([]);
    setIsFollowing(false);
    setIsBlocked(false);

    const showNonDeletedBoardPostsOnly = !viewerId || viewerId !== targetUserId;

    void (async () => {
      let boardPostsQuery = supabase
        .from("posts")
        .select("id, title, content, source_type, created_at, boards(slug)")
        .eq("author_id", targetUserId)
        .eq("source_type", "BOARD")
        .order("created_at", { ascending: false })
        .limit(PREVIEW_LIMIT);
      if (showNonDeletedBoardPostsOnly) {
        boardPostsQuery = boardPostsQuery.eq("status", "NORMAL");
      }

      const commentsQuery = supabase
        .from("comments")
        .select("id, post_id, content, sticker_token, created_at, posts(title, source_type, boards(slug))")
        .eq("author_id", targetUserId)
        .order("created_at", { ascending: false })
        .limit(PREVIEW_LIMIT);

      const [
        { data: prof, error: profileError },
        { data: boardPostsData, error: boardPostsError },
        { data: commentsData, error: commentsError },
      ] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", targetUserId).maybeSingle(),
        boardPostsQuery,
        commentsQuery,
      ]);

      if (cancelled) return;

      if (profileError) {
        console.warn("[UserActionModal] profile fetch:", profileError.message);
        setProfile(null);
      } else {
        setProfile(prof as UserProfile | null);
      }

      if (boardPostsError) {
        console.warn("[UserActionModal] board posts preview:", boardPostsError.message);
        setRecentBoardPosts([]);
      } else {
        setRecentBoardPosts((boardPostsData as PreviewBoardPost[] | null) ?? []);
      }

      if (commentsError) {
        console.warn("[UserActionModal] comments preview:", commentsError.message);
        setRecentComments([]);
      } else {
        setRecentComments((commentsData as PreviewComment[] | null) ?? []);
      }

      if (viewerId && viewerId !== targetUserId) {
        const [{ data: followRow }, blocked] = await Promise.all([
          supabase
            .from("follows_user")
            .select("following_id")
            .eq("follower_id", viewerId)
            .eq("following_id", targetUserId)
            .maybeSingle(),
          checkIsBlocked(viewerId, targetUserId),
        ]);
        if (cancelled) return;
        setIsFollowing(Boolean(followRow));
        setIsBlocked(blocked);
      }

      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [open, targetUserId, viewerId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const toggleFollow = useCallback(async () => {
    if (!viewerId || !targetUserId || viewerId === targetUserId) return;
    setBusy(true);
    try {
      if (isFollowing) {
        const { error } = await supabase
          .from("follows_user")
          .delete()
          .eq("follower_id", viewerId)
          .eq("following_id", targetUserId);
        if (error) throw error;
        setIsFollowing(false);
      } else {
        const { error } = await supabase
          .from("follows_user")
          .insert({ follower_id: viewerId, following_id: targetUserId });
        if (error) throw error;
        setIsFollowing(true);
        await createNotification({
          receiverId: targetUserId,
          senderId: viewerId,
          type: "FOLLOW",
          title: "새 팔로워",
          content: "회원님을 새로 팔로우했습니다.",
          linkUrl: "/profile",
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      alert(`팔로우 처리에 실패했습니다: ${message}`);
    } finally {
      setBusy(false);
    }
  }, [viewerId, targetUserId, isFollowing]);

  const toggleBlock = useCallback(async () => {
    if (!viewerId || !targetUserId || viewerId === targetUserId) return;
    setBusy(true);
    try {
      if (isBlocked) {
        await unblockUser(viewerId, targetUserId);
        setIsBlocked(false);
      } else {
        if (
          !confirm(
            "이 사용자를 차단하시겠습니까? 차단하면 이 사용자의 글과 댓글이 보이지 않게 됩니다.",
          )
        ) {
          setBusy(false);
          return;
        }
        await blockUser(viewerId, targetUserId);
        setIsBlocked(true);
        if (isFollowing) {
          await supabase
            .from("follows_user")
            .delete()
            .eq("follower_id", viewerId)
            .eq("following_id", targetUserId);
          setIsFollowing(false);
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      alert(`차단 처리에 실패했습니다: ${message}`);
    } finally {
      setBusy(false);
    }
  }, [viewerId, targetUserId, isBlocked, isFollowing]);

  if (!open || !targetUserId) return null;

  const isSelf = viewerId === targetUserId;
  const segment = profileSegment(profile);
  const actBase = segment ? `/user/${encodeURIComponent(segment)}/activity` : null;
  const mainProfileHref = segment ? `/user/${encodeURIComponent(segment)}` : null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-action-modal-title"
        className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden border border-dashed border-gray-500 bg-white shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-2 border-b border-dashed border-gray-200 p-4">
          <h2 id="user-action-modal-title" className="text-sm font-bold text-gray-900">
            사용자
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="border border-dashed border-gray-400 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-100"
          >
            닫기
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {loading ? (
            <p className="text-center text-sm text-gray-500">불러오는 중...</p>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-center gap-3 border-b border-dashed border-gray-200 pb-4">
                <IdentityBadge
                  profile={profile}
                  fallback={
                    profile
                      ? undefined
                      : { nickname: "알 수 없음", nickname_type: "TEMPORARY" }
                  }
                  size="md"
                />
                {mainProfileHref ? (
                  <Link
                    href={mainProfileHref}
                    onClick={onClose}
                    className="text-xs font-bold text-gray-600 underline decoration-dashed underline-offset-2 hover:text-gray-900"
                  >
                    프로필 홈
                  </Link>
                ) : null}
              </div>

              {actBase ? (
                <div className="mb-4 grid grid-cols-3 gap-2">
                  <Link
                    href={`${actBase}?tab=feed`}
                    onClick={onClose}
                    className="border border-dashed border-gray-500 bg-white px-2 py-2 text-center text-xs font-bold hover:bg-gray-50"
                  >
                    피드
                  </Link>
                  <Link
                    href={`${actBase}?tab=board`}
                    onClick={onClose}
                    className="border border-dashed border-gray-500 bg-white px-2 py-2 text-center text-xs font-bold hover:bg-gray-50"
                  >
                    게시판
                  </Link>
                  <Link
                    href={`${actBase}?tab=comments`}
                    onClick={onClose}
                    className="border border-dashed border-gray-500 bg-white px-2 py-2 text-center text-xs font-bold hover:bg-gray-50"
                  >
                    댓글
                  </Link>
                </div>
              ) : (
                <p className="mb-4 text-center text-xs text-gray-500">
                  핸들·닉네임이 없어 활동 페이지로 이동할 수 없습니다.
                </p>
              )}

              <section className="mb-4">
                <h3 className="mb-2 text-[11px] font-black uppercase tracking-wider text-gray-500">
                  최근 게시판 글
                </h3>
                {recentBoardPosts.length === 0 ? (
                  <p className="text-xs text-gray-400">게시판 글이 없습니다.</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {recentBoardPosts.map((p) => {
                      const href = postDetailHref(p);
                      const label = boardPostPreviewLine(p);
                      const inner = (
                        <>
                          <span className="line-clamp-2 font-medium text-gray-900">{label}</span>
                          <span className="shrink-0 text-[10px] text-gray-400">
                            {formatCommunityDate(p.created_at)}
                          </span>
                        </>
                      );
                      return (
                        <li key={p.id}>
                          {href ? (
                            <Link
                              href={href}
                              onClick={onClose}
                              className="flex items-start justify-between gap-2 border border-dashed border-gray-200 bg-gray-50/80 px-2 py-1.5 text-left text-xs hover:bg-gray-100"
                            >
                              {inner}
                            </Link>
                          ) : (
                            <div className="flex items-start justify-between gap-2 border border-dashed border-gray-200 px-2 py-1.5 text-xs text-gray-600">
                              {inner}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <section className="mb-4">
                <h3 className="mb-2 text-[11px] font-black uppercase tracking-wider text-gray-500">
                  최근 댓글
                </h3>
                {recentComments.length === 0 ? (
                  <p className="text-xs text-gray-400">댓글이 없습니다.</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {recentComments.map((c) => {
                      const href = commentContextHref(c);
                      const meta = firstRelation(c.posts ?? null);
                      const postTitle = meta?.title?.trim() || "게시글";
                      return (
                        <li key={c.id}>
                          {href ? (
                            <Link
                              href={href}
                              onClick={onClose}
                              className="block border border-dashed border-gray-200 bg-gray-50/80 px-2 py-1.5 text-left text-xs hover:bg-gray-100"
                            >
                              <p className="line-clamp-2 text-gray-900">{commentPreviewLine(c)}</p>
                              <p className="mt-0.5 line-clamp-1 text-[10px] text-gray-500">
                                〈{postTitle}〉 · {formatCommunityDate(c.created_at)}
                              </p>
                            </Link>
                          ) : (
                            <div className="border border-dashed border-gray-200 px-2 py-1.5 text-xs text-gray-600">
                              <p className="line-clamp-2">{commentPreviewLine(c)}</p>
                              <p className="mt-0.5 text-[10px] text-gray-500">
                                〈{postTitle}〉 · {formatCommunityDate(c.created_at)}
                              </p>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <div className="flex flex-col gap-2 border-t border-dashed border-gray-200 pt-4">
                {!isSelf && viewerId ? (
                  <>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void toggleFollow()}
                      className={`border border-dashed border-gray-500 px-3 py-2 text-sm font-bold disabled:opacity-50 ${
                        isFollowing ? "bg-red-50 text-red-800" : "bg-gray-900 text-white hover:bg-gray-800"
                      }`}
                    >
                      {isFollowing ? "팔로우 취소" : "팔로우"}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void toggleBlock()}
                      className={`border border-dashed px-3 py-2 text-sm font-bold disabled:opacity-50 ${
                        isBlocked
                          ? "border-gray-400 bg-white text-gray-800 hover:bg-gray-50"
                          : "border-red-400 bg-red-50 text-red-800 hover:bg-red-100"
                      }`}
                    >
                      {isBlocked ? "차단 해제" : "차단"}
                    </button>
                  </>
                ) : null}

                {!viewerId ? (
                  <p className="text-center text-xs text-gray-500">
                    로그인하면 팔로우·차단을 사용할 수 있습니다.
                  </p>
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
