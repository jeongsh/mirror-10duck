import { NextResponse } from "next/server";
import { buildTemplateCopy } from "@/lib/clinic/templateCopy";
import type { Diagnosis, Prescription } from "@/lib/clinic/types";

export const runtime = "nodejs";

type Body = {
  departmentName?: string;
  diagnosis?: Diagnosis;
  prescriptions?: Prescription[];
  allergies?: string[];
  keywords?: string[];
  immersionScore?: number;
};

type OpinionCopyResponse = {
  opinion?: string;
  shareSummary?: string;
};

const SYSTEM_PROMPT = `너는 오타쿠 커뮤니티 "과몰입 클리닉"의 진단 소견 작성자다.
엔터테인먼트용 취향 진단 결과를 병원 말투로 작성한다.
실제 의료 조언처럼 보이면 안 된다. 사용자를 조롱하지 않는다. 스포일러 금지.
처방 작품의 효능·복용법·부작용은 작성하지 않는다. 진단 소견과 공유용 한 줄만 작성한다.
JSON만 출력한다.`;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Body | null;
  const diagnosis = body?.diagnosis;
  const prescriptions = body?.prescriptions ?? [];
  const allergies = body?.allergies ?? [];
  const keywords = body?.keywords ?? [];
  const immersionScore = body?.immersionScore ?? 50;
  const departmentName = body?.departmentName ?? "과몰입 클리닉";

  if (!diagnosis || prescriptions.length === 0) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const fallback = buildTemplateCopy(diagnosis, prescriptions, allergies, immersionScore);
  const openaiApiKey = process.env.OPENAI_API_KEY;

  if (!openaiApiKey) {
    return NextResponse.json(fallback);
  }

  const userPrompt = JSON.stringify({
    departmentName,
    diagnosis,
    prescriptions: prescriptions.map((p) => ({
      slot: p.slot,
      title: p.title,
      category: p.category,
      matchedTags: p.matchedTags,
    })),
    allergies,
    keywords,
    immersionScore,
  });

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.7,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `${userPrompt}

출력 JSON 스키마 (이 두 필드만):
{
  "opinion": "진단 소견 3~5문장. 문진·진단명·처방 방향을 반영.",
  "shareSummary": "공유용 한 줄. 바이럴 톤, 40자 내외."
}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      return NextResponse.json(fallback);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) return NextResponse.json(fallback);

    const parsed = JSON.parse(raw) as OpinionCopyResponse;

    return NextResponse.json({
      opinion: parsed.opinion?.trim() || fallback.opinion,
      shareSummary: parsed.shareSummary?.trim() || fallback.shareSummary,
      prescriptions: fallback.prescriptions,
      warnings: fallback.warnings,
    });
  } catch {
    return NextResponse.json(fallback);
  }
}
