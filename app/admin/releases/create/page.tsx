"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ReleaseForm,
  csvToArray,
  datetimeLocalToIso,
  emptyReleaseForm,
  emptyToNull,
  numberOrNull,
  parseDetails,
} from "@/components/releases/AdminReleaseForm";
import { supabase } from "@/lib/supabase/client";

export default function CreateReleasePage() {
  const router = useRouter();
  const [form, setForm] = useState(emptyReleaseForm);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.title.trim() || !form.synopsis.trim()) {
      alert("제목과 시놉시스는 필수입니다.");
      return;
    }

    const { error } = await supabase.from("release_items").insert([
      {
        category: form.category.toUpperCase(),
        status: form.status,
        title: form.title.trim(),
        original_title: emptyToNull(form.originalTitle),
        synopsis: form.synopsis.trim(),
        poster_url: emptyToNull(form.posterUrl),
        banner_url: emptyToNull(form.bannerUrl),
        genres: csvToArray(form.genres),
        studios: csvToArray(form.studios),
        season: emptyToNull(form.season),
        episode_count: numberOrNull(form.episodeCount),
        details_json: parseDetails(form.details),
        last_checked_at: datetimeLocalToIso(form.lastCheckedAt),
      },
    ]);

    if (error) {
      alert("신작 생성 실패: " + error.message);
      return;
    }

    router.push("/admin/releases");
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="border-b border-dashed border-gray-500 pb-4">
        <h2 className="text-xl font-bold">새 신작 추가</h2>
        <p className="mt-1 text-sm text-gray-600">
          전체 작품 DB가 아니라 신작 알림에 필요한 최소 정보만 등록합니다.
        </p>
      </div>

      <ReleaseForm
        form={form}
        setForm={setForm}
        submitLabel="추가하기"
        onSubmit={handleSubmit}
        onCancel={() => router.push("/admin/releases")}
      />
    </div>
  );
}
