import type { OtakuCategory } from "@/lib/otaku/hub";

export type NewsNameMapping = {
  original: string;
  koreanOfficial: string;
  type: "work" | "character" | "nickname" | "other";
  namuwikiMatched?: boolean;
  catalogMatched?: boolean;
};

export type NewsSourceDraftResult = {
  sourceUrl: string;
  detectedTopic: string;
  category: Exclude<OtakuCategory, "all" | "game">;
  nameMappings: NewsNameMapping[];
  title: string;
  summary: string;
  body: string;
  tags: string[];
  notes: string;
};

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeCategory(value: unknown): NewsSourceDraftResult["category"] {
  const raw = stringValue(value).toLowerCase();
  if (raw === "manga") return "manga";
  return "anime";
}

function normalizeNameMappingType(value: unknown): NewsNameMapping["type"] {
  const raw = stringValue(value).toLowerCase();
  if (raw === "work" || raw === "character" || raw === "nickname") return raw;
  return "other";
}

export function normalizeNameMappings(value: unknown): NewsNameMapping[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const original = stringValue(row.original);
      const koreanOfficial = stringValue(row.koreanOfficial);
      if (!original) return null;
      const mapping: NewsNameMapping = {
        original,
        koreanOfficial,
        type: normalizeNameMappingType(row.type),
      };
      if (row.namuwikiMatched === true) mapping.namuwikiMatched = true;
      if (row.catalogMatched === true) mapping.catalogMatched = true;
      return mapping;
    })
    .filter((item): item is NewsNameMapping => item !== null);
}

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => stringValue(item)).filter(Boolean);
}

const SOURCE_SITE_PATTERNS = [
  /crunchyroll(?:\s*news)?/gi,
  /크런치롤(?:\s*뉴스)?/g,
  /https?:\/\/(?:www\.)?crunchyroll\.com[^\s]*/gi,
];

export function sanitizeNewsDraftText(text: string): string {
  let result = text;
  for (const pattern of SOURCE_SITE_PATTERNS) {
    result = result.replace(pattern, "");
  }

  return result
    .replace(/\(\s*\)/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.!?])/g, "$1")
    .replace(/^[,.!?]\s*/g, "")
    .trim();
}

export function normalizeNewsSourceDraftResult(
  parsed: unknown,
  sourceUrl: string,
  overrides?: Partial<Pick<NewsSourceDraftResult, "nameMappings" | "title" | "summary" | "body">>,
): NewsSourceDraftResult {
  const obj = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};

  const title = sanitizeNewsDraftText(overrides?.title ?? stringValue(obj.title));
  const summary = sanitizeNewsDraftText(overrides?.summary ?? stringValue(obj.summary));
  const body = sanitizeNewsDraftText(overrides?.body ?? stringValue(obj.body));
  const notes = sanitizeNewsDraftText(stringValue(obj.notes));
  const detectedTopic = sanitizeNewsDraftText(stringValue(obj.detectedTopic)) || "주제 미확인";
  const tags = normalizeTags(obj.tags)
    .map((tag) => sanitizeNewsDraftText(tag))
    .filter(Boolean);

  return {
    sourceUrl,
    detectedTopic,
    category: normalizeCategory(obj.category),
    nameMappings: overrides?.nameMappings ?? normalizeNameMappings(obj.nameMappings),
    title,
    summary,
    body,
    tags,
    notes,
  };
}

export function buildNewsEditorBodyJson(body: string): string {
  const content: Array<Record<string, unknown>> = [];

  for (const paragraph of body.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean)) {
    content.push({
      type: "paragraph",
      content: [{ type: "text", text: paragraph }],
    });
  }

  if (content.length === 0) {
    content.push({ type: "paragraph" });
  }

  return JSON.stringify({ type: "doc", content });
}

