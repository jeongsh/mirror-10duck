"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import {
  ReleaseForm,
  type ReleaseFormState,
  arrayToCsv,
  csvToArray,
  emptyReleaseForm,
  emptyToNull,
  formatDetailsForTextarea,
  numberOrNull,
  parseDetails,
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
  cours: string | null;
  episode_count: number | null;
  details_json: unknown | null;
  release_date: string | null;
};

export default function AdminReleaseEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [form, setForm] = useState<ReleaseFormState>(emptyReleaseForm);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const fetchRelease = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("release_items")
        .select(
          "id, category, status, title, original_title, synopsis, poster_url, banner_url, genres, studios, season, cours, episode_count, details_json, release_date",
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
        cours: item.cours ?? "",
        episodeCount: item.episode_count?.toString() ?? "",
        details: formatDetailsForTextarea(item.details_json),
        releaseDate: item.release_date ?? "",
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
    if (!form.cours) {
      alert("분기를 선택해 주세요.");
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
        cours: form.cours,
        episode_count: numberOrNull(form.episodeCount),
        details_json: parseDetails(form.details),
        release_date: emptyToNull(form.releaseDate),
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

  const handleDelete = async () => {
    if (!confirm(`'${title || form.title}' 작품을 삭제할까요? 이 작업은 되돌릴 수 없습니다.`)) {
      return;
    }

    setDeleting(true);
    try {
      const { error } = await supabase.from("release_items").delete().eq("id", id);
      if (error) {
        throw error;
      }
      alert("삭제되었습니다.");
      router.push("/admin/releases");
    } catch (error) {
      const message = error instanceof Error ? error.message : "알 수 없는 오류";
      alert(`삭제 실패: ${message}`);
    } finally {
      setDeleting(false);
    }
  };

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
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => void handleDelete()}
          disabled={deleting}
          className="inline-flex items-center gap-1 rounded border border-red-300 bg-white px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
          삭제
        </button>
      </div>
    </div>
  );
}
