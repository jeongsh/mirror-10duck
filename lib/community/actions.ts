"use server";

import { headers } from "next/headers";
import { supabase } from "@/lib/supabase/client";

/**
 * 클라이언트의 IP 주소를 가져옵니다.
 * 로컬 개발 환경이나 프록시 뒤에 있는 경우를 고려합니다.
 */
export async function getClientIp() {
  const headerList = await headers();
  // x-forwarded-for 는 'client, proxy1, proxy2' 형식일 수 있으므로 첫 번째 값을 가져옵니다.
  const forwarded = headerList.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return headerList.get("x-real-ip") || "127.0.0.1";
}
