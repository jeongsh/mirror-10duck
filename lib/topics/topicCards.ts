import {
  EVENT_TYPE_LABELS,
  formatEventDatePeriod,
  type CalendarEventType,
} from "@/lib/otaku/hub";

export type TopicCardType = "event" | "seasonal" | "poll" | "viral" | "sourced";
export type TopicCardStatus = "draft" | "pending_review" | "approved" | "rejected" | "blocked";
export type TopicRiskLevel = "low" | "medium" | "high" | "blocked";
export type SourceType = "official" | "reference" | "news" | "unknown";

export type SourceItem = {
  title: string;
  url: string;
  sourceType: SourceType;
};

export type TopicCard = {
  id: string;
  type: TopicCardType;
  categoryLabel: string;
  title: string;
  summary: string;
  question: string;
  pollOptions: string[];
  relatedWorkId?: string;
  relatedWorkName?: string;
  relatedCharacterId?: string;
  relatedEventId?: string;
  officialSources?: SourceItem[];
  referenceSources?: SourceItem[];
  sourceUrl?: string;
  startsAt?: string;
  endsAt?: string;
  createdAt: string;
  commentCount: number;
  voteCount: number;
  reactionCount: number;
  status: TopicCardStatus;
  riskLevel?: TopicRiskLevel;
  riskNote?: string;
};

export type TopicTab = "all" | TopicCardType;

export const TOPIC_TABS: Array<{ value: TopicTab; label: string }> = [
  { value: "all", label: "전체" },
  { value: "event", label: "이벤트" },
  { value: "seasonal", label: "이번 분기" },
  { value: "poll", label: "투표" },
  { value: "viral", label: "바이럴" },
  { value: "sourced", label: "공식 소식" },
];

export const TOPIC_TYPE_LABELS: Record<TopicCardType, string> = {
  event: "이벤트",
  seasonal: "이번 분기",
  poll: "투표",
  viral: "바이럴",
  sourced: "공식 소식",
};

export const TOPIC_EMPTY_MESSAGE =
  "아직 오늘의 떡밥이 없습니다. 이벤트, 이번 분기 작품, 투표, 공식 소식 초안이 등록되면 이곳에 표시됩니다.";

export const URL_DRAFT_EMPTY_MESSAGE =
  "참고 뉴스 URL을 입력하면 AI가 공식 출처를 찾고, 확인 가능한 사실만으로 짧은 떡밥 카드 초안을 만들어줍니다.";

export const NO_OFFICIAL_SOURCE_MESSAGE =
  "공식 출처를 찾지 못했습니다. 이 항목은 자동 게시할 수 없습니다. 직접 확인 후 보류 또는 삭제해주세요.";

export type ReleaseEventTopicRow = {
  id: string;
  event_type: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  timezone?: string | null;
  platform: string | null;
  location: string | null;
  source_url: string | null;
  release_item_id: string | null;
  release_items?: {
    category?: string | null;
    title?: string | null;
  } | null;
};

export type SeasonalAnimeTopicRow = {
  id: string;
  title: string;
  synopsis: string | null;
  release_date: string | null;
  cours?: string | null;
};

export type SourcedTopicDraft = {
  title: string;
  summary: string;
  question: string;
  pollOptions: string[];
};

export type SourcedTopicDraftResult = {
  detectedTopic: string;
  relatedWorkName: string | null;
  category: string;
  officialSources: SourceItem[];
  referenceSources: SourceItem[];
  facts: string[];
  draft: SourcedTopicDraft;
  status: TopicCardStatus;
  riskLevel: TopicRiskLevel;
  riskNote: string;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const REFERENCE_ONLY_HOST_PARTS = [
  "crunchyroll.com/news",
  "animenewsnetwork.com",
  "anime-news-network.com",
  "anitrendz.net",
  "anime-trending.com",
  "myanimelist.net/news",
  "reddit.com",
  "ruliweb.com",
  "dcinside.com",
  "tistory.com",
  "blog.naver.com",
  "blog.livedoor.jp",
  "forums.",
];

export function createTopicCardFromEvent(
  event: ReleaseEventTopicRow,
  now = new Date(),
): TopicCard {
  const eventType = event.event_type.toLowerCase() as CalendarEventType;
  const relatedWorkName = event.release_items?.title ?? undefined;
  const categoryLabel = EVENT_TYPE_LABELS[eventType] ?? "이벤트";
  const eventSource = event.source_url
    ? {
        title: isReferenceOnlySource(event.source_url) ? "참고" : "공식 출처",
        url: event.source_url,
        sourceType: isReferenceOnlySource(event.source_url) ? ("reference" as const) : ("official" as const),
      }
    : null;
  const officialSource = eventSource?.sourceType === "official" ? [eventSource] : [];
  const referenceSource = eventSource?.sourceType === "reference" ? [eventSource] : [];
  const closingDays = getClosingDays(event.ends_at, now);
  const place = event.location ?? event.platform ?? "장소 미정";
  const period = formatEventDatePeriod(event.starts_at, event.ends_at ?? undefined);

  if (closingDays !== null && closingDays >= 0 && closingDays <= 3) {
    return buildEventTopic(event, {
      categoryLabel: "마감 임박",
      title: `[마감임박] ${event.title} 종료 D-${closingDays}`,
      summary: `${formatShortDate(event.ends_at)}에 종료됩니다.`,
      question: "막차 탈 생각 있음?",
      pollOptions: ["간다", "이미 갔다", "고민 중", "안 감"],
      officialSource,
      referenceSource,
      relatedWorkName,
    });
  }

  if (eventType === "ticket_event") {
    return buildEventTopic(event, {
      categoryLabel,
      title: `[티켓] ${event.title} 티켓 오픈`,
      summary: `${formatShortDate(event.starts_at)}부터 예매가 시작됩니다.`,
      question: "예매 도전함?",
      pollOptions: ["무조건 도전", "고민 중", "가격 보고 결정", "안 함"],
      officialSource,
      referenceSource,
      relatedWorkName,
    });
  }

  if (eventType === "goods_preorder") {
    return buildEventTopic(event, {
      categoryLabel,
      title: `[예약] ${event.title} 예약 시작`,
      summary: `${place}에서 예약이 진행됩니다.`,
      question: "살 만함?",
      pollOptions: ["산다", "고민 중", "가격이 문제", "패스"],
      officialSource,
      referenceSource,
      relatedWorkName,
    });
  }

  if (eventType === "goods_release") {
    return buildEventTopic(event, {
      categoryLabel,
      title: `[발매] ${event.title} 발매 예정`,
      summary: `${formatShortDate(event.starts_at)} 기준으로 공식 발매 정보가 등록되었습니다.`,
      question: "살 만함?",
      pollOptions: ["산다", "고민 중", "가격이 문제", "패스"],
      officialSource,
      referenceSource,
      relatedWorkName,
    });
  }

  return buildEventTopic(event, {
    categoryLabel,
    title: `[팝업] ${relatedWorkName ?? event.title} 열린다`,
    summary: `${place}에서 ${period}까지 진행됩니다.`,
    question: "갈 생각 있음?",
    pollOptions: ["갈 예정", "고민 중", "굿즈 보고 결정", "안 감"],
    officialSource,
    referenceSource,
    relatedWorkName,
  });
}

export function createTopicCardFromSeasonalAnime(
  anime: SeasonalAnimeTopicRow,
  index = 0,
): TopicCard {
  const base = {
    id: `seasonal-${anime.id}`,
    type: "seasonal" as const,
    categoryLabel: "이번 분기",
    relatedWorkId: anime.id,
    relatedWorkName: anime.title,
    sourceUrl: `/releases/${anime.id}`,
    createdAt: new Date().toISOString(),
    commentCount: 0,
    voteCount: 0,
    reactionCount: 0,
    status: "approved" as const,
  };

  if (index % 2 === 1) {
    return {
      ...base,
      title: `[입덕질문] ${anime.title} 지금 시작해도 됨?`,
      summary: "아직 안 본 유저들을 위한 입덕 질문입니다.",
      question: "입문자에게 추천 가능?",
      pollOptions: ["강추", "취향 타지만 추천", "나중에", "비추천"],
    };
  }

  return {
    ...base,
    title: `[방영중] ${anime.title} 보는 사람 있음?`,
    summary: "이번 분기 방영 중인 작품입니다.",
    question: "계속 볼 예정?",
    pollOptions: ["계속 봄", "하차 고민", "몰아서 볼 예정", "안 봄"],
  };
}

export function createManualPollTopicCard(now = new Date()): TopicCard {
  return {
    id: "poll-remake-style",
    type: "poll",
    categoryLabel: "운영자 투표",
    title: "[오늘의 떡밥] 리메이크는 원작 그림체를 따라야 할까?",
    summary: "리메이크 애니에서 무엇이 더 중요한지 투표해보세요.",
    question: "리메이크에서 더 중요한 건?",
    pollOptions: ["원작 그림체", "현대식 작화", "성우 유지", "연출"],
    createdAt: now.toISOString(),
    commentCount: 0,
    voteCount: 0,
    reactionCount: 0,
    status: "approved",
  };
}

export function createViralResultTopicCard(now = new Date()): TopicCard {
  return {
    id: "viral-prescription-daily",
    type: "viral",
    categoryLabel: "오늘의 결과",
    title: "[오늘의 결과] 오늘 가장 많이 나온 처방은 \"과몰입 회복불가형\"",
    summary: "오늘 애니 처방전 결과 중 가장 많이 나온 타입입니다.",
    question: "이 타입 인정함?",
    pollOptions: ["완전 나임", "조금 맞음", "전혀 아님", "다시 해봄"],
    sourceUrl: "/play/recommend",
    createdAt: now.toISOString(),
    commentCount: 0,
    voteCount: 0,
    reactionCount: 0,
    status: "approved",
  };
}

export function createTopicCardFromSourcedDraft(
  result: SourcedTopicDraftResult,
  id = `sourced-${Date.now()}`,
): TopicCard {
  return {
    id,
    type: "sourced",
    categoryLabel: result.category || "공식 소식",
    title: result.draft.title,
    summary: enforceTwoSentenceSummary(result.draft.summary),
    question: result.draft.question,
    pollOptions: normalizePollOptions(result.draft.pollOptions),
    relatedWorkName: result.relatedWorkName ?? undefined,
    officialSources: result.officialSources,
    referenceSources: result.referenceSources,
    sourceUrl: result.officialSources[0]?.url ?? result.referenceSources[0]?.url,
    createdAt: new Date().toISOString(),
    commentCount: 0,
    voteCount: 0,
    reactionCount: 0,
    status: result.status,
    riskLevel: result.riskLevel,
    riskNote: result.riskNote,
  };
}

export function filterTopicCards(cards: TopicCard[], tab: TopicTab): TopicCard[] {
  const approved = cards.filter((card) => card.status === "approved");
  if (tab === "all") return approved;
  return approved.filter((card) => card.type === tab);
}

export function normalizeSourcedDraftResult(
  value: unknown,
  inputUrl: string,
): SourcedTopicDraftResult {
  const obj = isRecord(value) ? value : {};
  const rawOfficial = arrayOfRecords(obj.officialSources).map(normalizeSourceItem);
  const rawReferences = arrayOfRecords(obj.referenceSources).map(normalizeSourceItem);
  const officialSources = dedupeSources(
    rawOfficial.filter((source) => source.sourceType === "official" && !isReferenceOnlySource(source.url)),
  );
  const referenceSources = dedupeSources([
    ...rawReferences.map((source) => ({ ...source, sourceType: "reference" as const })),
    ...rawOfficial
      .filter((source) => source.sourceType !== "official" || isReferenceOnlySource(source.url))
      .map((source) => ({ ...source, sourceType: "reference" as const })),
    {
      title: sourceTitleFromUrl(inputUrl),
      url: inputUrl,
      sourceType: "reference" as const,
    },
  ]);
  const facts = arrayOfStrings(obj.facts).slice(0, 5);
  const draftObj = isRecord(obj.draft) ? obj.draft : {};
  const hasOfficial = officialSources.length > 0;
  const requestedRisk = stringValue(obj.riskLevel);
  const riskLevel: TopicRiskLevel = !hasOfficial
    ? "blocked"
    : isRiskLevel(requestedRisk)
      ? requestedRisk
      : "low";
  const status: TopicCardStatus = !hasOfficial
    ? "blocked"
    : riskLevel === "low"
      ? "draft"
      : "pending_review";

  return {
    detectedTopic: stringValue(obj.detectedTopic) || "주제 확인 필요",
    relatedWorkName: stringValue(obj.relatedWorkName) || null,
    category: stringValue(obj.category) || "공식 소식",
    officialSources,
    referenceSources,
    facts,
    draft: {
      title: stringValue(draftObj.title) || "[공식소식] 제목 확인 필요",
      summary: enforceTwoSentenceSummary(stringValue(draftObj.summary) || facts.slice(0, 2).join(" ")),
      question: stringValue(draftObj.question) || "이 소식 어떻게 봄?",
      pollOptions: normalizePollOptions(arrayOfStrings(draftObj.pollOptions)),
    },
    status,
    riskLevel,
    riskNote: !hasOfficial
      ? NO_OFFICIAL_SOURCE_MESSAGE
      : stringValue(obj.riskNote) || "공식 출처가 확인되었고 관리자 승인 전 상태입니다.",
  };
}

export function isReferenceOnlySource(url: string): boolean {
  try {
    const parsed = new URL(url);
    const target = `${parsed.hostname.replace(/^www\./, "")}${parsed.pathname}`.toLowerCase();
    return REFERENCE_ONLY_HOST_PARTS.some((part) => target.includes(part));
  } catch {
    return true;
  }
}

function buildEventTopic(
  event: ReleaseEventTopicRow,
  input: {
    categoryLabel: string;
    title: string;
    summary: string;
    question: string;
    pollOptions: string[];
    officialSource: SourceItem[];
    referenceSource: SourceItem[];
    relatedWorkName?: string;
  },
): TopicCard {
  return {
    id: `event-${event.id}`,
    type: "event",
    categoryLabel: input.categoryLabel,
    title: input.title,
    summary: enforceTwoSentenceSummary(input.summary),
    question: input.question,
    pollOptions: input.pollOptions,
    relatedWorkId: event.release_item_id ?? undefined,
    relatedWorkName: input.relatedWorkName,
    relatedEventId: event.id,
    officialSources: input.officialSource,
    referenceSources: input.referenceSource,
    sourceUrl: event.source_url ?? undefined,
    startsAt: event.starts_at,
    endsAt: event.ends_at ?? undefined,
    createdAt: event.starts_at,
    commentCount: 0,
    voteCount: 0,
    reactionCount: 0,
    status: "approved",
  };
}

function getClosingDays(endsAt: string | null | undefined, now: Date): number | null {
  if (!endsAt) return null;
  const end = new Date(endsAt);
  if (Number.isNaN(end.getTime())) return null;
  return Math.ceil((end.getTime() - now.getTime()) / MS_PER_DAY);
}

function formatShortDate(value: string | null | undefined): string {
  if (!value) return "날짜 미정";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).format(new Date(value));
}

function enforceTwoSentenceSummary(value: string): string {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return "공식 출처 확인 후 관리자가 요약을 입력해야 합니다.";
  const parts = trimmed.match(/[^.!?。！？]+[.!?。！？]?/g) ?? [trimmed];
  return parts.slice(0, 2).join(" ").trim();
}

function normalizePollOptions(values: string[]): string[] {
  const normalized = values.map((value) => value.trim()).filter(Boolean).slice(0, 6);
  if (normalized.length >= 2) return normalized;
  return ["기대됨", "보류", "불안함", "아직 모름"];
}

function normalizeSourceItem(value: Record<string, unknown>): SourceItem {
  const url = stringValue(value.url);
  const sourceType = normalizeSourceType(stringValue(value.sourceType));
  return {
    title: stringValue(value.title) || sourceTitleFromUrl(url),
    url,
    sourceType,
  };
}

function normalizeSourceType(value: string): SourceType {
  if (value === "official" || value === "reference" || value === "news" || value === "unknown") {
    return value;
  }
  return "unknown";
}

function dedupeSources(items: SourceItem[]): SourceItem[] {
  const seen = new Set<string>();
  const result: SourceItem[] = [];
  for (const item of items) {
    if (!item.url || seen.has(item.url)) continue;
    seen.add(item.url);
    result.push(item);
  }
  return result;
}

function sourceTitleFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "참고 URL";
  }
}

function isRiskLevel(value: string): value is TopicRiskLevel {
  return value === "low" || value === "medium" || value === "high" || value === "blocked";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function arrayOfRecords(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
