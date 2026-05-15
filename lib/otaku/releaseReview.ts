/** 서울 기준 오늘 날짜가 `release_date`(YYYY-MM-DD) 이상이면 방영 시작으로 간주 */
export function isReleaseAiredForReview(releaseDate: string | null | undefined, now = new Date()): boolean {
  if (!releaseDate?.trim()) return false;
  const d = releaseDate.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const y = parts.find((p) => p.type === "year")?.value ?? "";
  const m = parts.find((p) => p.type === "month")?.value ?? "";
  const day = parts.find((p) => p.type === "day")?.value ?? "";
  const todayStr = `${y}-${m}-${day}`;

  return todayStr >= d;
}

export const RELEASE_REVIEW_BODY_MAX = 2000;

export function normalizeReleaseReviewBody(raw: string): string {
  return raw.replace(/\r\n/g, "\n").trim();
}
