import type { SupabaseClient } from "@supabase/supabase-js";
import { isSameNamuwikiTitle, resolveNameFromNamuwiki } from "@/lib/news/namuwikiSearch";
import { callPerplexityWithFallback, parseJsonContent } from "@/lib/perplexity/client";
import type { NewsNameMapping } from "@/lib/news/newsDraft";

type CatalogCharacterRow = {
  work_id: string;
  name: string;
  original_name: string | null;
  aliases: string[] | null;
};

type CatalogWorkRow = {
  title: string;
  original_title: string | null;
};

const NAMUWIKI_NAME_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["mappings"],
  properties: {
    mappings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["original", "koreanOfficial", "type", "foundOnNamuwiki"],
        properties: {
          original: { type: "string" },
          koreanOfficial: { type: "string" },
          type: { type: "string", enum: ["work", "character", "nickname", "other"] },
          foundOnNamuwiki: { type: "boolean" },
        },
      },
    },
  },
};

const NAMUWIKI_SYSTEM_PROMPT = [
  "Resolve Korean names for anime/manga works, characters, and nicknames using Namuwiki ONLY.",
  "Namuwiki (https://namu.wiki) is the single authoritative source. Do not use other sites, phonetic guesses, or English-to-Korean transliteration.",
  "Search Namuwiki for the work page first, then the character section or character page.",
  "Copy the exact Korean spelling used on Namuwiki.",
  "For characters, never invent a Korean name. Use only the name shown on Namuwiki.",
  "For nicknames, use the Korean nickname or alias listed on Namuwiki when available.",
  "If a Namuwiki page cannot be found, set foundOnNamuwiki=false and keep koreanOfficial empty.",
  "Return JSON only.",
].join("\n");

export type EnrichedNewsNames = {
  nameMappings: NewsNameMapping[];
  title: string;
  summary: string;
  body: string;
};

function normalizeLookupKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceWholeTerm(text: string, from: string, to: string): string {
  if (!from.trim() || from === to) return text;
  const pattern = new RegExp(escapeRegExp(from), "gi");
  return text.replace(pattern, to);
}

export function applyNameMappingsToText(text: string, mappings: NewsNameMapping[]): string {
  let result = text;
  const replacements = [...mappings].sort((a, b) => b.original.length - a.original.length);

  for (const mapping of replacements) {
    result = replaceWholeTerm(result, mapping.original, mapping.koreanOfficial);
  }

  return result;
}

function findCharacterInCatalog(original: string, characters: CatalogCharacterRow[]): string | null {
  const key = normalizeLookupKey(original);
  if (!key) return null;

  for (const character of characters) {
    if (character.original_name && normalizeLookupKey(character.original_name) === key) {
      return character.name;
    }
    for (const alias of character.aliases ?? []) {
      if (normalizeLookupKey(alias) === key) return character.name;
    }
  }

  return null;
}

function findWorkInCatalog(original: string, works: CatalogWorkRow[]): string | null {
  const key = normalizeLookupKey(original);
  if (!key) return null;

  for (const work of works) {
    if (normalizeLookupKey(work.title) === key) return work.title;
    if (work.original_title && normalizeLookupKey(work.original_title) === key) return work.title;
  }

  return null;
}

async function loadCatalogContext(
  adminClient: SupabaseClient,
  mappings: NewsNameMapping[],
): Promise<{ characters: CatalogCharacterRow[]; works: CatalogWorkRow[] }> {
  const originals = mappings.map((mapping) => mapping.original).filter(Boolean);
  if (originals.length === 0) return { characters: [], works: [] };

  const workFilters = originals.map((name) => `original_title.ilike.%${name}%`).join(",");
  const titleFilters = originals.map((name) => `title.ilike.%${name}%`).join(",");
  const workOr = [workFilters, titleFilters].filter(Boolean).join(",");

  const [{ data: works }, { data: characters }] = await Promise.all([
    workOr
      ? adminClient.from("official_works").select("id, title, original_title").eq("status", "PUBLISHED").or(workOr)
      : Promise.resolve({ data: [] }),
    adminClient
      .from("official_oshi_characters")
      .select("name, original_name, aliases, work_id")
      .eq("status", "PUBLISHED"),
  ]);

  const workIds = new Set((works ?? []).map((work) => (work as { id: string }).id));
  const allCharacters = (characters ?? []).map((row) => {
    const item = row as Record<string, unknown>;
    return {
      work_id: String(item.work_id ?? ""),
      name: String(item.name ?? ""),
      original_name: typeof item.original_name === "string" ? item.original_name : null,
      aliases: Array.isArray(item.aliases) ? item.aliases.map(String) : null,
    } satisfies CatalogCharacterRow;
  });

  const scopedCharacters =
    workIds.size > 0
      ? allCharacters.filter((character) => workIds.has(character.work_id))
      : allCharacters;

  return {
    works: (works ?? []) as CatalogWorkRow[],
    characters: scopedCharacters.length > 0 ? scopedCharacters : allCharacters,
  };
}

function applyCatalogFallback(
  mappings: NewsNameMapping[],
  catalog: { characters: CatalogCharacterRow[]; works: CatalogWorkRow[] },
): NewsNameMapping[] {
  return mappings.map((mapping) => {
    if (mapping.namuwikiMatched || mapping.catalogMatched) return mapping;

    if (mapping.type === "work") {
      const catalogName = findWorkInCatalog(mapping.original, catalog.works);
      if (!catalogName) return mapping;
      return { ...mapping, koreanOfficial: catalogName, catalogMatched: true };
    }

    if (mapping.type === "character" || mapping.type === "nickname") {
      const catalogName = findCharacterInCatalog(mapping.original, catalog.characters);
      if (!catalogName) return mapping;
      return { ...mapping, koreanOfficial: catalogName, catalogMatched: true };
    }

    return mapping;
  });
}

async function resolveNamesFromNamuwikiDirect(
  mappings: NewsNameMapping[],
): Promise<NewsNameMapping[]> {
  const workTitleByOriginal = new Map<string, string>();

  for (const mapping of mappings) {
    if (mapping.type !== "work" || !mapping.original.trim()) continue;
    const resolved = await resolveNameFromNamuwiki(mapping.original, "work");
    if (!resolved) continue;
    workTitleByOriginal.set(normalizeLookupKey(mapping.original), resolved);
  }

  const enriched: NewsNameMapping[] = [];

  for (const mapping of mappings) {
    if (mapping.type === "work") {
      const resolved = workTitleByOriginal.get(normalizeLookupKey(mapping.original));
      if (!resolved) {
        enriched.push({ ...mapping, namuwikiMatched: false });
        continue;
      }
      enriched.push({
        ...mapping,
        koreanOfficial: resolved,
        namuwikiMatched: true,
      });
      continue;
    }

    const relatedWork = [...workTitleByOriginal.values()][0];
    const resolved = await resolveNameFromNamuwiki(mapping.original, mapping.type, {
      workTitle: relatedWork,
    });

    if (!resolved || (relatedWork && isSameNamuwikiTitle(resolved, relatedWork))) {
      enriched.push({ ...mapping, namuwikiMatched: false });
      continue;
    }

    enriched.push({
      ...mapping,
      koreanOfficial: resolved,
      namuwikiMatched: true,
    });
  }

  return enriched;
}

async function resolveNamesFromNamuwiki(
  apiKey: string,
  mappings: NewsNameMapping[],
  context: {
    articleUrl: string;
    draftTitle?: string;
    detectedTopic?: string;
    summary?: string;
  },
): Promise<NewsNameMapping[]> {
  const targets = mappings.filter(
    (mapping) =>
      !mapping.namuwikiMatched &&
      ["work", "character", "nickname", "other"].includes(mapping.type),
  );
  if (targets.length === 0) return mappings;

  try {
    const raw = await callPerplexityWithFallback(apiKey, (structured) => ({
      model: process.env.PERPLEXITY_MODEL ?? "sonar",
      temperature: 0.1,
      messages: [
        { role: "system", content: NAMUWIKI_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            `Article URL: ${context.articleUrl}`,
            context.draftTitle ? `Draft title: ${context.draftTitle}` : "",
            context.detectedTopic ? `Detected topic: ${context.detectedTopic}` : "",
            context.summary ? `Summary: ${context.summary}` : "",
            "Resolve Korean names on Namuwiki for every item below.",
            "Search site:namu.wiki and read the work/character pages.",
            JSON.stringify(targets),
            'Return JSON: { "mappings": [{ "original": "...", "koreanOfficial": "...", "type": "character", "foundOnNamuwiki": true }] }',
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
      ...(structured
        ? {
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "namuwiki_name_mappings",
                schema: NAMUWIKI_NAME_SCHEMA,
              },
            },
          }
        : {}),
    }));

    const parsed = parseJsonContent(raw);
    if (!parsed || typeof parsed !== "object") return mappings;

    const resolvedList = (parsed as Record<string, unknown>).mappings;
    if (!Array.isArray(resolvedList)) return mappings;

    const resolvedMap = new Map<
      string,
      { koreanOfficial: string; foundOnNamuwiki: boolean }
    >();

    for (const item of resolvedList) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      const original = typeof row.original === "string" ? row.original.trim() : "";
      const koreanOfficial = typeof row.koreanOfficial === "string" ? row.koreanOfficial.trim() : "";
      const foundOnNamuwiki = row.foundOnNamuwiki === true;
      if (!original || !koreanOfficial || !foundOnNamuwiki) continue;
      resolvedMap.set(normalizeLookupKey(original), { koreanOfficial, foundOnNamuwiki });
    }

    return mappings.map((mapping) => {
      if (mapping.namuwikiMatched) return mapping;
      const resolved = resolvedMap.get(normalizeLookupKey(mapping.original));
      if (!resolved) return { ...mapping, namuwikiMatched: false };
      return {
        ...mapping,
        koreanOfficial: resolved.koreanOfficial,
        namuwikiMatched: true,
      };
    });
  } catch {
    return mappings;
  }
}

function applyKoreanNameCorrections(
  text: string,
  previousMappings: NewsNameMapping[],
  currentMappings: NewsNameMapping[],
): string {
  let result = text;

  for (let index = 0; index < currentMappings.length; index += 1) {
    const previous = previousMappings[index];
    const current = currentMappings[index];
    if (!previous || !current) continue;
    if (previous.koreanOfficial !== current.koreanOfficial) {
      result = replaceWholeTerm(result, previous.koreanOfficial, current.koreanOfficial);
    }
  }

  return result;
}

export async function enrichNewsDraftNames({
  apiKey,
  adminClient,
  articleUrl,
  draftTitle,
  detectedTopic,
  summary,
  title,
  body,
  nameMappings,
}: {
  apiKey: string;
  adminClient: SupabaseClient;
  articleUrl: string;
  draftTitle: string;
  detectedTopic: string;
  summary: string;
  title: string;
  body: string;
  nameMappings: NewsNameMapping[];
}): Promise<EnrichedNewsNames> {
  const initialMappings = nameMappings.map((mapping) => ({ ...mapping }));

  let enrichedMappings = await resolveNamesFromNamuwikiDirect(nameMappings);

  enrichedMappings = await resolveNamesFromNamuwiki(apiKey, enrichedMappings, {
    articleUrl,
    draftTitle,
    detectedTopic,
    summary,
  });

  const catalog = await loadCatalogContext(adminClient, enrichedMappings);
  enrichedMappings = applyCatalogFallback(enrichedMappings, catalog);

  let enrichedTitle = applyNameMappingsToText(title, enrichedMappings);
  let enrichedSummary = applyNameMappingsToText(summary, enrichedMappings);
  let enrichedBody = applyNameMappingsToText(body, enrichedMappings);

  enrichedTitle = applyKoreanNameCorrections(enrichedTitle, initialMappings, enrichedMappings);
  enrichedSummary = applyKoreanNameCorrections(enrichedSummary, initialMappings, enrichedMappings);
  enrichedBody = applyKoreanNameCorrections(enrichedBody, initialMappings, enrichedMappings);

  return {
    nameMappings: enrichedMappings,
    title: enrichedTitle,
    summary: enrichedSummary,
    body: enrichedBody,
  };
}
