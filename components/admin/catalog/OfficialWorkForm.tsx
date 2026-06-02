"use client";

import { useEffect, useMemo, useState } from "react";
import {
  EMPTY_WORK_FORM,
  workFormToPayload,
  type WorkFormState,
  type WorkPayload,
} from "@/lib/admin/catalogForms";
import {
  OFFICIAL_CATALOG_STATUS_OPTIONS,
  OFFICIAL_WORK_CATEGORY_OPTIONS,
  normalizeOfficialSlug,
} from "@/lib/official/catalog";
import { uploadOfficialCatalogImage } from "@/lib/official/storage";
import type {
  OfficialCatalogStatus,
  OfficialWork,
  OfficialWorkCategory,
} from "@/types/official";

type Props = {
  initialValue?: WorkFormState;
  mode: "create" | "edit";
  submitLabel?: string;
  className?: string;
  compact?: boolean;
  onSave: (payload: WorkPayload) => Promise<OfficialWork | void>;
  onSaved?: (work?: OfficialWork) => void;
  onCancel?: () => void;
  onDelete?: () => void;
};

export default function OfficialWorkForm({
  initialValue = EMPTY_WORK_FORM,
  mode,
  submitLabel,
  className,
  compact = false,
  onSave,
  onSaved,
  onCancel,
  onDelete,
}: Props) {
  const [form, setForm] = useState<WorkFormState>(initialValue);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    setForm(initialValue);
  }, [initialValue]);

  const normalizedSlug = useMemo(
    () => normalizeOfficialSlug(form.slug || form.title),
    [form.slug, form.title],
  );

  const update = <K extends keyof WorkFormState>(key: K, value: WorkFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleImageUpload = async (file: File | null) => {
    if (!file) return;
    try {
      setUploadingImage(true);
      const publicUrl = await uploadOfficialCatalogImage(
        "works",
        normalizedSlug || form.title || "draft-work",
        file,
      );
      update("cover_image_url", publicUrl);
    } catch (error) {
      alert(error instanceof Error ? error.message : "이미지 업로드 실패");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!normalizedSlug || !form.title.trim()) {
      alert("슬러그와 작품명은 필수입니다.");
      return;
    }

    setSaving(true);
    try {
      const saved = await onSave(workFormToPayload({ ...form, slug: normalizedSlug }));
      onSaved?.(saved as OfficialWork | undefined);
    } finally {
      setSaving(false);
    }
  };

  const gridClass = compact ? "grid gap-3 md:grid-cols-2" : "grid gap-4 lg:grid-cols-2";
  const triGridClass = compact ? "grid gap-3 md:grid-cols-2" : "grid gap-4 lg:grid-cols-3";
  const quadGridClass = compact ? "grid gap-3 md:grid-cols-2" : "grid gap-4 lg:grid-cols-4";

  return (
    <form
      onSubmit={handleSubmit}
      className={
        className ??
        "flex flex-col gap-6 rounded border border-dashed border-gray-500 bg-white/70 p-6"
      }
    >
      <section className={gridClass}>
        <h3 className="text-sm font-bold uppercase tracking-widest text-gray-500 md:col-span-2 lg:col-span-2">
          기본
        </h3>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold">작품명 *</span>
          <input
            value={form.title}
            onChange={(event) => update("title", event.target.value)}
            className="rounded border p-2 focus:border-black focus:outline-none"
            required
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold">원제</span>
          <input
            value={form.original_title}
            onChange={(event) => update("original_title", event.target.value)}
            className="rounded border p-2 focus:border-black focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold">슬러그 *</span>
          <input
            value={form.slug}
            onChange={(event) => update("slug", event.target.value)}
            placeholder="ex) one-piece"
            className="rounded border p-2 focus:border-black focus:outline-none"
          />
          {normalizedSlug ? <p className="text-xs text-gray-600">미리보기: /works/{normalizedSlug}</p> : null}
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold">별칭</span>
          <input
            value={form.aliases}
            onChange={(event) => update("aliases", event.target.value)}
            placeholder="쉼표로 구분"
            className="rounded border p-2 focus:border-black focus:outline-none"
          />
        </label>
      </section>

      <section className={triGridClass}>
        <h3 className="text-sm font-bold uppercase tracking-widest text-gray-500 md:col-span-2 lg:col-span-3">
          분류
        </h3>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold">장르(태그)</span>
          <input
            value={form.genres}
            onChange={(event) => update("genres", event.target.value)}
            placeholder="액션, 판타지"
            className="rounded border p-2 focus:border-black focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold">연령등급</span>
          <input
            value={form.age_rating}
            onChange={(event) => update("age_rating", event.target.value)}
            placeholder="15세 이상"
            className="rounded border p-2 focus:border-black focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold">국내 시청 가능 OTT</span>
          <input
            value={form.ott_platforms}
            onChange={(event) => update("ott_platforms", event.target.value)}
            placeholder="라프텔, 티빙, 웨이브, 넷플릭스"
            className="rounded border p-2 focus:border-black focus:outline-none"
          />
        </label>
      </section>

      <section className={quadGridClass}>
        <h3 className="text-sm font-bold uppercase tracking-widest text-gray-500 md:col-span-2 lg:col-span-4">
          방영정보
        </h3>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold">시작일</span>
          <input
            type="date"
            value={form.start_date}
            onChange={(event) => update("start_date", event.target.value)}
            className="rounded border p-2 focus:border-black focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold">종료일</span>
          <input
            type="date"
            value={form.end_date}
            onChange={(event) => update("end_date", event.target.value)}
            className="rounded border p-2 focus:border-black focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold">분기</span>
          <input
            value={form.season}
            onChange={(event) => update("season", event.target.value)}
            placeholder="2026 2분기"
            className="rounded border p-2 focus:border-black focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold">화수</span>
          <input
            type="number"
            min={1}
            value={form.episode_count}
            onChange={(event) => update("episode_count", event.target.value)}
            className="rounded border p-2 focus:border-black focus:outline-none"
          />
        </label>
      </section>

      <section className={triGridClass}>
        <h3 className="text-sm font-bold uppercase tracking-widest text-gray-500 md:col-span-2 lg:col-span-3">
          제작
        </h3>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold">제작사</span>
          <input
            value={form.studios}
            onChange={(event) => update("studios", event.target.value)}
            placeholder="쉼표로 구분"
            className="rounded border p-2 focus:border-black focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold">감독</span>
          <input
            value={form.director}
            onChange={(event) => update("director", event.target.value)}
            className="rounded border p-2 focus:border-black focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold">원작자</span>
          <input
            value={form.original_author}
            onChange={(event) => update("original_author", event.target.value)}
            className="rounded border p-2 focus:border-black focus:outline-none"
          />
        </label>
      </section>

      <section className={quadGridClass}>
        <h3 className="text-sm font-bold uppercase tracking-widest text-gray-500 md:col-span-2 lg:col-span-4">
          외부 / 관리
        </h3>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold">AniList ID</span>
          <input
            type="number"
            value={form.anilist_id}
            onChange={(event) => update("anilist_id", event.target.value)}
            className="rounded border p-2 focus:border-black focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold">상태</span>
          <select
            value={form.status}
            onChange={(event) => update("status", event.target.value as OfficialCatalogStatus)}
            className="rounded border border-gray-300 bg-white p-2 focus:border-black focus:outline-none"
          >
            {OFFICIAL_CATALOG_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold">우선순위</span>
          <input
            type="number"
            value={form.sort_order}
            onChange={(event) => update("sort_order", Number(event.target.value))}
            className="rounded border p-2 focus:border-black focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold">분류</span>
          <select
            value={form.category}
            onChange={(event) => update("category", event.target.value as OfficialWorkCategory)}
            className="rounded border border-gray-300 bg-white p-2 focus:border-black focus:outline-none"
          >
            {OFFICIAL_WORK_CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </section>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-semibold">소개</span>
        <textarea
          value={form.synopsis}
          onChange={(event) => update("synopsis", event.target.value)}
          rows={compact ? 3 : 4}
          className="rounded border p-2 focus:border-black focus:outline-none"
        />
      </label>

      {mode === "edit" ? (
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold">대표 이미지</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => void handleImageUpload(event.target.files?.[0] ?? null)}
            disabled={uploadingImage}
            className="rounded border p-2 focus:border-black focus:outline-none"
          />
          {uploadingImage ? <p className="text-xs text-gray-500">이미지 업로드 중...</p> : null}
          {form.cover_image_url ? (
            <div className="mt-2 flex items-center gap-3">
              <img
                src={form.cover_image_url}
                alt="대표 이미지 미리보기"
                className="h-20 w-14 rounded border object-cover"
              />
              <button
                type="button"
                onClick={() => update("cover_image_url", "")}
                className="text-xs text-red-600 hover:underline"
              >
                이미지 제거
              </button>
            </div>
          ) : null}
        </label>
      ) : null}

      <div className="flex flex-wrap gap-2 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded bg-black px-4 py-2 text-white transition-opacity hover:opacity-80 disabled:opacity-50"
        >
          {saving ? "저장 중..." : submitLabel ?? (mode === "create" ? "추가하기" : "작품 저장")}
        </button>
        {onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            className="rounded border border-red-300 bg-red-50 px-4 py-2 text-red-700 transition-colors hover:bg-red-100"
          >
            작품 삭제
          </button>
        ) : null}
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-gray-300 bg-gray-100 px-4 py-2 transition-colors hover:bg-gray-200"
          >
            취소
          </button>
        ) : null}
      </div>
    </form>
  );
}
