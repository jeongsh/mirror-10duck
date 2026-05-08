"use client";

import type { OtakuCategory } from "@/lib/otaku/hub";

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
  episodeCount: string;
  lastCheckedAt: string;
};

export const emptyReleaseForm: ReleaseFormState = {
  category: "anime",
  status: "DRAFT",
  title: "",
  originalTitle: "",
  synopsis: "",
  posterUrl: "",
  bannerUrl: "",
  genres: "",
  studios: "",
  season: "",
  episodeCount: "",
  lastCheckedAt: "",
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
  const set = <K extends keyof ReleaseFormState>(key: K, value: ReleaseFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
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
          label="마지막 확인"
          type="datetime-local"
          value={form.lastCheckedAt}
          onChange={(value) => set("lastCheckedAt", value)}
        />
      </div>

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
        <TextInput label="포스터 URL" value={form.posterUrl} onChange={(value) => set("posterUrl", value)} />
        <TextInput label="배너 URL" value={form.bannerUrl} onChange={(value) => set("bannerUrl", value)} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TextInput label="장르 (쉼표 구분)" value={form.genres} onChange={(value) => set("genres", value)} />
        <TextInput label="제작사 (쉼표 구분)" value={form.studios} onChange={(value) => set("studios", value)} />
        <TextInput label="분기" value={form.season} onChange={(value) => set("season", value)} />
        <TextInput label="화수" value={form.episodeCount} onChange={(value) => set("episodeCount", value)} />
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

export function numberOrNull(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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
