"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  NewsForm,
  type NewsFormState,
  arrayToCsv,
  csvToArray,
  datetimeLocalToIso,
  emptyNewsForm,
  emptyToNull,
  isoToDatetimeLocal,
  parseEditorBody,
  stringifyEditorBody,
} from "@/components/news/AdminNewsForm";
import { supabase } from "@/lib/supabase/client";
import type { OtakuCategory } from "@/lib/otaku/hub";

type NewsEditRow = {
  id: string;
  category: "ANIME" | "MANGA" | "GAME";
  status: "DRAFT" | "PUBLISHED" | "HIDDEN";
  title: string;
  summary: string;
  body_json: unknown | null;
  thumbnail_url: string | null;
  tags: string[] | null;
  published_at: string | null;
};

export default function AdminNewsEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [form, setForm] = useState<NewsFormState>(emptyNewsForm);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNews = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("news_items")
        .select(
          "id, category, status, title, summary, body_json, thumbnail_url, tags, published_at",
        )
        .eq("id", id)
        .single();

      if (error || !data) {
        alert("뉴스 정보를 불러오지 못했습니다.");
        router.push("/admin/news");
        return;
      }

      const item = data as NewsEditRow;
      const category = item.category.toLowerCase() as Exclude<OtakuCategory, "all" | "game">;
      setTitle(item.title);
      setForm({
        category,
        status: item.status,
        title: item.title,
        summary: item.summary,
        body: stringifyEditorBody(item.body_json),
        thumbnailUrl: item.thumbnail_url ?? "",
        tags: arrayToCsv(item.tags),
        publishedAt: isoToDatetimeLocal(item.published_at),
      });
      setLoading(false);
    };

    void fetchNews();
  }, [id, router]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.title.trim() || !form.summary.trim()) {
      alert("제목, 요약은 필수입니다.");
      return;
    }

    const { error } = await supabase
      .from("news_items")
      .update({
        category: form.category.toUpperCase(),
        status: form.status,
        title: form.title.trim(),
        summary: form.summary.trim(),
        body_json: parseEditorBody(form.body),
        thumbnail_url: emptyToNull(form.thumbnailUrl),
        tags: csvToArray(form.tags),
        published_at: datetimeLocalToIso(form.publishedAt),
      })
      .eq("id", id);

    if (error) {
      alert("뉴스 수정 실패: " + error.message);
      return;
    }

    setTitle(form.title);
    alert("뉴스 정보가 저장되었습니다.");
  };

  if (loading) return <div className="p-6 text-sm text-gray-500">로딩 중...</div>;

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-3xl flex-col gap-6">
      <div className="flex items-center justify-between border-b border-dashed border-gray-500 pb-4">
        <div>
          <Link href="/admin/news" className="text-xs text-gray-500 hover:underline">
            뉴스 관리로 돌아가기
          </Link>
          <h2 className="mt-2 text-xl font-bold">{title} 관리</h2>
          <p className="mt-1 text-sm text-gray-600">
            수정 내용은 뉴스 상세 페이지와 목록 카드에 반영됩니다.
          </p>
        </div>
        <Link
          href={`/news/${id}`}
          className="rounded border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-100"
        >
          공개 페이지
        </Link>
      </div>

      <NewsForm
        form={form}
        setForm={setForm}
        submitLabel="저장하기"
        onSubmit={handleSubmit}
        onCancel={() => router.push("/admin/news")}
      />
    </div>
  );
}
