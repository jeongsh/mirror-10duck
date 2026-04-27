"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import {
  COMMUNITY_CATEGORIES,
  CommunityCategory,
  CommunityPost,
} from "@/types/community";

export default function EditPostPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const postId = params.id;

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<CommunityCategory>("일반");
  const [authorId, setAuthorId] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setMessage("");

      const [{ data: authData }, postResponse] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from("posts").select("*").eq("id", postId).single(),
      ]);

      const post = postResponse.data as CommunityPost | null;
      setCurrentUserId(authData.user?.id ?? "");

      if (postResponse.error || !post) {
        setMessage(postResponse.error?.message ?? "게시글을 찾을 수 없습니다.");
      } else {
        setTitle(post.title);
        setContent(post.content);
        setCategory(post.category);
        setAuthorId(post.author_id);
      }

      setLoading(false);
    };

    fetchData();
  }, [postId]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentUserId || currentUserId !== authorId) {
      setMessage("작성자만 수정할 수 있습니다.");
      return;
    }

    setSaving(true);
    setMessage("");

    const { error } = await supabase
      .from("posts")
      .update({ title, content, category })
      .eq("id", postId);

    setSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    router.push(`/community/${postId}`);
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
        <h1 className="text-lg font-bold">게시글 수정</h1>
      </header>

      <form
        onSubmit={onSubmit}
        className="flex flex-col gap-3 border border-dashed border-gray-500 bg-white/70 p-4"
      >
        <label className="text-sm">
          카테고리
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value as CommunityCategory)}
            className="mt-1 w-full border border-dashed border-gray-500 bg-white px-3 py-2"
          >
            {COMMUNITY_CATEGORIES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          제목
          <input
            required
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="mt-1 w-full border border-dashed border-gray-500 bg-white px-3 py-2"
          />
        </label>

        <label className="text-sm">
          내용
          <textarea
            required
            rows={12}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            className="mt-1 w-full border border-dashed border-gray-500 bg-white px-3 py-2"
          />
        </label>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="border border-dashed border-gray-500 bg-gray-200 px-3 py-2 text-sm disabled:opacity-50"
          >
            {saving ? "저장 중..." : "저장"}
          </button>
          <Link
            href={`/community/${postId}`}
            className="border border-dashed border-gray-500 bg-white px-3 py-2 text-sm"
          >
            취소
          </Link>
        </div>
      </form>

      {message ? (
        <p className="border border-dashed border-red-500 bg-red-50 p-3 text-sm text-red-700">
          {message}
        </p>
      ) : null}
    </main>
  );
}
