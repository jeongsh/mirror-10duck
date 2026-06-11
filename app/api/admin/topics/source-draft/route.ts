import { NextResponse } from "next/server";
import { requireAdminRoute } from "@/lib/supabase/adminRoute";
import { normalizeSourcedDraftResult } from "@/lib/topics/topicCards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SourceDraftRequest = {
  url?: unknown;
};

const TOPIC_DRAFT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "detectedTopic",
    "relatedWorkName",
    "category",
    "officialSources",
    "referenceSources",
    "facts",
    "draft",
    "status",
    "riskLevel",
    "riskNote",
  ],
  properties: {
    detectedTopic: { type: "string" },
    relatedWorkName: { type: ["string", "null"] },
    category: { type: "string" },
    officialSources: {
      type: "array",
      items: { $ref: "#/$defs/source" },
    },
    referenceSources: {
      type: "array",
      items: { $ref: "#/$defs/source" },
    },
    facts: {
      type: "array",
      items: { type: "string" },
    },
    draft: {
      type: "object",
      additionalProperties: false,
      required: ["title", "summary", "question", "pollOptions"],
      properties: {
        title: { type: "string" },
        summary: { type: "string" },
        question: { type: "string" },
        pollOptions: {
          type: "array",
          minItems: 2,
          maxItems: 6,
          items: { type: "string" },
        },
      },
    },
    status: { type: "string", enum: ["draft", "pending_review", "approved", "rejected", "blocked"] },
    riskLevel: { type: "string", enum: ["low", "medium", "high", "blocked"] },
    riskNote: { type: "string" },
  },
  $defs: {
    source: {
      type: "object",
      additionalProperties: false,
      required: ["title", "url", "sourceType"],
      properties: {
        title: { type: "string" },
        url: { type: "string" },
        sourceType: { type: "string", enum: ["official", "reference", "news", "unknown"] },
      },
    },
  },
};

const SYSTEM_PROMPT = [
  "You create Korean short reaction topic-card drafts for SSIBDUK.",
  "The input URL is a reference link only. Do not translate, rewrite, summarize, copy, or quote its article body.",
  "Find the official original source for the same announcement and use only facts that can be verified from official sources.",
  "Official sources include official anime sites, official X accounts, official YouTube channels, production committees, distributors, theaters, event pages, sellers, publishers, labels, broadcasters, and streaming platform notices.",
  "Crunchyroll News, Anime News Network, Anime Trending, MyAnimeList News, blogs, communities, forums, and secondary articles are referenceSources only and must never be officialSources.",
  "If no official source is found, do not create a publishable draft. Return status blocked or pending_review and riskLevel blocked or high.",
  "Never use article images, article titles, article paragraph structure, or long article-style prose.",
  "The draft must be Korean, no more than two summary sentences, one question, and two to six poll options.",
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
      { error: "PERPLEXITY_API_KEY를 설정해야 URL 기반 떡밥 초안을 만들 수 있습니다." },
      { status: 500 },
    );
  }

  try {
    const raw = await callPerplexity(apiKey, inputUrl);
    const parsed = parseJsonContent(raw);
    const result = normalizeSourcedDraftResult(parsed, inputUrl);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "URL 초안 생성 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function callPerplexity(apiKey: string, inputUrl: string): Promise<string> {
  const payload = buildPerplexityPayload(inputUrl, true);
  const response = await postPerplexity(apiKey, payload);

  if (!response.ok && response.status === 400) {
    const fallback = await postPerplexity(apiKey, buildPerplexityPayload(inputUrl, false));
    if (!fallback.ok) {
      const raw = await fallback.text();
      throw new Error(`Perplexity 요청 실패 (${fallback.status}): ${raw.slice(0, 500)}`);
    }
    return readPerplexityContent(await fallback.json());
  }

  if (!response.ok) {
    const raw = await response.text();
    throw new Error(`Perplexity 요청 실패 (${response.status}): ${raw.slice(0, 500)}`);
  }

  return readPerplexityContent(await response.json());
}

function buildPerplexityPayload(inputUrl: string, structured: boolean) {
  return {
    model: process.env.PERPLEXITY_MODEL ?? "sonar",
    temperature: 0.1,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          `Input reference URL: ${inputUrl}`,
          "Tasks:",
          "1. Identify the topic covered by the URL.",
          "2. Search for official original source candidates.",
          "3. Separate officialSources and referenceSources.",
          "4. Extract only official-source-verifiable facts.",
          "5. Create a short Korean topic-card draft only if officialSources exist.",
          "6. Put the input URL in referenceSources only.",
          "7. Use this exact JSON shape:",
          JSON.stringify({
            detectedTopic: "작품명 신규 PV 공개 및 방영일 발표",
            relatedWorkName: "작품명",
            category: "PV/키비주얼",
            officialSources: [{ title: "공식 홈페이지 공지", url: "https://...", sourceType: "official" }],
            referenceSources: [{ title: "Crunchyroll News", url: inputUrl, sourceType: "reference" }],
            facts: ["공식 채널에서 신규 PV가 공개됨", "방영 시기가 2026년 7월로 안내됨"],
            draft: {
              title: "[PV공개] 작품명 신규 PV 공개",
              summary: "공식 채널을 통해 작품명의 신규 PV가 공개되었습니다. 방영 시기는 2026년 7월로 안내되었습니다.",
              question: "PV 보고 기대치 올라감?",
              pollOptions: ["올라감", "그대로", "오히려 불안함", "아직 안 봄"],
            },
            status: "draft",
            riskLevel: "low",
            riskNote: "공식 출처가 확인되었고 뉴스 기사 본문을 사용하지 않음",
          }),
        ].join("\n"),
      },
    ],
    ...(structured
      ? {
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "topic_source_draft",
              schema: TOPIC_DRAFT_SCHEMA,
            },
          },
        }
      : {}),
  };
}

function postPerplexity(apiKey: string, payload: object) {
  return fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

function readPerplexityContent(value: unknown): string {
  if (!isRecord(value)) return "";
  const choices = value.choices;
  if (!Array.isArray(choices)) return "";
  const first = choices[0];
  if (!isRecord(first) || !isRecord(first.message)) return "";
  return typeof first.message.content === "string" ? first.message.content : "";
}

function parseJsonContent(content: string): unknown {
  const trimmed = content.trim();
  if (!trimmed) throw new Error("AI 응답이 비어 있습니다.");

  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error("AI 응답을 JSON으로 파싱하지 못했습니다.");
  }
}

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
