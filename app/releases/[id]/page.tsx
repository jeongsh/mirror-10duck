"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Bell, BellRing } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { fetchFollowedReleaseIds, getCurrentUserId, setReleaseFollow } from "@/lib/supabase/releaseFollows";
import {
  CATEGORY_LABELS,
  type OtakuCategory,
  type ReleaseItem,
  formatDateTime,
  getCalendarEvents,
  getReleaseItemById,
} from "@/lib/otaku/hub";
import { ReleaseReviewsPanel } from "@/components/releases/ReleaseReviewsPanel";
import { StarBar } from "@/components/ui/StarBar";

const EMPTY_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='600' viewBox='0 0 800 600'%3E%3Crect width='800' height='600' fill='%23f3f4f6'/%3E%3Ctext x='400' y='300' text-anchor='middle' fill='%239ca3af' font-family='sans-serif' font-size='28'%3ENo Image%3C/text%3E%3C/svg%3E";

export default function ReleaseDetailPage() {
  const params = useParams<{ id: string }>();
  const [item, setItem] = useState<ReleaseItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [followed, setFollowed] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [reviewSummary, setReviewSummary] = useState<{ avg: number; count: number } | null>(null);
  const events = useMemo(
    () => getCalendarEvents().filter((event) => event.contentId === item?.id),
    [item?.id],
  );

  useEffect(() => {
    const fetchRelease = async () => {
      setLoading(true);
      setReviewSummary(null);
      const id = decodeURIComponent(params.id);
      const { data, error } = await supabase
        .from("release_items")
        .select(
          "id, category, title, original_title, synopsis, poster_url, banner_url, genres, studios, season, episode_count, details_json, status, release_date",
        )
        .eq("id", id)
        .single();

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
        console.error("Error fetching release detail:", error);
        const fallback = getReleaseItemById(id);
        setItem(fallback ?? null);
        setFollowed(fallback ? persistedFollowedIds.has(fallback.id) || fallback.isFollowing : false);
        if (fallback) {
          const { data: starRows } = await supabase
            .from("release_item_reviews")
            .select("stars")
            .eq("release_item_id", fallback.id);
          if (starRows && starRows.length > 0) {
            const sum = (starRows as { stars: number }[]).reduce((acc, r) => acc + r.stars, 0);
            setReviewSummary({ avg: sum / starRows.length, count: starRows.length });
          }
        }
      } else if (data) {
        if (data.status !== "PUBLISHED") {
          setItem(null);
          setFollowed(false);
          setReviewSummary(null);
          setLoading(false);
          return;
        }
        const mapped = mapReleaseRow(data as ReleaseRow);
        setItem(mapped);
        setFollowed(persistedFollowedIds.has(mapped.id));

        const { data: starRows } = await supabase
          .from("release_item_reviews")
          .select("stars")
          .eq("release_item_id", mapped.id);
        if (starRows && starRows.length > 0) {
          const sum = (starRows as { stars: number }[]).reduce((acc, r) => acc + r.stars, 0);
          setReviewSummary({ avg: sum / starRows.length, count: starRows.length });
        }
      }

      setLoading(false);
    };

    if (params.id) void fetchRelease();
  }, [params.id]);

  const toggleFollow = async () => {
    if (!item) return;
    if (!userId) {
      alert("로그인 후 일정 알림을 받을 수 있습니다.");
      return;
    }

    const nextEnabled = !followed;
    setFollowed(nextEnabled);

    try {
      await setReleaseFollow(userId, item.id, nextEnabled);
    } catch (error) {
      setFollowed(!nextEnabled);
      const message = error instanceof Error ? error.message : "알 수 없는 오류";
      alert("일정 알림 변경 실패: " + message);
    }
  };

  if (loading) {
    return (
      <main className="border border-dashed border-gray-500 bg-white/80 p-6">
        <p className="text-sm text-gray-500">로딩 중...</p>
      </main>
    );
  }

  if (!item) {
    return (
      <main className="border border-dashed border-gray-500 bg-white/80 p-6">
        <h1 className="text-xl font-bold text-gray-900">신작 정보를 찾을 수 없습니다.</h1>
        <Link href="/season/current" className="mt-4 inline-block text-sm text-gray-600 hover:underline">
          이번 분기 신작으로 돌아가기
        </Link>
      </main>
    );
  }

  return (
    <main className="flex w-full flex-col gap-6">
      <Hero
        item={item}
        followed={followed}
        reviewSummary={reviewSummary}
        onToggleFollow={() => void toggleFollow()}
      />

      <Panel title="소개">
        <p className="text-sm leading-7 text-gray-700 whitespace-pre-wrap">
          {item.synopsis || "소개 정보가 없습니다."}
        </p>
      </Panel>

      <Panel title="상세 정보">
        <InfoTable entries={buildDetailEntries(item)} />

        <div className="mt-5 border-t border-dashed border-gray-300 pt-4">
          <h3 className="mb-3 text-xs font-bold tracking-widest text-gray-600">일정</h3>
          {events.length === 0 ? (
            <p className="text-sm text-gray-500 py-2">등록된 일정이 없습니다.</p>
          ) : (
            <ul className="divide-y divide-dashed divide-gray-300">
              {events.map((event) => (
                <li
                  key={event.id}
                  className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="text-sm font-bold text-gray-900">{event.title}</span>
                  <span className="text-xs text-gray-500">{formatDateTime(event.startsAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Panel>

      <ReleaseReviewsPanel releaseItemId={item.id} releaseDate={item.releaseDate} />
    </main>
  );
}

function Hero({
  item,
  followed,
  reviewSummary,
  onToggleFollow,
}: {
  item: ReleaseItem;
  followed: boolean;
  reviewSummary: { avg: number; count: number } | null;
  onToggleFollow: () => void;
}) {
  return (
    <header className="overflow-hidden border border-dashed border-gray-500 bg-white/75 relative">
      <div className="absolute inset-0 z-0">
        <img
          src={item.bannerUrl}
          alt=""
          className="h-full w-full object-cover opacity-25"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-white/90 via-white/70 to-transparent" />
      </div>
      
      <div className="relative z-10 p-5 sm:p-6 lg:p-8">
        <div className="mb-6">
          <Link href="/season/current" className="inline-flex items-center text-xs font-medium text-gray-600 hover:text-gray-900 hover:underline">
            ← 이번 분기 신작으로 돌아가기
          </Link>
        </div>

        <div className="flex flex-col gap-6 sm:flex-row sm:items-end">
          <div className="w-32 shrink-0 overflow-hidden border border-dashed border-gray-500 bg-gray-200 shadow-sm sm:w-44">
            <div className="aspect-[3/4]">
              <img src={item.posterUrl} alt="" className="h-full w-full object-cover" />
            </div>
          </div>
          
          <div className="flex min-w-0 flex-col pb-1">
            <div className="mb-3 flex flex-wrap gap-2 text-xs text-gray-700">
              <span className="border border-dashed border-gray-500 bg-white/80 px-2 py-1">
                {CATEGORY_LABELS[item.category]}
              </span>
              <span className="border border-dashed border-gray-500 bg-white/80 px-2 py-1">
                {item.season}
              </span>
            </div>
            
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-950 sm:text-4xl">{item.title}</h1>
            {item.originalTitle && <p className="mt-1.5 text-sm text-gray-600">{item.originalTitle}</p>}
            {reviewSummary && reviewSummary.count > 0 && (
              <div className="mt-3">
                <StarBar avg={reviewSummary.avg} count={reviewSummary.count} />
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-1.5">
              {item.genres.map((tag) => (
                <span
                  key={tag}
                  className="bg-white/60 px-2 py-0.5 text-xs text-gray-700 border border-dashed border-gray-400"
                >
                  #{tag}
                </span>
              ))}
            </div>

            <div className="mt-6 flex">
              <button
                type="button"
                onClick={onToggleFollow}
                className={`inline-flex items-center justify-center gap-2 border border-dashed px-5 py-2.5 text-sm font-bold shadow-sm transition-all ${
                  followed
                    ? "border-pink-400 bg-pink-50 text-pink-700 hover:bg-pink-100"
                    : "border-gray-600 bg-white text-gray-800 hover:bg-gray-50"
                }`}
              >
                {followed ? <BellRing size={18} /> : <Bell size={18} />}
                {followed ? "알림 받는 중" : "일정 알림 받기"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="h-full border border-dashed border-gray-500 bg-white/75 p-5">
      <h2 className="mb-4 border-b border-dashed border-gray-300 pb-3 text-sm font-bold tracking-widest text-gray-800">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 border border-dashed border-gray-300 bg-white/50 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
      <dt className="text-xs font-medium text-gray-500">{label}</dt>
      <dd className="text-sm font-medium text-gray-900 text-right">{value}</dd>
    </div>
  );
}

function InfoTable({ entries }: { entries: Array<{ label: string; value: string }> }) {
  return (
    <dl className="overflow-hidden border border-dashed border-gray-400 bg-white/70">
      {entries.map((entry) => (
        <div key={`${entry.label}-${entry.value}`} className="grid grid-cols-[112px_1fr] border-b border-dashed border-gray-300 last:border-b-0">
          <dt className="border-r border-dashed border-gray-300 bg-gray-100 px-3 py-2 text-center text-xs font-bold text-gray-700">
            {entry.label}
          </dt>
          <dd className="min-w-0 whitespace-pre-wrap bg-white px-3 py-2 text-sm font-medium leading-6 text-gray-900">
            {entry.value}
          </dd>
        </div>
      ))}
    </dl>
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
  details_json: unknown | null;
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
    details: parseDetailEntries(row.details_json),
    releaseDate: row.release_date,
    isFollowing: false,
    notifications: {
      sameDay: false,
      thirtyMinutesBefore: false,
      changeNotice: false,
    },
  };
}

function parseDetailEntries(value: unknown): Array<{ label: string; value: string }> {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const item = entry as { label?: unknown; value?: unknown };
      return typeof item.label === "string" && typeof item.value === "string"
        ? { label: item.label, value: item.value }
        : null;
    })
    .filter((entry): entry is { label: string; value: string } => Boolean(entry));
}

function buildDetailEntries(item: ReleaseItem) {
  const entries = [
    ...(item.details ?? []),
    { label: "출시 일자", value: item.releaseDate ?? "미정" },
    { label: "분기", value: item.season || "미정" },
    { label: "화수", value: item.episodeCount ? `${item.episodeCount}화` : "미정" },
    {
      label: "제작사",
      value: item.studios.length > 0 ? item.studios.join(", ") : "미정",
    },
  ];

  const seen = new Set<string>();
  return entries.filter((entry) => {
    if (!entry.value || seen.has(entry.label)) return false;
    seen.add(entry.label);
    return true;
  });
}
