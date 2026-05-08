"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ReleaseForm,
  type ReleaseFormState,
  arrayToCsv,
  csvToArray,
  datetimeLocalToIso,
  emptyReleaseForm,
  emptyToNull,
  isoToDatetimeLocal,
  numberOrNull,
} from "@/components/releases/AdminReleaseForm";
import { supabase } from "@/lib/supabase/client";
import type { OtakuCategory } from "@/lib/otaku/hub";

type ReleaseEditRow = {
  id: string;
  category: "ANIME" | "MANGA" | "GAME";
  status: "DRAFT" | "PUBLISHED" | "HIDDEN";
  title: string;
  original_title: string | null;
  synopsis: string;
  poster_url: string | null;
  banner_url: string | null;
  genres: string[] | null;
  studios: string[] | null;
  season: string | null;
  episode_count: number | null;
  last_checked_at: string | null;
};

export default function AdminReleaseEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [form, setForm] = useState<ReleaseFormState>(emptyReleaseForm);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRelease = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("release_items")
        .select(
          "id, category, status, title, original_title, synopsis, poster_url, banner_url, genres, studios, season, episode_count, last_checked_at",
        )
        .eq("id", id)
        .single();

      if (error || !data) {
        alert("신작 정보를 불러오지 못했습니다.");
        router.push("/admin/releases");
        return;
      }

      const item = data as ReleaseEditRow;
      const category = item.category.toLowerCase() as Exclude<OtakuCategory, "all" | "game">;
      setTitle(item.title);
      setForm({
        category,
        status: item.status,
        title: item.title,
        originalTitle: item.original_title ?? "",
        synopsis: item.synopsis ?? "",
        posterUrl: item.poster_url ?? "",
        bannerUrl: item.banner_url ?? "",
        genres: arrayToCsv(item.genres),
        studios: arrayToCsv(item.studios),
        season: item.season ?? "",
        episodeCount: item.episode_count?.toString() ?? "",
        lastCheckedAt: isoToDatetimeLocal(item.last_checked_at),
      });
      setLoading(false);
    };

    void fetchRelease();
  }, [id, router]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.title.trim() || !form.synopsis.trim()) {
      alert("제목과 시놉시스는 필수입니다.");
      return;
    }

    const { error } = await supabase
      .from("release_items")
      .update({
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
        last_checked_at: datetimeLocalToIso(form.lastCheckedAt),
      })
      .eq("id", id);

    if (error) {
      alert("신작 수정 실패: " + error.message);
      return;
    }

    setTitle(form.title);
    alert("신작 정보가 저장되었습니다.");
  };

  if (loading) return <div className="p-6 text-sm text-gray-500">로딩 중...</div>;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex items-center justify-between border-b border-dashed border-gray-500 pb-4">
        <div>
          <Link href="/admin/releases" className="text-xs text-gray-500 hover:underline">
            신작 관리로 돌아가기
          </Link>
          <h2 className="mt-2 text-xl font-bold">{title} 관리</h2>
          <p className="mt-1 text-sm text-gray-600">
            기본 메타데이터를 수정하면 신작 상세 페이지 표시가 함께 바뀝니다.
          </p>
        </div>
        <Link
          href={`/releases/${id}`}
          className="rounded border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-100"
        >
          공개 페이지
        </Link>
      </div>

      <ReleaseForm
        form={form}
        setForm={setForm}
        submitLabel="저장하기"
        onSubmit={handleSubmit}
        onCancel={() => router.push("/admin/releases")}
      />
    </div>
  );
}
