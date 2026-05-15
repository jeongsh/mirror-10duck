import { normalizeCours } from "@/lib/otaku/cours";

export type ReleaseStaffSummary = {
  director: string[];
  seriesComposition: string[];
  characterDesign: string[];
  music: string[];
};

export type ReleaseAiCandidate = {
  mediaId: number;
  popularity: number;
  sourceType: string | null;
  isAdult: boolean;
  titleNative: string | null;
  titleEnglish: string | null;
  titleRomaji: string | null;
  synopsisSeed: string;
  posterUrl: string | null;
  bannerUrl: string | null;
  genres: string[];
  studios: string[];
  season: "WINTER" | "SPRING" | "SUMMER" | "FALL" | null;
  seasonYear: number | null;
  format: string | null;
  status: string | null;
  airedFrom: string | null;
  airedTo: string | null;
  episodes: number | null;
  staff: ReleaseStaffSummary;
};

export type ReleaseAiOutput = {
  mediaId: number;
  titleKo: string;
  synopsis: string;
};

type AniListSeasonResponse = {
  data?: {
    Page?: {
      pageInfo?: {
        hasNextPage?: boolean;
      } | null;
      media?: AniListMedia[] | null;
    } | null;
  } | null;
  errors?: Array<{ message?: string }>;
};

type AniListMedia = {
  id: number;
  isAdult?: boolean | null;
  format?: string | null;
  source?: string | null;
  status?: string | null;
  description?: string | null;
  title?: {
    romaji?: string | null;
    english?: string | null;
    native?: string | null;
    userPreferred?: string | null;
  } | null;
  coverImage?: {
    extraLarge?: string | null;
    large?: string | null;
  } | null;
  bannerImage?: string | null;
  genres?: string[] | null;
  popularity?: number | null;
  studios?: {
    nodes?: Array<{ name?: string | null } | null> | null;
  } | null;
  staff?: {
    edges?: Array<{
      role?: string | null;
      node?: {
        name?: {
          userPreferred?: string | null;
          native?: string | null;
        } | null;
      } | null;
    } | null> | null;
  } | null;
  season?: "WINTER" | "SPRING" | "SUMMER" | "FALL" | null;
  seasonYear?: number | null;
  episodes?: number | null;
  startDate?: {
    year?: number | null;
    month?: number | null;
    day?: number | null;
  } | null;
  endDate?: {
    year?: number | null;
    month?: number | null;
    day?: number | null;
  } | null;
};

const ANILIST_GRAPHQL = "https://graphql.anilist.co";

export function coursToAniListSeason(cours: string): { year: number; season: "WINTER" | "SPRING" | "SUMMER" | "FALL" } | null {
  const normalized = normalizeCours(cours);
  if (!normalized) return null;

  const match = normalized.match(/^(\d{4})-Q([1-4])$/);
  if (!match) return null;

  const quarter = Number(match[2]);
  const season = quarter === 1 ? "WINTER" : quarter === 2 ? "SPRING" : quarter === 3 ? "SUMMER" : "FALL";
  return { year: Number(match[1]), season };
}

export function formatSeasonLabel(cours: string): string {
  const normalized = normalizeCours(cours);
  if (!normalized) return "미정";

  const match = normalized.match(/^(\d{4})-Q([1-4])$/);
  if (!match) return normalized;

  const quarterLabel = match[2] === "1" ? "겨울" : match[2] === "2" ? "봄" : match[2] === "3" ? "여름" : "가을";
  return `${match[1]} ${quarterLabel}`;
}

export async function fetchSeasonAnimeCandidates(cours: string): Promise<ReleaseAiCandidate[]> {
  const seasonInfo = coursToAniListSeason(cours);
  if (!seasonInfo) return [];

  const results: ReleaseAiCandidate[] = [];
  let page = 1;
  let hasNextPage = true;

  while (hasNextPage) {
    const query = `
      query ReleaseSeason($season: MediaSeason!, $seasonYear: Int!, $page: Int!, $perPage: Int!) {
        Page(page: $page, perPage: $perPage) {
          pageInfo {
            hasNextPage
          }
          media(season: $season, seasonYear: $seasonYear, type: ANIME, sort: POPULARITY_DESC) {
            id
            isAdult
            format
            source
            status
            title {
              romaji
              english
              native
              userPreferred
            }
            description(asHtml: false)
            coverImage {
              extraLarge
              large
            }
            bannerImage
            genres
            popularity
            studios(isMain: true) {
              nodes {
                name
              }
            }
            staff(perPage: 35, sort: RELEVANCE) {
              edges {
                role
                node {
                  name {
                    userPreferred
                    native
                  }
                }
              }
            }
            season
            seasonYear
            episodes
            startDate {
              year
              month
              day
            }
            endDate {
              year
              month
              day
            }
          }
        }
      }
    `;

    const response = await fetch(ANILIST_GRAPHQL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        query,
        variables: {
          season: seasonInfo.season,
          seasonYear: seasonInfo.year,
          page,
          perPage: 50,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`AniList 요청 실패: ${response.status}`);
    }

    const json = (await response.json()) as AniListSeasonResponse;
    if (json.errors?.length) {
      throw new Error(json.errors[0]?.message ?? "AniList GraphQL 오류");
    }

    const mediaList = json.data?.Page?.media ?? [];
    for (const media of mediaList) {
      const staff = buildStaffSummary(media.staff?.edges ?? []);

      results.push({
        mediaId: media.id,
        popularity: media.popularity ?? results.length + 1,
        sourceType: media.source?.trim() || null,
        isAdult: Boolean(media.isAdult),
        titleNative: media.title?.native?.trim() || null,
        titleEnglish: media.title?.english?.trim() || media.title?.userPreferred?.trim() || null,
        titleRomaji: media.title?.romaji?.trim() || media.title?.userPreferred?.trim() || null,
        synopsisSeed: normalizeSynopsis(media.description),
        posterUrl:
          media.coverImage?.extraLarge ||
          media.coverImage?.large ||
          null,
        bannerUrl: media.bannerImage || null,
        genres: uniqueStrings(media.genres ?? []),
        studios: extractStudioNames(media.studios?.nodes ?? []),
        season: media.season ?? null,
        seasonYear: media.seasonYear ?? null,
        format: media.format?.trim() || null,
        status: media.status?.trim() || null,
        airedFrom: formatDateValue(media.startDate),
        airedTo: formatDateValue(media.endDate),
        episodes: media.episodes ?? null,
        staff,
      });
    }

    hasNextPage = Boolean(json.data?.Page?.pageInfo?.hasNextPage);
    page += 1;
  }

  return results;
}

export function buildTitlePrompt(cours: string, items: ReleaseAiCandidate[]): string {
  const payload = {
    cours,
    instruction:
      "Return valid JSON only. Keep the same order and count. Produce Korean titles and longer Korean synopses.",
    outputShape: {
      items: [
        {
          mediaId: 123,
          titleKo: "한국어 제목",
          synopsis: "한국어 소개글",
        },
      ],
    },
    style: {
      titleKo: [
        "실제 국내에서 널리 쓰이는 제목이 있으면 그 이름을 우선한다.",
        "없으면 자연스러운 한국어 로컬라이즈 제목으로 만든다.",
        "일본어 원문이나 영어 원문을 그대로 쓰지 않는다.",
      ],
      synopsis: [
        "3~5문장",
        "최소 180자 이상",
        "작품의 분위기, 중심 설정, 감상 포인트를 자연스럽게 담는다.",
        "성인 작품도 포함되지만 문체는 노골적이지 않게 유지한다.",
      ],
    },
    items: items.map((item) => ({
      mediaId: item.mediaId,
      isAdult: item.isAdult,
      sourceType: item.sourceType,
      titleNative: item.titleNative,
      titleEnglish: item.titleEnglish,
      titleRomaji: item.titleRomaji,
      synopsisSeed: item.synopsisSeed,
      genres: item.genres,
      studios: item.studios,
      season: item.season,
      seasonYear: item.seasonYear,
      format: item.format,
      status: item.status,
      episodes: item.episodes,
      popularity: item.popularity,
    })),
  };

  return [
    "You are preparing metadata for a Korean anime release database.",
    "Rules:",
    "- Output JSON only.",
    "- Do not omit any item.",
    "- Do not reorder items.",
    "- Use Korean for titleKo and synopsis.",
    "- titleKo must be Hangul, not Japanese or English script.",
    "- If a widely used Korean title is known, prefer it over a literal translation.",
    "- synopsis must be detailed, natural, and at least 180 Korean characters.",
    "- Do not mention the data source or API in the text.",
    "- Keep adult content neutral and non-explicit in the copy.",
    "- Output shape: {\"items\":[{\"mediaId\":number,\"titleKo\":string,\"synopsis\":string}]}",
    "Input payload:",
    JSON.stringify(payload),
  ].join("\n");
}

export function buildDetailEntries(item: ReleaseAiCandidate) {
  return [
    { label: "원작", value: toKoreanSource(item.sourceType) },
    { label: "감독", value: joinOrMissing(item.staff.director) },
    { label: "시리즈 구성", value: joinOrMissing(item.staff.seriesComposition) },
    { label: "캐릭터 디자인", value: joinOrMissing(item.staff.characterDesign) },
    { label: "음악", value: joinOrMissing(item.staff.music) },
    { label: "제작사", value: joinOrMissing(item.studios) },
    { label: "방영 기간", value: formatAiredRange(item) },
    { label: "화수", value: item.episodes ? `${item.episodes}화` : "미정" },
    { label: "등급", value: item.isAdult ? "성인" : "일반" },
    { label: "성인 여부", value: item.isAdult ? "예" : "아니오" },
  ];
}

function buildStaffSummary(
  staff: Array<{
    role?: string | null;
    node?: {
      name?: {
        userPreferred?: string | null;
        native?: string | null;
      } | null;
    } | null;
  } | null>,
): ReleaseStaffSummary {
  const summary = emptyStaffSummary();

  for (const edge of staff) {
    const role = edge?.role?.toLowerCase() ?? "";
    const name = edge?.node?.name?.native?.trim() || edge?.node?.name?.userPreferred?.trim();
    if (!name) continue;

    if (isDirectorRole(role)) summary.director.push(name);
    if (isSeriesCompositionRole(role)) summary.seriesComposition.push(name);
    if (isCharacterDesignRole(role)) summary.characterDesign.push(name);
    if (isMusicRole(role)) summary.music.push(name);
  }

  return {
    director: uniqueStrings(summary.director),
    seriesComposition: uniqueStrings(summary.seriesComposition),
    characterDesign: uniqueStrings(summary.characterDesign),
    music: uniqueStrings(summary.music),
  };
}

function isDirectorRole(role: string): boolean {
  return (
    role.includes("director") &&
    !role.includes("art director") &&
    !role.includes("sound director") &&
    !role.includes("cg director") &&
    !role.includes("photography director")
  );
}

function isSeriesCompositionRole(role: string): boolean {
  return role.includes("series composition") || role.includes("script") || role.includes("screenplay");
}

function isCharacterDesignRole(role: string): boolean {
  return role.includes("character design");
}

function isMusicRole(role: string): boolean {
  return role.includes("music");
}

function emptyStaffSummary(): ReleaseStaffSummary {
  return {
    director: [],
    seriesComposition: [],
    characterDesign: [],
    music: [],
  };
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))),
  );
}

function extractStudioNames(nodes: Array<{ name?: string | null } | null>): string[] {
  return uniqueStrings(nodes.map((node) => node?.name ?? null));
}

function normalizeSynopsis(value: string | null | undefined): string {
  if (!value) return "";

  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1200);
}

function formatDateValue(value: { year?: number | null; month?: number | null; day?: number | null } | null | undefined): string | null {
  if (!value?.year || !value.month || !value.day) return null;
  return `${value.year}-${String(value.month).padStart(2, "0")}-${String(value.day).padStart(2, "0")}`;
}

function formatAiredRange(item: ReleaseAiCandidate): string {
  if (item.airedFrom && item.airedTo) return `${item.airedFrom} ~ ${item.airedTo}`;
  if (item.airedFrom) {
    if (item.status?.toUpperCase() === "RELEASING") return `${item.airedFrom} ~ 방영 중`;
    if (item.status?.toUpperCase() === "NOT_YET_RELEASED") return "방영 예정";
    return `${item.airedFrom} ~ 미정`;
  }
  if (item.status?.toUpperCase() === "NOT_YET_RELEASED") return "방영 예정";
  return "미정";
}

function joinOrMissing(values: string[]): string {
  return values.length > 0 ? values.join(", ") : "미정";
}

export function toKoreanSource(value: string | null): string {
  if (!value) return "미정";
  const map: Record<string, string> = {
    ORIGINAL: "오리지널",
    MANGA: "만화",
    LIGHT_NOVEL: "라이트 노벨",
    VISUAL_NOVEL: "비주얼 노벨",
    VIDEO_GAME: "게임",
    OTHER: "기타",
    NOVEL: "소설",
    DOUJINSHI: "동인지",
    ANIME: "애니메이션",
    WEB_NOVEL: "웹소설",
    LIVE_ACTION: "실사",
    GAME: "게임",
    COMIC: "코믹",
    MULTIMEDIA_PROJECT: "미디어 믹스",
    PICTURE_BOOK: "그림책",
  };

  return map[value] ?? value.replace(/_/g, " ");
}
