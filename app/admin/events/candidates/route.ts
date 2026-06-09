import { NextResponse } from "next/server";
import { requireAdminRoute } from "@/lib/supabase/adminRoute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const context = await requireAdminRoute(request);
  if (context instanceof NextResponse) return context;

  const { data, error } = await context.adminClient
    .from("event_candidates")
    .select(
      [
        "id",
        "title",
        "source_name",
        "source_url",
        "normalized_url",
        "summary",
        "category",
        "location",
        "start_date",
        "end_date",
        "searched_at",
        "is_checked",
        "checked_at",
        "checked_by",
        "duplicate_status",
        "duplicate_event_id",
        "duplicate_similarity",
        "duplicate_reason",
        "release_events:duplicate_event_id(id, title, starts_at, ends_at, location, source_url)",
      ].join(", "),
    )
    .order("searched_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, candidates: data ?? [] });
}
