"use client";

import { useRef, useState } from "react";
import { ImageIcon, Loader2, Upload, X } from "lucide-react";
import type { OtakuCategory } from "@/lib/otaku/hub";
import CommunityEditor from "@/components/community/editor/CommunityEditor";
import { supabase } from "@/lib/supabase/client";
import { useAuthUser } from "@/lib/supabase/useAuthUser";

const categories: Exclude<OtakuCategory, "all" | "game">[] = ["anime", "manga"];
const statuses = ["DRAFT", "PUBLISHED", "HIDDEN"] as const;

export type NewsFormState = {
  category: Exclude<OtakuCategory, "all" | "game">;
  status: (typeof statuses)[number];
  title: string;
  summary: string;
  body: string;
  thumbnailUrl: string;
  tags: string;
  publishedAt: string;
};

export const emptyNewsForm: NewsFormState = {
  category: "anime",
  status: "DRAFT",
  title: "",
  summary: "",
  body: "",
  thumbnailUrl: "",
  tags: "",
  publishedAt: "",
};

export function NewsForm({
  form,
  setForm,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  form: NewsFormState;
  setForm: React.Dispatch<React.SetStateAction<NewsFormState>>;
  submitLabel: string;
  onSubmit: (event: React.FormEvent) => void;
  onCancel: () => void;
}) {
  const authUser = useAuthUser();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);

  const set = <K extends keyof NewsFormState>(key: K, value: NewsFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleThumbnailUpload = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("이미지 파일만 업로드할 수 있습니다.");
      return;
    }

    setUploadingThumbnail(true);
    try {
      const fileExt = file.name.split(".").pop() || "jpg";
      const filePath = `news-thumbnails/${crypto.randomUUID()}.${fileExt}`;
      const { error } = await supabase.storage.from("post-assets").upload(filePath, file);

      if (error) throw error;

      const {
        data: { publicUrl },
      } = supabase.storage.from("post-assets").getPublicUrl(filePath);

      set("thumbnailUrl", publicUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : "알 수 없는 오류";
      alert("썸네일 업로드 실패: " + message);
    } finally {
      setUploadingThumbnail(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-4 rounded border border-dashed border-gray-500 bg-white/70 p-6"
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold">유형 *</span>
          <select
            value={form.category}
            onChange={(event) => set("category", event.target.value as NewsFormState["category"])}
            className="rounded border p-2 focus:border-black focus:outline-none"
          >
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold">상태 *</span>
          <select
            value={form.status}
            onChange={(event) => set("status", event.target.value as NewsFormState["status"])}
            className="rounded border p-2 focus:border-black focus:outline-none"
          >
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
      </div>

      <TextInput label="제목 *" value={form.title} onChange={(value) => set("title", value)} required />

      <label className="flex flex-col gap-1">
        <span className="text-sm font-semibold">요약 *</span>
        <textarea
          value={form.summary}
          onChange={(event) => set("summary", event.target.value)}
          rows={3}
          className="rounded border p-2 focus:border-black focus:outline-none"
          required
        />
      </label>

      <div className="flex flex-col gap-1">
        <span className="text-sm">내용</span>
        <CommunityEditor
          content={form.body}
          onChange={(content) => set("body", content)}
          userId={authUser?.id ?? ""}
          allowMedia={true}
          placeholder="내용을 작성해 주세요."
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2 md:col-span-2">
          <span className="text-sm font-semibold">썸네일</span>
          <div className="flex flex-col gap-3 rounded border border-dashed border-gray-400 bg-white p-3 sm:flex-row">
            <div className="flex aspect-[16/9] w-full items-center justify-center overflow-hidden rounded border border-gray-200 bg-gray-100 sm:w-56">
              {form.thumbnailUrl ? (
                <img src={form.thumbnailUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <ImageIcon className="text-gray-400" size={32} />
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => void handleThumbnailUpload(event.target.files)}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingThumbnail}
                  className="inline-flex items-center gap-1 rounded border border-gray-300 bg-gray-100 px-3 py-2 text-sm hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {uploadingThumbnail ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                  업로드
                </button>
                {form.thumbnailUrl && (
                  <button
                    type="button"
                    onClick={() => set("thumbnailUrl", "")}
                    className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-100"
                  >
                    <X size={16} />
                    제거
                  </button>
                )}
              </div>
              <p className="truncate text-xs text-gray-500">
                {form.thumbnailUrl || "뉴스 목록과 상세 상단에 표시됩니다."}
              </p>
            </div>
          </div>
        </div>
        <TextInput label="태그 (쉼표 구분)" value={form.tags} onChange={(value) => set("tags", value)} />
        <TextInput
          label="발행 시각"
          type="datetime-local"
          value={form.publishedAt}
          onChange={(value) => set("publishedAt", value)}
        />
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          className="rounded bg-black px-4 py-2 text-white transition-opacity hover:opacity-80"
        >
          {submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-gray-300 bg-gray-100 px-4 py-2 transition-colors hover:bg-gray-200"
        >
          취소
        </button>
      </div>
    </form>
  );
}

function TextInput({
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-semibold">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded border p-2 focus:border-black focus:outline-none"
        required={required}
      />
    </label>
  );
}

export function csvToArray(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function arrayToCsv(value: string[] | null | undefined) {
  return (value ?? []).join(", ");
}

export function emptyEditorBody() {
  return JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] });
}

export function parseEditorBody(value: string) {
  if (!value.trim()) return JSON.parse(emptyEditorBody());
  try {
    return JSON.parse(value);
  } catch {
    return {
      type: "doc",
      content: value
        .split(/\n{2,}|\n/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean)
        .map((paragraph) => ({
          type: "paragraph",
          content: [{ type: "text", text: paragraph }],
        })),
    };
  }
}

export function stringifyEditorBody(value: unknown) {
  if (!value) return emptyEditorBody();
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

export function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function datetimeLocalToIso(value: string) {
  return value ? new Date(value).toISOString() : null;
}

export function isoToDatetimeLocal(value: string | null | undefined) {
  if (!value) return "";
  const d = new Date(value);
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}
