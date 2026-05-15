import { getCurrentCours, normalizeCours } from "@/lib/otaku/cours";

export type CoursCalendarPhase = "upcoming" | "lineup" | "ongoing" | "retro" | "archived";

const MS_PER_DAY = 86_400_000;

/** 서울 기준 연·월·일 (비교용 정수 YYYYMMDD) */
export function seoulYmdInt(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);
  const y = Number(parts.find((p) => p.type === "year")?.value ?? 0);
  const m = Number(parts.find((p) => p.type === "month")?.value ?? 0);
  const d = Number(parts.find((p) => p.type === "day")?.value ?? 0);
  return y * 10_000 + m * 100 + d;
}

export function parseCours(cours: string | null | undefined): { year: number; quarter: number } | null {
  const n = normalizeCours(cours);
  if (!n) return null;
  const m = n.match(/^(\d{4})-Q([1-4])$/);
  if (!m) return null;
  return { year: Number(m[1]), quarter: Number(m[2]) };
}

/** 분기 첫날 00:00 (Asia/Seoul 오프셋 고정, DST 없음) */
export function coursQuarterStartDate(cours: string): Date | null {
  const p = parseCours(cours);
  if (!p) return null;
  const month = (p.quarter - 1) * 3 + 1;
  const mm = String(month).padStart(2, "0");
  return new Date(`${p.year}-${mm}-01T00:00:00+09:00`);
}

/** 분기 마지막 날 23:59:59.999 KST */
export function coursQuarterEndDate(cours: string): Date | null {
  const start = coursQuarterStartDate(cours);
  if (!start) return null;
  const next = new Date(start);
  next.setMonth(next.getMonth() + 3);
  next.setTime(next.getTime() - 1);
  return next;
}

export function compareCours(a: string, b: string): number {
  const pa = parseCours(a);
  const pb = parseCours(b);
  if (!pa || !pb) return 0;
  if (pa.year !== pb.year) return pa.year - pb.year;
  return pa.quarter - pb.quarter;
}

/**
 * 분기 시작일부터 `days`일(당일 포함) — 라인업 투표용 첫 주.
 */
export function coursLineupWindowEnd(cours: string, days = 7): Date | null {
  const start = coursQuarterStartDate(cours);
  if (!start) return null;
  return new Date(start.getTime() + (days - 1) * MS_PER_DAY);
}

/**
 * 분기 마지막일 기준 앞으로 `days`일(당일 포함) — 회고 기간.
 */
export function coursRetroWindowStart(cours: string, days = 7): Date | null {
  const end = coursQuarterEndDate(cours);
  if (!end) return null;
  return new Date(end.getTime() - (days - 1) * MS_PER_DAY);
}

export function getCoursCalendarPhase(cours: string, now = new Date()): CoursCalendarPhase {
  const start = coursQuarterStartDate(cours);
  const end = coursQuarterEndDate(cours);
  if (!start || !end) return "archived";

  const today = seoulYmdInt(now);
  const startInt = seoulYmdInt(start);
  const endInt = seoulYmdInt(end);

  if (today < startInt) return "upcoming";
  if (today > endInt) return "archived";

  const lineupEnd = seoulYmdInt(coursLineupWindowEnd(cours, 7)!);
  if (today <= lineupEnd) return "lineup";

  const retroStart = seoulYmdInt(coursRetroWindowStart(cours, 7)!);
  if (today >= retroStart) return "retro";

  return "ongoing";
}

/**
 * 라인업 투표(볼래/고민/패스) 허용 여부.
 * - 지난 분기: 항상 허용(기록·정리 목적).
 * - 이번 분기: 라인업 주(분기 첫 7일)에만 허용.
 * - 미래 분기: 비허용.
 */
export function isLineupVoteAllowed(cours: string, now = new Date()): boolean {
  const current = getCurrentCours(now);
  const cmp = compareCours(cours, current);
  if (cmp < 0) return true;
  if (cmp > 0) return false;
  return getCoursCalendarPhase(cours, now) === "lineup";
}

const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"] as const;

/** `release_date` 문자열(YYYY-MM-DD) 기준 서울 요일. 없으면 null */
export function releaseDateToWeekdayKo(releaseDate: string | null | undefined): string | null {
  if (!releaseDate?.trim()) return null;
  const d = new Date(`${releaseDate.trim()}T12:00:00+09:00`);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    weekday: "short",
  }).formatToParts(d);
  const w = parts.find((p) => p.type === "weekday")?.value;
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const idx = w ? map[w] : undefined;
  if (idx === undefined) return null;
  return WEEKDAY_KO[idx];
}

export function weekdaySortKey(label: string): number {
  const order = ["월", "화", "수", "목", "금", "토", "일", "방송일 미정"];
  const i = order.indexOf(label);
  return i === -1 ? 99 : i;
}
