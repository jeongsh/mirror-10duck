import { NextResponse } from "next/server";
import { requireAdminRoute } from "@/lib/supabase/adminRoute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CandidateRow = {
  id: string;
  title: string;
  source_url: string;
  category: string;
  start_date: string | null;
  end_date: string | null;
};

type CreateDraftsRequest = {
  candidate_ids?: unknown;
};

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export async function POST(request: Request) {
  const context = await requireAdminRoute(request);
  if (context instanceof NextResponse) return context;

  const body = (await request.json().catch(() => null)) as CreateDraftsRequest | null;
  const candidateIds = Array.isArray(body?.candidate_ids)
    ? body.candidate_ids.filter((id): id is string => typeof id === "string")
    : [];

  if (candidateIds.length === 0) {
    return NextResponse.json({
      ok: true,
      createdCount: 0,
      skippedCount: 0,
      message: "초안으로 만들 체크 후보가 없습니다.",
    });
  }

  const { data: candidates, error: candidateError } = await context.adminClient
    .from("event_candidates")
    .select("id, title, source_url, category, start_date, end_date")
    .in("id", candidateIds)
    .eq("is_checked", true)
    .order("searched_at", { ascending: false });

  if (candidateError) {
    return NextResponse.json({ error: candidateError.message }, { status: 500 });
  }

  const rows = ((candidates as CandidateRow[] | null) ?? []).filter(
    (candidate) => candidate.title.trim() && candidate.source_url.trim(),
  );

  if (rows.length === 0) {
    return NextResponse.json({
      ok: true,
      createdCount: 0,
      skippedCount: (candidates ?? []).length,
      message: "초안으로 만들 체크 후보가 없습니다.",
    });
  }

  const sourceUrls = rows.map((candidate) => candidate.source_url);
  const { data: existingEvents, error: existingError } = await context.adminClient
    .from("release_events")
    .select("id, source_url")
    .in("source_url", sourceUrls);

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  const existingUrls = new Set(((existingEvents as Array<{ source_url: string | null }> | null) ?? [])
    .map((event) => event.source_url)
    .filter((value): value is string => Boolean(value)));

  const draftRows = rows
    .filter((candidate) => !existingUrls.has(candidate.source_url))
    .map((candidate) => ({
      event_type: mapCategoryToEventType(candidate.category),
      title: candidate.title.trim(),
      starts_at: dateToKstIso(candidate.start_date ?? getTodayKstDateString()),
      ends_at: candidate.end_date ? dateToKstIso(candidate.end_date) : null,
      timezone: "Asia/Seoul",
      source_url: candidate.source_url.trim(),
      status: "DRAFT",
    }));

  if (draftRows.length === 0) {
    return NextResponse.json({
      ok: true,
      createdCount: 0,
      skippedCount: rows.length,
      message: "이미 같은 URL로 등록된 이벤트가 있습니다.",
    });
  }

  const { data: createdRows, error: insertError } = await context.adminClient
    .from("release_events")
    .insert(draftRows)
    .select("id");

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    createdCount: createdRows?.length ?? 0,
    skippedCount: ((candidates as CandidateRow[] | null) ?? []).length - draftRows.length,
  });
}

function mapCategoryToEventType(category: string): string {
  if (["블루레이", "음반", "굿즈", "피규어"].includes(category)) return "GOODS_RELEASE";
  if (["라이브", "오케스트라", "콘서트", "성우 이벤트"].includes(category)) return "LIVE_EVENT";
  return "OFFLINE_EVENT";
}

function dateToKstIso(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  const utcMs = Date.UTC(year, month - 1, day, 0, 0, 0) - KST_OFFSET_MS;
  return new Date(utcMs).toISOString();
}

function getTodayKstDateString(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  const year = kst.getUTCFullYear();
  const month = `${kst.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${kst.getUTCDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}
