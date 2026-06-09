import { NextResponse } from "next/server";
import { searchAndStoreEventCandidates } from "@/lib/events/aiCandidateSearch";
import { requireAdminRoute } from "@/lib/supabase/adminRoute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type FindCandidatesRequest = {
  mode?: unknown;
};

export async function POST(request: Request) {
  const context = await requireAdminRoute(request);
  if (context instanceof NextResponse) return context;

  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY를 설정해야 AI 이벤트 찾기를 사용할 수 있습니다." },
      { status: 500 },
    );
  }

  try {
    const body = (await request.json().catch(() => null)) as FindCandidatesRequest | null;
    const mode = body?.mode === "daily" ? "daily" : "full";
    const result = await searchAndStoreEventCandidates({
      supabase: context.adminClient,
      openaiApiKey,
      mode,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI 이벤트 후보 검색 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
