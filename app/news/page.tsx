"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import {
  CATEGORY_LABELS,
  PUBLIC_CATEGORIES,
  type OtakuCategory,
  type NewsItem,
  filterByCategory,
  formatRelativeDate,
  getNewsItems,
} from "@/lib/otaku/hub";

const TABS: OtakuCategory[] = PUBLIC_CATEGORIES;

export default function NewsPage() {
  const [activeCategory, setActiveCategory] = useState<OtakuCategory>("all");
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNews = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("news_items")
        .select("id, category, title, summary, status, published_at, thumbnail_url, tags")
        .eq("status", "PUBLISHED")
        .order("published_at", { ascending: false });

      if (error) {
        console.error("Error fetching news:", error);
        // Fallback to hardcoded data
        setNewsItems(getNewsItems());
      } else if (data) {
        const mappedData: NewsItem[] = data.map((item) => ({
          id: item.id,
          category: item.category.toLowerCase() as Exclude<OtakuCategory, "all">,
          title: item.title,
          summary: item.summary,
          body: "", // not needed for list
          publishedAt: item.published_at || new Date().toISOString(),
          thumbnailUrl: item.thumbnail_url || "",
          tags: item.tags || [],
          status: item.status.toLowerCase() as "draft" | "published" | "hidden",
          editorName: "운영팀",
        }));
        setNewsItems(mappedData);
      }
      setLoading(false);
    };

    void fetchNews();
  }, []);

  const visibleItems = useMemo(
    () => filterByCategory(newsItems, activeCategory),
    [activeCategory, newsItems],
  );

  const dateRange = useMemo(() => {
    if (newsItems.length === 0) return "";
    const dates = newsItems.map((item) => new Date(item.publishedAt).getTime());
    const maxDate = new Date(Math.max(...dates));
    const minDate = new Date(Math.min(...dates));
    
    const formatDate = (date: Date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, "0");
      const d = String(date.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    };
    
    return `(${formatDate(maxDate)} ~ ${formatDate(minDate)})`;
  }, [newsItems]);

  return (
    <main className="flex w-full flex-col gap-4">
      <header className="border border-dashed border-gray-500 bg-white/80 p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.2em] text-gray-500 uppercase">
              Editorial news
            </p>
            <h1 className="mt-1 text-2xl font-bold text-gray-900">소식</h1>
            <p className="mt-1 text-sm text-gray-600">
              운영자가 직접 작성한 실제 뉴스를 모아 보여줍니다.
            </p>
          </div>
          <Link
            href="/calendar"
            className="inline-flex items-center gap-1 border border-dashed border-gray-500 bg-white px-3 py-2 text-sm hover:bg-gray-100"
          >
            <Bell size={16} />
            일정 보기
          </Link>
        </div>
      </header>

      <section className="border border-dashed border-gray-500 bg-white/70 p-3">
        <div className="grid grid-cols-3 gap-2">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveCategory(tab)}
              className={`border border-dashed px-3 py-2 text-sm font-semibold ${
                activeCategory === tab
                  ? "border-gray-800 bg-gray-300 text-gray-950"
                  : "border-gray-500 bg-white text-gray-600 hover:bg-gray-100"
              }`}
            >
              {CATEGORY_LABELS[tab]}
            </button>
          ))}
        </div>
      </section>

      <div className="text-sm text-gray-600 px-1">
        뉴스 <span className="font-bold text-black">{newsItems.length}</span>개 등록됨 {dateRange}
      </div>

      <section className="flex flex-col border border-dashed border-gray-500 bg-white/80">
        {visibleItems.map((item) => (
          <Link
            key={item.id}
            href={`/news/${item.id}`}
            className="flex flex-col sm:flex-row gap-4 p-4 border-b border-dashed border-gray-300 last:border-b-0 hover:bg-gray-50 group"
          >
            <div className="w-full sm:w-48 h-32 sm:h-28 flex-shrink-0 overflow-hidden bg-gray-100 border border-gray-200">
              <img
                src={item.thumbnailUrl}
                alt=""
                className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
              />
            </div>
            <div className="flex flex-col justify-between flex-1 py-1">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-bold text-gray-950 group-hover:underline">
                    {item.title}
                  </h2>
                  <span className="bg-red-600 text-white text-[10px] px-1 font-bold rounded-sm">HOT</span>
                  <span className="text-red-600 text-xs font-bold">[1]</span>
                </div>
                <p className="mt-1 text-sm text-gray-600 line-clamp-2">{item.summary}</p>
              </div>
              
              <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 mt-2">
                <span className="font-semibold text-gray-700">{CATEGORY_LABELS[item.category]}</span>
                <span className="text-gray-300">|</span>
                <span>{item.editorName || "운영팀"}</span>
                <span className="text-gray-300">|</span>
                <span>{(() => {
                  const d = new Date(item.publishedAt);
                  const y = d.getFullYear();
                  const m = String(d.getMonth() + 1).padStart(2, "0");
                  const date = String(d.getDate()).padStart(2, "0");
                  const h = String(d.getHours()).padStart(2, "0");
                  const min = String(d.getMinutes()).padStart(2, "0");
                  return `${y}-${m}-${date} ${h}:${min}`;
                })()}</span>
              </div>
            </div>
          </Link>
        ))}
      </section>
    </main>
  );
}
