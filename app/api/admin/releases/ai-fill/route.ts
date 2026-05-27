import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { isAdminUserId } from "@/lib/supabase/admin";
import { normalizeCours } from "@/lib/otaku/cours";
import {
  buildDetailEntries,
  buildTitlePrompt,
  fetchSeasonAnimeCandidates,
  formatSeasonLabel,
  toKoreanSource,
  type ReleaseAiCandidate,
  type ReleaseAiOutput,
} from "@/lib/otaku/releaseAi";

export const runtime = "nodejs";

type AiFillRequest = {
  cours?: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as AiFillRequest | null;
  const cours = normalizeCours(body?.cours ?? null);

  if (!cours) {
    return NextResponse.json({ error: "유효한 분기를 선택해 주세요." }, { status: 400 });
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const openaiApiKey = process.env.OPENAI_API_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Supabase 환경 변수가 설정되지 않았습니다." }, { status: 500 });
  }
  if (!openaiApiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY를 설정해야 AI 일괄 채우기를 사용할 수 있습니다." },
      { status: 500 },
    );
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });

  const accessToken = authHeader.replace(/^Bearer\s+/i, "");
  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);

  if (userError || !userData.user) {
    return NextResponse.json({ error: "로그인 정보를 확인할 수 없습니다." }, { status: 401 });
  }
  if (!(await isAdminUserId(supabase, userData.user.id))) {
    return NextResponse.json({ error: "관리자만 실행할 수 있습니다." }, { status: 403 });
  }

  const candidates = await fetchSeasonAnimeCandidates(cours);
  if (candidates.length === 0) {
    return NextResponse.json({ error: "해당 분기에서 가져올 작품을 찾지 못했습니다." }, { status: 404 });
  }

  const { data: existingRows, error: existingError } = await supabase
    .from("release_items")
    .select("id, title, original_title, cours")
    .eq("cours", cours);

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  const existingKeys = new Set(
    (existingRows ?? []).map((row) => buildMatchingKey(row.original_title ?? row.title)),
  );

  const missingCandidates = candidates.filter((candidate) => {
    const key = buildMatchingKey(candidate.titleNative ?? candidate.titleEnglish ?? candidate.titleRomaji ?? `${candidate.mediaId}`);
    return !existingKeys.has(key);
  });

  if (missingCandidates.length === 0) {
    return NextResponse.json({
      cours,
      totalCandidates: candidates.length,
      insertedCount: 0,
      skippedCount: candidates.length,
      message: "이미 모든 작품이 존재합니다.",
    });
  }

  const titleResult = await generateTitleAndSynopsis(openaiApiKey, cours, missingCandidates);
  const titleMap = new Map(titleResult.outputs.map((item) => [item.mediaId, item]));

  const rows = missingCandidates.map((candidate) => {
    const generated = titleMap.get(candidate.mediaId) ?? fallbackReleaseOutput(candidate);
    const originalTitle = candidate.titleNative ?? candidate.titleEnglish ?? candidate.titleRomaji;

    return {
      category: "ANIME",
      status: candidate.isAdult ? "DRAFT" : "PUBLISHED",
      title: generated.titleKo.trim(),
      original_title: originalTitle,
      synopsis: generated.synopsis.trim(),
      poster_url: candidate.posterUrl,
      banner_url: candidate.bannerUrl,
      genres: candidate.genres,
      studios: candidate.studios,
      season: formatSeasonLabel(cours),
      cours,
      episode_count: candidate.episodes,
      details_json: buildDetailEntries(candidate),
      release_date: candidate.airedFrom ? candidate.airedFrom.slice(0, 10) : null,
    };
  });

  const { data: insertedRows, error: insertError } = await supabase
    .from("release_items")
    .insert(rows)
    .select("id");

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const draftCount = rows.filter((row) => row.status === "DRAFT").length;

  return NextResponse.json({
    cours,
    totalCandidates: candidates.length,
    insertedCount: insertedRows?.length ?? 0,
    skippedCount: candidates.length - missingCandidates.length,
    publishedCount: rows.length - draftCount,
    draftCount,
    usedAi: titleResult.usedAi,
  });
}

async function generateTitleAndSynopsis(
  openaiApiKey: string,
  cours: string,
  candidates: ReleaseAiCandidate[],
): Promise<{ outputs: ReleaseAiOutput[]; usedAi: boolean }> {
  const chunks = chunkArray(candidates, 6);
  const outputs: ReleaseAiOutput[] = [];
  let usedAi = false;

  for (const chunk of chunks) {
    const prompt = buildTitlePrompt(cours, chunk);
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Return only valid JSON and follow the schema exactly. Do not wrap the answer in markdown.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const raw = await response.text();
      console.warn(`[admin/releases/ai-fill] OpenAI request failed: ${response.status} ${raw}`);
      outputs.push(...chunk.map((candidate) => fallbackReleaseOutput(candidate)));
      continue;
    }

    const json = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: string | null;
        };
      }>;
    };

    const content = json.choices?.[0]?.message?.content ?? "";
    const parsed = parseOpenAiOutput(content);
    if (parsed.length > 0) {
      usedAi = true;
    }

    const parsedMap = new Map(parsed.map((item) => [item.mediaId, item]));
    for (const candidate of chunk) {
      const item = parsedMap.get(candidate.mediaId);
      if (!item) {
        outputs.push(fallbackReleaseOutput(candidate));
        continue;
      }

      const titleKo = normalizeTitleKo(item.titleKo, candidate);
      const synopsis = normalizeSynopsisText(item.synopsis, candidate);
      outputs.push({
        mediaId: candidate.mediaId,
        titleKo,
        synopsis,
      });
    }
  }

  return { outputs, usedAi };
}

function parseOpenAiOutput(content: string): ReleaseAiOutput[] {
  try {
    const json = JSON.parse(content) as {
      items?: Array<{
        mediaId?: number;
        malId?: number;
        id?: number;
        titleKo?: string;
        synopsis?: string;
      }>;
    };

    return (json.items ?? [])
      .map((item) => ({
        mediaId: item.mediaId ?? item.malId ?? item.id ?? 0,
        titleKo: typeof item.titleKo === "string" ? item.titleKo.trim() : "",
        synopsis: typeof item.synopsis === "string" ? item.synopsis.trim() : "",
      }))
      .filter(
        (item) =>
          Number.isFinite(item.mediaId) &&
          item.mediaId > 0 &&
          item.titleKo.length > 0 &&
          item.synopsis.length > 0,
      );
  } catch {
    return [];
  }
}

function normalizeTitleKo(value: string, candidate: ReleaseAiCandidate): string {
  const trimmed = value.trim();
  if (containsHangul(trimmed)) return trimmed;
  return fallbackTitleKo(candidate);
}

function normalizeSynopsisText(value: string, candidate: ReleaseAiCandidate): string {
  const trimmed = value.trim();
  if (trimmed.length >= 180) return trimmed;
  return fallbackSynopsisText(candidate);
}

function fallbackReleaseOutput(candidate: ReleaseAiCandidate): ReleaseAiOutput {
  return {
    mediaId: candidate.mediaId,
    titleKo: fallbackTitleKo(candidate),
    synopsis: fallbackSynopsisText(candidate),
  };
}

function fallbackTitleKo(candidate: ReleaseAiCandidate): string {
  const original =
    candidate.titleEnglish ??
    candidate.titleRomaji ??
    candidate.titleNative ??
    `작품 ${candidate.mediaId}`;

  if (containsHangul(original)) return original.trim();
  return `${candidate.mediaId}번 작품`;
}

function fallbackSynopsisText(candidate: ReleaseAiCandidate): string {
  const title = candidate.titleEnglish ?? candidate.titleRomaji ?? candidate.titleNative ?? `작품 ${candidate.mediaId}`;
  const genreText = joinText(candidate.genres.slice(0, 3), "장르 미정");
  const studioText = joinText(candidate.studios.slice(0, 2), "제작사 미정");
  const sourceText = toKoreanSource(candidate.sourceType);
  const seasonText = formatSeasonText(candidate);
  const airedText = formatAiredText(candidate);
  const adultText = candidate.isAdult
    ? "이 작품은 성인 콘텐츠로 분류되어 관리자 검수가 필요하다."
    : "일반 공개용 작품으로 바로 노출할 수 있다.";

  return [
    `${title}은 ${seasonText}에 공개된 ${genreText} 계열의 작품이다.`,
    `${sourceText} 설정과 ${studioText}의 제작 감각이 어우러지며, 캐릭터 관계와 전개가 중심이 되는 흐름을 보여준다.`,
    `방영 정보는 ${airedText}로 정리되며, ${adultText}`,
  ].join(" ");
}

function formatSeasonText(candidate: ReleaseAiCandidate): string {
  const seasonLabel =
    candidate.season === "WINTER"
      ? "겨울"
      : candidate.season === "SPRING"
        ? "봄"
        : candidate.season === "SUMMER"
          ? "여름"
          : candidate.season === "FALL"
            ? "가을"
            : "미정";

  return candidate.seasonYear ? `${candidate.seasonYear}년 ${seasonLabel}` : seasonLabel;
}

function formatAiredText(candidate: ReleaseAiCandidate): string {
  if (candidate.airedFrom && candidate.airedTo) {
    return `${candidate.airedFrom}부터 ${candidate.airedTo}까지`;
  }
  if (candidate.airedFrom) {
    if (candidate.status?.toUpperCase() === "RELEASING") return `${candidate.airedFrom}부터 방영 중`;
    if (candidate.status?.toUpperCase() === "NOT_YET_RELEASED") return `방영 예정(${candidate.airedFrom})`;
    return `${candidate.airedFrom} 이후 정보 미정`;
  }
  return "방영 기간 미정";
}

function buildMatchingKey(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function containsHangul(value: string): boolean {
  return /[가-힣]/.test(value);
}

function joinText(values: string[], fallback: string): string {
  return values.length > 0 ? values.join(", ") : fallback;
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}
