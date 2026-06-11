import { NextResponse } from "next/server";
import { enrichNewsDraftNames } from "@/lib/news/nameResolution";
import { normalizeNameMappings, normalizeNewsSourceDraftResult } from "@/lib/news/newsDraft";
import {
  callPerplexityWithFallback,
  isValidHttpUrl,
  parseJsonContent,
} from "@/lib/perplexity/client";
import { requireAdminRoute } from "@/lib/supabase/adminRoute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SourceDraftRequest = {
  url?: unknown;
};

const NEWS_DRAFT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "detectedTopic",
    "category",
    "nameMappings",
    "title",
    "summary",
    "body",
    "tags",
    "notes",
  ],
  properties: {
    detectedTopic: { type: "string" },
    category: { type: "string", enum: ["anime", "manga"] },
    nameMappings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["original", "koreanOfficial", "type"],
        properties: {
          original: { type: "string" },
          koreanOfficial: { type: "string" },
          type: { type: "string", enum: ["work", "character", "nickname", "other"] },
        },
      },
    },
    title: { type: "string" },
    summary: { type: "string" },
    body: { type: "string" },
    tags: {
      type: "array",
      items: { type: "string" },
    },
    notes: { type: "string" },
  },
};

const SYSTEM_PROMPT = [
  "You create Korean news article drafts for SSIBDUK, an otaku community platform.",
  "The input URL is usually an English-language anime/manga news article.",
  "Before writing any draft text, you MUST resolve Korean names using Namuwiki (https://namu.wiki) ONLY.",
  "Namuwiki is the single authoritative source for Korean work titles, character names, and nicknames.",
  "Search site:namu.wiki for each work and character. Copy the exact Korean spelling from Namuwiki pages.",
  "Never use literal English-to-Korean translation, romaji, fan transliteration, or names from other websites.",
  "For characters, open the work page or character section on Namuwiki and copy the Korean name exactly.",
  "If a Namuwiki page does not exist, leave the Korean name empty in nameMappings rather than guessing.",
  "Never translate English titles into Korean yourself. Wrong example: 'From X to Y' -> '시골에서 검성까지'. Use only Namuwiki titles.",
  "Summarize and reorganize the article in your own words. Do not copy the source article's paragraph structure or wording.",
  "Write in natural Korean for domestic otaku readers. Keep facts accurate and neutral.",
  "The summary should be 1-2 sentences for list cards.",
  "The body should be 3-6 short paragraphs separated by blank lines.",
  "Never mention the source website, publisher, or input URL domain in title, summary, body, tags, or notes.",
  "Return JSON only.",
].join("\n");

export async function POST(request: Request) {
  const context = await requireAdminRoute(request);
  if (context instanceof NextResponse) return context;

  const body = (await request.json().catch(() => null)) as SourceDraftRequest | null;
  const inputUrl = typeof body?.url === "string" ? body.url.trim() : "";

  if (!isValidHttpUrl(inputUrl)) {
    return NextResponse.json({ error: "유효한 URL을 입력해 주세요." }, { status: 400 });
  }

  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "PERPLEXITY_API_KEY를 설정해야 URL 기반 뉴스 초안을 만들 수 있습니다." },
      { status: 500 },
    );
  }

  try {
    const raw = await callPerplexityWithFallback(apiKey, (structured) =>
      buildPerplexityPayload(inputUrl, structured),
    );
    const parsed = parseJsonContent(raw);

    const draftObj =
      parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};

    const draftTitle = typeof draftObj.title === "string" ? draftObj.title.trim() : "";
    const detectedTopic = typeof draftObj.detectedTopic === "string" ? draftObj.detectedTopic.trim() : "";
    const draftSummary = typeof draftObj.summary === "string" ? draftObj.summary.trim() : "";
    const draftBody = typeof draftObj.body === "string" ? draftObj.body.trim() : "";
    const initialMappings = normalizeNameMappings(draftObj.nameMappings);

    const enrichedNames = await enrichNewsDraftNames({
      apiKey,
      adminClient: context.adminClient,
      articleUrl: inputUrl,
      draftTitle,
      detectedTopic,
      summary: draftSummary,
      title: draftTitle,
      body: draftBody,
      nameMappings: initialMappings,
    });

    const result = normalizeNewsSourceDraftResult(parsed, inputUrl, {
      nameMappings: enrichedNames.nameMappings,
      title: enrichedNames.title,
      summary: enrichedNames.summary,
      body: enrichedNames.body,
    });

    if (!result.title || !result.summary || !result.body) {
      return NextResponse.json(
        { error: "AI가 제목, 요약, 본문을 충분히 생성하지 못했습니다. 다시 시도해 주세요." },
        { status: 422 },
      );
    }

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "URL 초안 생성 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function buildPerplexityPayload(inputUrl: string, structured: boolean) {
  return {
    model: process.env.PERPLEXITY_MODEL ?? "sonar",
    temperature: 0.2,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          `Input reference URL: ${inputUrl}`,
          "Tasks:",
          "1. Read and understand the article at the input URL.",
          "2. List every anime/manga work, character, and nickname mentioned.",
          "3. Search Namuwiki (site:namu.wiki) for each work, character, and nickname BEFORE drafting.",
          "4. Return nameMappings with original names and the exact Korean names copied from Namuwiki.",
          "5. Write a reorganized Korean news draft using only the resolved Korean names in title, summary, and body.",
          "6. Do not mention the source website or input URL in title, summary, body, tags, or notes.",
          "7. Suggest relevant Korean tags.",
          "8. Use this exact JSON shape:",
          JSON.stringify({
            detectedTopic: "작품명 시즌2 제작 발표",
            category: "anime",
            nameMappings: [
              { original: "Solo Leveling", koreanOfficial: "나 혼자만 레벨업", type: "work" },
              { original: "Sung Jin-Woo", koreanOfficial: "성진우", type: "character" },
              { original: "Shadow Monarch", koreanOfficial: "어둠의 군주", type: "nickname" },
            ],
            title: "나 혼자만 레벨업, 시즌2 제작 공식 발표",
            summary:
              "웹툰 원작 애니메이션 나 혼자만 레벨업의 시즌2 제작이 공식 발표되었습니다. 방영 시기는 추후 안내될 예정입니다.",
            body: [
              "나 혼자만 레벨업 시즌2 제작이 공식적으로 발표되었습니다.",
              "제작사는 후속 시즌에서 성진우의 이야기를 이어갈 계획이라고 밝혔습니다.",
              "정확한 방영 시기와 플랫폼은 추후 공개될 예정입니다.",
            ].join("\n\n"),
            tags: ["나 혼자만 레벨업", "시즌2", "애니메이션"],
            notes: "영문 기사의 Solo Leveling을 나무위키 기준 한국어 이름으로 치환함",
          }),
        ].join("\n"),
      },
    ],
    ...(structured
      ? {
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "news_source_draft",
              schema: NEWS_DRAFT_SCHEMA,
            },
          },
        }
      : {}),
  };
}
