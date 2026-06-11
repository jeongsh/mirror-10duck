"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type NewsRow = {
  id: string;
  category: string;
  title: string;
  summary: string;
  thumbnail_url: string | null;
  published_at: string | null;
};

export const dynamic = "force-dynamic";

export default function NewsPage() {
  const [items, setItems] = useState<NewsRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from("news_items")
        .select("id, category, title, summary, thumbnail_url, published_at")
        .eq("status", "PUBLISHED")
        .order("published_at", { ascending: false });

      if (cancelled) return;
      if (error) {
        console.warn("[news] failed to load news_items:", error.message);
        setItems([]);
      } else {
        setItems((data ?? []) as NewsRow[]);
      }
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="flex w-full flex-col gap-4">
      <header className="border border-dashed border-gray-500 bg-white/80 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-500">
          News
        </p>
        <h1 className="mt-1 text-2xl font-black text-gray-950">뉴스</h1>
        <p className="mt-2 text-sm leading-6 text-gray-600">
          공식 정보와 운영팀이 정리한 새소식을 짧게 확인합니다.
        </p>
      </header>

      {loading ? (
        <div className="border border-dashed border-gray-400 bg-white/70 p-6 text-sm text-gray-500">
          뉴스를 불러오는 중...
        </div>
      ) : items.length === 0 ? (
        <div className="border border-dashed border-gray-400 bg-white/70 p-6 text-sm text-gray-500">
          등록된 뉴스가 없습니다.
        </div>
      ) : (
        <section className="grid gap-3">
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/news/${item.id}`}
              className="grid gap-3 border border-dashed border-gray-400 bg-white/80 p-3 hover:bg-gray-50 sm:grid-cols-[120px_minmax(0,1fr)]"
            >
              <div className="aspect-[4/3] overflow-hidden bg-gray-100">
                {item.thumbnail_url ? (
                  <img src={item.thumbnail_url} alt="" className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-black text-gray-500">
                  {categoryLabel(item.category)} · {formatShortDate(item.published_at)}
                </p>
                <h2 className="mt-1 line-clamp-2 text-base font-black text-gray-950">
                  {item.title}
                </h2>
                <p className="mt-1 line-clamp-2 text-sm leading-6 text-gray-600">
                  {item.summary}
                </p>
              </div>
            </Link>
          ))}
        </section>
      )}
    </main>
  );
}

function categoryLabel(value: string): string {
  const normalized = value.toLowerCase();
  if (normalized === "anime") return "애니";
  if (normalized === "manga") return "만화";
  if (normalized === "game") return "게임";
  return "뉴스";
}

function formatShortDate(value: string | null): string {
  if (!value) return "날짜 미정";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).format(new Date(value));
}
