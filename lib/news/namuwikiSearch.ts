const NAMUWIKI_ORIGIN = "https://namu.wiki";
const NAMUWIKI_USER_AGENT = "SSIBDUK-NewsBot/1.0 (+https://ssibduk.com)";

const SUBPAGE_SUFFIX_PATTERN =
  /\/(?:코믹스|애니메이션|등장인물|라이트\s*노벨|웹(?:툰|소)|소설|TV\s*애니메이션|OVA|극장판)$/;

const PREFERRED_SUBPAGE_KEYWORDS = ["애니메이션", "라이트 노벨", "코믹스", "웹툰", "웹소", "소설"];
const BLOCKED_TITLE_PREFIXES = ["사용자:", "틀:", "파일:", "분류:"];
const ENGLISH_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "at",
  "by",
  "for",
  "from",
  "in",
  "is",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
]);

export type NamuwikiSearchHit = {
  fullTitle: string;
  shortTitle: string;
  href: string;
  snippet: string;
};

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x2F;/g, "/");
}

function stripHtmlTags(value: string): string {
  return value.replace(/<[^>]+>/g, " ");
}

function normalizeForMatch(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function tokenizeEnglish(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((token) => token.length > 1 && !ENGLISH_STOP_WORDS.has(token));
}

function containsHangul(value: string): boolean {
  return /[\uAC00-\uD7A3]/.test(value);
}

export function extractShortNamuwikiTitle(fullTitle: string): string {
  let title = decodeHtmlEntities(fullTitle.trim());
  title = title.replace(SUBPAGE_SUFFIX_PATTERN, "");
  const tildeIndex = title.indexOf("~");
  if (tildeIndex >= 0) title = title.slice(0, tildeIndex).trim();
  return title.trim();
}

export function parseNamuwikiSearchHtml(html: string): NamuwikiSearchHit[] {
  const hits: NamuwikiSearchHit[] = [];
  const pattern =
    /<h4[^>]*>\s*(?:<i[^>]*><\/i>\s*)?<a href="(\/w\/[^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/h4>\s*<div[^>]*>([\s\S]*?)<\/div>/gi;

  for (const match of html.matchAll(pattern)) {
    const href = match[1] ?? "";
    const fullTitle = decodeHtmlEntities(stripHtmlTags(match[2] ?? "").replace(/\s+/g, " ").trim());
    const snippet = decodeHtmlEntities(stripHtmlTags(match[3] ?? "").replace(/\s+/g, " ").trim());
    if (!href || !fullTitle) continue;

    hits.push({
      fullTitle,
      shortTitle: extractShortNamuwikiTitle(fullTitle),
      href,
      snippet,
    });
  }

  return hits;
}

function normalizeTitleKey(value: string): string {
  return extractShortNamuwikiTitle(value).trim().replace(/\s+/g, " ").toLowerCase();
}

export function isSameNamuwikiTitle(a: string, b: string): boolean {
  return normalizeTitleKey(a) === normalizeTitleKey(b);
}

function isBlockedNamuwikiTitle(title: string): boolean {
  const decoded = decodeHtmlEntities(title.trim());
  return BLOCKED_TITLE_PREFIXES.some((prefix) => decoded.startsWith(prefix));
}

function hasBlockedNamuwikiNamespace(hit: NamuwikiSearchHit): boolean {
  if (isBlockedNamuwikiTitle(hit.fullTitle) || isBlockedNamuwikiTitle(hit.shortTitle)) return true;
  const decodedHref = decodeURIComponent(hit.href);
  return BLOCKED_TITLE_PREFIXES.some((prefix) => decodedHref.includes(`/w/${prefix}`));
}

function isLikelyWorkTitleCandidate(title: string, workTitle?: string): boolean {
  if (!workTitle) return false;
  if (isSameNamuwikiTitle(title, workTitle)) return true;

  const titleShort = extractShortNamuwikiTitle(title);
  const workShort = extractShortNamuwikiTitle(workTitle);
  const titleHead = titleShort.split(",")[0]?.trim() ?? titleShort;

  return titleHead.length >= 6 && isSameNamuwikiTitle(titleHead, workShort);
}

function hasOriginalNameEvidence(hit: NamuwikiSearchHit, original: string): boolean {
  const tokens = tokenizeEnglish(original);
  if (tokens.length === 0) {
    const key = normalizeForMatch(original);
    const haystack = normalizeForMatch(`${hit.fullTitle} ${hit.shortTitle} ${hit.snippet}`);
    return key.length > 0 && haystack.includes(key);
  }

  return hasEnoughEnglishTokenEvidence(hit, tokens);
}

function hasEnoughEnglishTokenEvidence(hit: NamuwikiSearchHit, tokens: string[]): boolean {
  if (tokens.length === 0) return true;

  const haystack = normalizeForMatch(`${hit.fullTitle} ${hit.snippet} ${decodeURIComponent(hit.href)}`);
  const matchedCount = tokens.filter((token) => haystack.includes(token)).length;
  const requiredCount =
    tokens.length <= 2 ? tokens.length : Math.max(2, Math.ceil(tokens.length * 0.7));

  return matchedCount >= requiredCount;
}

function hasWorkContextEvidence(hit: NamuwikiSearchHit, workTitle?: string): boolean {
  if (!workTitle) return true;

  const workShort = extractShortNamuwikiTitle(workTitle);
  const haystack = `${hit.fullTitle} ${hit.snippet} ${decodeURIComponent(hit.href)}`;
  if (haystack.includes(workShort)) return true;

  const workTokens = workShort
    .split(/[\s,/~]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
  if (workTokens.some((token) => haystack.includes(token))) return true;

  return hit.href.includes("%EB%93%B1%EC%9E%A5%EC%9D%B8%EB%AC%BC") || hit.fullTitle.includes("등장인물");
}

function hasEnoughEnglishTitleEvidence(hit: NamuwikiSearchHit, tokens: string[]): boolean {
  if (tokens.length === 0) return true;

  const titleHaystack = normalizeForMatch(`${hit.fullTitle} ${hit.shortTitle} ${decodeURIComponent(hit.href)}`);
  const matchedCount = tokens.filter((token) => titleHaystack.includes(token)).length;
  const requiredCount =
    tokens.length <= 2 ? tokens.length : Math.max(2, Math.ceil(tokens.length * 0.7));

  return matchedCount >= requiredCount;
}

function hasExactEnglishTitleMatch(hit: NamuwikiSearchHit, query: string): boolean {
  const queryKey = normalizeForMatch(query);
  const hrefTitle = decodeURIComponent(hit.href).replace(/^\/w\//, "");

  return [hit.fullTitle, hit.shortTitle, hrefTitle].some(
    (candidate) => normalizeForMatch(candidate) === queryKey,
  );
}

function scoreNamuwikiHit(
  hit: NamuwikiSearchHit,
  query: string,
  options?: { requireTitleEvidence?: boolean },
): number {
  const queryTokens = tokenizeEnglish(query);
  const haystack = normalizeForMatch(`${hit.fullTitle} ${hit.snippet}`);
  let score = 0;

  if (hasBlockedNamuwikiNamespace(hit)) return -100;
  if (!hasEnoughEnglishTokenEvidence(hit, queryTokens)) return -100;
  if (options?.requireTitleEvidence && !hasEnoughEnglishTitleEvidence(hit, queryTokens)) {
    return -100;
  }

  if (hasExactEnglishTitleMatch(hit, query)) score += 30;

  if (containsHangul(hit.shortTitle)) score += 4;

  for (const token of queryTokens) {
    if (haystack.includes(token)) score += 3;
  }

  for (const keyword of PREFERRED_SUBPAGE_KEYWORDS) {
    if (hit.fullTitle.includes(keyword) || hit.href.includes(encodeURIComponent(keyword))) {
      score += 2;
    }
  }

  if (hit.fullTitle.includes("~")) score += 1;

  if (/분류:\d{4}년/.test(hit.snippet) && !hit.snippet.toLowerCase().includes("anime")) {
    score -= 2;
  }

  return score;
}

function pickBestNamuwikiHit(hits: NamuwikiSearchHit[], query: string): NamuwikiSearchHit | null {
  if (hits.length === 0) return null;

  const ranked = [...hits]
    .map((hit) => ({ hit, score: scoreNamuwikiHit(hit, query, { requireTitleEvidence: true }) }))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  if (!best || best.score < 4) return null;
  return best.hit;
}

function scoreCharacterHit(
  hit: NamuwikiSearchHit,
  original: string,
  workTitle?: string,
): number {
  if (isLikelyWorkTitleCandidate(hit.shortTitle, workTitle)) return -100;
  if (!hasOriginalNameEvidence(hit, original)) return -100;
  if (!hasWorkContextEvidence(hit, workTitle)) return -100;

  let score = scoreNamuwikiHit(hit, original);
  if (hit.href.includes("%EB%93%B1%EC%9E%A5%EC%9D%B8%EB%AC%BC") || hit.fullTitle.includes("등장인물")) {
    score += 5;
  }
  if (hit.shortTitle.length <= 12) score += 2;
  if (hit.shortTitle.includes(",")) score -= 4;
  if (hit.fullTitle.startsWith("틀:")) score -= 3;
  return score;
}

function pickBestCharacterHit(
  hits: NamuwikiSearchHit[],
  original: string,
  workTitle?: string,
): NamuwikiSearchHit | null {
  if (hits.length === 0) return null;

  const ranked = [...hits]
    .map((hit) => ({ hit, score: scoreCharacterHit(hit, original, workTitle) }))
    .filter((item) => item.score >= 4)
    .sort((a, b) => b.score - a.score);

  return ranked[0]?.hit ?? null;
}

async function fetchNamuwikiHtml(path: string): Promise<string | null> {
  try {
    const response = await fetch(`${NAMUWIKI_ORIGIN}${path}`, {
      headers: {
        "User-Agent": NAMUWIKI_USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "ko-KR,ko;q=0.9",
      },
      signal: AbortSignal.timeout(12_000),
    });

    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

function extractNamuwikiDocumentTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) return null;

  const title = decodeHtmlEntities(stripHtmlTags(match[1] ?? "").replace(/\s+/g, " ").trim())
    .replace(/\s+-\s+나무위키\s*$/, "")
    .trim();
  const shortTitle = extractShortNamuwikiTitle(title);

  if (!shortTitle || isBlockedNamuwikiTitle(shortTitle)) return null;
  return shortTitle;
}

async function resolveNamuwikiHitTitle(hit: NamuwikiSearchHit): Promise<string | null> {
  const html = await fetchNamuwikiHtml(hit.href);
  const documentTitle = html ? extractNamuwikiDocumentTitle(html) : null;
  const fallbackTitle = extractShortNamuwikiTitle(hit.shortTitle);
  const title = documentTitle ?? fallbackTitle;

  if (!title || isBlockedNamuwikiTitle(title)) return null;
  return title;
}

export async function searchNamuwiki(query: string): Promise<NamuwikiSearchHit[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const html = await fetchNamuwikiHtml(`/Search?q=${encodeURIComponent(trimmed)}`);
  if (!html) return [];
  return parseNamuwikiSearchHtml(html);
}

export async function resolveWorkTitleFromNamuwiki(englishTitle: string): Promise<string | null> {
  const hits = await searchNamuwiki(englishTitle);
  const best = pickBestNamuwikiHit(hits, englishTitle);
  if (!best?.shortTitle) return null;
  return resolveNamuwikiHitTitle(best);
}

export async function resolveNameFromNamuwiki(
  original: string,
  type: "work" | "character" | "nickname" | "other",
  context?: { workTitle?: string },
): Promise<string | null> {
  if (type === "work") {
    return resolveWorkTitleFromNamuwiki(original);
  }

  const queries = [original];
  if (context?.workTitle) {
    queries.push(`${original} ${extractShortNamuwikiTitle(context.workTitle)}`);
  }

  for (const query of queries) {
    const hits = await searchNamuwiki(query);
    const best = pickBestCharacterHit(hits, original, context?.workTitle);
    if (!best?.shortTitle) continue;
    const resolvedTitle = await resolveNamuwikiHitTitle(best);
    if (!resolvedTitle) continue;
    if (isLikelyWorkTitleCandidate(resolvedTitle, context?.workTitle)) continue;
    return resolvedTitle;
  }

  return null;
}
