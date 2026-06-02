"use client";

import { Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  characterFormToPayload,
  EMPTY_CHARACTER_FORM,
  type CharacterFormState,
  type CharacterPayload,
} from "@/lib/admin/catalogForms";
import {
  OFFICIAL_CATALOG_STATUS_OPTIONS,
  OFFICIAL_CHARACTER_MEME_TAGS,
  OFFICIAL_CHARACTER_POSITIONS,
  OFFICIAL_CHARACTER_TAGS,
  normalizeOfficialSlug,
  splitList,
  uniqueList,
} from "@/lib/official/catalog";
import { uploadOfficialCatalogImage } from "@/lib/official/storage";
import type {
  OfficialCatalogStatus,
  OfficialOshiCharacter,
} from "@/types/official";

type Props = {
  workId: string;
  initialValue?: CharacterFormState;
  submitLabel?: string;
  className?: string;
  compact?: boolean;
  onSave: (
    payload: CharacterPayload,
    characterId: string | null,
  ) => Promise<OfficialOshiCharacter | void>;
  onSaved?: (character?: OfficialOshiCharacter) => void;
  onReset?: () => void;
};

export default function OfficialCharacterForm({
  workId,
  initialValue = EMPTY_CHARACTER_FORM,
  submitLabel,
  className,
  compact = false,
  onSave,
  onSaved,
  onReset,
}: Props) {
  const [form, setForm] = useState<CharacterFormState>(initialValue);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    setForm(initialValue);
  }, [initialValue]);

  const normalizedSlug = useMemo(
    () => normalizeOfficialSlug(form.slug || form.name),
    [form.slug, form.name],
  );

  const update = <K extends keyof CharacterFormState>(
    key: K,
    value: CharacterFormState[K],
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const reset = () => {
    setForm(EMPTY_CHARACTER_FORM);
    onReset?.();
  };

  const toggleListValue = (field: "positions" | "tags" | "meme_tags", value: string) => {
    setForm((current) => {
      const currentValues = splitList(current[field]);
      const nextValues = currentValues.includes(value)
        ? currentValues.filter((item) => item !== value)
        : [...currentValues, value];
      return { ...current, [field]: uniqueList(nextValues).join(", ") };
    });
  };

  const handleImageUpload = async (file: File | null) => {
    if (!file) return;
    try {
      setUploadingImage(true);
      const publicUrl = await uploadOfficialCatalogImage(
        "oshi",
        normalizedSlug || form.name || "draft-oshi",
        file,
      );
      update("profile_image_url", publicUrl);
    } catch (error) {
      alert(error instanceof Error ? error.message : "이미지 업로드 실패");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!normalizedSlug || !form.name.trim()) {
      alert("최애캐 슬러그와 이름은 필수입니다.");
      return;
    }

    setSaving(true);
    try {
      const saved = await onSave(
        characterFormToPayload({ ...form, slug: normalizedSlug }, workId),
        form.id,
      );
      onSaved?.(saved as OfficialOshiCharacter | undefined);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={
        className ??
        "flex flex-col gap-4 rounded border border-dashed border-gray-500 bg-white/70 p-6"
      }
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-lg font-bold">{form.id ? "최애 수정" : "최애 추가"}</h3>
        {form.id ? (
          <button type="button" onClick={reset} className="text-xs text-gray-500 hover:text-black">
            새로 추가
          </button>
        ) : (
          <Plus size={16} className="text-gray-400" />
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold">이름 *</span>
          <input
            value={form.name}
            onChange={(event) => update("name", event.target.value)}
            className="rounded border p-2 focus:border-black focus:outline-none"
            required
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold">원문명</span>
          <input
            value={form.original_name}
            onChange={(event) => update("original_name", event.target.value)}
            className="rounded border p-2 focus:border-black focus:outline-none"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-semibold">슬러그 *</span>
        <input
          value={form.slug}
          onChange={(event) => update("slug", event.target.value)}
          placeholder="ex) usopp"
          className="rounded border p-2 focus:border-black focus:outline-none"
        />
        {normalizedSlug ? <p className="text-xs text-gray-600">미리보기: /characters/{normalizedSlug}</p> : null}
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

      <section className="space-y-3 rounded border border-dashed border-gray-300 p-3">
        <h4 className="text-xs font-bold uppercase tracking-widest text-gray-500">캐릭터 속성 정보</h4>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold">포지션</span>
          <input
            value={form.positions}
            onChange={(event) => update("positions", event.target.value)}
            placeholder="주인공, 라이벌"
            className="rounded border p-2 focus:border-black focus:outline-none"
          />
        </label>
        <div className="flex flex-wrap gap-1.5">
          {OFFICIAL_CHARACTER_POSITIONS.map((position) => (
            <button
              key={position}
              type="button"
              onClick={() => toggleListValue("positions", position)}
              className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${
                splitList(form.positions).includes(position)
                  ? "border-black bg-black text-white"
                  : "border-gray-300 bg-white text-gray-600"
              }`}
            >
              {position}
            </button>
          ))}
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold">태그</span>
          <textarea
            value={form.tags}
            onChange={(event) => update("tags", event.target.value)}
            rows={compact ? 2 : 3}
            placeholder="냉정, 카리스마, 성장형"
            className="rounded border p-2 focus:border-black focus:outline-none"
          />
        </label>
        <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto rounded border border-dashed border-gray-200 p-2">
          {OFFICIAL_CHARACTER_TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => toggleListValue("tags", tag)}
              className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${
                splitList(form.tags).includes(tag)
                  ? "border-black bg-black text-white"
                  : "border-gray-300 bg-white text-gray-600"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold">밈 태그</span>
          <textarea
            value={form.meme_tags}
            onChange={(event) => update("meme_tags", event.target.value)}
            rows={2}
            placeholder="밈캐, 짤 생성기"
            className="rounded border p-2 focus:border-black focus:outline-none"
          />
        </label>
        <div className="flex flex-wrap gap-1.5">
          {OFFICIAL_CHARACTER_MEME_TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => toggleListValue("meme_tags", tag)}
              className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${
                splitList(form.meme_tags).includes(tag)
                  ? "border-pink-600 bg-pink-600 text-white"
                  : "border-gray-300 bg-white text-gray-600"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
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
      </div>

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
        {form.profile_image_url ? (
          <div className="mt-2 flex items-center gap-3">
            <img
              src={form.profile_image_url}
              alt="최애캐 이미지 미리보기"
              className="h-16 w-16 rounded border object-cover"
            />
            <button
              type="button"
              onClick={() => update("profile_image_url", "")}
              className="text-xs text-red-600 hover:underline"
            >
              이미지 제거
            </button>
          </div>
        ) : null}
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-semibold">소개</span>
        <textarea
          value={form.description}
          onChange={(event) => update("description", event.target.value)}
          rows={compact ? 2 : 3}
          className="rounded border p-2 focus:border-black focus:outline-none"
        />
      </label>

      <button
        type="submit"
        disabled={saving}
        className="rounded bg-black px-4 py-2 text-white transition-opacity hover:opacity-80 disabled:opacity-50"
      >
        {saving ? "저장 중..." : submitLabel ?? (form.id ? "최애 저장" : "최애 추가")}
      </button>
    </form>
  );
}
