import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { scanPendingPostMediaAssets } from "@/lib/moderation/postMediaScanner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const openaiApiKey = process.env.OPENAI_API_KEY;

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY 또는 NEXT_PUBLIC_SUPABASE_URL 없음" },
      { status: 500 },
    );
  }
  if (!openaiApiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY 없음" }, { status: 500 });
  }

  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? 10);
  const supabase = createClient(supabaseUrl, serviceKey);
  const result = await scanPendingPostMediaAssets({
    supabase,
    openaiApiKey,
    limit: Number.isFinite(limit) ? limit : 10,
  });

  return NextResponse.json({
    ok: true,
    ...result,
  });
}
