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
  if (ip?.includes(":")) {
    const v6Parts = ip.split(":");
    if (v6Parts.length >= 2) {
      return `${v6Parts[0]}:${v6Parts[1]}`;
    }
  }
  return ip || "";
}
