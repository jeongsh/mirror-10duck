const STORAGE_KEY = "10duck:recent-boards-v1";
const MAX_ITEMS = 24;

/** `recordBoardVisit` / `removeRecentBoard` 이후 동일 탭 UI 동기화용 */
export const RECENT_BOARDS_CHANGED_EVENT = "10duck:recent-boards-changed" as const;

function notifyRecentBoardsChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(RECENT_BOARDS_CHANGED_EVENT));
}

export type RecentBoardEntry = {
  slug: string;
  name: string;
  visitedAt: number;
};

function safeParse(raw: string | null): RecentBoardEntry[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return [];
    return v
      .map((row) => {
        if (!row || typeof row !== "object") return null;
        const o = row as Record<string, unknown>;
        const slug = typeof o.slug === "string" ? o.slug.trim() : "";
        const name = typeof o.name === "string" ? o.name.trim() : "";
        const visitedAt =
          typeof o.visitedAt === "number" && Number.isFinite(o.visitedAt)
            ? o.visitedAt
            : Date.now();
        if (!slug) return null;
        return { slug, name: name || slug, visitedAt };
      })
      .filter((x): x is RecentBoardEntry => x !== null);
  } catch {
    return [];
  }
}

export function readRecentBoards(): RecentBoardEntry[] {
  if (typeof window === "undefined") return [];
  return safeParse(window.localStorage.getItem(STORAGE_KEY));
}

export function recordBoardVisit(slug: string, name: string): void {
  if (typeof window === "undefined") return;
  const s = slug.trim();
  if (!s) return;
  const label = name.trim() || s;
  const now = Date.now();
  const prev = safeParse(window.localStorage.getItem(STORAGE_KEY));
  const next = [{ slug: s, name: label, visitedAt: now }].concat(
    prev.filter((p) => p.slug !== s),
  );
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next.slice(0, MAX_ITEMS)));
  notifyRecentBoardsChanged();
}

export function removeRecentBoard(slug: string): void {
  if (typeof window === "undefined") return;
  const s = slug.trim();
  if (!s) return;
  const prev = safeParse(window.localStorage.getItem(STORAGE_KEY));
  const next = prev.filter((p) => p.slug !== s);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  notifyRecentBoardsChanged();
}
