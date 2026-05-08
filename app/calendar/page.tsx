"use client";

import Link from "next/link";
import {
  Bell,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  MessageSquareText,
  PenLine,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  CATEGORY_LABELS,
  EVENT_TYPE_LABELS,
  PUBLIC_CATEGORIES,
  addMonths,
  buildMonthGrid,
  filterByCategory,
  formatDateTime,
  getCalendarEvents,
  startOfMonth,
  type CalendarEvent,
  type OtakuCategory,
  ymdKey,
} from "@/lib/otaku/hub";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const TABS: OtakuCategory[] = PUBLIC_CATEGORIES;

export default function CalendarPage() {
  const [cursor, setCursor] = useState<Date>(() => startOfMonth(new Date()));
  const [activeCategory, setActiveCategory] = useState<OtakuCategory>("all");
  const [followingOnly, setFollowingOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const today = useMemo(() => new Date(), []);
  const events = useMemo(() => getCalendarEvents(), []);
  const monthEvents = useMemo(() => {
    const categoryFiltered = filterByCategory(events, activeCategory);
    return categoryFiltered
      .filter((event) => isSameMonth(new Date(event.startsAt), cursor))
      .filter((event) => (followingOnly ? event.isFollowing : true))
      .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  }, [activeCategory, cursor, events, followingOnly]);

  const weeks = useMemo(() => buildMonthGrid(cursor), [cursor]);
  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of monthEvents) {
      const key = ymdKey(event.startsAt);
      const list = map.get(key) ?? [];
      list.push(event);
      map.set(key, list);
    }
    return map;
  }, [monthEvents]);

  const selectedEvent =
    monthEvents.find((event) => event.id === selectedId) ?? monthEvents[0] ?? null;
  const todayEvents = monthEvents.filter((event) => ymdKey(event.startsAt) === ymdKey(today));
  const weekEvents = monthEvents.filter((event) => isWithinDays(new Date(event.startsAt), today, 7));
  const monthLabel = `${cursor.getFullYear()}년 ${cursor.getMonth() + 1}월`;

  return (
    <main className="flex w-full flex-col gap-4">
      <header className="border border-dashed border-gray-500 bg-white/80 p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.2em] text-gray-500 uppercase">
              Fan calendar
            </p>
            <h1 className="mt-1 text-2xl font-bold text-gray-900">덕질 캘린더</h1>
            <p className="mt-1 text-sm text-gray-600">
              관심작과 공식/운영 일정이 모이는 보조 화면입니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/news"
              className="inline-flex items-center gap-1 border border-dashed border-gray-500 bg-white px-3 py-2 text-sm hover:bg-gray-100"
            >
              <MessageSquareText size={16} />
              소식
            </Link>
            <Link
              href="/releases"
              className="inline-flex items-center gap-1 border border-dashed border-gray-500 bg-white px-3 py-2 text-sm hover:bg-gray-100"
            >
              <CalendarDays size={16} />
              신작/일정
            </Link>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_280px]">
        <div className="border border-dashed border-gray-500 bg-white/70 p-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCursor((current) => addMonths(current, -1))}
                className="inline-flex h-9 w-9 items-center justify-center border border-dashed border-gray-500 bg-white hover:bg-gray-100"
                title="이전 달"
              >
                <ChevronLeft size={17} />
              </button>
              <h2 className="min-w-36 text-center text-lg font-bold text-gray-900">
                {monthLabel}
              </h2>
              <button
                type="button"
                onClick={() => setCursor((current) => addMonths(current, 1))}
                className="inline-flex h-9 w-9 items-center justify-center border border-dashed border-gray-500 bg-white hover:bg-gray-100"
                title="다음 달"
              >
                <ChevronRight size={17} />
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {TABS.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveCategory(tab)}
                  className={`border border-dashed px-3 py-2 text-xs font-semibold ${
                    activeCategory === tab
                      ? "border-gray-800 bg-gray-300 text-gray-950"
                      : "border-gray-500 bg-white text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {CATEGORY_LABELS[tab]}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setFollowingOnly((current) => !current)}
                className={`inline-flex items-center gap-1 border border-dashed px-3 py-2 text-xs font-semibold ${
                  followingOnly
                    ? "border-pink-400 bg-pink-50 text-pink-700"
                    : "border-gray-500 bg-white text-gray-600 hover:bg-gray-100"
                }`}
              >
                <Bell size={14} />
                내 관심작
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 border-b border-dashed border-gray-400 pb-2 text-center text-xs font-semibold">
            {WEEKDAYS.map((weekday, index) => (
              <span
                key={weekday}
                className={
                  index === 0 ? "text-red-500" : index === 6 ? "text-blue-500" : "text-gray-700"
                }
              >
                {weekday}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {weeks.flat().map((day) => {
              const inMonth = day.getMonth() === cursor.getMonth();
              const dayEvents = eventsByDay.get(ymdKey(day)) ?? [];
              const isToday = ymdKey(day) === ymdKey(today);

              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => dayEvents[0] && setSelectedId(dayEvents[0].id)}
                  className={`min-h-[112px] border-b border-r border-dashed border-gray-300 p-1.5 text-left text-xs ${
                    inMonth ? "bg-white/80 hover:bg-gray-50" : "bg-gray-100/60 text-gray-400"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[11px] font-semibold ${
                        isToday ? "bg-pink-500 text-white" : "text-gray-700"
                      }`}
                    >
                      {day.getDate()}
                    </span>
                    {dayEvents.length > 0 ? (
                      <span className="rounded-full bg-gray-200 px-1.5 text-[10px] text-gray-700">
                        {dayEvents.length}
                      </span>
                    ) : null}
                  </div>
                  <ul className="mt-1 space-y-1">
                    {dayEvents.slice(0, 3).map((event) => (
                      <li
                        key={event.id}
                        className={`truncate border border-dashed px-1 py-0.5 text-[10px] ${
                          event.isFollowing
                            ? "border-pink-300 bg-pink-50 text-pink-700"
                            : "border-gray-300 bg-gray-100 text-gray-700"
                        }`}
                        title={event.title}
                      >
                        {EVENT_TYPE_LABELS[event.type]} · {event.title}
                      </li>
                    ))}
                    {dayEvents.length > 3 ? (
                      <li className="text-[10px] text-gray-500">+{dayEvents.length - 3}</li>
                    ) : null}
                  </ul>
                </button>
              );
            })}
          </div>
        </div>

        <aside className="flex flex-col gap-3">
          <SummaryPanel title="오늘" events={todayEvents} onSelect={setSelectedId} />
          <SummaryPanel title="이번 주" events={weekEvents} onSelect={setSelectedId} />
        </aside>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">
        <div className="border border-dashed border-gray-500 bg-white/70 p-4">
          <h2 className="mb-3 text-sm font-bold text-gray-600">[{monthLabel} 일정]</h2>
          {monthEvents.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">표시할 일정이 없습니다.</p>
          ) : (
            <ul className="divide-y divide-dashed divide-gray-300 border border-dashed border-gray-300">
              {monthEvents.map((event) => (
                <li key={event.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(event.id)}
                    className={`grid w-full grid-cols-[96px_1fr_auto] items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                      selectedEvent?.id === event.id ? "bg-gray-100" : ""
                    }`}
                  >
                    <span className="font-mono text-xs text-gray-500">
                      {formatDateTime(event.startsAt)}
                    </span>
                    <span className="min-w-0 truncate font-semibold text-gray-800">
                      {event.title}
                    </span>
                    <span className="border border-dashed border-gray-300 bg-white px-2 py-0.5 text-[11px] text-gray-500">
                      {EVENT_TYPE_LABELS[event.type]}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <EventDetail event={selectedEvent} />
      </section>
    </main>
  );
}

function SummaryPanel({
  title,
  events,
  onSelect,
}: {
  title: string;
  events: CalendarEvent[];
  onSelect: (id: string) => void;
}) {
  return (
    <section className="border border-dashed border-gray-500 bg-white/70 p-3">
      <h2 className="mb-2 text-sm font-bold text-gray-700">{title}</h2>
      {events.length === 0 ? (
        <p className="text-xs text-gray-500">일정 없음</p>
      ) : (
        <ul className="space-y-2">
          {events.slice(0, 5).map((event) => (
            <li key={event.id}>
              <button
                type="button"
                onClick={() => onSelect(event.id)}
                className="w-full border border-dashed border-gray-300 bg-white px-2 py-2 text-left hover:bg-gray-100"
              >
                <div className="truncate text-xs font-bold text-gray-800">{event.title}</div>
                <div className="mt-1 flex justify-between gap-2 text-[11px] text-gray-500">
                  <span>{EVENT_TYPE_LABELS[event.type]}</span>
                  <span>{formatDateTime(event.startsAt)}</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function EventDetail({ event }: { event: CalendarEvent | null }) {
  if (!event) {
    return (
      <aside className="border border-dashed border-gray-500 bg-white/70 p-4 text-sm text-gray-500">
        일정을 선택하면 알림과 관련 액션을 설정할 수 있습니다.
      </aside>
    );
  }

  return (
    <aside className="border border-dashed border-gray-500 bg-white/80 p-4">
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
        <span className="border border-dashed border-gray-400 bg-gray-100 px-2 py-0.5 font-bold text-gray-700">
          {event.category === "community" || event.category === "personal"
            ? "기타"
            : CATEGORY_LABELS[event.category]}
        </span>
        <span>{EVENT_TYPE_LABELS[event.type]}</span>
        <span>{event.timezone}</span>
      </div>
      <h2 className="mt-2 text-lg font-bold text-gray-950">{event.title}</h2>
      <dl className="mt-3 grid grid-cols-[72px_1fr] gap-x-3 gap-y-2 text-sm">
        <dt className="text-gray-500">시간</dt>
        <dd className="font-semibold text-gray-800">{formatDateTime(event.startsAt)}</dd>
        {event.episodeLabel ? (
          <>
            <dt className="text-gray-500">회차</dt>
            <dd>{event.episodeLabel}</dd>
          </>
        ) : null}
        {event.platform ? (
          <>
            <dt className="text-gray-500">플랫폼</dt>
            <dd>{event.platform}</dd>
          </>
        ) : null}
        <dt className="text-gray-500">알림</dt>
        <dd>
          {event.isFollowing
            ? event.reminderOffsetMinutes === 30
              ? "30분 전 + 당일"
              : "당일 알림"
            : "관심 등록 필요"}
        </dd>
      </dl>

      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        {event.relatedBoardSlug ? (
          <Link
            href={getBoardHref(event.relatedBoardSlug)}
            className="inline-flex items-center justify-center gap-1 border border-dashed border-gray-500 bg-white px-2 py-2 hover:bg-gray-100"
          >
            <MessageSquareText size={15} />
            관련 채널
          </Link>
        ) : null}
        {event.relatedBoardSlug ? (
          <Link
            href={getBoardWriteHref(event.relatedBoardSlug, event.title)}
            className="inline-flex items-center justify-center gap-1 border border-dashed border-gray-500 bg-white px-2 py-2 hover:bg-gray-100"
          >
            <PenLine size={15} />
            글쓰기
          </Link>
        ) : null}
        {event.sourceUrl ? (
          <a
            href={event.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-1 border border-dashed border-gray-500 bg-white px-2 py-2 hover:bg-gray-100"
          >
            <ExternalLink size={15} />
            출처
          </a>
        ) : null}
        <button
          type="button"
          className={`inline-flex items-center justify-center gap-1 border border-dashed px-2 py-2 ${
            event.isFollowing
              ? "border-pink-400 bg-pink-50 text-pink-700"
              : "border-gray-500 bg-white hover:bg-gray-100"
          }`}
        >
          <Bell size={15} />
          {event.isFollowing ? "알림 설정됨" : "알림 받기"}
        </button>
      </div>
    </aside>
  );
}

function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

function getBoardHref(slug: string): string {
  return slug === "board" ? "/board" : `/board/${slug}`;
}

function getBoardWriteHref(slug: string, title: string): string {
  const topic = encodeURIComponent(title);
  return slug === "board" ? `/feed/write?topic=${topic}` : `/board/${slug}/write?topic=${topic}`;
}

function isWithinDays(target: Date, base: Date, days: number): boolean {
  const start = new Date(base.getFullYear(), base.getMonth(), base.getDate()).getTime();
  const end = start + days * 24 * 60 * 60 * 1000;
  const time = target.getTime();
  return time >= start && time <= end;
}
