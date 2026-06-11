"use client";

import { useEffect, useRef, useState } from "react";
import { ImageIcon, Loader2, Upload, X } from "lucide-react";
import type { OtakuCategory } from "@/lib/otaku/hub";
import { supabase } from "@/lib/supabase/client";
import type { OfficialWork } from "@/types/official";

const categories: Exclude<OtakuCategory, "all" | "game">[] = ["anime", "manga"];
const statuses = ["DRAFT", "PUBLISHED", "HIDDEN"] as const;

export type ReleaseFormState = {
  category: Exclude<OtakuCategory, "all" | "game">;
  status: (typeof statuses)[number];
  title: string;
  originalTitle: string;
  synopsis: string;
  posterUrl: string;
  bannerUrl: string;
  genres: string;
  studios: string;
  season: string;
  cours: string;
  episodeCount: string;
  details: string;
  releaseDate: string;
  officialWorkId: string;
  createOfficialWork: boolean;
};

export const emptyReleaseForm: ReleaseFormState = {
  category: "anime",
  status: "PUBLISHED",
  title: "",
  originalTitle: "",
  synopsis: "",
  posterUrl: "",
  bannerUrl: "",
  genres: "",
  studios: "",
  season: "",
  cours: "",
  episodeCount: "",
  details: "",
  releaseDate: "",
  officialWorkId: "",
  createOfficialWork: true,
};

export function ReleaseForm({
  form,
  setForm,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  form: ReleaseFormState;
  setForm: React.Dispatch<React.SetStateAction<ReleaseFormState>>;
  submitLabel: string;
  onSubmit: (event: React.FormEvent) => void;
  onCancel: () => void;
}) {
  const posterInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAsset, setUploadingAsset] = useState<"posterUrl" | "bannerUrl" | null>(null);
  const [officialWorks, setOfficialWorks] = useState<OfficialWork[]>([]);

  const set = <K extends keyof ReleaseFormState>(key: K, value: ReleaseFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const applyOfficialWork = (workId: string) => {
    const selected = officialWorks.find((work) => work.id === workId);
    setForm((prev) => {
      if (!selected) {
        return { ...prev, officialWorkId: "", createOfficialWork: true };
      }
      return {
        ...prev,
        officialWorkId: selected.id,
        createOfficialWork: false,
        category:
          selected.category === "manga"
            ? "manga"
            : "anime",
        title: prev.title.trim() ? prev.title : selected.title,
        originalTitle: prev.originalTitle.trim()
          ? prev.originalTitle
          : selected.original_title ?? "",
        synopsis: prev.synopsis.trim() ? prev.synopsis : selected.synopsis ?? "",
        posterUrl: prev.posterUrl.trim()
          ? prev.posterUrl
          : selected.cover_image_url ?? "",
      };
    });
  };

  useEffect(() => {
    const fetchOfficialWorks = async () => {
      const { data, error } = await supabase
        .from("official_works")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("title", { ascending: true });

      if (!error) setOfficialWorks((data ?? []) as OfficialWork[]);
    };

    void fetchOfficialWorks();
  }, []);

  const uploadImageAsset = async (key: "posterUrl" | "bannerUrl", files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("이미지 파일만 업로드할 수 있습니다.");
      return;
    }

    setUploadingAsset(key);
    try {
      const userId = (await supabase.auth.getUser()).data.user?.id ?? "admin";
      const fileExt = file.name.split(".").pop() || "jpg";
      const filePath = `release-assets/${userId}/${key}-${crypto.randomUUID()}.${fileExt}`;
      const { error } = await supabase.storage.from("post-assets").upload(filePath, file);

      if (error) throw error;

      const {
        data: { publicUrl },
      } = supabase.storage.from("post-assets").getPublicUrl(filePath);

      set(key, publicUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : "알 수 없는 오류";
      alert("이미지 업로드 실패: " + message);
    } finally {
      setUploadingAsset(null);
      if (key === "posterUrl" && posterInputRef.current) posterInputRef.current.value = "";
      if (key === "bannerUrl" && bannerInputRef.current) bannerInputRef.current.value = "";
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-4 rounded border border-dashed border-gray-500 bg-white/70 p-6"
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold">유형 *</span>
          <select
            value={form.category}
            onChange={(event) => set("category", event.target.value as ReleaseFormState["category"])}
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
            onChange={(event) => set("status", event.target.value as ReleaseFormState["status"])}
            className="rounded border p-2 focus:border-black focus:outline-none"
          >
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <TextInput
          label="출시 일자"
          type="date"
          value={form.releaseDate}
          onChange={(value) => set("releaseDate", value)}
        />
      </div>

      <section className="rounded border border-dashed border-blue-300 bg-blue-50/50 p-4">
        <div className="mb-3">
          <h3 className="text-sm font-bold text-blue-900">작품 허브</h3>
          <p className="mt-1 text-xs text-blue-600">
            기존 허브에 연결하거나, 이 신작 정보로 작품 허브를 함께 생성합니다.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold">기존 작품</span>
            <select
              value={form.officialWorkId}
              onChange={(event) => applyOfficialWork(event.target.value)}
              className="rounded border p-2 focus:border-black focus:outline-none"
            >
              <option value="">새 작품으로 함께 등록</option>
              {officialWorks.map((work) => (
                <option key={work.id} value={work.id}>
                  {work.title}
                  {work.status !== "PUBLISHED" ? ` (${work.status})` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 rounded border border-dashed border-blue-300 bg-white px-3 py-2 text-sm font-semibold text-blue-900 md:mt-6">
            <input
              type="checkbox"
              checked={form.createOfficialWork}
              disabled={Boolean(form.officialWorkId)}
              onChange={(event) => set("createOfficialWork", event.target.checked)}
            />
            새 허브 생성
          </label>
        </div>
      </section>

      <TextInput label="제목 *" value={form.title} onChange={(value) => set("title", value)} required />
      <TextInput label="원제" value={form.originalTitle} onChange={(value) => set("originalTitle", value)} />

      <label className="flex flex-col gap-1">
        <span className="text-sm font-semibold">시놉시스 *</span>
        <textarea
          value={form.synopsis}
          onChange={(event) => set("synopsis", event.target.value)}
          rows={5}
          className="rounded border p-2 focus:border-black focus:outline-none"
          required
        />
      </label>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ImageUploadField
          label="포스터"
          value={form.posterUrl}
          inputRef={posterInputRef}
          uploading={uploadingAsset === "posterUrl"}
          aspectClassName="aspect-[2/3]"
          onUpload={(files) => void uploadImageAsset("posterUrl", files)}
          onClear={() => set("posterUrl", "")}
        />
        <ImageUploadField
          label="배너"
          value={form.bannerUrl}
          inputRef={bannerInputRef}
          uploading={uploadingAsset === "bannerUrl"}
          aspectClassName="aspect-[16/7]"
          onUpload={(files) => void uploadImageAsset("bannerUrl", files)}
          onClear={() => set("bannerUrl", "")}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TextInput label="장르 (쉼표 구분)" value={form.genres} onChange={(value) => set("genres", value)} />
        <TextInput label="제작사 (쉼표 구분)" value={form.studios} onChange={(value) => set("studios", value)} />
        <TextInput label="분기" value={form.season} onChange={(value) => set("season", value)} />
        <TextInput label="화수" value={form.episodeCount} onChange={(value) => set("episodeCount", value)} />
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-semibold">상세 정보</span>
        <textarea
          value={form.details}
          onChange={(event) => set("details", event.target.value)}
          rows={8}
          className="rounded border p-2 font-mono text-sm leading-6 focus:border-black focus:outline-none"
          placeholder={"원작: 작가명\n감독: 감독명\n시리즈 구성: 담당자명"}
        />
      </label>

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
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
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
        placeholder={placeholder}
      />
    </label>
  );
}

function ImageUploadField({
  label,
  value,
  inputRef,
  uploading,
  aspectClassName,
  onUpload,
  onClear,
}: {
  label: string;
  value: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  uploading: boolean;
  aspectClassName: string;
  onUpload: (files: FileList | null) => void;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-semibold">{label}</span>
      <div className="rounded border border-dashed border-gray-400 bg-white p-3">
        <div className={`flex w-full items-center justify-center overflow-hidden rounded border border-gray-200 bg-gray-100 ${aspectClassName}`}>
          {value ? (
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImageIcon className="text-gray-400" size={32} />
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => onUpload(event.target.files)}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1 rounded border border-gray-300 bg-gray-100 px-3 py-2 text-sm hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            업로드
          </button>
          {value && (
            <button
              type="button"
              onClick={onClear}
              className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-100"
            >
              <X size={16} />
              제거
            </button>
          )}
        </div>
        <p className="mt-2 truncate text-xs text-gray-500">{value || `${label} 이미지를 업로드해 주세요.`}</p>
      </div>
    </div>
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

export function numberOrNull(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export type ReleaseDetailEntry = {
  label: string;
  value: string;
};

export function parseDetails(value: string): ReleaseDetailEntry[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const separatorIndex = line.search(/[:：]/);
      if (separatorIndex === -1) return null;
      const label = line.slice(0, separatorIndex).trim();
      const itemValue = line.slice(separatorIndex + 1).trim();
      return label && itemValue ? { label, value: itemValue } : null;
    })
    .filter((entry): entry is ReleaseDetailEntry => Boolean(entry));
}

export function formatDetailsForTextarea(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return "";
      const item = entry as Partial<ReleaseDetailEntry>;
      return item.label && item.value ? `${item.label}: ${item.value}` : "";
    })
    .filter(Boolean)
    .join("\n");
}
