import type { SupabaseClient } from "@supabase/supabase-js";

export type AiEventCandidateInput = {
  title: string;
  source_name: string;
  source_url: string;
  summary: string;
  category: string;
  location?: string | null;
  start_date?: string | null;
  end_date?: string | null;
};

export type EventCandidateRow = AiEventCandidateInput & {
  normalized_url: string;
  duplicate_status: "none" | "suspected";
  duplicate_event_id: string | null;
  duplicate_similarity: number | null;
  duplicate_reason: string | null;
  raw_payload: Record<string, unknown>;
};

type ExistingEventRow = {
  id: string;
  title: string;
  event_type: string;
  location: string | null;
  starts_at: string;
  ends_at: string | null;
};

type OpenAiCandidateResponse = {
  candidates?: AiEventCandidateInput[];
};

export type EventCandidateSearchMode = "daily" | "full";

export type AiEventSearchResult = {
  insertedCount: number;
  duplicateUrlCount: number;
  duplicateSuspectedCount: number;
  returnedCount: number;
  mode: EventCandidateSearchMode;
};

const CATEGORY_LABELS = [
  "팝업스토어",
  "콜라보 카페",
  "전시회",
  "AGF",
  "서울 코믹월드",
  "극장판",
  "상영회",
  "관람 특전",
  "성우 이벤트",
  "라이브",
  "오케스트라",
  "콘서트",
  "블루레이",
  "음반",
  "굿즈",
  "피규어",
  "게임 행사",
  "캐릭터 IP 행사",
] as const;

const SEARCH_GROUPS = [
  {
    name: "ruliweb_anime_info_priority",
    maxItems: 10,
    focus:
      "1순위로 https://bbs.ruliweb.com/family/211/board/300015 루리웹 애니정보 게시판의 개별 정보글을 찾으세요. 행사, 축전, 특전 공개, 극장판 개봉/상영, 예매, 무대인사, 팝업, 콜라보 카페, 전시회, 굿즈/블루레이/음반/피규어 발매 정보글을 중심으로 찾으세요.",
  },
  {
    name: "official_offline_events",
    maxItems: 10,
    focus:
      "팝업스토어, 콜라보 카페, 전시회, 브랜드 콜라보, 체험 이벤트, 캐릭터 IP 오프라인 행사를 중심으로 찾으세요.",
  },
  {
    name: "anime_movies_and_theater_benefits",
    maxItems: 10,
    focus:
      "애니메이션 극장판 개봉, 애니메이션 영화 개봉, 특별 상영회, 예매 오픈, 무대인사, 관람 특전, 입장 특전, 영화관 콜라보 프로모션을 중심으로 찾으세요.",
  },
  {
    name: "official_releases_except_aniplus_shop_goods_figures",
    maxItems: 10,
    focus:
      "블루레이, 음반, 굿즈, 피규어 발매를 중심으로 찾되, 애니플러스샵/ANIPLUS SHOP의 굿즈와 피규어 판매 후보는 제외하세요.",
  },
  {
    name: "conventions_live_voice_actor_game",
    maxItems: 10,
    focus:
      "AGF, 서울 코믹월드, 애니메이션/게임 관련 행사, 성우 이벤트, 라이브 공연, 오케스트라, 콘서트를 중심으로 찾으세요.",
  },
] as const;

const DAILY_SEARCH_GROUPS = [
  {
    name: "daily_ruliweb_anime_info",
    maxItems: 10,
    focus:
      "오늘 새 후보 찾기입니다. https://bbs.ruliweb.com/family/211/board/300015 루리웹 애니정보 게시판의 최근 1~3일 개별 정보글만 좁게 찾으세요. 행사, 축전, 특전 공개, 극장판 개봉/상영, 예매, 무대인사, 팝업, 콜라보 카페, 전시회, 굿즈/블루레이/음반/피규어 발매 정보글이 아니면 제외하세요. 새 글이 없으면 빈 candidates 배열을 반환하세요.",
  },
] as const;

const EVENT_CANDIDATE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["candidates"],
  properties: {
    candidates: {
      type: "array",
      maxItems: 10,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "title",
          "source_name",
          "source_url",
          "summary",
          "category",
          "location",
          "start_date",
          "end_date",
        ],
        properties: {
          title: { type: "string" },
          source_name: { type: "string" },
          source_url: { type: "string" },
          summary: { type: "string" },
          category: { type: "string", enum: [...CATEGORY_LABELS] },
          location: { type: ["string", "null"] },
          start_date: { type: ["string", "null"] },
          end_date: { type: ["string", "null"] },
        },
      },
    },
  },
};

export async function searchAndStoreEventCandidates({
  supabase,
  openaiApiKey,
  mode = "full",
}: {
  supabase: SupabaseClient;
  openaiApiKey: string;
  mode?: EventCandidateSearchMode;
}): Promise<AiEventSearchResult> {
  const [aiCandidates, existingEvents] = await Promise.all([
    searchAiEventCandidates(openaiApiKey, mode),
    fetchExistingEvents(supabase),
  ]);

  if (mode === "full") {
    const { error: clearError } = await supabase
      .from("event_candidates")
      .delete()
      .lte("searched_at", new Date().toISOString());

    if (clearError) throw new Error(clearError.message);
  }

  let insertedCount = 0;
  let duplicateUrlCount = 0;
  let duplicateSuspectedCount = 0;

  for (const candidate of aiCandidates) {
    const normalizedUrl = normalizeEventUrl(candidate.source_url);
    if (!normalizedUrl) continue;

    const duplicate = findDuplicateEvent(candidate, existingEvents);
    if (duplicate.status === "suspected") duplicateSuspectedCount += 1;

    const row: EventCandidateRow = {
      title: candidate.title.trim(),
      source_name: candidate.source_name.trim(),
      source_url: candidate.source_url.trim(),
      normalized_url: normalizedUrl,
      summary: candidate.summary.trim(),
      category: candidate.category.trim(),
      location: normalizeNullableText(candidate.location),
      start_date: normalizeDate(candidate.start_date),
      end_date: normalizeDate(candidate.end_date),
      duplicate_status: duplicate.status,
      duplicate_event_id: duplicate.eventId,
      duplicate_similarity: duplicate.similarity,
      duplicate_reason: duplicate.reason,
      raw_payload: candidate as unknown as Record<string, unknown>,
    };

    const { error } = await supabase.from("event_candidates").insert(row);
    if (!error) {
      insertedCount += 1;
      continue;
    }
    if (isUniqueViolation(error)) {
      duplicateUrlCount += 1;
      continue;
    }
    throw new Error(error.message);
  }

  return {
    insertedCount,
    duplicateUrlCount,
    duplicateSuspectedCount,
    returnedCount: aiCandidates.length,
    mode,
  };
}

export function normalizeEventUrl(value: string): string | null {
  try {
    const url = new URL(value);
    url.protocol = "https:";
    url.hash = "";
    url.search = "";
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    let pathname = decodeURIComponent(url.pathname).replace(/\/{2,}/g, "/");
    if (pathname.length > 1) pathname = pathname.replace(/\/+$/, "");
    return `https://${host}${pathname}`;
  } catch {
    return null;
  }
}

async function searchAiEventCandidates(
  openaiApiKey: string,
  mode: EventCandidateSearchMode,
): Promise<AiEventCandidateInput[]> {
  const groups = mode === "daily" ? DAILY_SEARCH_GROUPS : SEARCH_GROUPS;
  const results = await Promise.all(
    groups.map((group) => searchAiEventCandidateGroup(openaiApiKey, group.focus, mode)),
  );
  const seen = new Set<string>();
  const candidates: AiEventCandidateInput[] = [];

  for (const candidate of results.flat()) {
    const normalizedUrl = normalizeEventUrl(candidate.source_url);
    if (
      !normalizedUrl ||
      seen.has(normalizedUrl) ||
      isExcludedCandidate(candidate) ||
      isLikelyNonDirectSourceUrl(normalizedUrl)
    ) {
      continue;
    }
    seen.add(normalizedUrl);
    candidates.push(candidate);
  }

  return candidates;
}

async function searchAiEventCandidateGroup(
  openaiApiKey: string,
  focus: string,
  mode: EventCandidateSearchMode,
): Promise<AiEventCandidateInput[]> {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openaiApiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_EVENT_SEARCH_MODEL ?? "gpt-5.2",
      reasoning: { effort: "low" },
      tools: [
        {
          type: "web_search",
          user_location: {
            type: "approximate",
            country: "KR",
            city: "Seoul",
            region: "Seoul",
            timezone: "Asia/Seoul",
          },
        },
      ],
      tool_choice: "auto",
      max_tool_calls: 6,
      include: ["web_search_call.action.sources"],
      text: {
        format: {
          type: "json_schema",
          name: "korea_subculture_event_candidates",
          strict: true,
          schema: EVENT_CANDIDATE_SCHEMA,
        },
      },
      input: buildEventSearchPrompt(focus, mode),
    }),
  });

  if (!response.ok) {
    const raw = await response.text();
    throw new Error(`OpenAI 이벤트 검색 실패 (${response.status}): ${raw.slice(0, 500)}`);
  }

  const json = await response.json();
  const outputText = extractOutputText(json);
  const parsed = JSON.parse(outputText) as OpenAiCandidateResponse;

  return (parsed.candidates ?? [])
    .filter(isUsableCandidate)
    .filter((candidate) => !isExcludedCandidate(candidate))
    .map((candidate) => ({
      ...candidate,
      title: candidate.title.trim().slice(0, 240),
      source_name: candidate.source_name.trim().slice(0, 120),
      source_url: candidate.source_url.trim(),
      summary: candidate.summary.trim().slice(0, 1000),
      category: candidate.category.trim(),
    }));
}

function buildEventSearchPrompt(focus: string, mode: EventCandidateSearchMode): string {
  const today = getKstDateString(new Date());
  const dailyRules =
    mode === "daily"
      ? [
          "이번 실행은 매일 사용하는 빠른 검색입니다.",
          "루리웹 애니정보 게시판의 최근 1~3일 개별 글을 최우선으로 보세요.",
          "새 후보가 없으면 억지로 채우지 말고 candidates를 빈 배열로 반환하세요.",
          "오래된 글, 이미 종료된 글, 게시판 목록/검색 결과/홈 URL은 제외하세요.",
        ]
      : [];

  return [
    "JSON으로만 답변하세요.",
    "한국 서브컬처 관련 최신 이벤트 후보를 찾아주세요. 목적은 관리자가 직접 등록할 만한 이벤트를 발견하는 것입니다.",
    `검색 기준일은 ${today}(Asia/Seoul)입니다.`,
    `이번 검색 묶음의 우선순위: ${focus}`,
    ...dailyRules,
    "이미 시작했더라도 종료일이 기준일 이후인 진행 중 이벤트는 포함하세요.",
    "루리웹 애니정보 게시판 글처럼 날짜가 명확히 적혀 있지 않은 정보글도 후보로 포함하세요.",
    "시작일, 종료일, 발매일, 개최일이 없어도 특전 공개, 개최 발표, 예매 공지, 발매 공지, 참가사 발표, 콜라보 발표, 팝업 예고, 공연 발표, 성우 출연 발표, 예약 판매 공지라면 제외하지 마세요.",
    "단, 글 제목이나 본문에서 이미 종료, 마감, 판매 종료, 상영 종료, 이벤트 종료가 명확한 후보는 제외하세요.",
    "출처 우선순위는 루리웹 애니정보 게시판(https://bbs.ruliweb.com/family/211/board/300015)의 개별 정보글, 공식 판매 링크, 공식 정보 링크, 공식 SNS, 공식 공지 순서입니다.",
    "포함: 팝업스토어, 콜라보 카페, 전시회, AGF, 서울 코믹월드, 애니메이션 행사, 게임 행사, 캐릭터 IP 행사, 브랜드 콜라보, 체험 이벤트, 극장판 개봉, 애니메이션 영화 개봉, 특별 상영회, 관람 특전, 예매 오픈, 무대인사, 성우 이벤트, 라이브, 오케스트라, 콘서트, 블루레이/음반/굿즈/피규어 발매.",
    "제외: 일반 전시회, 일반 팝업스토어, K-POP 행사, 연예인 행사, 일반 브랜드 행사, 비서브컬처 행사, 애니플러스샵/ANIPLUS SHOP의 굿즈 판매, 애니플러스샵/ANIPLUS SHOP의 피규어 판매.",
    "source_url은 반드시 후보 제목과 같은 건을 설명하는 직접 URL이어야 합니다. 공식 예매/판매/상세/공지 URL 또는 루리웹 애니정보 게시판의 개별 정보글 URL만 반환하세요.",
    "source_url에 사이트 홈, 공지사항 목록, 게시판 목록, 검색 결과, 카테고리 목록, 이벤트 목록 URL을 넣지 마세요.",
    "후보와 직접 관련 없는 공지 글 URL을 넣지 마세요. 예를 들어 페이지 하단 추천글, 관련글, 인기글, 사이드바에만 후보명이 등장하는 경우는 제외하세요.",
    "공식 사이트의 개별 공지 URL이라도 제목/본문의 주제가 후보 이벤트와 다르면 제외하세요.",
    "location은 공식 출처에 명시된 경우에만 넣고, 추론하지 말고 null로 두세요.",
    "start_date와 end_date는 공식 출처에서 확인한 날짜만 YYYY-MM-DD 형식으로 넣으세요. 하루짜리 발매/행사는 start_date와 end_date를 같은 날짜로 넣으세요.",
  ].join("\n");
}

function addDays(value: Date, days: number): Date {
  return new Date(value.getTime() + days * 24 * 60 * 60 * 1000);
}

function getKstDateString(value: Date): string {
  const kst = new Date(value.getTime() + 9 * 60 * 60 * 1000);
  const year = kst.getUTCFullYear();
  const month = `${kst.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${kst.getUTCDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function fetchExistingEvents(supabase: SupabaseClient): Promise<ExistingEventRow[]> {
  const { data, error } = await supabase
    .from("release_events")
    .select("id, title, event_type, location, starts_at, ends_at")
    .order("starts_at", { ascending: false })
    .limit(300);

  if (error) throw new Error(error.message);
  return (data as ExistingEventRow[] | null) ?? [];
}

function findDuplicateEvent(candidate: AiEventCandidateInput, events: ExistingEventRow[]) {
  let best: {
    eventId: string | null;
    eventTitle: string | null;
    similarity: number;
    reason: string | null;
  } = {
    eventId: null,
    eventTitle: null,
    similarity: 0,
    reason: null,
  };

  for (const event of events) {
    const titleScore = tokenSimilarity(candidate.title, event.title);
    const categoryScore = eventTypeMatchesCategory(event.event_type, candidate.category) ? 0.15 : 0;
    const locationScore =
      candidate.location && event.location && normalizeText(candidate.location) === normalizeText(event.location)
        ? 0.1
        : 0;
    const dateScore = hasDateOverlap(candidate, event) ? 0.15 : 0;
    const score = Math.min(1, titleScore + categoryScore + locationScore + dateScore);

    if (score > best.similarity) {
      best = {
        eventId: event.id,
        eventTitle: event.title,
        similarity: score,
        reason: `기존 이벤트 "${event.title}"와 제목/분류${locationScore > 0 ? "/장소" : ""}${dateScore > 0 ? "/일정" : ""}이 유사합니다.`,
      };
    }
  }

  if (best.eventId && best.similarity >= 0.72) {
    return {
      status: "suspected" as const,
      eventId: best.eventId,
      similarity: Number(best.similarity.toFixed(2)),
      reason: best.reason,
    };
  }

  return {
    status: "none" as const,
    eventId: null,
    similarity: null,
    reason: null,
  };
}

function tokenSimilarity(a: string, b: string): number {
  const aTokens = tokenize(a);
  const bTokens = tokenize(b);
  if (aTokens.length === 0 || bTokens.length === 0) return 0;
  const bSet = new Set(bTokens);
  const intersection = aTokens.filter((token) => bSet.has(token)).length;
  const union = new Set([...aTokens, ...bTokens]).size;
  return intersection / union;
}

function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(/\s+/)
    .filter((token) => token.length >= 2);
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim();
}

function eventTypeMatchesCategory(eventType: string, category: string): boolean {
  const type = eventType.toUpperCase();
  if (["팝업스토어", "콜라보 카페", "전시회", "AGF", "서울 코믹월드", "성우 이벤트", "게임 행사", "캐릭터 IP 행사"].includes(category)) {
    return type === "OFFLINE_EVENT";
  }
  if (["라이브", "오케스트라", "콘서트"].includes(category)) return type === "LIVE_EVENT" || type === "TICKET_EVENT";
  if (["블루레이", "음반", "굿즈", "피규어"].includes(category)) return type === "GOODS_RELEASE" || type === "GOODS_PREORDER";
  return false;
}

function hasDateOverlap(candidate: AiEventCandidateInput, event: ExistingEventRow): boolean {
  const candidateStart = normalizeDate(candidate.start_date);
  if (!candidateStart) return false;

  const eventStart = event.starts_at.slice(0, 10);
  const eventEnd = event.ends_at?.slice(0, 10) ?? eventStart;
  const candidateEnd = normalizeDate(candidate.end_date) ?? candidateStart;

  return candidateStart <= eventEnd && candidateEnd >= eventStart;
}

function normalizeNullableText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, 240) : null;
}

function normalizeDate(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return value;
}

function isUsableCandidate(candidate: AiEventCandidateInput): boolean {
  return Boolean(
    candidate.title?.trim() &&
      candidate.source_name?.trim() &&
      candidate.source_url?.trim() &&
      candidate.summary?.trim() &&
      candidate.category?.trim() &&
      normalizeEventUrl(candidate.source_url),
  );
}

function isExcludedCandidate(candidate: AiEventCandidateInput): boolean {
  const sourceText = `${candidate.source_name} ${candidate.source_url}`.toLowerCase();
  const isAniplusShop =
    sourceText.includes("애니플러스샵") ||
    sourceText.includes("aniplus shop") ||
    sourceText.includes("shop.aniplustv") ||
    sourceText.includes("aniplustv.com/shop");
  const isGoodsOrFigure = ["굿즈", "피규어"].includes(candidate.category);

  return isAniplusShop && isGoodsOrFigure;
}

function isLikelyNonDirectSourceUrl(normalizedUrl: string): boolean {
  try {
    const url = new URL(normalizedUrl);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    if (url.hostname === "bbs.ruliweb.com" && path === "/family/211/board/300015") return true;
    if (path === "/") return true;
    if (/^\/(notice|notices|news|event|events|board|bbs)$/i.test(path)) return true;
    if (/\/(notice|notices|news|event|events)\/(list|all)?$/i.test(path)) return true;
    return false;
  } catch {
    return true;
  }
}

function extractOutputText(response: unknown): string {
  const outputText = (response as { output_text?: unknown }).output_text;
  if (typeof outputText === "string" && outputText.trim()) return outputText;

  const output = (response as { output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }> }).output;
  const text = output
    ?.flatMap((item) => item.content ?? [])
    .map((content) => content.text ?? "")
    .join("")
    .trim();

  if (text) return text;
  throw new Error("OpenAI 응답에서 후보 JSON을 찾지 못했습니다.");
}

function isUniqueViolation(error: { code?: string; message?: string }) {
  return error.code === "23505" || /duplicate key/i.test(error.message ?? "");
}
