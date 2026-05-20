"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import {
  OFFICIAL_CATALOG_STATUS_OPTIONS,
  OFFICIAL_WORK_CATEGORY_OPTIONS,
  normalizeOfficialSlug,
} from "@/lib/official/catalog";
import { uploadOfficialCatalogImage } from "@/lib/official/storage";
import type {
  OfficialCatalogStatus,
  OfficialWorkCategory,
} from "@/types/official";

export default function CreateOfficialWorkPage() {
  const router = useRouter();
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [originalTitle, setOriginalTitle] = useState("");
  const [category, setCategory] = useState<OfficialWorkCategory>("anime");
  const [synopsis, setSynopsis] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [status, setStatus] = useState<OfficialCatalogStatus>("DRAFT");
  const [sortOrder, setSortOrder] = useState(0);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const normalizedSlug = normalizeOfficialSlug(slug);

  const handleImageUpload = async (file: File | null) => {
    if (!file) return;
    try {
      setUploadingImage(true);
      const publicUrl = await uploadOfficialCatalogImage(
        "works",
        normalizedSlug || title || "draft-work",
        file,
      );
      setCoverImageUrl(publicUrl);
    } catch (error) {
      alert(error instanceof Error ? error.message : "이미지 업로드 실패");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!normalizedSlug || !title.trim()) {
      alert("슬러그와 작품명은 필수입니다.");
      return;
    }

    setSaving(true);
    const { data, error } = await supabase
      .from("official_works")
      .insert({
        slug: normalizedSlug,
        title: title.trim(),
        original_title: originalTitle.trim() || null,
        category,
        synopsis: synopsis.trim(),
        cover_image_url: coverImageUrl.trim() || null,
        status,
        sort_order: sortOrder,
      })
      .select("id")
      .single();
    setSaving(false);

    if (error) {
      alert(`작품 추가 실패: ${error.message}`);
      return;
    }

    router.push(`/admin/works/${data.id}`);
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="border-b border-dashed border-gray-500 pb-4">
        <h2 className="text-xl font-bold">공식 작품 추가</h2>
        <p className="mt-1 text-sm text-gray-600">
          온보딩과 작품 허브에서 선택할 수 있는 공식 작품을 추가합니다.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 rounded border border-dashed border-gray-500 bg-white/70 p-6"
      >
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold">슬러그 *</span>
          <input
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            placeholder="ex) one-piece"
            className="rounded border p-2 focus:border-black focus:outline-none"
            required
          />
          {normalizedSlug ? (
            <p className="text-xs text-gray-600">미리보기: /works/{normalizedSlug}</p>
          ) : null}
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold">작품명 *</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="rounded border p-2 focus:border-black focus:outline-none"
            required
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold">원제/별칭</span>
          <input
            value={originalTitle}
            onChange={(event) => setOriginalTitle(event.target.value)}
            className="rounded border p-2 focus:border-black focus:outline-none"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold">분류</span>
            <select
              value={category}
              onChange={(event) =>
                setCategory(event.target.value as OfficialWorkCategory)
              }
              className="rounded border border-gray-300 bg-white p-2 focus:border-black focus:outline-none"
            >
              {OFFICIAL_WORK_CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold">상태</span>
            <select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as OfficialCatalogStatus)
              }
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
            <span className="text-sm font-semibold">정렬</span>
            <input
              type="number"
              value={sortOrder}
              onChange={(event) => setSortOrder(Number(event.target.value))}
              className="rounded border p-2 focus:border-black focus:outline-none"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold">소개</span>
          <textarea
            value={synopsis}
            onChange={(event) => setSynopsis(event.target.value)}
            rows={4}
            className="rounded border p-2 focus:border-black focus:outline-none"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold">대표 이미지</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => void handleImageUpload(event.target.files?.[0] ?? null)}
            className="rounded border p-2 focus:border-black focus:outline-none"
            disabled={uploadingImage}
          />
          {uploadingImage ? (
            <p className="text-xs text-gray-500">이미지 업로드 중...</p>
          ) : null}
          {coverImageUrl ? (
            <div className="mt-2 flex items-center gap-3">
              <img
                src={coverImageUrl}
                alt="대표 이미지 미리보기"
                className="h-20 w-14 rounded border object-cover"
              />
              <button
                type="button"
                onClick={() => setCoverImageUrl("")}
                className="text-xs text-red-600 hover:underline"
              >
                이미지 제거
              </button>
            </div>
          ) : null}
        </label>

        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-black px-4 py-2 text-white transition-opacity hover:opacity-80 disabled:opacity-50"
          >
            {saving ? "저장 중..." : "추가하기"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/admin/works")}
            className="rounded border border-gray-300 bg-gray-100 px-4 py-2 transition-colors hover:bg-gray-200"
          >
            취소
          </button>
        </div>
      </form>
    </div>
  );
}
