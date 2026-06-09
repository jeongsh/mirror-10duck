"use client";

import Link from "next/link";
import { CalendarDays, Heart, ImageIcon, MapPin, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import {
  EVENT_TYPE_LABELS,
  formatEventPeriod,
  getCalendarEventCategory,
  type CalendarEvent,
  type CalendarEventType,
} from "@/lib/otaku/hub";

export type EventSectionKind = "release";

type ReleaseEventRow = {
  id: string;
  event_type: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  timezone: string;
  platform: string | null;
  location: string | null;
  source_url: string | null;
  image_url: string | null;
  release_item_id: string | null;
  release_items?: {
    category?: string | null;
    title?: string | null;
    poster_url?: string | null;
  } | null;
};

const RELEASE_EVENT_TYPES: CalendarEventType[] = [
  "goods_preorder",
  "goods_release",
  "offline_event",
  "ticket_event",
  "live_event",
];

const EVENT_TYPES_BY_KIND: Record<EventSectionKind, CalendarEventType[]> = {
  release: RELEASE_EVENT_TYPES,
};

const PAGE_META: Record<
  EventSectionKind,
  { title: string; eyebrow: string; description: string; empty: string; detailBase: string }
> = {
  release: {
    title: "이벤트",
    eyebrow: "Events",
    description: "공식 발매, 예약, 티켓 오픈, 팝업, 라이브 일정을 모아서 봅니다.",
    empty: "선택한 날짜 범위에 공개된 이벤트가 없습니다.",
    detailBase: "/events",
  },
};

export default function EventGalleryPage({ kind }: { kind: EventSectionKind }) {
  const meta = PAGE_META[kind];
  const eventTypes = EVENT_TYPES_BY_KIND[kind];
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("release_events")
        .select(`
          id,
          event_type,
          title,
          description,
          starts_at,
          ends_at,
          timezone,
          platform,
          location,
          source_url,
          image_url,
          release_item_id,
          release_items (
            category,
            title,
            poster_url
          )
        `)
        .eq("status", "PUBLISHED")
        .in("event_type", eventTypes.map((type) => type.toUpperCase()))
        .order("starts_at", { ascending: true });

      if (cancelled) return;
      if (error) {
        console.error(`[${kind}] failed to load events:`, error);
        setEvents([]);
      } else {
        setEvents(((data ?? []) as ReleaseEventRow[]).map(mapReleaseEvent));
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [eventTypes, kind]);

  const visibleEvents = useMemo(() => {
    const startMs = startDate ? new Date(`${startDate}T00:00:00+09:00`).getTime() : -Infinity;
    const endMs = endDate ? new Date(`${endDate}T23:59:59+09:00`).getTime() : Infinity;
    return events.filter((event) => {
      const eventStartMs = Date.parse(event.startsAt);
      const eventEndMs = event.endsAt ? Date.parse(event.endsAt) : eventStartMs;
      return eventEndMs >= startMs && eventStartMs <= endMs;
    });
  }, [endDate, events, startDate]);

  const resetDateRange = () => {
    setStartDate("");
    setEndDate("");
  };

  return (
    <main className="flex w-full flex-col gap-4">
      <header className="border border-dashed border-gray-500 bg-white/80 p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-500">
              {meta.eyebrow}
            </p>
            <h1 className="mt-1 text-2xl font-bold text-gray-900">{meta.title}</h1>
            <p className="mt-1 text-sm text-gray-600">{meta.description}</p>
          </div>
          <Link
            href="/calendar"
            className="inline-flex items-center gap-1 border border-dashed border-gray-500 bg-white px-3 py-2 text-sm hover:bg-gray-100"
          >
            <CalendarDays size={16} />
            캘린더
          </Link>
        </div>
      </header>

      <section className="border border-dashed border-gray-500 bg-white/70 p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1 text-xs font-semibold text-gray-600">
              시작
              <input
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                type="date"
                className="h-9 border border-dashed border-gray-400 bg-white px-2 text-sm font-normal text-gray-900"
              />
            </label>
            <label className="flex items-center gap-1 text-xs font-semibold text-gray-600">
              종료
              <input
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                type="date"
                className="h-9 border border-dashed border-gray-400 bg-white px-2 text-sm font-normal text-gray-900"
              />
            </label>
            <button
              type="button"
              onClick={resetDateRange}
              className="inline-flex h-9 items-center gap-1 border border-dashed border-gray-400 bg-white px-2 text-xs font-semibold text-gray-600 hover:bg-gray-100"
            >
              <RotateCcw size={13} />
              초기화
            </button>
          </div>
          <p className="text-xs font-semibold text-gray-500">
            {visibleEvents.length}개 일정
          </p>
        </div>
      </section>

      <section className="min-h-[320px]">
        {loading ? (
          <div className="border border-dashed border-gray-400 bg-white/70 p-6 text-sm text-gray-500">
            일정 불러오는 중...
          </div>
        ) : null}
        {!loading && visibleEvents.length === 0 ? (
          <div className="border border-dashed border-gray-400 bg-white/70 p-6 text-sm text-gray-500">
            {startDate || endDate ? meta.empty : "공개된 이벤트가 없습니다."}
          </div>
        ) : null}
        {!loading && visibleEvents.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {visibleEvents.map((event) => (
              <GalleryEventCard key={event.id} event={event} detailBase={meta.detailBase} />
            ))}
          </div>
        ) : null}
      </section>
    </main>
  );
}

function GalleryEventCard({ event, detailBase }: { event: CalendarEvent; detailBase: string }) {
  const isGoods = ["goods_preorder", "goods_release"].includes(event.type);
  return (
    <article className="border border-dashed border-gray-400 bg-white/75 hover:bg-white">
      <Link href={`${detailBase}/${event.id}`} className="block">
        <div className="flex aspect-[16/9] items-center justify-center overflow-hidden border-b border-dashed border-gray-300 bg-gray-100">
          {event.imageUrl ? (
            <img src={event.imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImageIcon size={28} className="text-gray-400" />
          )}
        </div>
        <div className="p-2.5">
          <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-gray-500">
            <span>{EVENT_TYPE_LABELS[event.type]}</span>
            <span>{formatEventPeriod(event.startsAt, event.endsAt)}</span>
          </div>
          <h2 className="mt-1.5 line-clamp-2 min-h-9 text-sm font-bold leading-[18px] text-gray-950">
            {event.title}
          </h2>
          {!isGoods ? (
            <p className="mt-1.5 flex items-center gap-1 text-xs text-gray-500">
              <MapPin size={12} />
              <span className="line-clamp-1">{event.location ?? event.platform ?? "장소 미정"}</span>
            </p>
          ) : (
            <p className="mt-1.5 line-clamp-1 text-xs text-gray-500">
              {event.description ?? "공식 발매 정보"}
            </p>
          )}
        </div>
      </Link>
      <div className="flex items-center justify-between border-t border-dashed border-gray-300 px-2.5 py-2">
        <button
          type="button"
          className="inline-flex h-8 items-center gap-1 border border-dashed border-gray-400 bg-white px-2 text-xs font-semibold text-gray-700 hover:bg-gray-100"
        >
          <Heart size={13} />
          팔로우
        </button>
        <Link
          href={`${detailBase}/${event.id}`}
          className="inline-flex h-8 items-center border border-dashed border-gray-400 bg-white px-2 text-xs font-semibold text-gray-700 hover:bg-gray-100"
        >
          상세
        </Link>
      </div>
    </article>
  );
}

function mapReleaseEvent(row: ReleaseEventRow): CalendarEvent {
  const type = row.event_type.toLowerCase() as CalendarEventType;
  return {
    id: row.id,
    contentId: row.release_item_id ?? undefined,
    category: getCalendarEventCategory(row.event_type, row.release_items?.category),
    type,
    title: row.title,
    description: row.description ?? undefined,
    startsAt: row.starts_at,
    endsAt: row.ends_at ?? undefined,
    timezone: row.timezone,
    platform: row.platform ?? row.release_items?.title ?? undefined,
    location: row.location ?? undefined,
    sourceUrl: row.source_url ?? undefined,
    imageUrl: row.image_url ?? row.release_items?.poster_url ?? undefined,
    isFollowing: false,
    reminderOffsetMinutes: null,
  };
}
