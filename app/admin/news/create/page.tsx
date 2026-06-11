"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  NewsForm,
  csvToArray,
  datetimeLocalToIso,
  emptyNewsForm,
  emptyToNull,
  parseEditorBody,
} from "@/components/news/AdminNewsForm";
import { supabase } from "@/lib/supabase/client";

export default function CreateNewsPage() {
  const router = useRouter();
  const [form, setForm] = useState(emptyNewsForm);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.title.trim() || !form.summary.trim()) {
      alert("제목, 요약은 필수입니다.");
      return;
    }

    const { error } = await supabase.from("news_items").insert([
      {
        category: form.category.toUpperCase(),
        status: form.status,
        title: form.title.trim(),
        summary: form.summary.trim(),
        body_json: parseEditorBody(form.body),
        thumbnail_url: emptyToNull(form.thumbnailUrl),
        tags: csvToArray(form.tags),
        published_at: datetimeLocalToIso(form.publishedAt),
      },
    ]);

    if (error) {
      alert("뉴스 생성 실패: " + error.message);
      return;
    }

    router.push("/admin/news");
  };

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-3xl flex-col gap-6">
      <div className="border-b border-dashed border-gray-500 pb-4">
        <h2 className="text-xl font-bold">새 뉴스 추가</h2>
        <p className="mt-1 text-sm text-gray-600">
          영문 뉴스 URL로 AI 초안을 만들거나, 직접 뉴스 본문과 목록 정보를 등록합니다.
        </p>
      </div>

      <NewsForm
        form={form}
        setForm={setForm}
        submitLabel="추가하기"
        onSubmit={handleSubmit}
        onCancel={() => router.push("/admin/news")}
      />
    </div>
  );
}
