"use client";

import Link from "next/link";
import {
  Bell,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Edit3,
  ExternalLink,
  ImageIcon,
  MapPin,
  MessageSquareText,
  Plus,
  Send,
  Trash2,
  User,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { fetchFollowedReleaseIds, getCurrentUserId, setReleaseFollow } from "@/lib/supabase/releaseFollows";
import {
  fetchAttendanceMonthSummary,
  type AttendanceMonthSummary,
} from "@/lib/community/attendance";
import {
  CALENDAR_TAB_LABELS,
  EVENT_TYPE_LABELS,
  PUBLIC_CALENDAR_TABS,
  addMonths,
  buildMonthGrid,
  filterByCalendarTab,
  getCalendarEvents,
  getCalendarEventCategory,
  startOfMonth,
  type CalendarTab,
  type CalendarEvent,
  type CalendarEventType,
  ymdKey,
} from "@/lib/otaku/hub";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const TABS: CalendarTab[] = PUBLIC_CALENDAR_TABS;
const PERSONAL_EVENTS_STORAGE_KEY = "duck-personal-calendar-events-v1";
const SUBMITTABLE_EVENT_TYPES = [
  "goods_preorder",
  "goods_release",
  "offline_event",
  "ticket_event",
  "live_event",
] as const;

type PersonalCalendarForm = {
  id: string | null;
  title: string;
  startsAt: string;
  location: string;
};

type EventSubmissionForm = {
  eventType: (typeof SUBMITTABLE_EVENT_TYPES)[number];
  title: string;
  startsAt: string;
  endsAt: string;
  location: string;
  sourceUrl: string;
  imageUrl: string;
  description: string;
};

type ReleaseDateRow = {
  id: string;
  category: "ANIME" | "MANGA" | "GAME";
  title: string;
  release_date: string;
};

export default function CalendarPage() {
  const [cursor, setCursor] = useState<Date>(() => startOfMonth(new Date()));
  const [activeTab, setActiveTab] = useState<CalendarTab>("all");
  const [followingOnly, setFollowingOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [personalEvents, setPersonalEvents] = useState<CalendarEvent[]>([]);
  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceMonthSummary>({
    attendedYmds: [],
    monthCount: 0,
    totalCount: 0,
  });
  const [dbEvents, setDbEvents] = useState<CalendarEvent[]>([]);
  const [followedReleaseIds, setFollowedReleaseIds] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [submittingEvent, setSubmittingEvent] = useState(false);
  const [personalForm, setPersonalForm] = useState<PersonalCalendarForm>({
    id: null,
    title: "",
    startsAt: "",
    location: "",
  });
  const [submissionForm, setSubmissionForm] = useState<EventSubmissionForm>({
    eventType: "goods_preorder",
    title: "",
    startsAt: "",
    endsAt: "",
    location: "",
    sourceUrl: "",
    imageUrl: "",
    description: "",
  });

  const today = useMemo(() => new Date(), []);
  const baseEvents = useMemo(() => getCalendarEvents(), []);

  useEffect(() => {
    const fetchEvents = async () => {
      const { data, error } = await supabase
        .from("release_events")
        .select(`
          id,
          title,
          starts_at,
          ends_at,
          timezone,
          event_type,
          episode_label,
          platform,
          description,
          location,
          source_url,
          image_url,
          release_item_id,
          release_items (
            category
          )
        `)
        .eq("status", "PUBLISHED");

      const { data: releaseItems, error: releaseItemsError } = await supabase
        .from("release_items")
        .select("id, category, title, release_date")
        .eq("status", "PUBLISHED")
        .not("release_date", "is", null);

      if (error) {
        console.error("Error fetching calendar events:", error);
      }

      if (releaseItemsError) {
        console.error("Error fetching release dates:", releaseItemsError);
      }

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
      setFollowedReleaseIds(persistedFollowedIds);

      if (data || releaseItems) {
        const mappedData: CalendarEvent[] = ((data ?? []) as any[]).map((item) => ({
          id: item.id,
          contentId: item.release_item_id,
          category: getCalendarEventCategory(item.event_type, item.release_items?.category),
          type: item.event_type.toLowerCase() as CalendarEventType,
          title: item.title,
          description: item.description ?? undefined,
          startsAt: item.starts_at,
          endsAt: item.ends_at ?? undefined,
          timezone: item.timezone,
          episodeLabel: item.episode_label,
          platform: item.platform,
          location: item.location ?? undefined,
          sourceUrl: item.source_url,
          imageUrl: item.image_url ?? undefined,
          isFollowing: false,
          reminderOffsetMinutes: null,
        }));
        const mappedReleaseDates: CalendarEvent[] = ((releaseItems ?? []) as ReleaseDateRow[]).map((item) => ({
          id: `release-date-${item.id}`,
          contentId: item.id,
          category: item.category.toLowerCase() as "anime" | "manga" | "game",
          type: item.category === "MANGA" ? "manga_volume" : "anime_airing",
          title: item.title,
          startsAt: dateOnlyToKstIso(item.release_date),
          timezone: "Asia/Seoul",
          platform: "출시 일자",
          isFollowing: false,
          reminderOffsetMinutes: null,
        }));
        setDbEvents([...mappedData, ...mappedReleaseDates]);
      }
    };

    void fetchEvents();
  }, []);

  useEffect(() => {
    if (!userId) {
      setAttendanceSummary({ attendedYmds: [], monthCount: 0, totalCount: 0 });
      return;
    }
    let cancelled = false;
    void (async () => {
      const summary = await fetchAttendanceMonthSummary(userId, cursor);
      if (!cancelled) setAttendanceSummary(summary);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, cursor]);

  const attendedDaySet = useMemo(
    () => new Set(attendanceSummary.attendedYmds),
    [attendanceSummary.attendedYmds],
  );

  const events = useMemo(
    () =>
      [...baseEvents, ...dbEvents, ...personalEvents]
        .map((event) => ({
          ...event,
          isFollowing: event.contentId ? followedReleaseIds.has(event.contentId) : event.isFollowing,
        }))
        .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt)),
    [baseEvents, dbEvents, followedReleaseIds, personalEvents],
  );
  const monthEvents = useMemo(() => {
    const tabFiltered = filterByCalendarTab(events, activeTab);
    return tabFiltered
      .filter((event) => isSameMonth(new Date(event.startsAt), cursor))
      .filter((event) => (followingOnly ? event.isFollowing : true))
      .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  }, [activeTab, cursor, events, followingOnly]);

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

  const monthLabel = `${cursor.getFullYear()}년 ${cursor.getMonth() + 1}월`;

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(PERSONAL_EVENTS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as CalendarEvent[];
      const sanitized = parsed.filter((event) => {
        return (
          event &&
          typeof event.id === "string" &&
          typeof event.title === "string" &&
          typeof event.startsAt === "string" &&
          event.category === "personal" &&
          event.type === "personal"
        );
      });
      setPersonalEvents(sanitized);
    } catch {
      window.localStorage.removeItem(PERSONAL_EVENTS_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(PERSONAL_EVENTS_STORAGE_KEY, JSON.stringify(personalEvents));
  }, [personalEvents]);

  useEffect(() => {
    if (!selectedId) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest("[data-event-popup='true']")) return;
      if (target.closest("[data-event-trigger='true']")) return;
      setSelectedId(null);
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [selectedId]);

  function handleSavePersonalEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!personalForm.title.trim() || !personalForm.startsAt) return;

    const startsAt = new Date(personalForm.startsAt).toISOString();
    if (personalForm.id) {
      setPersonalEvents((current) =>
        current.map((saved) =>
          saved.id === personalForm.id
            ? {
                ...saved,
                title: personalForm.title.trim(),
                startsAt,
                platform: personalForm.location.trim() || undefined,
              }
            : saved,
        ),
      );
      setSelectedId(personalForm.id);
    } else {
      const next: CalendarEvent = {
        id: `personal-${Date.now()}`,
        category: "personal",
        type: "personal",
        title: personalForm.title.trim(),
        startsAt,
        timezone: "Asia/Seoul",
        platform: personalForm.location.trim() || undefined,
        isFollowing: true,
        reminderOffsetMinutes: null,
      };
      setPersonalEvents((current) => [...current, next]);
      setSelectedId(next.id);
    }

    setPersonalForm({ id: null, title: "", startsAt: "", location: "" });
    setIsModalOpen(false);
  }

  function handleDeletePersonalEvent(eventId: string) {
    setPersonalEvents((current) => current.filter((event) => event.id !== eventId));
    setSelectedId((current) => (current === eventId ? null : current));
  }

  function handleEditPersonalEvent(event: CalendarEvent) {
    const localValue = toLocalDateTimeValue(event.startsAt);
    setPersonalForm({
      id: event.id,
      title: event.title,
      startsAt: localValue,
      location: event.platform ?? "",
    });
    setIsModalOpen(true);
  }

  function handleOpenCreateModal() {
    setPersonalForm({ id: null, title: "", startsAt: "", location: "" });
    setIsModalOpen(true);
  }

  async function handleToggleFollow(releaseItemId: string, nextValue: boolean) {
    if (!userId) {
      alert("로그인 후 일정 알림을 받을 수 있습니다.");
      return;
    }

    setFollowedReleaseIds((current) => {
      const next = new Set(current);
      if (nextValue) next.add(releaseItemId);
      else next.delete(releaseItemId);
      return next;
    });

    try {
      await setReleaseFollow(userId, releaseItemId, nextValue);
    } catch (error) {
      setFollowedReleaseIds((current) => {
        const next = new Set(current);
        if (nextValue) next.delete(releaseItemId);
        else next.add(releaseItemId);
        return next;
      });
      const message = error instanceof Error ? error.message : "알 수 없는 오류";
      alert("일정 알림 변경 실패: " + message);
    }
  }

  async function handleSubmitEventSuggestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId) {
      alert("로그인 후 일정을 제보할 수 있습니다.");
      return;
    }
    if (!submissionForm.title.trim() || !submissionForm.startsAt || !submissionForm.sourceUrl.trim()) {
      alert("제목, 날짜, 출처 URL은 필수입니다.");
      return;
    }

    setSubmittingEvent(true);
    try {
      const { error } = await supabase.from("calendar_event_submissions").insert({
        user_id: userId,
        event_type: submissionForm.eventType.toUpperCase(),
        title: submissionForm.title.trim(),
        starts_at: new Date(submissionForm.startsAt).toISOString(),
        ends_at: submissionForm.endsAt ? new Date(submissionForm.endsAt).toISOString() : null,
        timezone: "Asia/Seoul",
        location: emptyToNullish(submissionForm.location),
        source_url: submissionForm.sourceUrl.trim(),
        image_url: emptyToNullish(submissionForm.imageUrl),
        description: emptyToNullish(submissionForm.description),
        status: "PENDING",
      });

      if (error) throw error;

      setSubmissionForm({
        eventType: "goods_preorder",
        title: "",
        startsAt: "",
        endsAt: "",
        location: "",
        sourceUrl: "",
        imageUrl: "",
        description: "",
      });
      setIsSubmitModalOpen(false);
      alert("제보가 접수되었습니다. 운영자 확인 후 공개됩니다.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "알 수 없는 오류";
      alert("일정 제보 실패: " + message);
    } finally {
      setSubmittingEvent(false);
    }
  }

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
              href="/events"
              className="inline-flex items-center gap-1 border border-dashed border-gray-500 bg-white px-3 py-2 text-sm hover:bg-gray-100"
            >
              <CalendarDays size={16} />
              이벤트
            </Link>
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

      <section className="w-full">
        <div className="w-full border border-dashed border-gray-500 bg-white/70 p-3">
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
                  onClick={() => setActiveTab(tab)}
                  className={`border border-dashed px-3 py-2 text-xs font-semibold ${
                    activeTab === tab
                      ? "border-gray-800 bg-gray-300 text-gray-950"
                      : "border-gray-500 bg-white text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {CALENDAR_TAB_LABELS[tab]}
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

          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            {userId ? (
              <p className="inline-flex items-center gap-2 border border-dashed border-emerald-400 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-emerald-500 bg-white text-emerald-600">
                  <Check size={14} strokeWidth={3} />
                </span>
                이번 달 출석 {attendanceSummary.monthCount}회
                <span className="font-normal text-emerald-700/80">·</span>
                누적 {attendanceSummary.totalCount}회
              </p>
            ) : (
              <p className="text-xs text-gray-500">로그인하면 출석 도장이 캘린더에 표시됩니다.</p>
            )}
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="inline-flex h-9 items-center justify-center gap-1 border border-dashed border-gray-600 bg-gray-900 px-3 text-sm font-semibold text-white hover:bg-gray-700"
            >
              <Plus size={14} />
              내 캘린더 저장
            </button>
            <button
              type="button"
              onClick={() => setIsSubmitModalOpen(true)}
              className="inline-flex h-9 items-center justify-center gap-1 border border-dashed border-gray-500 bg-white px-3 text-sm font-semibold text-gray-800 hover:bg-gray-100"
            >
              <Send size={14} />
              일정 제보
            </button>
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
              const dayKey = ymdKey(day);
              const dayEvents = eventsByDay.get(dayKey) ?? [];
              const isToday = dayKey === ymdKey(today);
              const hasAttendance = Boolean(userId && attendedDaySet.has(dayKey));
              const visibleEventLimit = hasAttendance ? 2 : 3;
              const slotCount = (hasAttendance ? 1 : 0) + dayEvents.length;

              return (
                <div
                  key={day.toISOString()}
                  className={`relative min-h-[112px] border-b border-r border-dashed border-gray-300 p-1.5 text-left text-xs ${
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
                    {slotCount > 0 ? (
                      <span className="rounded-full bg-gray-200 px-1.5 text-[10px] text-gray-700">
                        {slotCount}
                      </span>
                    ) : null}
                  </div>
                  <ul className="mt-1 space-y-1">
                    {hasAttendance ? (
                      <li>
                        <div
                          className="flex h-[18px] w-full items-center justify-center gap-0.5 border border-dashed border-emerald-500 bg-emerald-50 text-[10px] font-bold tracking-wide text-emerald-800"
                          title="출석 완료"
                        >
                          <Check size={11} strokeWidth={3} />
                          출석
                        </div>
                      </li>
                    ) : null}
                    {dayEvents.slice(0, visibleEventLimit).map((event) => (
                      <li key={event.id} className="relative">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedId((current) => (current === event.id ? null : event.id))
                          }
                          data-event-trigger="true"
                          className={`w-full truncate border border-dashed px-1 py-0.5 text-left text-[10px] ${
                            selectedId === event.id
                              ? "border-gray-800 bg-gray-200 text-gray-900"
                              : event.isFollowing
                                ? "border-pink-300 bg-pink-50 text-pink-700"
                                : "border-gray-300 bg-gray-100 text-gray-700"
                          }`}
                          title={event.title}
                        >
                          {EVENT_TYPE_LABELS[event.type]} · {event.title}
                        </button>
                        {selectedId === event.id ? (
                          <MiniEventPopup
                            event={event}
                            onUnfollow={
                              event.isFollowing && event.contentId && event.category !== "personal"
                                ? () => void handleToggleFollow(event.contentId!, false)
                                : undefined
                            }
                            onDeletePersonal={
                              event.category === "personal"
                                ? () => handleDeletePersonalEvent(event.id)
                                : undefined
                            }
                            onEditPersonal={
                              event.category === "personal"
                                ? () => handleEditPersonalEvent(event)
                                : undefined
                            }
                          />
                        ) : null}
                      </li>
                    ))}
                    {dayEvents.length > visibleEventLimit ? (
                      <li className="text-[10px] text-gray-500">
                        +{dayEvents.length - visibleEventLimit}
                      </li>
                    ) : null}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </section>
      {isModalOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/35 p-4">
          <form
            onSubmit={handleSavePersonalEvent}
            className="w-full max-w-lg border border-dashed border-gray-500 bg-white p-4"
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900">
                {personalForm.id ? "내 일정 수정" : "내 캘린더 저장"}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center border border-dashed border-gray-400 bg-white hover:bg-gray-100"
              >
                <X size={14} />
              </button>
            </div>
            <div className="space-y-2">
              <input
                value={personalForm.title}
                onChange={(event) =>
                  setPersonalForm((current) => ({ ...current, title: event.target.value }))
                }
                type="text"
                placeholder="내 일정 제목"
                className="h-10 w-full border border-dashed border-gray-400 bg-white px-3 text-sm outline-none focus:border-gray-700"
                required
              />
              <input
                value={personalForm.startsAt}
                onChange={(event) =>
                  setPersonalForm((current) => ({ ...current, startsAt: event.target.value }))
                }
                type="datetime-local"
                className="h-10 w-full border border-dashed border-gray-400 bg-white px-3 text-sm outline-none focus:border-gray-700"
                required
              />
              <input
                value={personalForm.location}
                onChange={(event) =>
                  setPersonalForm((current) => ({ ...current, location: event.target.value }))
                }
                type="text"
                placeholder="장소"
                className="h-10 w-full border border-dashed border-gray-400 bg-white px-3 text-sm outline-none focus:border-gray-700"
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="inline-flex h-9 items-center justify-center border border-dashed border-gray-400 bg-white px-3 text-sm hover:bg-gray-100"
              >
                취소
              </button>
              <button
                type="submit"
                className="inline-flex h-9 items-center justify-center gap-1 border border-dashed border-gray-600 bg-gray-900 px-3 text-sm font-semibold text-white hover:bg-gray-700"
              >
                <Plus size={14} />
                {personalForm.id ? "수정 저장" : "저장"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
      {isSubmitModalOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/35 p-4">
          <form
            onSubmit={handleSubmitEventSuggestion}
            className="w-full max-w-lg border border-dashed border-gray-500 bg-white p-4"
          >
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-gray-900">일정 제보</h3>
                <p className="mt-1 text-xs text-gray-500">
                  공식 발매, 예약, 티켓, 팝업, 라이브 일정을 제보해 주세요.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsSubmitModalOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center border border-dashed border-gray-400 bg-white hover:bg-gray-100"
              >
                <X size={14} />
              </button>
            </div>
            {!userId ? (
              <p className="mb-3 border border-dashed border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                로그인 후 일정을 제보할 수 있습니다.
              </p>
            ) : null}
            <div className="space-y-2">
              <select
                value={submissionForm.eventType}
                onChange={(event) =>
                  setSubmissionForm((current) => ({
                    ...current,
                    eventType: event.target.value as EventSubmissionForm["eventType"],
                  }))
                }
                className="h-10 w-full border border-dashed border-gray-400 bg-white px-3 text-sm outline-none focus:border-gray-700"
              >
                {SUBMITTABLE_EVENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {EVENT_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
              <input
                value={submissionForm.title}
                onChange={(event) =>
                  setSubmissionForm((current) => ({ ...current, title: event.target.value }))
                }
                type="text"
                placeholder="일정 제목"
                className="h-10 w-full border border-dashed border-gray-400 bg-white px-3 text-sm outline-none focus:border-gray-700"
                required
              />
              <input
                value={submissionForm.startsAt}
                onChange={(event) =>
                  setSubmissionForm((current) => ({ ...current, startsAt: event.target.value }))
                }
                type="datetime-local"
                className="h-10 w-full border border-dashed border-gray-400 bg-white px-3 text-sm outline-none focus:border-gray-700"
                required
              />
              <input
                value={submissionForm.endsAt}
                onChange={(event) =>
                  setSubmissionForm((current) => ({ ...current, endsAt: event.target.value }))
                }
                type="datetime-local"
                aria-label="종료일"
                className="h-10 w-full border border-dashed border-gray-400 bg-white px-3 text-sm outline-none focus:border-gray-700"
              />
              <input
                value={submissionForm.location}
                onChange={(event) =>
                  setSubmissionForm((current) => ({ ...current, location: event.target.value }))
                }
                type="text"
                placeholder="장소 또는 판매처"
                className="h-10 w-full border border-dashed border-gray-400 bg-white px-3 text-sm outline-none focus:border-gray-700"
              />
              <input
                value={submissionForm.sourceUrl}
                onChange={(event) =>
                  setSubmissionForm((current) => ({ ...current, sourceUrl: event.target.value }))
                }
                type="url"
                placeholder="출처 URL"
                className="h-10 w-full border border-dashed border-gray-400 bg-white px-3 text-sm outline-none focus:border-gray-700"
                required
              />
              <input
                value={submissionForm.imageUrl}
                onChange={(event) =>
                  setSubmissionForm((current) => ({ ...current, imageUrl: event.target.value }))
                }
                type="url"
                placeholder="이미지 URL"
                className="h-10 w-full border border-dashed border-gray-400 bg-white px-3 text-sm outline-none focus:border-gray-700"
              />
              <textarea
                value={submissionForm.description}
                onChange={(event) =>
                  setSubmissionForm((current) => ({ ...current, description: event.target.value }))
                }
                placeholder="메모"
                rows={3}
                className="w-full resize-none border border-dashed border-gray-400 bg-white px-3 py-2 text-sm outline-none focus:border-gray-700"
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsSubmitModalOpen(false)}
                className="inline-flex h-9 items-center justify-center border border-dashed border-gray-400 bg-white px-3 text-sm hover:bg-gray-100"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={!userId || submittingEvent}
                className="inline-flex h-9 items-center justify-center gap-1 border border-dashed border-gray-600 bg-gray-900 px-3 text-sm font-semibold text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send size={14} />
                {submittingEvent ? "접수 중" : "제보하기"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </main>
  );
}

function MiniEventPopup({
  event,
  onUnfollow,
  onEditPersonal,
  onDeletePersonal,
}: {
  event: CalendarEvent;
  onUnfollow?: () => void;
  onEditPersonal?: () => void;
  onDeletePersonal?: () => void;
}) {
  const shortTime = new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(event.startsAt));

  if (!event) {
    return null;
  }

  return (
    <aside
      data-event-popup="true"
      className="absolute top-full left-0 z-20 mt-1 w-[280px] border border-gray-400 bg-white p-3 shadow-[0_4px_16px_rgba(0,0,0,0.18)]"
    >
      {event.imageUrl ? (
        <div className="mb-2 h-28 overflow-hidden border border-dashed border-gray-300 bg-gray-100">
          <img src={event.imageUrl} alt="" className="h-full w-full object-cover" />
        </div>
      ) : null}
      <h3 className="truncate text-sm font-bold text-gray-900">{event.title}</h3>
      {event.description ? (
        <p className="mt-1 line-clamp-3 text-[11px] leading-4 text-gray-600">{event.description}</p>
      ) : null}
      <div className="mt-2 flex flex-col gap-1.5 text-[11px] text-gray-700">
        <p className="flex items-center gap-1">
          <Clock3 size={12} />
          {shortTime}
        </p>
        <p className="flex items-center gap-1">
          <MapPin size={12} />
          {event.location ?? event.platform ?? "미정"}
        </p>
        {event.imageUrl ? (
          <p className="flex items-center gap-1">
            <ImageIcon size={12} />
            이미지 등록됨
          </p>
        ) : null}
        {event.sourceUrl ? (
          <a
            href={event.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-blue-600 hover:underline"
          >
            <ExternalLink size={12} />
            공식/출처 링크
          </a>
        ) : null}
        <p className="flex items-center gap-1">
          <User size={12} />
          {event.isFollowing ? "관심 일정" : "공개 일정"}
        </p>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
        {onUnfollow ? (
          <button
            type="button"
            onClick={onUnfollow}
            className="inline-flex items-center justify-center gap-1 border border-dashed border-pink-300 bg-pink-50 px-2 py-1.5 text-pink-700 hover:bg-pink-100"
          >
            <Bell size={12} />
            팔로우 해제
          </button>
        ) : null}
        {event.category !== "personal" ? (
          <Link
            href={getEventDetailHref(event)}
            className="inline-flex items-center justify-center gap-1 border border-dashed border-gray-500 bg-white px-2 py-1.5 hover:bg-gray-100"
          >
            <CalendarDays size={12} />
            상세
          </Link>
        ) : null}
        {onEditPersonal ? (
          <button
            type="button"
            onClick={onEditPersonal}
            className="inline-flex items-center justify-center gap-1 border border-dashed border-gray-500 bg-white px-2 py-1.5 hover:bg-gray-100"
          >
            <Edit3 size={12} />
            수정
          </button>
        ) : null}
        {onDeletePersonal ? (
          <button
            type="button"
            onClick={onDeletePersonal}
            className="inline-flex items-center justify-center gap-1 border border-dashed border-red-300 bg-red-50 px-2 py-1.5 text-red-700 hover:bg-red-100"
          >
            <Trash2 size={12} />
            삭제
          </button>
        ) : null}
      </div>
    </aside>
  );
}

function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

function toLocalDateTimeValue(value: string): string {
  const date = new Date(value);
  const localMs = date.getTime() - date.getTimezoneOffset() * 60 * 1000;
  return new Date(localMs).toISOString().slice(0, 16);
}

function dateOnlyToKstIso(value: string): string {
  return `${value}T00:00:00+09:00`;
}

function emptyToNullish(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function getEventDetailHref(event: CalendarEvent): string {
  if (event.id.startsWith("release-date-") && event.contentId) return `/releases/${event.contentId}`;
  if (["goods_preorder", "goods_release", "offline_event", "ticket_event", "live_event"].includes(event.type)) {
    return `/events/${event.id}`;
  }
  return `/calendar/events/${event.id}`;
}
