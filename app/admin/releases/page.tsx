"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { CATEGORY_LABELS, getReleaseItems, type OtakuCategory } from "@/lib/otaku/hub";

type AdminReleaseRow = {
  id: string;
  category: Exclude<OtakuCategory, "all">;
  title: string;
  original_title: string | null;
  poster_url: string | null;
  season: string | null;
  episode_count: number | null;
  status: string;
  release_date: string | null;
};

export default function AdminReleasesPage() {
  const [items, setItems] = useState<AdminReleaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);

  useEffect(() => {
    const fetchItems = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("release_items")
        .select("id, category, title, original_title, poster_url, season, episode_count, status, release_date")
        .order("created_at", { ascending: false });

      if (error) {
        setUsingFallback(true);
        setItems(
          getReleaseItems().map((item) => ({
            id: item.id,
            category: item.category,
            title: item.title,
            original_title: item.originalTitle,
            poster_url: item.posterUrl,
            season: item.season,
            episode_count: item.episodeCount,
            status: "PUBLISHED",
            release_date: item.releaseDate,
          })),
        );
      } else {
        setUsingFallback(false);
        setItems((data as AdminReleaseRow[] | null) ?? []);
      }
      setLoading(false);
    };

    void fetchItems();
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between border-b border-dashed border-gray-500 pb-4">
        <div>
          <h2 className="text-xl font-bold">신작 관리</h2>
          <p className="mt-1 text-sm text-gray-600">
            제목, 원제, 시놉시스, 이미지, 장르, 제작사, 분기, 화수만 관리합니다.
          </p>
        </div>
        <Link
          href="/admin/releases/create"
          className="rounded bg-black px-4 py-2 text-sm text-white transition-opacity hover:opacity-80"
        >
          새 신작 추가
        </Link>
      </div>

      {usingFallback && (
        <div className="rounded border border-dashed border-amber-500 bg-amber-50 p-3 text-sm text-amber-800">
          Supabase `release_items` 테이블을 읽지 못해 로컬 샘플을 표시 중입니다.
        </div>
      )}

      <section className="rounded border border-dashed border-gray-500 bg-white/70 p-6">
        {loading ? (
          <p className="text-sm text-gray-500">로딩 중...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-gray-500">등록된 신작이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b">
                <tr>
                  <th className="p-3 font-semibold">신작</th>
                  <th className="p-3 font-semibold">유형</th>
                  <th className="p-3 font-semibold">분기</th>
                  <th className="p-3 font-semibold">화수</th>
                  <th className="p-3 font-semibold">상태</th>
                  <th className="p-3 font-semibold text-right">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dashed">
                {items.map((item) => (
                  <tr key={item.id} className="transition-colors hover:bg-gray-100">
                    <td className="p-3">
                      <div className="font-medium">{item.title}</div>
                      <div className="text-xs text-gray-500">{item.original_title}</div>
                    </td>
                    <td className="p-3 text-gray-600">{getCategoryLabel(item.category)}</td>
                    <td className="p-3 text-gray-600">{item.season ?? "미정"}</td>
                    <td className="p-3 text-gray-600">
                      {item.episode_count ? `${item.episode_count}화` : "미정"}
                    </td>
                    <td className="p-3 text-gray-600">{item.status}</td>
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Link href={`/releases/${item.id}`} className="text-gray-600 hover:underline">
                          보기
                        </Link>
                        {!usingFallback && (
                          <Link
                            href={`/admin/releases/${item.id}`}
                            className="text-blue-600 hover:underline"
                          >
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
