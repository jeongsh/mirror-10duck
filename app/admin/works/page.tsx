"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import {
  getCatalogStatusLabel,
  getWorkCategoryLabel,
} from "@/lib/official/catalog";
import type { OfficialOshiCharacter, OfficialWork } from "@/types/official";

export default function AdminWorksPage() {
  const [works, setWorks] = useState<OfficialWork[]>([]);
  const [oshi, setOshi] = useState<Pick<OfficialOshiCharacter, "work_id">[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = async () => {
    setLoading(true);
    const [{ data: workData, error: workError }, { data: oshiData }] =
      await Promise.all([
        supabase
          .from("official_works")
          .select("*")
          .order("sort_order", { ascending: true })
          .order("title", { ascending: true }),
        supabase.from("official_oshi_characters").select("work_id"),
      ]);

    if (workError) {
      console.error("Failed to load official works:", workError);
      setWorks([]);
    } else {
      setWorks((workData ?? []) as OfficialWork[]);
    }
    setOshi((oshiData ?? []) as Pick<OfficialOshiCharacter, "work_id">[]);
    setLoading(false);
  };

  useEffect(() => {
    void fetchItems();
  }, []);

  const oshiCountByWork = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of oshi) {
      map.set(item.work_id, (map.get(item.work_id) ?? 0) + 1);
    }
    return map;
  }, [oshi]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-dashed border-gray-500 pb-4">
        <div>
          <h2 className="text-xl font-bold">공식 작품/최애캐 관리</h2>
          <p className="mt-1 text-sm text-gray-600">
            온보딩과 작품 허브에서 사용할 공식 작품과 작품별 최애캐를 관리합니다.
          </p>
        </div>
        <Link
          href="/admin/works/create"
          className="inline-flex items-center gap-1 rounded bg-black px-4 py-2 text-sm text-white transition-opacity hover:opacity-80"
        >
          <Plus size={16} />
          작품 추가
        </Link>
      </div>

      <section className="rounded border border-dashed border-gray-500 bg-white/70 p-6">
        {loading ? (
          <p className="text-sm text-gray-500">로딩 중...</p>
        ) : works.length === 0 ? (
          <div className="flex flex-col items-start gap-3 rounded border border-dashed border-gray-400 bg-white p-6">
            <p className="text-sm text-gray-500">등록된 공식 작품이 없습니다.</p>
            <Link
              href="/admin/works/create"
              className="rounded bg-black px-3 py-2 text-xs text-white transition-opacity hover:opacity-80"
            >
              첫 작품 추가
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b">
                <tr>
                  <th className="p-3 font-semibold">작품</th>
                  <th className="p-3 font-semibold">분류</th>
                  <th className="p-3 font-semibold">상태</th>
                  <th className="p-3 font-semibold">최애캐</th>
                  <th className="p-3 font-semibold">정렬</th>
                  <th className="p-3 font-semibold text-right">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dashed">
                {works.map((work) => (
                  <tr key={work.id} className="transition-colors hover:bg-gray-100">
                    <td className="p-3">
                      <div className="font-medium">{work.title}</div>
                      <div className="text-xs text-gray-500">/{work.slug}</div>
                    </td>
                    <td className="p-3 text-gray-600">
                      {getWorkCategoryLabel(work.category)}
                    </td>
                    <td className="p-3 text-gray-600">
                      {getCatalogStatusLabel(work.status)}
                    </td>
                    <td className="p-3 text-gray-600">
                      {oshiCountByWork.get(work.id) ?? 0}명
                    </td>
                    <td className="p-3 text-gray-600">{work.sort_order}</td>
                    <td className="p-3 text-right">
                      <Link
                        href={`/admin/works/${work.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        수정
                      </Link>
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
