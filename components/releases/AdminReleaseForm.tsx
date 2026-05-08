"use client";

import { useRef, useState } from "react";
import { ImageIcon, Loader2, Search, Upload, X } from "lucide-react";
import type { OtakuCategory } from "@/lib/otaku/hub";
import { supabase } from "@/lib/supabase/client";

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
  details: string;
  releaseDate: string;
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
  episodeCount: "",
  details: "",
  releaseDate: "",
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
  const [anilistQuery, setAnilistQuery] = useState("");
  const [anilistLoading, setAnilistLoading] = useState(false);
  const [anilistResults, setAnilistResults] = useState<AniListMedia[]>([]);
  const [selectedAniListId, setSelectedAniListId] = useState<number | null>(null);
  const [showAniListResults, setShowAniListResults] = useState(true);
  const [uploadingAsset, setUploadingAsset] = useState<"posterUrl" | "bannerUrl" | null>(null);

  const set = <K extends keyof ReleaseFormState>(key: K, value: ReleaseFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const searchAnilist = async () => {
    const search = anilistQuery.trim() || form.title.trim() || form.originalTitle.trim();
    if (!search) {
      alert("AniList에서 찾을 제목을 입력해 주세요.");
      return;
    }

    setAnilistLoading(true);
    setAnilistResults([]);
    setSelectedAniListId(null);
    setShowAniListResults(true);
    try {
      const results = await searchAnilistMedia(search, form.category === "manga" ? "MANGA" : "ANIME");
      if (results.length === 0) {
        alert("AniList에서 작품을 찾지 못했습니다.");
        return;
      }
      setAnilistResults(results);
    } catch (error) {
      const message = error instanceof Error ? error.message : "알 수 없는 오류";
      alert("AniList 검색 실패: " + message);
    } finally {
      setAnilistLoading(false);
    }
  };

  const applyAnilistMedia = (data: AniListMedia) => {
    setSelectedAniListId(data.id);
    setShowAniListResults(false);
    setForm((prev) => ({
      ...prev,
      category: data.type === "MANGA" ? "manga" : "anime",
      title: pickKoreanTitle(data) || data.title.userPreferred || data.title.romaji || data.title.english || prev.title,
      originalTitle: data.title.native || data.title.romaji || prev.originalTitle,
      synopsis: htmlToText(data.description) || prev.synopsis,
      posterUrl: data.coverImage?.extraLarge || data.coverImage?.large || prev.posterUrl,
      bannerUrl: data.bannerImage || prev.bannerUrl,
      genres: data.genres?.map(toKoreanGenre).join(", ") ?? prev.genres,
      studios:
        data.studios?.nodes
          ?.map((studio) => studio.name)
          .filter(Boolean)
          .join(", ") || prev.studios,
      season: formatAniListSeason(data.seasonYear, data.season) || prev.season,
      episodeCount:
        data.type === "MANGA"
          ? data.chapters?.toString() ?? prev.episodeCount
          : data.episodes?.toString() ?? prev.episodeCount,
      details: formatDetailsForTextarea(buildAniListDetails(data)) || prev.details,
      releaseDate: formatAniListStartDate(data.startDate) || prev.releaseDate,
    }));
  };

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
      <section className="rounded border border-dashed border-gray-400 bg-white p-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-sm font-semibold">AniList 검색</span>
            <input
              value={anilistQuery}
              onChange={(event) => setAnilistQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void searchAnilist();
                }
              }}
              placeholder="제목 또는 원제"
              className="rounded border p-2 focus:border-black focus:outline-none"
            />
          </label>
          <button
            type="button"
            onClick={() => void searchAnilist()}
            disabled={anilistLoading}
            className="inline-flex items-center justify-center gap-1 rounded border border-gray-300 bg-gray-100 px-4 py-2 text-sm hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-60 sm:mt-6"
          >
            {anilistLoading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            검색
          </button>
        </div>

        {anilistResults.length > 0 && (
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs text-gray-500">
                {selectedAniListId
                  ? `선택됨: #${selectedAniListId}`
                  : `${anilistResults.length}개 결과`}
              </p>
              <button
                type="button"
                onClick={() => setShowAniListResults((value) => !value)}
                className="rounded border border-gray-300 bg-gray-100 px-2 py-1 text-xs hover:bg-gray-200"
              >
                {showAniListResults ? "접기" : "결과 다시 열기"}
              </button>
            </div>

            {showAniListResults && (
              <ul className="max-h-[420px] overflow-y-auto divide-y divide-dashed divide-gray-300 border border-dashed border-gray-300">
                {anilistResults.map((result) => (
                  <li key={result.id}>
                    <button
                      type="button"
                      onClick={() => applyAnilistMedia(result)}
                      className={`grid w-full grid-cols-[64px_1fr] gap-3 p-3 text-left hover:bg-gray-100 ${
                        selectedAniListId === result.id ? "bg-green-50" : "bg-white"
                      }`}
                    >
                      <div className="aspect-[3/4] overflow-hidden border border-dashed border-gray-300 bg-gray-100">
                        {result.coverImage?.large || result.coverImage?.extraLarge ? (
                          <img
                            src={result.coverImage.large || result.coverImage.extraLarge || ""}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <ImageIcon className="m-auto mt-8 text-gray-400" size={24} />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
                          <span>{result.type}</span>
                          <span>{formatAniListSeason(result.seasonYear, result.season) || "분기 미정"}</span>
                          <span>{result.format ?? "형식 미정"}</span>
                          <span>#{result.id}</span>
                        </div>
                        <div className="mt-1 font-bold text-gray-900">
                          {pickKoreanTitle(result) ||
                            result.title.userPreferred ||
                            result.title.romaji ||
                            result.title.english ||
                            result.title.native ||
                            "Untitled"}
                        </div>
                        <div className="mt-0.5 truncate text-xs text-gray-500">
                          {result.title.native || result.title.romaji || "원제 없음"}
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-gray-600">
                          {htmlToText(result.description) || "소개 없음"}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

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

type AniListMediaType = "ANIME" | "MANGA";

type AniListMedia = {
  id: number;
  type: AniListMediaType;
  format: string | null;
  title: {
    romaji: string | null;
    english: string | null;
    native: string | null;
    userPreferred: string | null;
  };
  description: string | null;
  coverImage: {
    extraLarge: string | null;
    large: string | null;
  } | null;
  bannerImage: string | null;
  genres: string[] | null;
  synonyms: string[] | null;
  source: string | null;
  studios: {
    nodes: Array<{ name: string | null }> | null;
  } | null;
  staff: {
    edges: Array<{
      role: string | null;
      node: {
        name: {
          userPreferred: string | null;
          native: string | null;
        };
      } | null;
    }> | null;
  } | null;
  season: "WINTER" | "SPRING" | "SUMMER" | "FALL" | null;
  seasonYear: number | null;
  episodes: number | null;
  chapters: number | null;
  startDate: {
    year: number | null;
    month: number | null;
    day: number | null;
  } | null;
};

async function searchAnilistMedia(search: string, type: AniListMediaType) {
  const query = `
    query ReleaseSearch($search: String!, $type: MediaType!) {
      Page(page: 1, perPage: 8) {
        media(search: $search, type: $type, sort: SEARCH_MATCH) {
          id
          type
          format
          title {
            romaji
            english
            native
            userPreferred
          }
          description(asHtml: false)
          coverImage {
            extraLarge
            large
          }
          bannerImage
          genres
          synonyms
          source
          studios(isMain: true) {
            nodes {
              name
            }
          }
          staff(perPage: 35, sort: RELEVANCE) {
            edges {
              role
              node {
                name {
                  userPreferred
                  native
                }
              }
            }
          }
          season
          seasonYear
          episodes
          chapters
          startDate {
            year
            month
            day
          }
        }
      }
    }
  `;

  const response = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ query, variables: { search, type } }),
  });

  if (!response.ok) {
    throw new Error(`AniList 응답 오류 (${response.status})`);
  }

  const payload = (await response.json()) as {
    data?: { Page?: { media?: AniListMedia[] | null } | null };
    errors?: Array<{ message?: string }>;
  };

  if (payload.errors?.length) {
    throw new Error(payload.errors[0]?.message ?? "AniList GraphQL 오류");
  }

  return payload.data?.Page?.media ?? [];
}

function htmlToText(value: string | null | undefined) {
  if (!value) return "";
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function formatAniListSeason(year: number | null, season: AniListMedia["season"]) {
  if (!year && !season) return "";
  const label: Record<NonNullable<AniListMedia["season"]>, string> = {
    WINTER: "겨울",
    SPRING: "봄",
    SUMMER: "여름",
    FALL: "가을",
  };
  return [year, season ? label[season] : null].filter(Boolean).join(" ");
}

function hasHangul(value: string | null | undefined) {
  return Boolean(value && /[가-힣]/.test(value));
}

function formatAniListStartDate(value: AniListMedia["startDate"]) {
  if (!value?.year || !value.month || !value.day) return "";
  return `${value.year}-${String(value.month).padStart(2, "0")}-${String(value.day).padStart(2, "0")}`;
}

function pickKoreanTitle(media: AniListMedia) {
  const candidates = [
    media.title.userPreferred,
    media.title.english,
    media.title.romaji,
    media.title.native,
    ...(media.synonyms ?? []),
  ];
  return candidates.find(hasHangul) ?? "";
}

function toKoreanGenre(value: string) {
  const map: Record<string, string> = {
    Action: "액션",
    Adventure: "모험",
    Comedy: "코미디",
    Drama: "드라마",
    Ecchi: "에치",
    Fantasy: "판타지",
    Horror: "호러",
    Mahou: "마법소녀",
    "Mahou Shoujo": "마법소녀",
    Mecha: "메카",
    Music: "음악",
    Mystery: "미스터리",
    Psychological: "심리",
    Romance: "로맨스",
    "Sci-Fi": "SF",
    "Slice of Life": "일상",
    Sports: "스포츠",
    Supernatural: "초자연",
    Thriller: "스릴러",
  };
  return map[value] ?? value;
}

function buildAniListDetails(media: AniListMedia): ReleaseDetailEntry[] {
  const entries: ReleaseDetailEntry[] = [];
  const source = toKoreanSource(media.source);
  if (source) entries.push({ label: "원작", value: source });

  const roleMap: Array<[string, string]> = [
    ["Original Creator", "원작"],
    ["Original Character Design", "캐릭터 원안"],
    ["Director", "감독"],
    ["Assistant Director", "부감독"],
    ["Chief Director", "총감독"],
    ["Series Composition", "시리즈 구성"],
    ["Script", "각본"],
    ["Character Design", "캐릭터 디자인"],
    ["Chief Animation Director", "총 작화감독"],
    ["Animation Director", "작화감독"],
    ["Art Director", "미술 감독"],
    ["Art Design", "미술 설정"],
    ["Color Design", "색채 설계"],
    ["Photography Director", "촬영 감독"],
    ["CG Director", "CG 감독"],
    ["Sound Director", "음향 감독"],
    ["Music", "음악"],
    ["Mechanical Design", "메카닉 디자인"],
    ["Prop Design", "프롭 디자인"],
  ];

  const byLabel = new Map<string, string[]>();
  for (const edge of media.staff?.edges ?? []) {
    const role = edge.role ?? "";
    const matched = roleMap.find(([keyword]) => role.includes(keyword));
    if (!matched) continue;

    const label = matched[1];
    const name = edge.node?.name.native || edge.node?.name.userPreferred;
    if (!name) continue;

    const list = byLabel.get(label) ?? [];
    if (!list.includes(name)) list.push(name);
    byLabel.set(label, list.slice(0, 6));
  }

  for (const [label, values] of byLabel.entries()) {
    const existing = entries.find((entry) => entry.label === label);
    if (existing) {
      existing.value = Array.from(new Set([existing.value, ...values])).join(", ");
    } else {
      entries.push({ label, value: values.join(", ") });
    }
  }

  if (media.studios?.nodes?.length) {
    const studios = media.studios.nodes.map((studio) => studio.name).filter(Boolean).join(", ");
    if (studios) entries.push({ label: "제작사", value: studios });
  }

  return entries.slice(0, 18);
}

function toKoreanSource(value: string | null) {
  if (!value) return "";
  const map: Record<string, string> = {
    ORIGINAL: "오리지널",
    MANGA: "만화",
    LIGHT_NOVEL: "라이트 노벨",
    VISUAL_NOVEL: "비주얼 노벨",
    VIDEO_GAME: "게임",
    OTHER: "기타",
    NOVEL: "소설",
    DOUJINSHI: "동인지",
    ANIME: "애니메이션",
    WEB_NOVEL: "웹소설",
    LIVE_ACTION: "실사",
    GAME: "게임",
    COMIC: "코믹",
    MULTIMEDIA_PROJECT: "미디어 믹스",
    PICTURE_BOOK: "그림책",
  };
  return map[value] ?? value.replace(/_/g, " ");
}
