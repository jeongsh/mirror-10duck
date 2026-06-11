import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { isAdminUserId } from "@/lib/supabase/admin";
import { normalizeCours } from "@/lib/otaku/cours";
import {
  fetchNamuwikiSeasonItems,
  isDateInCours,
  normalizeNamuwikiSeasonUrl,
  normalizeNamuwikiTitleKey,
  type NamuwikiDetailEntry,
  type NamuwikiSeasonItem,
} from "@/lib/otaku/namuwikiSeason";
import {
  buildDetailEntries,
  coursToAniListSeason,
  fetchSeasonAnimeCandidates,
  formatSeasonLabel,
  searchAnimeCandidatesByTitle,
  toKoreanSource,
  type ReleaseAiCandidate,
} from "@/lib/otaku/releaseAi";

export const runtime = "nodejs";

type AiFillRequest = {
  cours?: string;
  namuwikiUrl?: string;
};

type ExistingReleaseRow = {
  id: string;
  title: string | null;
  original_title: string | null;
  cours: string | null;
};

type EnrichedNamuwikiItem = {
  item: NamuwikiSeasonItem;
  candidate: ReleaseAiCandidate | null;
};

type SynopsisAiOutput = {
  key: string;
  synopsis: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as AiFillRequest | null;
  const cours = normalizeCours(body?.cours ?? null);
  const namuwikiUrl = normalizeNamuwikiSeasonUrl(body?.namuwikiUrl);

  if (!cours) {
    return NextResponse.json({ error: "유효한 분기를 선택해 주세요." }, { status: 400 });
  }
  if (!namuwikiUrl) {
    return NextResponse.json(
      { error: "나무위키 분기 분류 URL을 입력해 주세요. namu.wiki의 분류: 페이지여야 합니다." },
      { status: 400 },
    );
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const openaiApiKey = process.env.OPENAI_API_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Supabase 환경 변수가 설정되지 않았습니다." }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });

  const accessToken = authHeader.replace(/^Bearer\s+/i, "");
  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);

  if (userError || !userData.user) {
    return NextResponse.json({ error: "로그인 정보를 확인할 수 없습니다." }, { status: 401 });
  }
  if (!(await isAdminUserId(supabase, userData.user.id))) {
    return NextResponse.json({ error: "관리자만 실행할 수 있습니다." }, { status: 403 });
  }

  let namuwikiResult: Awaited<ReturnType<typeof fetchNamuwikiSeasonItems>>;
  try {
    namuwikiResult = await fetchNamuwikiSeasonItems(namuwikiUrl, { cours });
  } catch (error) {
    const message = error instanceof Error ? error.message : "나무위키 분기 정보를 가져오지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
  if (namuwikiResult.totalLinks === 0) {
    return NextResponse.json({ error: "나무위키 분류 페이지에서 작품 링크를 찾지 못했습니다." }, { status: 404 });
  }
  if (namuwikiResult.items.length === 0) {
    return NextResponse.json(
      {
        error: "작품 페이지를 가져오지 못해 등록할 항목이 없습니다.",
        totalCandidates: namuwikiResult.totalLinks,
        pageSkippedCount: namuwikiResult.skipped.length,
      },
      { status: 502 },
    );
  }

  const { data: existingRows, error: existingError } = await supabase
    .from("release_items")
    .select("id, title, original_title, cours")
    .eq("cours", cours);

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  const existingKeys = buildExistingTitleKeys((existingRows ?? []) as ExistingReleaseRow[]);
  const missingItems = namuwikiResult.items.filter((item) => !isExistingItem(item, existingKeys));

  if (missingItems.length === 0) {
    return NextResponse.json({
      cours,
      sourceUrl: namuwikiResult.sourceUrl,
      totalCandidates: namuwikiResult.totalLinks,
      parsedCount: namuwikiResult.items.length,
      insertedCount: 0,
      skippedCount: namuwikiResult.totalLinks,
      existingSkippedCount: namuwikiResult.items.length,
      pageSkippedCount: namuwikiResult.skipped.length,
      message: "이미 모든 작품이 존재합니다.",
      usedAi: false,
      aiFilledCount: 0,
      anilistMatchedCount: 0,
    });
  }

  const anilistPool = await fetchAniListPool(cours);
  const enrichedItems = await enrichWithAniList(missingItems, anilistPool, cours);
  const synopsisResult = await generateRewrittenSynopses(openaiApiKey, cours, enrichedItems);
  const synopsisMap = new Map(synopsisResult.outputs.map((item) => [item.key, item.synopsis]));

  const rows = enrichedItems.map(({ item, candidate }) => {
    const synopsis = normalizeFinalSynopsis(
      synopsisMap.get(item.matchingKey) ?? "",
      item,
      candidate,
      cours,
    );

    return {
      category: "ANIME",
      status: item.isAdult || candidate?.isAdult ? "DRAFT" : "PUBLISHED",
      title: item.title,
      original_title: candidate?.titleNative ?? candidate?.titleRomaji ?? item.fullTitle,
      synopsis,
      poster_url: candidate?.posterUrl ?? null,
      banner_url: candidate?.bannerUrl ?? null,
      genres: item.genres.length > 0 ? item.genres : candidate?.genres ?? [],
      studios: item.studios.length > 0 ? item.studios : candidate?.studios ?? [],
      season: formatSeasonLabel(cours),
      cours,
      episode_count: item.episodeCount ?? candidate?.episodes ?? null,
      details_json: buildNamuwikiDetailEntries(item, candidate),
      release_date: item.releaseDate ?? getCandidateReleaseDateInCours(candidate, cours),
    };
  });

  const { data: insertedRows, error: insertError } = await supabase
    .from("release_items")
    .insert(rows)
    .select("id");

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const insertedCount = insertedRows?.length ?? 0;
  const draftCount = rows.filter((row) => row.status === "DRAFT").length;
  const anilistMatchedCount = enrichedItems.filter((item) => item.candidate).length;

  return NextResponse.json({
    cours,
    sourceUrl: namuwikiResult.sourceUrl,
    totalCandidates: namuwikiResult.totalLinks,
    parsedCount: namuwikiResult.items.length,
    insertedCount,
    skippedCount: Math.max(0, namuwikiResult.totalLinks - insertedCount),
    existingSkippedCount: namuwikiResult.items.length - missingItems.length,
    pageSkippedCount: namuwikiResult.skipped.length,
    publishedCount: rows.length - draftCount,
    draftCount,
    anilistMatchedCount,
    usedAi: synopsisResult.usedAi,
    aiFilledCount: synopsisResult.outputs.length,
  });
}

function buildExistingTitleKeys(rows: ExistingReleaseRow[]): Set<string> {
  const keys = new Set<string>();
  for (const row of rows) {
    for (const value of [row.title, row.original_title]) {
      const key = normalizeNamuwikiTitleKey(value);
      if (key) keys.add(key);
    }
  }
  return keys;
}

function isExistingItem(item: NamuwikiSeasonItem, existingKeys: Set<string>): boolean {
  if (existingKeys.has(item.matchingKey)) return true;
  return item.searchTitles.some((title) => existingKeys.has(normalizeNamuwikiTitleKey(title)));
}

async function fetchAniListPool(cours: string): Promise<ReleaseAiCandidate[]> {
  try {
    return await fetchSeasonAnimeCandidates(cours);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[admin/releases/ai-fill] AniList season pool failed: ${message}`);
    return [];
  }
}

async function enrichWithAniList(
  items: NamuwikiSeasonItem[],
  anilistPool: ReleaseAiCandidate[],
  cours: string,
): Promise<EnrichedNamuwikiItem[]> {
  return mapWithConcurrency(items, 3, async (item) => {
    const localMatch = pickBestAniListCandidate(item, anilistPool, cours, 35);
    if (localMatch) return { item, candidate: localMatch };

    try {
      const searchResults = await searchAnimeCandidatesByTitle(item.searchTitles[0] ?? item.title);
      return {
        item,
        candidate: pickBestAniListCandidate(item, searchResults, cours, 25),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[admin/releases/ai-fill] AniList title search failed for ${item.title}: ${message}`);
      return { item, candidate: null };
    }
  });
}

function pickBestAniListCandidate(
  item: NamuwikiSeasonItem,
  candidates: ReleaseAiCandidate[],
  cours: string,
  threshold: number,
): ReleaseAiCandidate | null {
  let best: { candidate: ReleaseAiCandidate; score: number } | null = null;

  for (const candidate of candidates) {
    const score = scoreAniListCandidate(item, candidate, cours);
    if (!best || score > best.score) best = { candidate, score };
  }

  return best && best.score >= threshold ? best.candidate : null;
}

function scoreAniListCandidate(
  item: NamuwikiSeasonItem,
  candidate: ReleaseAiCandidate,
  cours: string,
): number {
  const itemKeys = item.searchTitles.map((title) => normalizeNamuwikiTitleKey(title)).filter(Boolean);
  const candidateTitles = getCandidateTitles(candidate);
  const candidateKeys = candidateTitles.map((title) => normalizeNamuwikiTitleKey(title)).filter(Boolean);
  let score = 0;

  for (const itemKey of itemKeys) {
    for (const candidateKey of candidateKeys) {
      if (itemKey === candidateKey) score = Math.max(score, 120);
      else if (itemKey.length >= 5 && candidateKey.includes(itemKey)) score = Math.max(score, 80);
      else if (candidateKey.length >= 5 && itemKey.includes(candidateKey)) score = Math.max(score, 70);
    }
  }

  const itemAsciiTokens = extractAsciiTokens(item.searchTitles.join(" "));
  const candidateAscii = extractAsciiTokens(candidateTitles.join(" ")).join(" ");
  let tokenScore = 0;
  for (const token of itemAsciiTokens) {
    if (candidateAscii.includes(token)) tokenScore += token.length >= 4 ? 8 : 3;
  }
  if (itemAsciiTokens.length > 0 && tokenScore >= itemAsciiTokens.length * 6) tokenScore += 12;
  score = Math.max(score, tokenScore);

  if (isSameAniListSeason(candidate, cours)) score += 15;
  return score;
}

function isSameAniListSeason(candidate: ReleaseAiCandidate, cours: string): boolean {
  const season = coursToAniListSeason(cours);
  if (!season) return false;
  return candidate.seasonYear === season.year && candidate.season === season.season;
}

function getCandidateTitles(candidate: ReleaseAiCandidate): string[] {
  return [
    candidate.titleNative,
    candidate.titleEnglish,
    candidate.titleRomaji,
    ...candidate.synonyms,
  ].filter((value): value is string => Boolean(value?.trim()));
}

function extractAsciiTokens(value: string): string[] {
  return Array.from(
    new Set(
      value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .split(" ")
        .filter((token) => token.length >= 3),
    ),
  );
}

async function generateRewrittenSynopses(
  openaiApiKey: string | undefined,
  cours: string,
  items: EnrichedNamuwikiItem[],
): Promise<{ outputs: SynopsisAiOutput[]; usedAi: boolean }> {
  const targets = items;
  if (!openaiApiKey || targets.length === 0) {
    return { outputs: [], usedAi: false };
  }

  const outputs: SynopsisAiOutput[] = [];
  let usedAi = false;

  for (const chunk of chunkArray(targets, 6)) {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
        temperature: 0.35,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Return only valid JSON and follow the schema exactly. Do not wrap the answer in markdown.",
          },
          {
            role: "user",
            content: buildSynopsisPrompt(cours, chunk),
          },
        ],
      }),
    });

    if (!response.ok) {
      const raw = await response.text();
      console.warn(`[admin/releases/ai-fill] OpenAI synopsis request failed: ${response.status} ${raw}`);
      continue;
    }

    const json = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: string | null;
        };
      }>;
    };

    const parsed = parseSynopsisOutput(json.choices?.[0]?.message?.content ?? "");
    const sourceByKey = new Map(chunk.map(({ item }) => [item.matchingKey, item]));
    const accepted = parsed.filter((output) => {
      const sourceItem = sourceByKey.get(output.key);
      if (!sourceItem) return false;
      if (!isSourceLikeSynopsis(output.synopsis, sourceItem)) return true;

      console.warn(`[admin/releases/ai-fill] OpenAI synopsis looked too close to source: ${sourceItem.title}`);
      return false;
    });
    if (accepted.length > 0) usedAi = true;
    outputs.push(...accepted);
  }

  return { outputs, usedAi };
}

function buildSynopsisPrompt(cours: string, items: EnrichedNamuwikiItem[]): string {
  const payload = {
    cours,
    instruction:
      "Use source text only as factual reference. Rewrite every synopsis in original Korean wording for a commercial release database. Do not copy source sentences.",
    outputShape: {
      items: [
        {
          key: "normalized-title-key",
          synopsis: "180자 이상의 한국어 소개",
        },
      ],
    },
    style: [
      "3~5문장",
      "최소 180자 이상",
      "나무위키 개요/줄거리와 인포박스 정보는 사실 확인용으로만 사용",
      "문장 구조, 접속 표현, 묘사 순서를 원문과 다르게 재작성",
      "원문 특유의 문구나 긴 구절을 그대로 옮기지 않음",
      "출처명, API명, 나무위키명은 본문에 쓰지 않음",
      "성인 작품도 노골적인 표현 없이 중립적으로 작성",
    ],
    items: items.map(({ item, candidate }) => ({
      key: item.matchingKey,
      title: item.title,
      sourceSynopsis: truncateForPrompt(item.synopsis, 700),
      overview: truncateForPrompt(item.overview, 450),
      details: item.details.map((detail) => ({
        label: detail.label,
        value: truncateForPrompt(detail.value, 180),
      })),
      genres: item.genres,
      studios: item.studios,
      anilist: candidate
        ? {
            sourceType: candidate.sourceType,
            genres: candidate.genres,
            studios: candidate.studios,
            episodes: candidate.episodes,
            airedFrom: candidate.airedFrom,
            synopsisSeed: truncateForPrompt(candidate.synopsisSeed, 500),
          }
        : null,
    })),
  };

  return [
    "You are preparing metadata for a Korean anime release database.",
    "Rules:",
    "- Output JSON only.",
    "- Do not omit any item.",
    "- Do not reorder items.",
    "- Do not generate titles.",
    "- Synopsis must be Korean, neutral, and at least 180 Korean characters.",
    "- Rewrite from facts only; do not quote or closely paraphrase source text.",
    "- Avoid matching the source sentence order and avoid distinctive source wording.",
    "- Output shape: {\"items\":[{\"key\":\"string\",\"synopsis\":\"string\"}]}",
    "Input payload:",
    JSON.stringify(payload),
  ].join("\n");
}

function parseSynopsisOutput(content: string): SynopsisAiOutput[] {
  try {
    const json = JSON.parse(content) as {
      items?: Array<{
        key?: string;
        synopsis?: string;
      }>;
    };

    return (json.items ?? [])
      .map((item) => ({
        key: typeof item.key === "string" ? item.key.trim() : "",
        synopsis: typeof item.synopsis === "string" ? item.synopsis.trim() : "",
      }))
      .filter((item) => item.key.length > 0 && item.synopsis.length >= 80);
  } catch {
    return [];
  }
}

function normalizeFinalSynopsis(
  value: string,
  item: NamuwikiSeasonItem,
  candidate: ReleaseAiCandidate | null,
  cours: string,
): string {
  const trimmed = value.trim();
  if (trimmed.length > 0) return trimmed;
  return fallbackSynopsisText(item, candidate, cours);
}

function truncateForPrompt(value: string, maxLength: number): string {
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength).trim()}...`;
}

function isSourceLikeSynopsis(value: string, item: NamuwikiSeasonItem): boolean {
  const source = normalizeCopyCheckText(`${item.synopsis} ${item.overview}`);
  const output = normalizeCopyCheckText(value);
  if (!source || !output) return false;

  if (source.length <= 120 && output.includes(source)) return true;
  return hasLongSharedTextRun(source, output, 42);
}

function normalizeCopyCheckText(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^0-9a-z가-힣]/g, "");
}

function hasLongSharedTextRun(source: string, output: string, minLength: number): boolean {
  if (source.length < minLength || output.length < minLength) return false;

  for (let index = 0; index <= output.length - minLength; index += 1) {
    const fragment = output.slice(index, index + minLength);
    if (source.includes(fragment)) return true;
  }

  return false;
}

function fallbackSynopsisText(
  item: NamuwikiSeasonItem,
  candidate: ReleaseAiCandidate | null,
  cours: string,
): string {
  const genreText = joinText(item.genres.length > 0 ? item.genres : candidate?.genres ?? [], "장르 미정");
  const studioText = joinText(item.studios.length > 0 ? item.studios : candidate?.studios ?? [], "제작사 미정");
  const sourceText = candidate ? toKoreanSource(candidate.sourceType) : "원작 정보 미정";
  const releaseText = item.releaseDate ?? getCandidateReleaseDateInCours(candidate, cours) ?? "방영일 미정";

  return [
    `${item.title}은 ${formatSeasonLabel(cours)} 라인업에 포함된 ${genreText} 계열의 애니메이션이다.`,
    `${sourceText} 기반 정보와 ${studioText}의 제작 정보를 중심으로 등록되었으며, 방영 정보는 ${releaseText} 기준으로 정리된다.`,
    "상세 소개는 추후 공식 정보가 보강되면 관리자 검수 후 업데이트할 수 있다.",
  ].join(" ");
}

function buildNamuwikiDetailEntries(
  item: NamuwikiSeasonItem,
  candidate: ReleaseAiCandidate | null,
): NamuwikiDetailEntry[] {
  const filteredLabels = new Set(["화수", "방영 기간", "방송 기간", "방영일 기준"]);
  const entries: NamuwikiDetailEntry[] = item.details.map((entry) => {
    if (filteredLabels.has(entry.label)) {
      return null;
    }
    if (entry.label === "스트리밍" && item.streamingPlatforms.length > 0) {
      return { label: entry.label, value: item.streamingPlatforms.join(", ") };
    }
    return entry;
  }).filter((entry): entry is NamuwikiDetailEntry => Boolean(entry));
  if (item.streamingPlatforms.length > 0 && !entries.some((entry) => entry.label === "스트리밍")) {
    entries.push({ label: "스트리밍", value: item.streamingPlatforms.join(", ") });
  }
  if (candidate) {
    for (const detail of buildDetailEntries(candidate)) {
      if (!entries.some((entry) => entry.label === detail.label)) {
        entries.push(detail);
      }
    }
    entries.push({ label: "AniList ID", value: String(candidate.mediaId) });
  }
  entries.push({ label: "나무위키", value: item.url });
  return entries;
}

function getCandidateReleaseDateInCours(candidate: ReleaseAiCandidate | null, cours: string): string | null {
  const date = candidate?.airedFrom?.slice(0, 10) ?? null;
  return isDateInCours(date, cours) ? date : null;
}

function joinText(values: string[], fallback: string): string {
  return values.length > 0 ? values.join(", ") : fallback;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index] as T, index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}
