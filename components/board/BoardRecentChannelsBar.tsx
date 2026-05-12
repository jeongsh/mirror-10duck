"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import {
  readRecentBoards,
  removeRecentBoard,
  RECENT_BOARDS_CHANGED_EVENT,
  type RecentBoardEntry,
} from "@/lib/community/recentBoards";

export default function BoardRecentChannelsBar() {
  const pathname = usePathname();
  const [recent, setRecent] = useState<RecentBoardEntry[]>([]);
  const [slugGate, setSlugGate] = useState<"pending" | "error" | Set<string>>("pending");

  useEffect(() => {
    setRecent(readRecentBoards());
  }, [pathname]);

  useEffect(() => {
    const sync = () => setRecent(readRecentBoards());
    window.addEventListener(RECENT_BOARDS_CHANGED_EVENT, sync);
    return () => window.removeEventListener(RECENT_BOARDS_CHANGED_EVENT, sync);
  }, []);

  useEffect(() => {
    void (async () => {
      const { data, error } = await supabase.from("boards").select("slug");
      if (error || !data) {
        setSlugGate("error");
        return;
      }
      setSlugGate(new Set(data.map((r) => (r as { slug: string }).slug)));
    })();
  }, []);

  const recentLinks = useMemo(() => {
    if (slugGate === "pending") return [];
    if (slugGate === "error") return recent;
    return recent.filter((r) => slugGate.has(r.slug));
  }, [recent, slugGate]);

  if (recentLinks.length === 0) return null;

  return (
    <section className="w-full overflow-hidden border border-dashed border-neutral-800 bg-white">
      <div className="border-b border-dashed border-neutral-800 bg-white px-3 py-2">
        <h2 className="text-sm font-bold text-neutral-900">최근 방문한 채널</h2>
        <p className="text-[11px] text-neutral-600">이 기기 브라우저에만 저장됩니다.</p>
      </div>
      <div className="flex flex-wrap gap-2 p-3">
        {recentLinks.map((r) => (
          <div
            key={r.slug}
            className="inline-flex items-stretch border border-dashed border-neutral-800 bg-white text-[12px] text-neutral-900"
          >
            <Link
              href={`/board/${r.slug}`}
              className="flex items-center px-2.5 py-1 underline-offset-2 hover:underline"
            >
              {r.name}
            </Link>
            <button
              type="button"
              className="flex items-center border-l border-dashed border-neutral-800 px-1.5 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
              aria-label={`${r.name} 최근 목록에서 삭제`}
              onClick={() => {
                removeRecentBoard(r.slug);
                setRecent(readRecentBoards());
              }}
            >
              <X className="size-3.5 shrink-0" aria-hidden />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
