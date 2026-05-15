import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { email?: string };
    const email = body?.email;

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "유효하지 않은 이메일입니다." }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "서버 설정 오류입니다." }, { status: 500 });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: handle, error } = await adminClient.rpc("get_handle_by_email", { p_email: email });

    if (error) {
      console.error("[find-handle] rpc error:", error);
      return NextResponse.json({ error: "조회 중 오류가 발생했습니다." }, { status: 500 });
    }

    return NextResponse.json({ handle: handle ?? null }, { status: 200 });
  } catch (err) {
    console.error("[find-handle] unexpected error:", err);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
