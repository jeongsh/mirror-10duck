"use client";

import Link from "next/link";
import { Bell, BellRing } from "lucide-react";
import { useMemo, useState } from "react";
import {
  CATEGORY_LABELS,
  PUBLIC_CATEGORIES,
  type OtakuCategory,
  filterByCategory,
  formatDateTime,
  getCalendarEvents,
  getReleaseItems,
} from "@/lib/otaku/hub";

const TABS: OtakuCategory[] = PUBLIC_CATEGORIES;

export default function ReleasesPage() {
  const [activeCategory, setActiveCategory] = useState<OtakuCategory>("all");
  const [followedIds, setFollowedIds] = useState<Set<string>>(
    () => new Set(getReleaseItems().filter((item) => item.isFollowing).map((item) => item.id)),
  );

  const releases = useMemo(() => getReleaseItems(), []);
  const events = useMemo(() => getCalendarEvents(), []);
  const visibleReleases = useMemo(
    () => filterByCategory(releases, activeCategory),
    [activeCategory, releases],
  );

  const toggleFollow = (id: string) => {
    setFollowedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {visibleReleases.map((item) => {
          const itemEvents = events.filter((event) => event.contentId === item.id);
          const followed = followedIds.has(item.id);

          return (
            <article
              key={item.id}
              className="group relative flex min-h-full flex-col overflow-hidden border border-dashed border-gray-500 bg-white/80 transition-colors hover:bg-gray-50"
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
                onClick={() => toggleFollow(item.id)}
                className={`absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center border border-dashed shadow-sm ${
                  followed
                    ? "border-pink-400 bg-pink-50 text-pink-700"
                    : "border-gray-500 bg-white/90 text-gray-700 hover:bg-white"
                }`}
                title={followed ? "알림 해제" : "알림 받기"}
                aria-label={followed ? "알림 해제" : "알림 받기"}
              >
                {followed ? <BellRing size={17} /> : <Bell size={17} />}
              </button>
              <Link href={`/releases/${item.id}`} className="flex flex-1 flex-col gap-3 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="border border-dashed border-gray-400 bg-gray-100 px-2 py-0.5 text-[11px] font-bold text-gray-700">
                    {CATEGORY_LABELS[item.category]}
                  </span>
                  <span className="text-[10px] text-gray-500">
                    확인 {formatDateTime(item.lastCheckedAt)}
                  </span>
                </div>

                <div>
                  <h2 className="text-lg font-bold text-gray-950 group-hover:underline">
                    {item.title}
                  </h2>
                  <p className="mt-1 line-clamp-2 text-sm leading-6 text-gray-600">
                    {item.synopsis}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {item.genres.map((tag) => (
                      <span
                        key={tag}
                        className="border border-dashed border-gray-300 bg-white px-2 py-1 text-[11px] text-gray-500"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="border border-dashed border-gray-300 bg-gray-50 p-2">
                  <div className="mb-1 text-[11px] font-bold text-gray-500">신작 정보</div>
                  <dl className="grid grid-cols-[56px_1fr] gap-x-2 gap-y-1 text-xs text-gray-700">
                    <dt className="text-gray-500">분기</dt>
                    <dd>{item.season}</dd>
                    <dt className="text-gray-500">제작</dt>
                    <dd className="truncate">{item.studios.join(", ")}</dd>
                    <dt className="text-gray-500">화수</dt>
                    <dd>{item.episodeCount ? `${item.episodeCount}화` : "미정"}</dd>
                  </dl>
                </div>

                <div className="border border-dashed border-gray-300 bg-gray-50 p-2">
                  <div className="mb-1 text-[11px] font-bold text-gray-500">예정 일정</div>
                  {itemEvents.length > 0 ? (
                    <ul className="space-y-1 text-xs text-gray-700">
                      {itemEvents.map((event) => (
                        <li key={event.id} className="flex justify-between gap-2">
                          <span className="truncate">{event.title}</span>
                          <span className="shrink-0 text-gray-500">
                            {formatDateTime(event.startsAt)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-gray-500">등록된 일정이 없습니다.</p>
                  )}
                </div>
              </Link>
            </article>
          );
        })}
      </section>
    </main>
  );
}
