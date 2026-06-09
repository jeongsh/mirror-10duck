export type OtakuCategory = "all" | "anime" | "manga" | "game";

export type NewsItem = {
  id: string;
  category: Exclude<OtakuCategory, "all">;
  title: string;
  summary: string;
  body: string;
  publishedAt: string;
  thumbnailUrl: string;
  tags: string[];
  status: "draft" | "published" | "hidden";
  editorName: string;
};

export type ReleaseItem = {
  id: string;
  category: Exclude<OtakuCategory, "all">;
  title: string;
  originalTitle: string;
  synopsis: string;
  posterUrl: string;
  bannerUrl: string;
  genres: string[];
  studios: string[];
  season: string;
  episodeCount: number | null;
  details?: Array<{ label: string; value: string }>;
  releaseDate: string | null;
  isFollowing: boolean;
  notifications: {
    sameDay: boolean;
    thirtyMinutesBefore: boolean;
    changeNotice: boolean;
  };
};

export type CalendarEventType =
  | "anime_airing"
  | "anime_ott"
  | "manga_serial"
  | "manga_volume"
  | "goods_preorder"
  | "goods_release"
  | "offline_event"
  | "ticket_event"
  | "live_event"
  | "game_release"
  | "game_update"
  | "game_maintenance"
  | "community_event"
  | "personal"
  | "attendance";

export type CalendarTab = "all" | "release";

export type CalendarEvent = {
  id: string;
  contentId?: string;
  category: Exclude<OtakuCategory, "all"> | "goods" | "offline" | "community" | "personal";
  type: CalendarEventType;
  title: string;
  description?: string;
  startsAt: string;
  endsAt?: string;
  timezone: string;
  episodeLabel?: string;
  platform?: string;
  location?: string;
  sourceUrl?: string;
  imageUrl?: string;
  kakaoPlace?: {
    id: string;
    name: string;
    lat: number;
    lng: number;
    roadAddress?: string;
    address?: string;
    placeUrl?: string;
  };
  relatedBoardSlug?: string;
  relatedBoardLabel?: string;
  isFollowing: boolean;
  reminderOffsetMinutes: number | null;
};

export const CATEGORY_LABELS: Record<OtakuCategory, string> = {
  all: "전체",
  anime: "애니",
  manga: "만화",
  game: "게임",
};

export const PUBLIC_CATEGORIES: OtakuCategory[] = ["all", "anime", "manga"];

export const CALENDAR_TAB_LABELS: Record<CalendarTab, string> = {
  all: "전체",
  release: "이벤트",
};

export const PUBLIC_CALENDAR_TABS: CalendarTab[] = ["all", "release"];

export const EVENT_TYPE_LABELS: Record<CalendarEventType, string> = {
  anime_airing: "방영",
  anime_ott: "OTT",
  manga_serial: "연재",
  manga_volume: "발매",
  goods_preorder: "예약",
  goods_release: "발매",
  offline_event: "행사",
  ticket_event: "티켓",
  live_event: "라이브",
  game_release: "출시",
  game_update: "업데이트",
  game_maintenance: "점검",
  community_event: "이벤트",
  personal: "개인",
  attendance: "출석",
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function getNewsItems(now = new Date()): NewsItem[] {
  return [
    {
      id: "news-anime-1",
      category: "anime",
      title: "여름 시즌 신작 1화 선공개 일정 공개",
      summary: "공식 채널에서 1화 선행 상영과 스트리밍 공개 시간을 안내했습니다.",
      body: buildEditorBody([
        "운영자가 확인한 공식 공지 기준으로, 여름 시즌 신작의 1화 선행 공개 일정이 공개되었습니다.",
        "방영 시간과 OTT 공개 시간이 다를 수 있어 신작 알림을 켜 둔 사용자는 캘린더의 당일 알림을 함께 확인하는 편이 좋습니다.",
        "상세 편성에 변경 사항이 확인되면 운영자가 이 뉴스 항목을 업데이트합니다.",
      ]),
      publishedAt: isoAt(addDays(now, -1), 18, 0),
      thumbnailUrl:
        "https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=900&q=80",
      tags: ["여름신작", "선행상영", "OTT"],
      status: "published",
      editorName: "운영팀",
    },
    {
      id: "news-manga-1",
      category: "manga",
      title: "인기 웹연재 작가, 단행본 정발 일정 발표",
      summary: "전자책과 종이책 발매일이 분리되어 있어 관심작 알림 확인이 필요합니다.",
      body: buildEditorBody([
        "출판사 공지를 통해 인기 웹연재 작가의 단행본 정발 일정이 안내되었습니다.",
        "전자책 공개일과 종이책 입고일이 서로 다를 수 있으므로, 구매 예정 사용자는 발매 일정 카드를 확인해 주세요.",
        "운영팀은 정발 지연, 표지 변경, 특전 정보가 확인되는 대로 같은 뉴스 항목에 반영할 예정입니다.",
      ]),
      publishedAt: isoAt(addDays(now, -2), 11, 30),
      thumbnailUrl:
        "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=900&q=80",
      tags: ["정발", "단행본", "웹연재"],
      status: "published",
      editorName: "운영팀",
    },
    {
      id: "news-anime-2",
      category: "anime",
      title: "인기 시리즈 극장판 제작 결정",
      summary: "제작 결정 PV와 티저 비주얼이 공개되어 관련 채널 토론이 늘고 있습니다.",
      body: buildEditorBody([
        "공식 채널에서 인기 시리즈의 극장판 제작 결정 소식이 공개되었습니다.",
        "현재 공개된 정보는 제작 결정, 티저 비주얼, 짧은 PV 수준이며 개봉 시기와 상영관 정보는 아직 확정되지 않았습니다.",
        "후속 발표가 나오면 같은 이슈로 묶어 업데이트할 수 있도록 운영자 등록 상태로 관리합니다.",
      ]),
      publishedAt: isoAt(addDays(now, -4), 9, 20),
      thumbnailUrl:
        "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=900&q=80",
      tags: ["극장판", "PV", "티저"],
      status: "published",
      editorName: "운영팀",
    },
  ];
}

export function getReleaseItems(now = new Date()): ReleaseItem[] {
  return [
    {
      id: "rel-anime-1",
      category: "anime",
      title: "별빛 학원 2기",
      originalTitle: "星影学園 Season 2",
      synopsis:
        "신입생과 기존 멤버가 함께 무대에 오르며 새로운 유닛 경쟁을 시작하는 학원 아이돌 애니메이션 2기.",
      posterUrl:
        "https://images.unsplash.com/photo-1601850494422-3cf14624b0b3?auto=format&fit=crop&w=900&q=80",
      bannerUrl:
        "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1600&q=80",
      genres: ["아이돌", "학원", "음악"],
      studios: ["Studio Lumi"],
      season: "2026 여름",
      episodeCount: 12,
      releaseDate: ymdAt(addDays(now, 14)),
      isFollowing: true,
      notifications: { sameDay: true, thirtyMinutesBefore: false, changeNotice: true },
    },
    {
      id: "rel-manga-1",
      category: "manga",
      title: "마법서점의 주인님",
      originalTitle: "魔法書店の店主さま",
      synopsis:
        "마법서가 손님을 고르는 작은 서점을 배경으로, 책과 계약한 사람들이 각자의 소원을 마주하는 판타지 만화.",
      posterUrl:
        "https://images.unsplash.com/photo-1513001900722-370f803f498d?auto=format&fit=crop&w=900&q=80",
      bannerUrl:
        "https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=1600&q=80",
      genres: ["판타지", "일상", "드라마"],
      studios: ["월간 코믹 루나"],
      season: "2026 상반기",
      episodeCount: null,
      releaseDate: ymdAt(addDays(now, 30)),
      isFollowing: false,
      notifications: { sameDay: true, thirtyMinutesBefore: false, changeNotice: false },
    },
  ];
}

export function getNewsItemById(id: string, now = new Date()): NewsItem | null {
  return getNewsItems(now).find((item) => item.id === id) ?? null;
}

export function getReleaseItemById(id: string, now = new Date()): ReleaseItem | null {
  return getReleaseItems(now).find((item) => item.id === id) ?? null;
}

export function getCalendarEvents(now = new Date()): CalendarEvent[] {
  return [];
}

export function filterByCategory<T extends { category: string }>(
  items: T[],
  category: OtakuCategory,
): T[] {
  if (category === "all") return items;
  return items.filter((item) => item.category === category);
}

export function filterByCalendarTab<T extends { category: string; type: CalendarEventType }>(
  items: T[],
  tab: CalendarTab,
): T[] {
  if (tab === "all") return items;
  return items.filter((item) =>
    ["goods_preorder", "goods_release", "offline_event", "ticket_event", "live_event"].includes(item.type),
  );
}

export function getCalendarEventCategory(
  eventType: string,
  releaseCategory?: string | null,
): CalendarEvent["category"] {
  if (["GOODS_PREORDER", "GOODS_RELEASE"].includes(eventType)) {
    return "goods";
  }
  if (["OFFLINE_EVENT", "TICKET_EVENT", "LIVE_EVENT"].includes(eventType)) {
    return "offline";
  }
  return (releaseCategory?.toLowerCase() as CalendarEvent["category"] | undefined) ?? "anime";
}

export function formatRelativeDate(value: string, now = new Date()): string {
  const target = new Date(value);
  const diff = target.getTime() - now.getTime();
  const abs = Math.abs(diff);
  const days = Math.round(abs / MS_PER_DAY);
  if (days === 0) return diff >= 0 ? "오늘" : "오늘";
  if (days === 1) return diff >= 0 ? "내일" : "어제";
  return diff >= 0 ? `${days}일 후` : `${days}일 전`;
}

export function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

export function formatEventDate(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).format(new Date(value));
}

export function formatEventDatePeriod(startsAt: string, endsAt?: string): string {
  if (!endsAt) return formatEventDate(startsAt);
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();

  if (sameDay) return formatEventDate(startsAt);

  return `${formatEventDate(startsAt)} ~ ${formatEventDate(endsAt)}`;
}

export function formatEventPeriod(startsAt: string, endsAt?: string): string {
  if (!endsAt) return formatDateTime(startsAt);
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();

  if (sameDay) {
    const day = new Intl.DateTimeFormat("ko-KR", {
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
    }).format(start);
    const startTime = new Intl.DateTimeFormat("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(start);
    const endTime = new Intl.DateTimeFormat("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(end);
    return `${day} ${startTime}~${endTime}`;
  }

  return `${formatDateTime(startsAt)} ~ ${formatDateTime(endsAt)}`;
}

export function ymdKey(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function addMonths(d: Date, delta: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1);
}

export function buildMonthGrid(cursor: Date): Date[][] {
  const first = startOfMonth(cursor);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());

  const weeks: Date[][] = [];
  for (let w = 0; w < 6; w += 1) {
    const row: Date[] = [];
    for (let i = 0; i < 7; i += 1) {
      const d = new Date(start);
      d.setDate(start.getDate() + w * 7 + i);
      row.push(d);
    }
    weeks.push(row);
  }
  return weeks;
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * MS_PER_DAY);
}

function isoAt(d: Date, hours: number, minutes: number): string {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), hours, minutes).toISOString();
}

function ymdAt(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function buildEditorBody(paragraphs: string[]): string {
  return JSON.stringify({
    type: "doc",
    content: paragraphs.map((paragraph) => ({
      type: "paragraph",
      content: [{ type: "text", text: paragraph }],
    })),
  });
}
