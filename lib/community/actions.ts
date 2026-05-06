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

/**
 * IP 주소의 앞부분 두 마디만 추출하여 마스킹합니다 (예: 127.0.0.1 -> 127.0).
 */
export function formatIp(ip: string | null | undefined): string {
  if (!ip) return "";
  const parts = ip.split(".");
  if (parts.length >= 2) {
    return `${parts[0]}.${parts[1]}`;
  }
  // IPv6 대응 (단순화)
  if (ip.includes(":")) {
    const v6Parts = ip.split(":");
    if (v6Parts.length >= 2) {
      return `${v6Parts[0]}:${v6Parts[1]}`;
    }
  }
  return ip;
}
