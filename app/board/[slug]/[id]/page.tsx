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
        setPost(postResponse.data as CommunityPost);
      }

      setLoading(false);
    };

    if (postId && slug) fetchData();
  }, [postId, slug]);

  const canEdit = useMemo(() => {
    if (!post || !userId) return false;
    return post.author_id === userId;
  }, [post, userId]);

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
        <p className="mt-2 text-sm text-gray-600">
          {post?.author_email} | {post ? new Date(post.created_at).toLocaleString("ko-KR") : "-"}
        </p>
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
      </div>

      {message ? (
        <p className="border border-dashed border-red-500 bg-red-50 p-3 text-sm text-red-700">{message}</p>
      ) : null}
    </main>
  );
}
