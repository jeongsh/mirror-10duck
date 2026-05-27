import type { OttPlatform } from "@/types/official";

export const OTT_PLATFORM_IDS = [
  "laftel",
  "netflix",
  "tving",
  "wavve",
  "watcha",
  "disney-plus",
  "prime-video",
  "crunchyroll",
  "apple-tv",
  "serieson",
] as const;

export type OttPlatformId = (typeof OTT_PLATFORM_IDS)[number];

export const OTT_PLATFORM_FALLBACKS: Record<
  OttPlatformId,
  Pick<OttPlatform, "id" | "name" | "display_name" | "logo_key" | "website_url" | "sort_order">
> = {
  laftel: {
    id: "laftel",
    name: "라프텔",
    display_name: "라프텔",
    logo_key: "laftel",
    website_url: "https://laftel.net",
    sort_order: 10,
  },
  netflix: {
    id: "netflix",
    name: "넷플릭스",
    display_name: "Netflix",
    logo_key: "netflix",
    website_url: "https://www.netflix.com/kr",
    sort_order: 20,
  },
  tving: {
    id: "tving",
    name: "티빙",
    display_name: "TVING",
    logo_key: "tving",
    website_url: "https://www.tving.com",
    sort_order: 30,
  },
  wavve: {
    id: "wavve",
    name: "웨이브",
    display_name: "wavve",
    logo_key: "wavve",
    website_url: "https://www.wavve.com",
    sort_order: 40,
  },
  watcha: {
    id: "watcha",
    name: "왓챠",
    display_name: "WATCHA",
    logo_key: "watcha",
    website_url: "https://watcha.com",
    sort_order: 50,
  },
  "disney-plus": {
    id: "disney-plus",
    name: "디즈니+",
    display_name: "Disney+",
    logo_key: "disney-plus",
    website_url: "https://www.disneyplus.com/ko-kr",
    sort_order: 60,
  },
  "prime-video": {
    id: "prime-video",
    name: "프라임 비디오",
    display_name: "Prime Video",
    logo_key: "prime-video",
    website_url: "https://www.primevideo.com",
    sort_order: 70,
  },
  crunchyroll: {
    id: "crunchyroll",
    name: "크런치롤",
    display_name: "Crunchyroll",
    logo_key: "crunchyroll",
    website_url: "https://www.crunchyroll.com",
    sort_order: 80,
  },
  "apple-tv": {
    id: "apple-tv",
    name: "Apple TV",
    display_name: "Apple TV",
    logo_key: "apple-tv",
    website_url: "https://tv.apple.com/kr",
    sort_order: 90,
  },
  serieson: {
    id: "serieson",
    name: "네이버 시리즈온",
    display_name: "네이버 시리즈온",
    logo_key: "serieson",
    website_url: "https://serieson.naver.com",
    sort_order: 100,
  },
};

const OTT_PLATFORM_ID_BY_NAME = Object.fromEntries(
  OTT_PLATFORM_IDS.map((id) => [OTT_PLATFORM_FALLBACKS[id].name, id]),
) as Record<string, OttPlatformId>;

export function getOttPlatformIdByName(name: string) {
  return OTT_PLATFORM_ID_BY_NAME[name.trim()] ?? null;
}

export function getOttLogoPath(logoKey: string) {
  return `/ott/${logoKey}.svg`;
}

export function sortOttPlatforms<T extends { sort_order?: number; name?: string }>(
  platforms: T[],
) {
  return [...platforms].sort(
    (a, b) =>
      (a.sort_order ?? Number.MAX_SAFE_INTEGER) -
        (b.sort_order ?? Number.MAX_SAFE_INTEGER) ||
      (a.name ?? "").localeCompare(b.name ?? "", "ko"),
  );
}
