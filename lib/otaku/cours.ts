const COURS_PATTERN = /^(\d{4})-Q([1-4])$/;

export function normalizeCours(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  return COURS_PATTERN.test(normalized) ? normalized : null;
}

export function isValidCours(value: string | null | undefined): boolean {
  return normalizeCours(value) !== null;
}

export function getCurrentCours(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "numeric",
  }).formatToParts(date);

  const year = Number(parts.find((part) => part.type === "year")?.value ?? date.getFullYear());
  const month = Number(parts.find((part) => part.type === "month")?.value ?? date.getMonth() + 1);
  const quarter = month <= 3 ? 1 : month <= 6 ? 2 : month <= 9 ? 3 : 4;
  return `${year}-Q${quarter}`;
}

export function formatCoursLabel(cours: string | null | undefined): string {
  const normalized = normalizeCours(cours);
  if (!normalized) return "분기 미정";

  const match = normalized.match(COURS_PATTERN);
  if (!match) return normalized;

  return `${match[1]}년 ${match[2]}분기`;
}

export function formatCoursShort(cours: string | null | undefined): string {
  const normalized = normalizeCours(cours);
  if (!normalized) return "미정";

  const match = normalized.match(COURS_PATTERN);
  if (!match) return normalized;

  return `${match[1]} ${match[2]}분기`;
}

export function getRecentCoursList(count = 5, referenceDate = new Date()): string[] {
  let [year, quarter] = getCurrentCours(referenceDate).split("-Q").map(Number);

  const list: string[] = [];
  for (let i = 0; i < count; i++) {
    list.push(`${year}-Q${quarter}`);
    quarter--;
    if (quarter < 1) {
      quarter = 4;
      year--;
    }
  }
  return list;
}

export function getCoursRange(
  pastCount = 4,
  futureCount = 2,
  referenceDate = new Date(),
): string[] {
  const [currentYear, currentQuarter] = getCurrentCours(referenceDate)
    .split("-Q")
    .map(Number);

  const list: string[] = [];

  let year = currentYear;
  let quarter = currentQuarter + futureCount;
  while (quarter > 4) {
    quarter -= 4;
    year += 1;
  }

  for (let i = 0; i < pastCount + futureCount + 1; i++) {
    list.push(`${year}-Q${quarter}`);
    quarter -= 1;
    if (quarter < 1) {
      quarter = 4;
      year -= 1;
    }
  }
  return list;
}
