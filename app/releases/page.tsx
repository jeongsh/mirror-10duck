"use client";

import Link from "next/link";
import { Bell, BellRing } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { fetchFollowedReleaseIds, getCurrentUserId, setReleaseFollow } from "@/lib/supabase/releaseFollows";
import {
  CATEGORY_LABELS,
  PUBLIC_CATEGORIES,
  type OtakuCategory,
  type ReleaseItem,
  filterByCategory,
  getReleaseItems,
} from "@/lib/otaku/hub";

const TABS: OtakuCategory[] = PUBLIC_CATEGORIES;
const EMPTY_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='600' viewBox='0 0 800 600'%3E%3Crect width='800' height='600' fill='%23f3f4f6'/%3E%3Ctext x='400' y='300' text-anchor='middle' fill='%239ca3af' font-family='sans-serif' font-size='28'%3ENo Image%3C/text%3E%3C/svg%3E";

export default function ReleasesPage() {
  const [activeCategory, setActiveCategory] = useState<OtakuCategory>("all");
  const [releases, setReleases] = useState<ReleaseItem[]>([]);
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const visibleReleases = useMemo(
    () => filterByCategory(releases, activeCategory),
    [activeCategory, releases],
  );

  useEffect(() => {
    const fetchReleases = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("release_items")
        .select(
          "id, category, title, original_title, synopsis, poster_url, banner_url, genres, studios, season, episode_count, status, release_date",
        )
        .neq("status", "HIDDEN")
        .order("created_at", { ascending: false });

      const currentUserId = await getCurrentUserId();
      setUserId(currentUserId);

      let persistedFollowedIds = new Set<string>();
      if (currentUserId) {
        try {
          persistedFollowedIds = await fetchFollowedReleaseIds(currentUserId);
        } catch (followError) {
          console.error("Error fetching release follows:", followError);
        }
      }

      if (error) {
        console.error("Error fetching releases:", error);
        const fallback = getReleaseItems();
        setReleases(fallback);
        setFollowedIds(persistedFollowedIds.size > 0 ? persistedFollowedIds : new Set(fallback.filter((item) => item.isFollowing).map((item) => item.id)));
      } else {
        const mapped = ((data ?? []) as ReleaseRow[]).map(mapReleaseRow);
        setReleases(mapped);
        setFollowedIds(persistedFollowedIds);
      }
      setLoading(false);
    };

    void fetchReleases();
  }, []);

  const toggleFollow = async (id: string) => {
    if (!userId) {
      alert("로그인 후 일정 알림을 받을 수 있습니다.");
      return;
    }

    const nextEnabled = !followedIds.has(id);
    setFollowedIds((current) => {
      const next = new Set(current);
      if (nextEnabled) next.add(id);
      else next.delete(id);
      return next;
    });

    try {
      await setReleaseFollow(userId, id, nextEnabled);
    } catch (error) {
      setFollowedIds((current) => {
        const next = new Set(current);
        if (nextEnabled) next.delete(id);
        else next.add(id);
        return next;
      });
      const message = error instanceof Error ? error.message : "알 수 없는 오류";
      alert("일정 알림 변경 실패: " + message);
    }
  };

  return (
    <main className="flex w-full flex-col gap-4">
      <header className="border border-dashed border-gray-500 bg-white/80 p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.2em] text-gray-500 uppercase">
              Thin release cards
            </p>
            <h1 className="mt-1 text-2xl font-bold text-gray-900">신작/일정</h1>
            <p className="mt-1 text-sm text-gray-600">
              신작 기본 정보와 방영/연재 알림을 연결합니다.
            </p>
          </div>
          <Link
            href="/calendar"
            className="inline-flex items-center gap-1 border border-dashed border-gray-500 bg-white px-3 py-2 text-sm hover:bg-gray-100"
          >
            <Bell size={16} />
            캘린더
          </Link>
        </div>
      </header>

      <section className="border border-dashed border-gray-500 bg-white/70 p-3">
        <div className="grid grid-cols-3 gap-2">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveCategory(tab)}
              className={`border border-dashed px-3 py-2 text-sm font-semibold ${
                activeCategory === tab
                  ? "border-gray-800 bg-gray-300 text-gray-950"
                  : "border-gray-500 bg-white text-gray-600 hover:bg-gray-100"
              }`}
            >
              {CATEGORY_LABELS[tab]}
            </button>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        {loading ? (
          <p className="col-span-full border border-dashed border-gray-500 bg-white/70 p-6 text-sm text-gray-500">
            로딩 중...
          </p>
        ) : visibleReleases.length === 0 ? (
          <p className="col-span-full border border-dashed border-gray-500 bg-white/70 p-6 text-sm text-gray-500">
            등록된 신작이 없습니다.
          </p>
        ) : (
          visibleReleases.map((item) => {
            const followed = followedIds.has(item.id);

            return (
              <article
                key={item.id}
                className="group relative flex flex-col overflow-hidden border border-dashed border-gray-500 bg-white/80 transition-colors hover:bg-gray-50"
              >
                <Link href={`/releases/${item.id}`} className="block aspect-[4/3] overflow-hidden bg-gray-100">
                  <img
                    src={item.posterUrl}
                    alt=""
                    className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
                  />
                </Link>
                <button
                  type="button"
                  onClick={() => void toggleFollow(item.id)}
                  className={`absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center border border-dashed shadow-sm ${
                    followed
                      ? "border-pink-400 bg-pink-50 text-pink-700"
                      : "border-gray-500 bg-white/90 text-gray-700 hover:bg-white"
                  }`}
                  title={followed ? "알림 해제" : "알림 받기"}
                  aria-label={followed ? "알림 해제" : "알림 받기"}
                >
                  {followed ? <BellRing size={15} /> : <Bell size={15} />}
                </button>
                <Link href={`/releases/${item.id}`} className="flex flex-1 flex-col gap-1 p-2">
                  <div className="flex items-center justify-between gap-1">
                    <span className="border border-dashed border-gray-400 bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold text-gray-700">
                      {CATEGORY_LABELS[item.category]}
                    </span>
                  </div>

                  <div>
                    <h2 className="text-sm font-bold text-gray-950 group-hover:underline line-clamp-2">
                      {item.title}
                    </h2>
                  </div>
                </Link>
              </article>
            );
          })
        )}
      </section>
    </main>
  );
}

type ReleaseRow = {
  id: string;
  category: "ANIME" | "MANGA" | "GAME";
  title: string;
  original_title: string | null;
  synopsis: string;
  poster_url: string | null;
  banner_url: string | null;
  genres: string[] | null;
  studios: string[] | null;
  season: string | null;
  episode_count: number | null;
  status: "DRAFT" | "PUBLISHED" | "HIDDEN";
  release_date: string | null;
};

function mapReleaseRow(row: ReleaseRow): ReleaseItem {
  return {
    id: row.id,
    category: row.category.toLowerCase() as Exclude<OtakuCategory, "all">,
    title: row.title,
    originalTitle: row.original_title ?? "",
    synopsis: row.synopsis,
    posterUrl: row.poster_url || EMPTY_IMAGE,
    bannerUrl: row.banner_url || row.poster_url || EMPTY_IMAGE,
    genres: row.genres ?? [],
    studios: row.studios ?? [],
    season: row.season ?? "미정",
    episodeCount: row.episode_count,
    releaseDate: row.release_date,
    isFollowing: false,
    notifications: {
      sameDay: false,
      thirtyMinutesBefore: false,
      changeNotice: false,
    },
  };
}
