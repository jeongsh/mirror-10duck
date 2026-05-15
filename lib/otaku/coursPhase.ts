import { getCurrentCours, normalizeCours } from "@/lib/otaku/cours";

export type CoursCalendarPhase = "upcoming" | "ongoing" | "retro" | "archived";

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

  const retroStart = seoulYmdInt(coursRetroWindowStart(cours, 7)!);
  if (today >= retroStart) return "retro";

  return "ongoing";
}

export type CoursSlotKind = "ahead" | "live" | "behind";

export function getCoursSlotKind(cours: string, now = new Date()): CoursSlotKind {
  const current = getCurrentCours(now);
  const cmp = compareCours(cours, current);
  if (cmp > 0) return "ahead";
  if (cmp < 0) return "behind";
  return "live";
}

/**
 * 라인업 투표(볼래/고민/패스) 허용 여부.
 * - 다가올 분기(ahead): 해당 분기 **시작일 전**까지만 투표 가능.
 * - 현재·지난 분기: 분기 시작일 이후에는 마감(지난 분기는 기록 수정 불가).
 */
export function isLineupVoteAllowed(cours: string, now = new Date()): boolean {
  const start = coursQuarterStartDate(cours);
  if (!start) return false;
  const todayInt = seoulYmdInt(now);
  const startInt = seoulYmdInt(start);
  return todayInt < startInt;
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
