"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { CommunityPost, Board } from "@/types/community";

export default function BoardPostDetailPage() {
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;
  const postId = params.id as string;

  const [post, setPost] = useState<CommunityPost | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [userId, setUserId] = useState("");
  const [isFollowingAuthor, setIsFollowingAuthor] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setMessage("");

      const [{ data: authData }, postResponse, boardResponse] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from("posts").select("*").eq("id", postId).single(),
        supabase.from("boards").select("*").eq("slug", slug).single()
      ]);

      setUserId(authData.user?.id ?? "");

      if (boardResponse.data) setBoard(boardResponse.data);

      if (postResponse.error) {
        setMessage(postResponse.error.message);
        setPost(null);
      } else {
        const postData = postResponse.data as CommunityPost;
        setPost(postData);

        // 작성자 팔로우 여부 확인
        if (authData.user?.id && postData.author_id) {
          if (authData.user.id === postData.author_id) {
            // 본인인 경우 체크 생략
          } else {
            const { data: followData } = await supabase
              .from("follows_user")
              .select("*")
              .eq("follower_id", authData.user.id)
              .eq("following_id", postData.author_id)
              .single();
            if (followData) setIsFollowingAuthor(true);
          }
        }
      }

      setLoading(false);
    };

    if (postId && slug) fetchData();
  }, [postId, slug]);

  const canEdit = useMemo(() => {
    if (!post || !userId) return false;
    return post.author_id === userId;
  }, [post, userId]);

  const toggleFollowUser = async () => {
    if (!userId) {
      alert("로그인이 필요합니다.");
      return;
    }
    if (!post || post.author_id === userId) return;

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
    }
  };

  const onDelete = async () => {
    if (!canEdit || !post) return;
    const isConfirmed = window.confirm("정말 삭제할까요?");
    if (!isConfirmed) return;

    const { error } = await supabase.from("posts").delete().eq("id", post.id);
    if (error) {
      setMessage(error.message);
      return;
    }

    router.push(`/board/${slug}`);
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
    }
  };

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-3xl p-6">
        <div className="border border-dashed border-gray-500 bg-white/70 p-4 text-sm text-gray-500">로딩 중...</div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-4 p-6">
      <header className="border border-dashed border-gray-500 bg-white/70 p-4">
        <div className="mb-2 text-sm text-gray-500">
          <Link href="/board" className="hover:underline">게시판</Link> &gt;{" "}
          <Link href={`/board/${slug}`} className="hover:underline">{board?.name ?? slug}</Link>
        </div>
        <h1 className="text-xl font-bold">
          {post?.is_hot && <span className="mr-2 text-red-500">🔥</span>}
          {post?.title ?? "게시글 없음"}
        </h1>
        <div className="mt-2 flex items-center gap-3 text-sm text-gray-600">
          <span>{post?.author_email}</span>
          {post && userId && post.author_id !== userId && (
            <button
              onClick={toggleFollowUser}
              className={`rounded-full border border-dashed border-gray-500 px-3 py-0.5 text-xs transition-colors ${
                isFollowingAuthor ? "bg-gray-200" : "bg-white hover:bg-gray-100"
              }`}
            >
              {isFollowingAuthor ? "팔로잉 취소" : "팔로우"}
            </button>
          )}
          <span>|</span>
          <span>{post ? new Date(post.created_at).toLocaleString("ko-KR") : "-"}</span>
        </div>
      </header>

      <article className="min-h-[320px] whitespace-pre-wrap border border-dashed border-gray-500 bg-white/70 p-4 text-sm">
        {post?.source_type === 'FEED' ? (
          <div className="mb-4 rounded bg-gray-100 p-3 text-xs text-gray-600">
            ℹ️ 이 글은 피드에서 공유된 글의 스냅샷입니다.
          </div>
        ) : null}
        {post?.content ?? "게시글을 찾을 수 없습니다."}
      </article>

      <div className="flex flex-wrap gap-2">
        <Link href={`/board/${slug}`} className="border border-dashed border-gray-500 bg-white px-3 py-2 text-sm">
          목록
        </Link>
        <Link href={`/board/${slug}/write`} className="border border-dashed border-gray-500 bg-white px-3 py-2 text-sm">
          새 글
        </Link>
        {canEdit && post ? (
          <>
            <button
              type="button"
              onClick={() => alert('수정 기능은 추후 지원 예정입니다.')}
              className="border border-dashed border-gray-500 bg-white px-3 py-2 text-sm"
            >
              수정
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="border border-dashed border-red-500 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              삭제
            </button>
          </>
        ) : null}

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

      {message ? (
        <p className="border border-dashed border-red-500 bg-red-50 p-3 text-sm text-red-700">{message}</p>
      ) : null}
    </main>
  );
}
