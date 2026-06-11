"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, ExternalLink, Vote } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { readApprovedSourcedTopicCards } from "@/components/topics/topicDraftStorage";
import { supabase } from "@/lib/supabase/client";
import { getCurrentCours } from "@/lib/otaku/cours";
import { EVENT_TYPE_LABELS, formatEventDatePeriod, type CalendarEventType } from "@/lib/otaku/hub";
import {
  createManualPollTopicCard,
  createTopicCardFromEvent,
  createTopicCardFromSeasonalAnime,
  type ReleaseEventTopicRow,
  type SeasonalAnimeTopicRow,
  type TopicCard,
} from "@/lib/topics/topicCards";

const EMPTY_THUMB =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='640' height='840' viewBox='0 0 640 840'%3E%3Crect width='640' height='840' fill='%23f3f4f6'/%3E%3Ctext x='320' y='420' text-anchor='middle' fill='%239ca3af' font-family='sans-serif' font-size='30'%3ENO IMAGE%3C/text%3E%3C/svg%3E";

const EVENT_TYPES = [
  "GOODS_PREORDER",
  "GOODS_RELEASE",
  "OFFLINE_EVENT",
  "TICKET_EVENT",
  "LIVE_EVENT",
];

type HomeEventRow = ReleaseEventTopicRow & {
  image_url: string | null;
  release_items?:
    | {
        category?: string | null;
        title?: string | null;
        poster_url?: string | null;
      }
    | Array<{
        category?: string | null;
        title?: string | null;
        poster_url?: string | null;
      }>
    | null;
};

type HomeSeasonalRow = SeasonalAnimeTopicRow & {
  poster_url: string | null;
};

type HomeNewsRow = {
  id: string;
  category: string;
  title: string;
  summary: string;
  thumbnail_url: string | null;
  published_at: string | null;
};

type HomeEventItem = {
  card: TopicCard;
  imageUrl: string | null;
  dateLabel: string;
  typeLabel: string;
};

type HomeSeasonalItem = {
  card: TopicCard;
  imageUrl: string | null;
  dateLabel: string;
};

type HomeNewsItem = {
  id: string;
  href: string;
  title: string;
  summary: string;
  imageUrl: string | null;
  categoryLabel: string;
  sourceLabel: string;
  publishedLabel: string;
};

export default function HomeTopicSections() {
  const [events, setEvents] = useState<HomeEventItem[]>([]);
  const [seasonal, setSeasonal] = useState<HomeSeasonalItem[]>([]);
  const [news, setNews] = useState<HomeNewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const pollCard = useMemo(() => createManualPollTopicCard(), []);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      setLoading(true);
      const [nextEvents, nextSeasonal, nextNews] = await Promise.all([
        loadHomeEvents(),
        loadHomeSeasonalAnime(),
        loadHomeNews(),
      ]);

      if (!cancelled) {
        setEvents(nextEvents);
        setSeasonal(nextSeasonal);
        setNews(nextNews);
        setLoading(false);
      }
    }

    void refresh();
    const onTopicsUpdated = () => void refresh();
    window.addEventListener("storage", onTopicsUpdated);
    window.addEventListener("ssibduk:topics-updated", onTopicsUpdated);

    return () => {
      cancelled = true;
      window.removeEventListener("storage", onTopicsUpdated);
      window.removeEventListener("ssibduk:topics-updated", onTopicsUpdated);
    };
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <header className="border border-dashed border-gray-500 bg-white/80 p-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500">
              Today topics
            </p>
            <h2 className="mt-0.5 text-xl font-black text-gray-950">오늘의 떡밥</h2>
            <p className="mt-1 text-xs leading-5 text-gray-600">
              소식, 이번 분기, 행사 일정을 섞지 않고 작은 섹션으로 나눠 보여줍니다.
            </p>
          </div>
          <Link
            href="/topics"
            className="inline-flex h-8 items-center border border-dashed border-gray-500 bg-white px-2.5 text-xs font-bold text-gray-700 hover:bg-gray-100"
          >
            전체 보기
          </Link>
        </div>
      </header>

      <SectionShell title="소식" href="/topics" moreLabel="더 보기" dense>
        <NewsBoard loading={loading} news={news} />
      </SectionShell>

      <AdSlot label="홈 중간 배너" />

      <SectionShell title="이번 분기" href="/season/current" moreLabel="분기 보기" dense>
        {loading ? (
          <LoadingRows />
        ) : seasonal.length === 0 ? (
          <SectionEmpty message="이번 분기에 등록된 작품이 없습니다." />
        ) : (
          <SeasonalSwiper items={seasonal} />
        )}
      </SectionShell>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <SectionShell title="행사" href="/events" moreLabel="전체 보기" caption="임박/진행 중인 일정만 작게 노출합니다." dense>
          {loading ? (
            <LoadingRows />
        ) : events.length === 0 ? (
          <SectionEmpty message="등록된 행사/이벤트가 없습니다." />
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-3">
            {events.slice(0, 3).map((item) => (
              <EventPoster key={item.card.id} item={item} />
            ))}
            </div>
          )}
        </SectionShell>

        <div className="grid gap-4">
          <SectionShell title="오늘의 투표" href="/topics?tab=poll" moreLabel="참여" dense>
            <PollPreview card={pollCard} />
          </SectionShell>
          <AdSlot label="사이드 광고" compact />
        </div>
      </div>
    </div>
  );
}

function SectionShell({
  title,
  href,
  moreLabel,
  caption,
  dense = false,
  children,
}: {
  title: string;
  href: string;
  moreLabel: string;
  caption?: string;
  dense?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={`border border-dashed border-gray-500 bg-white/70 ${dense ? "p-3" : "p-4"}`}>
      <div className="mb-3 flex items-end justify-between gap-3 border-b border-dashed border-gray-400 pb-2">
        <div>
          <h3 className="text-base font-black text-gray-900">{title}</h3>
          {caption ? <p className="mt-0.5 text-[11px] text-gray-500">{caption}</p> : null}
        </div>
        <Link href={href} className="shrink-0 text-xs font-bold text-gray-500 hover:underline">
          {moreLabel}
        </Link>
      </div>
      {children}
    </section>
  );
}

function NewsBoard({ loading, news }: { loading: boolean; news: HomeNewsItem[] }) {
  if (loading) return <LoadingRows />;

  if (news.length === 0) {
    return (
      <div className="grid gap-3 md:grid-cols-[160px_minmax(0,1fr)]">
        <OfficialThumbPlaceholder />
        <div className="flex min-h-28 flex-col justify-center border border-dashed border-gray-300 bg-white p-3">
          <p className="text-sm font-black text-gray-900">공식 출처 기반 소식 대기 중</p>
          <p className="mt-1 text-xs leading-5 text-gray-500">
            관리자가 공식 출처를 확인하고 승인한 짧은 소식이 이 영역에 쌓입니다.
          </p>
        </div>
      </div>
    );
  }

  const [featured, ...rest] = news;
  return (
    <div className="grid gap-3 lg:grid-cols-[260px_minmax(0,1fr)]">
      <Link href={featured.href} className="group block">
        <div className="aspect-[16/10] overflow-hidden border border-dashed border-gray-300 bg-gray-100">
          <img
            src={featured.imageUrl ?? EMPTY_THUMB}
            alt=""
            className="h-full w-full object-cover transition-transform group-hover:scale-[1.03]"
          />
        </div>
        <div className="mt-2">
          <p className="text-[11px] font-bold text-gray-500">{featured.categoryLabel} · {featured.sourceLabel}</p>
          <h4 className="mt-1 line-clamp-2 text-sm font-black leading-5 text-gray-950 group-hover:underline">
            {featured.title}
          </h4>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-gray-600">{featured.summary}</p>
        </div>
      </Link>

      <div className="grid gap-2 sm:grid-cols-2">
        {rest.slice(0, 8).map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className="grid grid-cols-[72px_minmax(0,1fr)] gap-2 border border-dashed border-gray-300 bg-white p-2 hover:bg-gray-50"
          >
            <div className="aspect-square overflow-hidden bg-gray-100">
              <img src={item.imageUrl ?? EMPTY_THUMB} alt="" className="h-full w-full object-cover" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-gray-500">{item.categoryLabel}</p>
              <p className="mt-0.5 line-clamp-2 text-xs font-black leading-4 text-gray-900">{item.title}</p>
              <p className="mt-1 text-[10px] text-gray-400">{item.publishedLabel}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function OfficialThumbPlaceholder({ label = "공식 소식" }: { label?: string }) {
  return (
    <div className="flex aspect-[16/10] min-h-28 flex-col justify-between border border-dashed border-gray-300 bg-gray-100 p-3">
      <span className="w-fit border border-dashed border-gray-400 bg-white px-2 py-1 text-[10px] font-black text-gray-600">
        {label}
      </span>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Official source</p>
        <p className="mt-1 text-sm font-black text-gray-800">확인된 소식만</p>
      </div>
    </div>
  );
}

function SeasonalSwiper({ items }: { items: HomeSeasonalItem[] }) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  function scrollByCard(direction: -1 | 1) {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    scroller.scrollBy({ left: direction * 520, behavior: "smooth" });
  }

  return (
    <div>
      <div className="mb-2 flex justify-end gap-1">
        <button
          type="button"
          onClick={() => scrollByCard(-1)}
          className="inline-flex h-7 w-7 items-center justify-center border border-dashed border-gray-400 bg-white text-gray-600 hover:bg-gray-100"
          aria-label="이전 분기 카드"
        >
          <ChevronLeft size={15} />
        </button>
        <button
          type="button"
          onClick={() => scrollByCard(1)}
          className="inline-flex h-7 w-7 items-center justify-center border border-dashed border-gray-400 bg-white text-gray-600 hover:bg-gray-100"
          aria-label="다음 분기 카드"
        >
          <ChevronRight size={15} />
        </button>
      </div>
      <div
        ref={scrollerRef}
        className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2 [scrollbar-width:thin]"
      >
        {items.map((item) => (
          <SeasonalSlide key={item.card.id} item={item} />
        ))}
      </div>
    </div>
  );
}

function SeasonalSlide({ item }: { item: HomeSeasonalItem }) {
  return (
    <Link href={`/releases/${item.card.relatedWorkId}`} className="group block w-[132px] shrink-0 snap-start sm:w-[150px]">
      <div className="aspect-[3/4] overflow-hidden border border-dashed border-gray-300 bg-gray-100">
        <img
          src={item.imageUrl ?? EMPTY_THUMB}
          alt=""
          className="h-full w-full object-cover transition-transform group-hover:scale-[1.03]"
        />
      </div>
      <div className="mt-2 min-w-0">
        <p className="text-[10px] font-bold text-gray-500">{item.dateLabel}</p>
        <h4 className="mt-1 line-clamp-2 min-h-9 text-xs font-black leading-[18px] text-gray-950 group-hover:underline">
          {item.card.relatedWorkName ?? item.card.title}
        </h4>
        <p className="mt-1 line-clamp-1 text-[11px] text-gray-500">{item.card.question}</p>
      </div>
    </Link>
  );
}

function EventPoster({ item }: { item: HomeEventItem }) {
  return (
    <Link href={`/events/${item.card.relatedEventId}`} className="group block">
      <div className="relative mx-auto aspect-[3/4] w-full max-w-[104px] overflow-hidden border border-dashed border-gray-300 bg-gray-100 sm:max-w-[112px]">
        <img
          src={item.imageUrl ?? EMPTY_THUMB}
          alt=""
          className="h-full w-full object-cover transition-transform group-hover:scale-[1.03]"
        />
        <span className="absolute left-1.5 top-1.5 border border-dashed border-gray-300 bg-white/90 px-1 py-0.5 text-[9px] font-black text-gray-700">
          {item.typeLabel}
        </span>
      </div>
      <div className="mx-auto mt-1.5 min-w-0 max-w-[104px] sm:max-w-[112px]">
        <h4 className="line-clamp-2 text-[11px] font-black leading-4 text-gray-950 group-hover:underline">
          {item.card.title}
        </h4>
        <div className="mt-0.5 flex items-center gap-1.5 text-[9px] font-bold text-gray-500">
          <span className="truncate">{item.dateLabel}</span>
        </div>
      </div>
    </Link>
  );
}

function PollPreview({ card }: { card: TopicCard }) {
  return (
    <div className="grid gap-3">
      <div className="flex items-start gap-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center border border-dashed border-gray-300 bg-gray-100">
          <Vote size={22} className="text-gray-500" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold text-gray-500">{card.categoryLabel}</p>
          <h4 className="mt-0.5 line-clamp-2 text-sm font-black leading-5 text-gray-950">{card.title}</h4>
          <p className="mt-1 text-xs font-bold text-gray-800">{card.question}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {card.pollOptions.slice(0, 4).map((option) => (
          <button
            key={option}
            type="button"
            className="min-h-8 border border-dashed border-gray-400 bg-white px-2 py-1 text-[11px] font-bold text-gray-700 hover:bg-gray-100"
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

function AdSlot({ label, compact = false }: { label: string; compact?: boolean }) {
  return (
    <div
      className={`flex items-center justify-between border border-dashed border-gray-500 bg-gray-900 px-4 text-white ${
        compact ? "min-h-24 py-3" : "min-h-20 py-3"
      }`}
    >
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">AD</p>
        <p className="mt-1 text-sm font-black">{label}</p>
      </div>
      <span className="border border-dashed border-gray-600 px-2 py-1 text-[10px] font-bold text-gray-300">
        광고 슬롯
      </span>
    </div>
  );
}

function LoadingRows() {
  return <div className="border border-dashed border-gray-300 bg-white p-4 text-sm text-gray-500">불러오는 중...</div>;
}

function SectionEmpty({ message }: { message: string }) {
  return <div className="border border-dashed border-gray-300 bg-white p-4 text-sm text-gray-500">{message}</div>;
}

async function loadHomeNews(): Promise<HomeNewsItem[]> {
  const sourced = readApprovedSourcedTopicCards()
    .filter((card) => card.type === "sourced" && card.status === "approved")
    .slice(0, 9)
    .map((card) => ({
      id: card.id,
      href: "/topics",
      title: card.title,
      summary: card.summary,
      imageUrl: null,
      categoryLabel: card.categoryLabel,
      sourceLabel: "공식 출처",
      publishedLabel: formatShortDate(card.createdAt),
    }));

  const { data, error } = await supabase
    .from("news_items")
    .select("id, category, title, summary, thumbnail_url, published_at")
    .eq("status", "PUBLISHED")
    .order("published_at", { ascending: false })
    .limit(Math.max(0, 9 - sourced.length));

  if (error) {
    console.warn("[home] failed to load news items:", error.message);
    return sourced;
  }

  const legacy = ((data ?? []) as HomeNewsRow[]).map((row) => ({
    id: `news-${row.id}`,
    href: "/topics",
    title: row.title,
    summary: row.summary,
    imageUrl: row.thumbnail_url,
    categoryLabel: categoryLabel(row.category),
    sourceLabel: "운영 소식",
    publishedLabel: formatShortDate(row.published_at),
  }));

  return [...sourced, ...legacy].slice(0, 9);
}

async function loadHomeEvents(): Promise<HomeEventItem[]> {
  const { data, error } = await supabase
    .from("release_events")
    .select(
      `
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
    `,
    )
    .eq("status", "PUBLISHED")
    .in("event_type", EVENT_TYPES)
    .order("starts_at", { ascending: true })
    .limit(3);

  if (error) {
    console.warn("[home] failed to load event topics:", error.message);
    return [];
  }

  return ((data ?? []) as HomeEventRow[]).map((row) => {
    const releaseItem = Array.isArray(row.release_items) ? row.release_items[0] : row.release_items;
    const normalized = { ...row, release_items: releaseItem };
    const card = createTopicCardFromEvent(normalized);
    const eventType = row.event_type.toLowerCase() as CalendarEventType;
    return {
      card,
      imageUrl: row.image_url ?? releaseItem?.poster_url ?? null,
      dateLabel: formatEventDatePeriod(row.starts_at, row.ends_at ?? undefined),
      typeLabel: EVENT_TYPE_LABELS[eventType] ?? "행사",
    };
  });
}

async function loadHomeSeasonalAnime(): Promise<HomeSeasonalItem[]> {
  const currentCours = getCurrentCours();
  const { data, error } = await supabase
    .from("release_items")
    .select("id, title, synopsis, poster_url, release_date, cours")
    .eq("category", "ANIME")
    .eq("status", "PUBLISHED")
    .eq("cours", currentCours)
    .order("release_date", { ascending: true, nullsFirst: false })
    .limit(12);

  let rows = (data ?? []) as HomeSeasonalRow[];

  if (error) {
    if (error.code !== "42703") {
      console.warn("[home] failed to load seasonal topics:", error.message);
      return [];
    }

    const { data: fallbackRows, error: fallbackError } = await supabase
      .from("release_items")
      .select("id, title, synopsis, poster_url, release_date")
      .eq("category", "ANIME")
      .eq("status", "PUBLISHED")
      .order("release_date", { ascending: true, nullsFirst: false })
      .limit(40);

    if (fallbackError) {
      console.warn("[home] failed to load seasonal fallback topics:", fallbackError.message);
      return [];
    }

    rows = ((fallbackRows ?? []) as HomeSeasonalRow[])
      .filter((row) => releaseDateToCours(row.release_date) === currentCours)
      .slice(0, 12);
  }

  return rows.map((row, index) => ({
    card: createTopicCardFromSeasonalAnime(row, index),
    imageUrl: row.poster_url,
    dateLabel: formatShortDate(row.release_date),
  }));
}

function categoryLabel(value: string): string {
  const normalized = value.toLowerCase();
  if (normalized === "anime") return "애니";
  if (normalized === "manga") return "만화";
  if (normalized === "game") return "게임";
  return "소식";
}

function formatShortDate(value: string | null | undefined): string {
  if (!value) return "날짜 미정";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).format(new Date(value));
}

function releaseDateToCours(dateValue: string | null): string | null {
  if (!dateValue) return null;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;
  const month = date.getMonth() + 1;
  const quarter = month <= 3 ? 1 : month <= 6 ? 2 : month <= 9 ? 3 : 4;
  return `${date.getFullYear()}-Q${quarter}`;
}
