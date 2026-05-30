import { isViralLayoutPath } from "./viralAds";

export type LayoutChromeMode = "default" | "viral" | "none";

const STANDALONE_PREFIXES = ["/admin", "/auth"];

export function getLayoutChromeMode(pathname: string | null | undefined): LayoutChromeMode {
  if (!pathname) return "default";

  if (STANDALONE_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return "none";
  }

  if (isViralLayoutPath(pathname)) {
    return "viral";
  }

  return "default";
}

export { isViralLayoutPath, VIRAL_LAYOUT_PREFIXES } from "./viralAds";
