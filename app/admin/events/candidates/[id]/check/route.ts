import { NextResponse } from "next/server";
import { requireAdminRoute } from "@/lib/supabase/adminRoute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CheckRequest = {
  is_checked?: unknown;
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await requireAdminRoute(request);
  if (context instanceof NextResponse) return context;

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as CheckRequest | null;
  if (typeof body?.is_checked !== "boolean") {
    return NextResponse.json({ error: "is_checked 값이 필요합니다." }, { status: 400 });
  }

  const { data, error } = await context.adminClient
    .from("event_candidates")
    .update({
      is_checked: body.is_checked,
      checked_at: body.is_checked ? new Date().toISOString() : null,
      checked_by: body.is_checked ? context.user.id : null,
    })
    .eq("id", id)
    .select(
      "id, title, source_name, source_url, normalized_url, summary, category, location, start_date, end_date, searched_at, is_checked, checked_at, checked_by, duplicate_status, duplicate_event_id, duplicate_similarity, duplicate_reason",
    )
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "후보를 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, candidate: data });
}
