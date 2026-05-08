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

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {visibleItems.map((item) => (
          <Link
            key={item.id}
            href={`/news/${item.id}`}
            className="group overflow-hidden border border-dashed border-gray-500 bg-white/80 transition-colors hover:bg-gray-50"
          >
            <div className="aspect-[16/7] w-full overflow-hidden bg-gray-100">
              <img
                src={item.thumbnailUrl}
                alt=""
                className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
              />
            </div>
            <div className="flex flex-col gap-3 p-4">
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
                <span className="border border-dashed border-gray-400 bg-gray-100 px-2 py-0.5 font-bold text-gray-700">
                  {CATEGORY_LABELS[item.category]}
                </span>
                <span>{formatRelativeDate(item.publishedAt)}</span>
              </div>

              <div>
                <h2 className="text-lg font-bold text-gray-950 group-hover:underline">
                  {item.title}
                </h2>
                <p className="mt-1 text-sm leading-6 text-gray-600">{item.summary}</p>
              </div>

              <div className="flex flex-wrap gap-1">
                {item.tags.map((tag) => (
                  <span
                    key={tag}
                    className="border border-dashed border-gray-300 bg-white px-2 py-1 text-[11px] text-gray-500"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          </Link>
        ))}
      </section>
    </main>
  );
}
