import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { scanPostMediaAssetsByIds } from "@/lib/moderation/postMediaScanner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ScanRequest = {
  assetIds?: unknown;
};

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const openaiApiKey = process.env.OPENAI_API_KEY;

  if (!supabaseUrl || !anonKey || !serviceKey) {
    return NextResponse.json({ error: "Supabase 환경 변수가 설정되지 않았습니다." }, { status: 500 });
  }
  if (!openaiApiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY 없음" }, { status: 500 });
  }

  const body = (await request.json().catch(() => null)) as ScanRequest | null;
  const assetIds = Array.isArray(body?.assetIds)
    ? body.assetIds.filter((id): id is string => typeof id === "string")
    : [];

  if (assetIds.length === 0) {
    return NextResponse.json({ ok: true, processed: [], skipped: 0 });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const accessToken = authHeader.replace(/^Bearer\s+/i, "");
  const { data: userData, error: userError } = await userClient.auth.getUser(accessToken);
  if (userError || !userData.user) {
    return NextResponse.json({ error: "로그인 정보를 확인할 수 없습니다." }, { status: 401 });
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const result = await scanPostMediaAssetsByIds({
    supabase: admin,
    openaiApiKey,
    assetIds,
    userId: userData.user.id,
  });

  return NextResponse.json({ ok: true, ...result });
}
