"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { CommunityPost } from "@/types/community";

export default function CommunityPostDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const postId = params.id;

  const [post, setPost] = useState<CommunityPost | null>(null);
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setMessage("");

      const [{ data: authData }, postResponse] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from("posts").select("*").eq("id", postId).single(),
      ]);

      setUserId(authData.user?.id ?? "");

      if (postResponse.error) {
        setMessage(postResponse.error.message);
        setPost(null);
      } else {
        setPost(postResponse.data as CommunityPost);
      }

      setLoading(false);
    };

    fetchData();
  }, [postId]);

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

    router.push("/community");
  };

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-3xl p-6">
        <div className="border border-dashed border-gray-500 bg-white/70 p-4 text-sm">
          로딩 중...
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-4 p-6">
      <header className="border border-dashed border-gray-500 bg-white/70 p-4">
        <h1 className="text-xl font-bold">{post?.title ?? "게시글 없음"}</h1>
        <p className="mt-2 text-sm text-gray-600">
          {post?.category} | {post?.author_email} |{" "}
          {post ? new Date(post.created_at).toLocaleString("ko-KR") : "-"}
        </p>
      </header>

      <article className="min-h-[320px] whitespace-pre-wrap border border-dashed border-gray-500 bg-white/70 p-4 text-sm">
        {post?.content ?? "게시글을 찾을 수 없습니다."}
      </article>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/community"
          className="border border-dashed border-gray-500 bg-white px-3 py-2 text-sm"
        >
          목록
        </Link>
        <Link
          href="/community/write"
          className="border border-dashed border-gray-500 bg-white px-3 py-2 text-sm"
        >
          새 글
        </Link>
        {canEdit && post ? (
          <>
            <Link
              href={`/community/${post.id}/edit`}
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
      </div>

      {message ? (
        <p className="border border-dashed border-red-500 bg-red-50 p-3 text-sm text-red-700">
          {message}
        </p>
      ) : null}
    </main>
  );
}
