/** 바이럴 좌·우 세로 배너 — 공통 레이아웃 LeftSidebar 열과 동일 좌표 */

export const VIRAL_LAYOUT_PREFIXES = ["/play/fortune", "/play/oshi-card/view"] as const;

export function isViralLayoutPath(pathname: string): boolean {
  return VIRAL_LAYOUT_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
