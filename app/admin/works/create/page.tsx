"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import {
  OFFICIAL_CATALOG_STATUS_OPTIONS,
  OFFICIAL_WORK_CATEGORY_OPTIONS,
  normalizeOfficialSlug,
  splitList,
} from "@/lib/official/catalog";
import type {
  OfficialCatalogStatus,
  OfficialWorkCategory,
} from "@/types/official";

export default function CreateOfficialWorkPage() {
  const router = useRouter();
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [originalTitle, setOriginalTitle] = useState("");
  const [aliases, setAliases] = useState("");
  const [category, setCategory] = useState<OfficialWorkCategory>("anime");
  const [genres, setGenres] = useState("");
  const [ageRating, setAgeRating] = useState("");
  const [ottPlatforms, setOttPlatforms] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [season, setSeason] = useState("");
  const [episodeCount, setEpisodeCount] = useState("");
  const [studios, setStudios] = useState("");
  const [director, setDirector] = useState("");
  const [originalAuthor, setOriginalAuthor] = useState("");
  const [anilistId, setAnilistId] = useState("");
  const [synopsis, setSynopsis] = useState("");
  const [status, setStatus] = useState<OfficialCatalogStatus>("DRAFT");
  const [sortOrder, setSortOrder] = useState(0);
  const [saving, setSaving] = useState(false);

  const normalizedSlug = normalizeOfficialSlug(slug || title);

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
        aliases: splitList(aliases),
        category,
        genres: splitList(genres),
        age_rating: ageRating.trim() || null,
        ott_platforms: splitList(ottPlatforms),
        start_date: startDate || null,
        end_date: endDate || null,
        season: season.trim() || null,
        episode_count: episodeCount ? Number(episodeCount) : null,
        studios: splitList(studios),
        director: director.trim() || null,
        original_author: originalAuthor.trim() || null,
        anilist_id: anilistId ? Number(anilistId) : null,
        synopsis: synopsis.trim(),
        cover_image_url: null,
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
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div className="border-b border-dashed border-gray-500 pb-4">
        <h2 className="text-xl font-bold">작품 추가</h2>
        <p className="mt-1 text-sm text-gray-600">
          온보딩과 작품 허브에서 선택할 수 있는 작품 정보를 등록합니다. 이미지는 상세 화면에서 직접 넣으면 됩니다.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-6 rounded border border-dashed border-gray-500 bg-white/70 p-6"
      >
        <section className="grid gap-4 md:grid-cols-2">
          <h3 className="md:col-span-2 text-sm font-bold uppercase tracking-widest text-gray-500">기본</h3>
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
            <span className="text-sm font-semibold">원제</span>
            <input
              value={originalTitle}
              onChange={(event) => setOriginalTitle(event.target.value)}
              className="rounded border p-2 focus:border-black focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold">슬러그 *</span>
            <input
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              placeholder="ex) one-piece"
              className="rounded border p-2 focus:border-black focus:outline-none"
            />
            {normalizedSlug ? (
              <p className="text-xs text-gray-600">미리보기: /works/{normalizedSlug}</p>
            ) : null}
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold">별칭</span>
            <input
              value={aliases}
              onChange={(event) => setAliases(event.target.value)}
              placeholder="쉼표로 구분"
              className="rounded border p-2 focus:border-black focus:outline-none"
            />
          </label>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <h3 className="md:col-span-3 text-sm font-bold uppercase tracking-widest text-gray-500">분류</h3>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold">장르(태그)</span>
            <input
              value={genres}
              onChange={(event) => setGenres(event.target.value)}
              placeholder="액션, 판타지"
              className="rounded border p-2 focus:border-black focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold">연령등급</span>
            <input
              value={ageRating}
              onChange={(event) => setAgeRating(event.target.value)}
              placeholder="15세 이상"
              className="rounded border p-2 focus:border-black focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold">국내 시청 가능 OTT</span>
            <input
              value={ottPlatforms}
              onChange={(event) => setOttPlatforms(event.target.value)}
              placeholder="라프텔, 티빙, 웨이브, 넷플릭스"
              className="rounded border p-2 focus:border-black focus:outline-none"
            />
          </label>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <h3 className="md:col-span-4 text-sm font-bold uppercase tracking-widest text-gray-500">방영정보</h3>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold">시작일</span>
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="rounded border p-2 focus:border-black focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold">종료일</span>
            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className="rounded border p-2 focus:border-black focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold">분기</span>
            <input
              value={season}
              onChange={(event) => setSeason(event.target.value)}
              placeholder="2026 2분기"
              className="rounded border p-2 focus:border-black focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold">화수</span>
            <input
              type="number"
              min={1}
              value={episodeCount}
              onChange={(event) => setEpisodeCount(event.target.value)}
              className="rounded border p-2 focus:border-black focus:outline-none"
            />
          </label>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <h3 className="md:col-span-3 text-sm font-bold uppercase tracking-widest text-gray-500">제작</h3>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold">제작사</span>
            <input
              value={studios}
              onChange={(event) => setStudios(event.target.value)}
              placeholder="쉼표로 구분"
              className="rounded border p-2 focus:border-black focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold">감독</span>
            <input
              value={director}
              onChange={(event) => setDirector(event.target.value)}
              className="rounded border p-2 focus:border-black focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold">원작자</span>
            <input
              value={originalAuthor}
              onChange={(event) => setOriginalAuthor(event.target.value)}
              className="rounded border p-2 focus:border-black focus:outline-none"
            />
          </label>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <h3 className="md:col-span-3 text-sm font-bold uppercase tracking-widest text-gray-500">외부 / 관리</h3>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold">AniList ID</span>
            <input
              type="number"
              value={anilistId}
              onChange={(event) => setAnilistId(event.target.value)}
              className="rounded border p-2 focus:border-black focus:outline-none"
            />
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
            <span className="text-sm font-semibold">우선순위</span>
            <input
              type="number"
              value={sortOrder}
              onChange={(event) => setSortOrder(Number(event.target.value))}
              className="rounded border p-2 focus:border-black focus:outline-none"
            />
          </label>
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
        </section>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold">소개</span>
          <textarea
            value={synopsis}
            onChange={(event) => setSynopsis(event.target.value)}
            rows={4}
            className="rounded border p-2 focus:border-black focus:outline-none"
          />
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
