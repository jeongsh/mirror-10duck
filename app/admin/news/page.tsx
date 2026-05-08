"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { CATEGORY_LABELS, getNewsItems, type OtakuCategory } from "@/lib/otaku/hub";

type AdminNewsRow = {
  id: string;
  category: Exclude<OtakuCategory, "all">;
  title: string;
  status: string;
  published_at: string | null;
};

export default function AdminNewsPage() {
  const [items, setItems] = useState<AdminNewsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);

  useEffect(() => {
    const fetchItems = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("news_items")
        .select("id, category, title, status, published_at")
        .order("created_at", { ascending: false });

      if (error) {
        setUsingFallback(true);
        setItems(
          getNewsItems().map((item) => ({
            id: item.id,
            category: item.category,
            title: item.title,
            status: item.status.toUpperCase(),
            published_at: item.publishedAt,
          })),
        );
      } else {
        setUsingFallback(false);
        setItems((data as AdminNewsRow[] | null) ?? []);
      }
      setLoading(false);
    };

    void fetchItems();
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between border-b border-dashed border-gray-500 pb-4">
        <div>
          <h2 className="text-xl font-bold">뉴스 관리</h2>
          <p className="mt-1 text-sm text-gray-600">
            운영자가 직접 작성하는 뉴스 카드와 상세 본문을 관리합니다.
          </p>
        </div>
        <Link
          href="/admin/news/create"
          className="rounded bg-black px-4 py-2 text-sm text-white transition-opacity hover:opacity-80"
        >
          새 뉴스 추가
        </Link>
      </div>

      {usingFallback && (
        <div className="rounded border border-dashed border-amber-500 bg-amber-50 p-3 text-sm text-amber-800">
          Supabase `news_items` 테이블을 읽지 못해 로컬 샘플을 표시 중입니다.
        </div>
      )}

      <section className="rounded border border-dashed border-gray-500 bg-white/70 p-6">
        {loading ? (
          <p className="text-sm text-gray-500">로딩 중...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-gray-500">등록된 뉴스가 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b">
                <tr>
                  <th className="p-3 font-semibold">뉴스</th>
                  <th className="p-3 font-semibold">유형</th>
                  <th className="p-3 font-semibold">상태</th>
                  <th className="p-3 font-semibold">발행</th>
                  <th className="p-3 font-semibold text-right">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dashed">
                {items.map((item) => (
                  <tr key={item.id} className="transition-colors hover:bg-gray-100">
                    <td className="p-3">
                      <div className="font-medium">{item.title}</div>
                      <div className="text-xs text-gray-500">#{item.id}</div>
                    </td>
                    <td className="p-3 text-gray-600">{getCategoryLabel(item.category)}</td>
                    <td className="p-3 text-gray-600">{item.status}</td>
                    <td className="p-3 text-gray-600">
                      {item.published_at ? new Date(item.published_at).toLocaleDateString("ko-KR") : "미정"}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Link href={`/news/${item.id}`} className="text-gray-600 hover:underline">
                          보기
                        </Link>
                        {!usingFallback && (
                          <Link href={`/admin/news/${item.id}`} className="text-blue-600 hover:underline">
                            설정
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function getCategoryLabel(category: string) {
  const key = category.toLowerCase() as keyof typeof CATEGORY_LABELS;
  return CATEGORY_LABELS[key] ?? category;
}
