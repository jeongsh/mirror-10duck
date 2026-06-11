const NAMUWIKI_ORIGIN = "https://namu.wiki";
const NAMUWIKI_USER_AGENT = "SSIBDUK-ReleaseBot/1.0 (+https://ssibduk.com)";

const SUBPAGE_SUFFIX_PATTERN =
  /\/(?:코믹스|애니메이션|등장인물|라이트\s*노벨|웹(?:툰|소)|소설|TV\s*애니메이션|OVA|극장판)$/;

const BLOCKED_LINK_NAMESPACES = [
  "분류:",
  "파일:",
  "틀:",
  "나무위키:",
  "토론:",
  "사용자:",
  "특수기능:",
];

const DETAIL_LABELS = [
  "애니메이션 제작",
  "서브 캐릭터 디자인",
  "캐릭터 디자인",
  "시리즈 구성",
  "편당 러닝타임",
  "시청 등급",
  "방영 기간",
  "방송 기간",
  "방영 시간",
  "총감독",
  "감독",
  "원작",
  "장르",
  "제작사",
  "제작",
  "음악",
  "화수",
  "방송국",
  "스트리밍",
];

const KOREAN_BROADCAST_KEYWORDS = [
  "대한민국",
  "한국",
  "애니플러스",
  "애니맥스",
  "애니박스",
  "애니원",
  "챔프",
  "투니버스",
  "대원방송",
  "대교어린이TV",
  "KBS",
  "MBC",
  "SBS",
  "EBS",
  "JTBC",
  "LAFTEL",
  "라프텔",
  "TVING",
  "티빙",
  "WATCHA",
  "왓챠",
  "Wavve",
  "웨이브",
  "Netflix",
  "넷플릭스",
  "Disney+",
  "디즈니+",
  "쿠팡플레이",
  "네이버",
  "카카오",
];

const KOREAN_WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

export type NamuwikiDetailEntry = {
  label: string;
  value: string;
};

export type NamuwikiSeasonLink = {
  fullTitle: string;
  title: string;
  href: string;
  url: string;
  matchingKey: string;
};

export type NamuwikiSeasonItem = NamuwikiSeasonLink & {
  overview: string;
  synopsis: string;
  details: NamuwikiDetailEntry[];
  genres: string[];
  studios: string[];
  streamingPlatforms: string[];
  episodeCount: number | null;
  releaseDate: string | null;
  isAdult: boolean;
  searchTitles: string[];
};

export type NamuwikiSeasonResult = {
  sourceUrl: string;
  totalLinks: number;
  items: NamuwikiSeasonItem[];
  skipped: Array<{ title: string; href: string; reason: string }>;
};

export function buildNamuwikiSeasonCategoryUrl(cours: string): string | null {
  const match = cours.match(/^(\d{4})-Q([1-4])$/i);
  if (!match) return null;

  const title = `분류:${match[1]}년 ${match[2]}분기 일본 애니메이션`;
  return `${NAMUWIKI_ORIGIN}/w/${encodeURIComponent(title)}`;
}

export function normalizeNamuwikiSeasonUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:") return null;
    if (url.hostname !== "namu.wiki") return null;

    const path = safeDecodeURIComponent(url.pathname);
    if (!path.startsWith("/w/분류:")) return null;
    if (!path.includes("분기") || !path.includes("일본") || !path.includes("애니메이션")) return null;

    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

export function extractNamuwikiSeasonTitle(fullTitle: string): string {
  let title = decodeHtmlEntities(fullTitle.trim());
  title = title.replace(SUBPAGE_SUFFIX_PATTERN, "");
  const tildeIndex = title.indexOf("~");
  if (tildeIndex >= 0) title = title.slice(0, tildeIndex).trim();
  return title.replace(/\s+/g, " ").trim();
}

export function normalizeNamuwikiTitleKey(value: string | null | undefined): string {
  if (!value) return "";
  return extractNamuwikiSeasonTitle(value)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[()[\]{}〈〉《》「」『』~!@#$%^&*_+=|\\:;"',.<>/?`·・\-]/g, "");
}

export function parseNamuwikiSeasonLinks(html: string, sourceUrl: string): NamuwikiSeasonLink[] {
  const links: NamuwikiSeasonLink[] = [];
  const seen = new Set<string>();
  const anchorPattern = /<a\b[^>]*href=(["'])(\/w\/[^"']+)\1[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(anchorPattern)) {
    const rawHref = match[2] ?? "";
    const rawText = htmlToText(match[3] ?? "");
    const decodedPath = safeDecodeURIComponent(rawHref.split(/[?#]/)[0] ?? rawHref);
    const decodedTitle = decodedPath.replace(/^\/w\//, "");

    if (!rawHref || !rawText) continue;
    if (shouldSkipCategoryAnchor(decodedTitle, rawText)) continue;

    const fullTitle = rawText;
    const title = extractNamuwikiSeasonTitle(fullTitle);
    const matchingKey = normalizeNamuwikiTitleKey(title);
    if (!title || !matchingKey) continue;
    if (seen.has(matchingKey)) continue;

    const url = new URL(rawHref, sourceUrl).toString();
    seen.add(matchingKey);
    links.push({
      fullTitle,
      title,
      href: rawHref,
      url,
      matchingKey,
    });
  }

  return links;
}

export async function fetchNamuwikiSeasonItems(
  namuwikiUrl: string,
  options: { cours?: string; delayMs?: number; limit?: number } = {},
): Promise<NamuwikiSeasonResult> {
  const sourceUrl = normalizeNamuwikiSeasonUrl(namuwikiUrl);
  if (!sourceUrl) {
    throw new Error("나무위키 분기 분류 URL 형식이 올바르지 않습니다.");
  }

  const html = await fetchNamuwikiHtml(sourceUrl);
  if (!html) {
    throw new Error("나무위키 분류 페이지를 가져오지 못했습니다.");
  }

  const links = parseNamuwikiSeasonLinks(html, sourceUrl);
  const items: NamuwikiSeasonItem[] = [];
  const skipped: NamuwikiSeasonResult["skipped"] = [];
  const delayMs = options.delayMs ?? 200;
  const pageLinks = options.limit ? links.slice(0, options.limit) : links;

  for (const link of pageLinks) {
    if (items.length > 0 || skipped.length > 0) {
      await sleep(delayMs);
    }

    const workHtml = await fetchNamuwikiHtml(link.url);
    if (!workHtml) {
      console.warn(`[namuwiki-season] failed to fetch work page: ${link.url}`);
      skipped.push({ title: link.title, href: link.href, reason: "page_fetch_failed" });
      continue;
    }

    items.push(parseNamuwikiWorkPage(link, workHtml, options.cours));
  }

  return {
    sourceUrl,
    totalLinks: links.length,
    items,
    skipped,
  };
}

function parseNamuwikiWorkPage(link: NamuwikiSeasonLink, html: string, cours?: string): NamuwikiSeasonItem {
  const tables = extractInfoTables(html);
  const details = pickInfoTableDetails(tables, cours);
  const overview = extractSectionText(html, ["개요"]);
  const plot = extractSectionText(html, ["줄거리", "시놉시스", "스토리"]);
  const synopsis = pickSynopsis(plot, overview);
  const genreValue = findDetailValue(details, ["장르"]);
  const studioValue = findDetailValue(details, ["애니메이션 제작", "제작사", "제작"]);
  const releaseValue = findDetailValue(details, ["방영 기간", "방송 기간"]);
  const episodeValue = findDetailValue(details, ["화수"]);
  const ratingValue = findDetailValue(details, ["시청 등급"]);
  const streamingValue = findDetailValue(details, ["스트리밍"]);

  return {
    ...link,
    overview,
    synopsis,
    details,
    genres: splitDetailList(genreValue),
    studios: splitDetailList(studioValue),
    streamingPlatforms: splitStreamingPlatforms(streamingValue),
    episodeCount: parseEpisodeCount(episodeValue),
    releaseDate: cours
      ? pickCoursReleaseDateFromTables(tables, cours)
      : parseFirstReleaseDate(releaseValue),
    isAdult: isAdultNamuwikiText(`${link.fullTitle} ${genreValue} ${ratingValue}`),
    searchTitles: buildSearchTitles(link),
  };
}

type NamuwikiInfoTable = {
  details: NamuwikiDetailEntry[];
  releaseDates: string[];
  text: string;
};

function extractInfoTables(html: string): NamuwikiInfoTable[] {
  const tablePattern = /<table\b[\s\S]*?<\/table>/gi;
  const tables: NamuwikiInfoTable[] = [];

  for (const match of html.matchAll(tablePattern)) {
    const tableHtml = match[0] ?? "";
    const details = extractInfoDetailsFromHtml(tableHtml);
    if (details.length === 0) continue;

    const releaseText = details
      .filter((detail) => detail.label === "방영 기간" || detail.label === "방송 기간")
      .map((detail) => detail.value)
      .join(" ");

    tables.push({
      details,
      releaseDates: extractReleaseDateCandidates(releaseText),
      text: htmlToText(tableHtml),
    });
  }

  return tables;
}

function extractInfoDetailsFromHtml(html: string): NamuwikiDetailEntry[] {
  const details: NamuwikiDetailEntry[] = [];
  const seen = new Set<string>();
  const rowPattern = /<tr\b[^>]*class=(["'])[^"']*wiki-table-tr[^"']*\1[^>]*>([\s\S]*?)<\/tr>/gi;

  for (const row of html.matchAll(rowPattern)) {
    const cells = [...(row[2] ?? "").matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) =>
      htmlToText(cell[1] ?? ""),
    );
    if (cells.length < 2) continue;

    const label = normalizeDetailLabel(cells[0] ?? "");
    const value = cleanDetailValue(cells.slice(1).join(" "));
    if (!label || !value || seen.has(label)) continue;

    seen.add(label);
    details.push({ label, value });
  }

  return details;
}

function pickInfoTableDetails(tables: NamuwikiInfoTable[], cours?: string): NamuwikiDetailEntry[] {
  if (tables.length === 0) return [];
  if (!cours) return tables[0]?.details ?? [];

  const ranked = tables
    .map((table, index) => ({ table, index, score: scoreInfoTableForCours(table, cours) }))
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const best = ranked[0];
  if (!best || best.score <= 0) return tables[0]?.details ?? [];
  return best.table.details;
}

function scoreInfoTableForCours(table: NamuwikiInfoTable, cours: string): number {
  let score = 0;
  if (table.releaseDates.some((date) => isDateInCours(date, cours))) score += 100;
  if (table.details.some((detail) => detail.label === "스트리밍")) score += 5;
  if (table.details.some((detail) => detail.label === "방송국")) score += 3;
  if (table.details.some((detail) => detail.label === "화수")) score += 2;
  return score;
}

function normalizeDetailLabel(value: string): string | null {
  const compact = cleanDetailValue(value).replace(/^작품 정보\s*▼\s*/, "");
  for (const label of DETAIL_LABELS) {
    if (compact === label) return label;
    if (label !== "제작" && new RegExp(`^${escapeRegExp(label)}(?:\\s|/|·|ㆍ|,)`).test(compact)) {
      return label;
    }
  }
  return null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cleanDetailValue(value: string): string {
  return value
    .replace(/\[[0-9]+\]/g, "")
    .replace(/\[편집\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractSectionText(html: string, sectionNames: string[]): string {
  const headingPattern =
    /<h([2-4])\b[^>]*class=(["'])[^"']*wiki-heading[^"']*\2[^>]*>([\s\S]*?)<\/h\1>/gi;
  const headings = [...html.matchAll(headingPattern)].map((match) => ({
    index: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length,
    title: normalizeHeadingTitle(htmlToText(match[3] ?? "")),
  }));

  for (let i = 0; i < headings.length; i += 1) {
    const heading = headings[i];
    if (!heading || !sectionNames.includes(heading.title)) continue;

    const next = headings
      .slice(i + 1)
      .find((candidate) => candidate.title && !candidate.title.match(/^(PV|키 비주얼|OP|ED)\d*$/));
    const raw = html.slice(heading.end, next?.index ?? html.length);
    const withoutTables = raw.replace(/<table\b[\s\S]*?<\/table>/gi, " ");
    return cleanSynopsisText(htmlToText(withoutTables)).slice(0, 1800);
  }

  return "";
}

function normalizeHeadingTitle(value: string): string {
  return value
    .replace(/^\d+(?:\.\d+)*\.\s*/, "")
    .replace(/\[편집\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function pickSynopsis(plot: string, overview: string): string {
  if (plot.length >= 80) return plot;
  if (plot && overview) return cleanSynopsisText(`${overview} ${plot}`);
  return plot || overview;
}

function cleanSynopsisText(value: string): string {
  return value
    .replace(/\[[0-9]+\]/g, "")
    .replace(/\[편집\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function findDetailValue(details: NamuwikiDetailEntry[], labels: string[]): string {
  return details.find((detail) => labels.includes(detail.label))?.value ?? "";
}

function splitDetailList(value: string): string[] {
  if (!value) return [];
  return Array.from(
    new Set(
      value
        .split(/[,/|·ㆍ]/)
        .map((item) => item.replace(/\[[0-9]+\]/g, "").trim())
        .filter((item) => item.length > 0 && item.length <= 40),
    ),
  ).slice(0, 8);
}

function parseEpisodeCount(value: string): number | null {
  const match = value.match(/(?:전\s*)?(\d{1,3})\s*화/);
  if (!match) return null;
  const count = Number(match[1]);
  return Number.isFinite(count) && count > 0 ? count : null;
}

function parseFirstReleaseDate(value: string): string | null {
  return extractReleaseDateCandidates(value)[0] ?? null;
}

function pickCoursReleaseDateFromTables(tables: NamuwikiInfoTable[], cours: string): string | null {
  for (const table of tables) {
    const tableDates = table.releaseDates.filter((date) => isDateInCours(date, cours));
    const koreanDate = pickKoreanBroadcastDate(table.details, tableDates);
    if (koreanDate) return koreanDate;
  }

  const candidates = tables.flatMap((table) => table.releaseDates).filter((date) => isDateInCours(date, cours)).sort();

  return candidates[0] ?? null;
}

function pickKoreanBroadcastDate(details: NamuwikiDetailEntry[], dates: string[]): string | null {
  if (dates.length === 0) return null;
  if (dates.length === 1) return dates[0] ?? null;

  const weekday = inferKoreanBroadcastWeekday(details);
  if (weekday) {
    const matched = dates.find((date) => getKoreanWeekday(date) === weekday);
    if (matched) return matched;
  }

  const hasKoreanBroadcast = details
    .filter((detail) => detail.label === "방송국" || detail.label === "스트리밍")
    .some((detail) => KOREAN_BROADCAST_KEYWORDS.some((keyword) => detail.value.includes(keyword)));
  if (hasKoreanBroadcast) return dates[dates.length - 1] ?? null;

  return null;
}

function inferKoreanBroadcastWeekday(details: NamuwikiDetailEntry[]): string | null {
  const targetText = details
    .filter((detail) => detail.label === "방송국" || detail.label === "스트리밍")
    .map((detail) => detail.value)
    .join(" ");
  if (!targetText) return null;

  const slashSegments = targetText.split(/\s*\/\s*/g);
  for (let index = 0; index < slashSegments.length; index += 1) {
    const segment = slashSegments[index] ?? "";
    if (!KOREAN_BROADCAST_KEYWORDS.some((keyword) => segment.includes(keyword))) continue;

    const nextWeekday = extractFirstWeekday(slashSegments[index + 1] ?? "");
    if (nextWeekday) return nextWeekday;

    const sameSegmentWeekday = extractLastWeekday(segment);
    if (sameSegmentWeekday) return sameSegmentWeekday;
  }

  let best: { weekday: string; distance: number } | null = null;
  const weekdayMatches = [...targetText.matchAll(/\(([일월화수목금토])\)|([일월화수목금토])요일/g)].map((match) => ({
    weekday: match[1] ?? match[2] ?? "",
    index: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length,
  }));

  for (const keyword of KOREAN_BROADCAST_KEYWORDS) {
    let keywordIndex = targetText.indexOf(keyword);
    while (keywordIndex >= 0) {
      for (const match of weekdayMatches) {
        const distance =
          match.index >= keywordIndex
            ? match.index - keywordIndex
            : keywordIndex - match.end;
        if (distance > 48) continue;
        if (!best || distance < best.distance) {
          best = { weekday: match.weekday, distance };
        }
      }

      keywordIndex = targetText.indexOf(keyword, keywordIndex + keyword.length);
    }
  }

  return best?.weekday ?? null;
}

function extractFirstWeekday(value: string): string | null {
  const match = value.match(/\(([일월화수목금토])\)|([일월화수목금토])요일/);
  return match?.[1] ?? match?.[2] ?? null;
}

function extractLastWeekday(value: string): string | null {
  const matches = [...value.matchAll(/\(([일월화수목금토])\)|([일월화수목금토])요일/g)];
  const match = matches[matches.length - 1];
  return match?.[1] ?? match?.[2] ?? null;
}

function getKoreanWeekday(date: string): string | null {
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const weekdayIndex = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))).getUTCDay();
  return KOREAN_WEEKDAYS[weekdayIndex] ?? null;
}

export function isDateInCours(date: string | null | undefined, cours: string | null | undefined): boolean {
  if (!date || !cours) return false;
  const range = getCoursDateRange(cours);
  if (!range) return false;
  return date >= range.start && date <= range.end;
}

function extractReleaseDateCandidates(value: string): string[] {
  const dates: string[] = [];
  const pushDate = (year: string, month: string, day: string) => {
    dates.push(`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`);
  };

  for (const match of value.matchAll(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.?/g)) {
    pushDate(match[1], match[2], match[3]);
  }
  for (const match of value.matchAll(/(\d{4})-(\d{1,2})-(\d{1,2})/g)) {
    pushDate(match[1], match[2], match[3]);
  }
  for (const match of value.matchAll(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/g)) {
    pushDate(match[1], match[2], match[3]);
  }

  return Array.from(new Set(dates));
}

function getCoursDateRange(cours: string): { start: string; end: string } | null {
  const match = cours.match(/^(\d{4})-Q([1-4])$/i);
  if (!match) return null;

  const year = Number(match[1]);
  const quarter = Number(match[2]);
  const startMonth = (quarter - 1) * 3 + 1;
  const endMonth = startMonth + 2;
  const endDay = new Date(Date.UTC(year, endMonth, 0)).getUTCDate();

  return {
    start: `${year}-${String(startMonth).padStart(2, "0")}-01`,
    end: `${year}-${String(endMonth).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`,
  };
}

function splitStreamingPlatforms(value: string): string[] {
  if (!value) return [];

  const arrowParts = value
    .split(/\s*▶\s*/g)
    .map((item) => item.trim())
    .filter((item) => item.length > 0 && item.length <= 40);
  if (arrowParts.length > 1) return Array.from(new Set(arrowParts));

  return Array.from(
    new Set(
      value
        .replace(/▶/g, " ")
        .split(/[,/|·ㆍ]/)
        .map((item) => item.trim())
        .filter((item) => item.length > 0 && item.length <= 40),
    ),
  );
}

function isAdultNamuwikiText(value: string): boolean {
  return /(?:성인|19세|청소년\s*관람\s*불가|R-?18)/i.test(value);
}

function buildSearchTitles(link: NamuwikiSeasonLink): string[] {
  const withoutParentheses = link.title.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
  const decodedPath = safeDecodeURIComponent(link.href).replace(/^\/w\//, "");
  return Array.from(
    new Set([link.title, link.fullTitle, withoutParentheses, extractNamuwikiSeasonTitle(decodedPath)].filter(Boolean)),
  );
}

function shouldSkipCategoryAnchor(decodedTitle: string, text: string): boolean {
  const title = decodedTitle.trim();
  const cleanText = text.trim();
  if (!title || !cleanText) return true;
  if (cleanText.startsWith("분류")) return true;
  if (cleanText === "일본 애니메이션") return true;
  if (/^애니메이션\/\d{4}년\s+\d{1,2}월$/.test(cleanText)) return true;
  if (BLOCKED_LINK_NAMESPACES.some((namespace) => title.startsWith(namespace))) return true;
  if (/^(최근 변경|최근 토론|특수 기능|역링크|편집|토론|역사)$/.test(cleanText)) return true;
  return false;
}

async function fetchNamuwikiHtml(url: string): Promise<string | null> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": NAMUWIKI_USER_AGENT,
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "ko-KR,ko;q=0.9",
        },
        signal: AbortSignal.timeout(12_000),
      });

      if (response.ok) return await response.text();
    } catch {
      // Retry once below.
    }

    if (attempt === 0) await sleep(500);
  }

  return null;
}

function htmlToText(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
      .replace(/<svg\b[\s\S]*?<\/svg>/gi, " ")
      .replace(/<sup\b[\s\S]*?<\/sup>/gi, " ")
      .replace(/<span\b[^>]*class=(["'])[^"']*wiki-edit-section[^"']*\1[^>]*>[\s\S]*?<\/span>/gi, " ")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<\/(?:p|div|li|tr|h[1-6])>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
