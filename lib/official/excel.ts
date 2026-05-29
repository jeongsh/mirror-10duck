import type {
  OfficialCharacterPosition,
  OfficialCatalogStatus,
  OfficialWorkCategory,
} from "@/types/official";
import {
  OFFICIAL_CHARACTER_POSITIONS,
  normalizeOfficialSlug,
  splitList,
  uniqueList,
} from "./catalog";

type SheetRow = Record<string, unknown>;

export const WORK_TEMPLATE_PATH = "/templates/official-works-template.xlsx";
export const OSHI_TEMPLATE_PATH = "/templates/official-oshi-template.xlsx";

export type WorkExcelPayload = {
  slug: string;
  title: string;
  original_title: string | null;
  aliases: string[];
  category: OfficialWorkCategory;
  genres: string[];
  age_rating: string | null;
  ott_platforms: string[];
  start_date: string | null;
  end_date: string | null;
  season: string | null;
  episode_count: number | null;
  studios: string[];
  director: string | null;
  original_author: string | null;
  anilist_id: number | null;
  synopsis: string;
  status: OfficialCatalogStatus;
  sort_order: number;
};

export type OshiExcelPayload = {
  work_id: string;
  slug: string;
  name: string;
  original_name: string | null;
  aliases: string[];
  gender: string | null;
  positions: OfficialCharacterPosition[];
  tags: string[];
  meme_tags: string[];
  description: string;
  status: OfficialCatalogStatus;
  sort_order: number;
};

const CATEGORY_VALUES = new Set<OfficialWorkCategory>([
  "anime",
  "manga",
  "light_novel",
  "webtoon",
  "other",
]);

const STATUS_VALUES = new Set<OfficialCatalogStatus>([
  "DRAFT",
  "PUBLISHED",
  "HIDDEN",
]);

function text(row: SheetRow, key: string) {
  const value = row[key];
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function optionalText(row: SheetRow, key: string) {
  return text(row, key) || null;
}

function integer(row: SheetRow, key: string) {
  const value = text(row, key);
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

function status(row: SheetRow) {
  const value = text(row, "상태").toUpperCase() as OfficialCatalogStatus;
  return STATUS_VALUES.has(value) ? value : "DRAFT";
}

function category(row: SheetRow) {
  const value = text(row, "분류").toLowerCase() as OfficialWorkCategory;
  return CATEGORY_VALUES.has(value) ? value : "anime";
}

function listFromFlexibleCell(row: SheetRow, key: string) {
  const value = text(row, key);
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return uniqueList(parsed.map((item) => String(item)));
    }
  } catch {
    // 쉼표/줄바꿈 입력을 기본으로 지원하고, JSON 배열도 선택적으로 허용한다.
  }
  return uniqueList(splitList(value));
}

function positions(row: SheetRow) {
  const allowed = new Set<string>(OFFICIAL_CHARACTER_POSITIONS);
  return listFromFlexibleCell(row, "포지션").filter((item) =>
    allowed.has(item),
  ) as OfficialCharacterPosition[];
}

async function readRows(file: File): Promise<SheetRow[]> {
  const XLSX = await import("xlsx");
  const bytes = await file.arrayBuffer();
  const workbook = XLSX.read(bytes, { type: "array", cellDates: false });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json<SheetRow>(firstSheet, {
    defval: "",
    raw: false,
  });
}

export async function parseWorkExcel(file: File): Promise<WorkExcelPayload[]> {
  const rows = await readRows(file);
  return rows
    .map((row) => {
      const title = text(row, "작품명");
      const normalizedSlug = normalizeOfficialSlug(text(row, "슬러그") || title);
      if (!title || !normalizedSlug) return null;

      return {
        slug: normalizedSlug,
        title,
        original_title: optionalText(row, "원제"),
        aliases: splitList(text(row, "별칭")),
        category: category(row),
        genres: splitList(text(row, "장르")),
        age_rating: optionalText(row, "연령등급"),
        ott_platforms: splitList(text(row, "OTT")),
        start_date: optionalText(row, "시작일"),
        end_date: optionalText(row, "종료일"),
        season: optionalText(row, "분기"),
        episode_count: integer(row, "화수"),
        studios: splitList(text(row, "제작사")),
        director: optionalText(row, "감독"),
        original_author: optionalText(row, "원작자"),
        anilist_id: integer(row, "AniList ID"),
        synopsis: text(row, "소개"),
        status: status(row),
        sort_order: integer(row, "우선순위") ?? 0,
      };
    })
    .filter((row): row is WorkExcelPayload => Boolean(row));
}

export async function parseOshiExcel(
  file: File,
  fallbackWorkId: string,
): Promise<OshiExcelPayload[]> {
  const rows = await readRows(file);
  return rows
    .map((row) => {
      const name = text(row, "이름");
      const normalizedSlug = normalizeOfficialSlug(text(row, "슬러그") || name);
      if (!name || !normalizedSlug || !fallbackWorkId) return null;

      return {
        work_id: fallbackWorkId,
        slug: normalizedSlug,
        name,
        original_name: optionalText(row, "원문명"),
        aliases: splitList(text(row, "별칭")),
        gender: optionalText(row, "성별"),
        positions: positions(row),
        tags: listFromFlexibleCell(row, "태그"),
        meme_tags: listFromFlexibleCell(row, "밈 태그"),
        description: text(row, "소개"),
        status: status(row),
        sort_order: integer(row, "우선순위") ?? 0,
      };
    })
    .filter((row): row is OshiExcelPayload => Boolean(row));
}
