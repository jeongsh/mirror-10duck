"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

/**
 * 한 달 일정 캘린더.
 *
 * ⚠️ 현재 GNB 에서는 의도적으로 노출 제외(Phase 2 평가에서 핏이 약하다고 판단).
 *    URL 직접 진입(`/calendar`) 만 가능. Phase 3 진입 시점에 컨셉을 갈아엎어
 *    "시즌 애니 방영표 + 캐릭터 다마고치 일정" 하이브리드로 재설계 예정.
 *
 * 정책:
 * - 진입 시점의 OS 시각 기준으로 이번 달을 보여준다.
 * - 좌/우 화살표로 1달씩 이동.
 * - 일정 데이터는 현재 더미. 추후 외부 데이터(AniList 등) + 내부 캐릭터 라이브러리
 *   기반으로 자동 채움 구조로 전환 예정.
 */
export default function CalendarPage() {
  // 현재 달의 1일을 기준점으로 들고 다닌다 (시간/일자 노이즈 제거).
  const [cursor, setCursor] = useState<Date>(() => startOfMonth(new Date()));

  const today = useMemo(() => stripTime(new Date()), []);
  const weeks = useMemo(() => buildMonthGrid(cursor), [cursor]);
  const allEvents = useMemo(() => DUMMY_EVENTS, []);
  const events = useMemo(
    () =>
      allEvents
        .filter((e) => isSameMonth(e.date, cursor))
        .sort((a, b) => a.date.getTime() - b.date.getTime()),
    [allEvents, cursor]
  );

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const key = ymdKey(e.date);
      const list = map.get(key) ?? [];
      list.push(e);
      map.set(key, list);
    }
    return map;
  }, [events]);

  const monthLabel = `${cursor.getFullYear()}년 ${cursor.getMonth() + 1}월`;

  return (
    <main className="flex w-full flex-col gap-4">
      <header className="flex items-center justify-between border border-dashed border-gray-500 bg-white/70 p-4">
        <button
          type="button"
          onClick={() => setCursor((c) => addMonths(c, -1))}
          className="border border-dashed border-gray-500 bg-white px-3 py-1.5 text-sm hover:bg-gray-100"
          aria-label="이전 달"
        >
          ← 이전
        </button>
        <h1 className="text-lg font-bold tracking-widest">{monthLabel}</h1>
        <button
          type="button"
          onClick={() => setCursor((c) => addMonths(c, 1))}
          className="border border-dashed border-gray-500 bg-white px-3 py-1.5 text-sm hover:bg-gray-100"
          aria-label="다음 달"
        >
          다음 →
        </button>
      </header>

      <section className="border border-dashed border-gray-500 bg-white/70 p-3">
        <div className="grid grid-cols-7 border-b border-dashed border-gray-400 pb-2 text-center text-xs font-semibold tracking-widest">
          {WEEKDAYS.map((wd, i) => (
            <span
              key={wd}
              className={
                i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-gray-700"
              }
            >
              {wd}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {weeks.flat().map((day) => {
            const inMonth = day.getMonth() === cursor.getMonth();
            const isToday = sameDay(day, today);
            const dayEvents = eventsByDay.get(ymdKey(day)) ?? [];
            const dow = day.getDay();
            return (
              <div
                key={day.toISOString()}
                className={`min-h-[96px] border-b border-r border-dashed border-gray-300 p-1.5 text-xs first:border-l-0 ${
                  inMonth ? "bg-white/80" : "bg-gray-100/60 text-gray-400"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[11px] font-semibold ${
                      isToday
                        ? "bg-pink-500 text-white"
                        : dow === 0
                          ? "text-red-500"
                          : dow === 6
                            ? "text-blue-500"
                            : "text-gray-700"
                    }`}
                  >
                    {day.getDate()}
                  </span>
                  {dayEvents.length > 0 && (
                    <span className="rounded-full bg-gray-200 px-1.5 text-[10px] text-gray-700">
                      {dayEvents.length}
                    </span>
                  )}
                </div>
                <ul className="mt-1 space-y-0.5">
                  {dayEvents.slice(0, 2).map((e) => (
                    <li
                      key={e.id}
                      className="truncate rounded bg-gray-100 px-1 py-0.5 text-[10px] text-gray-700"
                      title={e.title}
                    >
                      {e.title}
                    </li>
                  ))}
                  {dayEvents.length > 2 && (
                    <li className="text-[10px] text-gray-500">
                      +{dayEvents.length - 2} more
                    </li>
                  )}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      <section className="border border-dashed border-gray-500 bg-white/70 p-4">
        <h2 className="mb-2 text-sm font-bold tracking-widest text-gray-600">
          [{monthLabel} 일정]
          <span className="ml-2 text-[10px] font-normal text-gray-400">
            (더미 데이터 · 스키마 적용 후 실제 데이터로 교체 예정)
          </span>
        </h2>
        {events.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500">
            이 달에 등록된 일정이 없습니다.
          </p>
        ) : (
          <ul className="divide-y divide-dashed divide-gray-300 border border-dashed border-gray-300">
            {events.map((e) => (
              <li
                key={e.id}
                className="grid grid-cols-[110px_1fr] items-center px-3 py-2 text-sm hover:bg-gray-50"
              >
                <span className="font-mono text-gray-600">
                  {formatMd(e.date)} ({WEEKDAYS[e.date.getDay()]})
                </span>
                {e.href ? (
                  <Link href={e.href} className="truncate hover:underline">
                    {e.title}
                  </Link>
                ) : (
                  <span className="truncate">{e.title}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// 데이터 (현재는 더미. 추후 community_events 테이블 fetch 로 교체)
// ────────────────────────────────────────────────────────────────────────────

type CalendarEvent = {
  id: string;
  date: Date;
  title: string;
  href?: string;
};

/**
 * 오늘 기준 ±N일 / ±N달 위치에 샘플 일정을 심어두기 위한 헬퍼.
 *
 * 실제 시각은 동적으로 계산되므로, 사용자가 언제 페이지를 열어도
 * 이번 달과 인접 달에 일정이 보이게 된다.
 */
function offsetFromToday(monthDelta: number, day: number): Date {
  const base = new Date();
  return new Date(base.getFullYear(), base.getMonth() + monthDelta, day);
}

const DUMMY_EVENTS: CalendarEvent[] = [
  // 이번 달
  { id: "dum-1", date: offsetFromToday(0, 3), title: "씹덕 정기 운영 회의" },
  { id: "dum-2", date: offsetFromToday(0, 7), title: "Live2D 모델 신작 드롭 (마오쨩 콜라보)" },
  { id: "dum-3", date: offsetFromToday(0, 12), title: "주말 오프라인 번개 모임" },
  { id: "dum-4", date: offsetFromToday(0, 15), title: "캐릭터 스티커 콘테스트 마감" },
  { id: "dum-5", date: offsetFromToday(0, 18), title: "Phase 3 크리에이터 스튜디오 베타 오픈" },
  { id: "dum-6", date: offsetFromToday(0, 21), title: "팬아트 챌린지 결과 발표" },
  { id: "dum-7", date: offsetFromToday(0, 24), title: "AI 롤플레잉 챗봇 데모 라이브" },
  { id: "dum-8", date: offsetFromToday(0, 24), title: "(같은 날 두 번째 일정 테스트)" },
  { id: "dum-9", date: offsetFromToday(0, 28), title: "월간 결산 + 다음 달 로드맵 공개" },

  // 다음 달
  { id: "dum-10", date: offsetFromToday(1, 5), title: "여름 시즌 한정 스킨 출시" },
  { id: "dum-11", date: offsetFromToday(1, 14), title: "크리에이터 정산 1차 라운드" },
  { id: "dum-12", date: offsetFromToday(1, 22), title: "C2C 거래소 사전 등록 시작" },

  // 지난 달
  { id: "dum-13", date: offsetFromToday(-1, 9), title: "[지난 달] 베타 테스터 모집 마감" },
  { id: "dum-14", date: offsetFromToday(-1, 26), title: "[지난 달] Phase 2.3 회고" },
];

// ────────────────────────────────────────────────────────────────────────────
// 날짜 유틸
// ────────────────────────────────────────────────────────────────────────────

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, delta: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1);
}

function stripTime(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

function ymdKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function formatMd(d: Date): string {
  return `${pad2(d.getMonth() + 1)}.${pad2(d.getDate())}`;
}

/**
 * 6주(42칸) 그리드로 빌드.
 * - 첫 칸 = 해당 달 1일이 속한 주의 일요일.
 * - 마지막 칸 = 위 시작점에서 41일 뒤.
 * - 달력의 빈 칸은 전월/다음월 날짜로 채워서 시각적으로 끊김 없게.
 */
function buildMonthGrid(cursor: Date): Date[][] {
  const first = startOfMonth(cursor);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());

  const weeks: Date[][] = [];
  for (let w = 0; w < 6; w++) {
    const row: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + w * 7 + i);
      row.push(d);
    }
    weeks.push(row);
  }
  return weeks;
}
