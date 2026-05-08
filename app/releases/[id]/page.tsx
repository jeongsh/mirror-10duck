"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Bell, BellRing } from "lucide-react";
import { useMemo, useState } from "react";
import {
  CATEGORY_LABELS,
  type ReleaseItem,
  formatDateTime,
  getCalendarEvents,
  getReleaseItemById,
} from "@/lib/otaku/hub";

export default function ReleaseDetailPage() {
  const params = useParams<{ id: string }>();
  const item = getReleaseItemById(decodeURIComponent(params.id));
  const initialFollowed = item?.isFollowing ?? false;
  const [followed, setFollowed] = useState(initialFollowed);
  const events = useMemo(
    () => getCalendarEvents().filter((event) => event.contentId === item?.id),
    [item?.id],
  );

  if (!item) {
    return (
      <main className="border border-dashed border-gray-500 bg-white/80 p-6">
        <h1 className="text-xl font-bold text-gray-900">신작 정보를 찾을 수 없습니다.</h1>
        <Link href="/releases" className="mt-4 inline-block text-sm text-gray-600 hover:underline">
          신작 목록으로 돌아가기
        </Link>
      </main>
    );
  }

  return (
    <main className="flex w-full flex-col gap-6">
      <Hero item={item} followed={followed} onToggleFollow={() => setFollowed((v) => !v)} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Panel title="소개">
            <p className="text-sm leading-7 text-gray-700 whitespace-pre-wrap">{item.synopsis || "소개 정보가 없습니다."}</p>
          </Panel>

          <Panel title="일정">
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
          </Panel>
        </div>

        <div className="flex flex-col gap-6 lg:col-span-1">
          <Panel title="상세 정보">
            <dl className="flex flex-col gap-2">
              <Info label="화수" value={item.episodeCount ? `${item.episodeCount}화` : "미정"} />
              <Info label="제작사" value={item.studios.length > 0 ? item.studios.join(", ") : "미정"} />
              <Info label="마지막 확인" value={formatDateTime(item.lastCheckedAt)} />
            </dl>
          </Panel>
        </div>
      </div>
    </main>
  );
}

function Hero({
  item,
  followed,
  onToggleFollow,
}: {
  item: ReleaseItem;
  followed: boolean;
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
          <Link href="/releases" className="inline-flex items-center text-xs font-medium text-gray-600 hover:text-gray-900 hover:underline">
            ← 신작/일정으로 돌아가기
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
