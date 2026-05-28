"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Download, Plus, Upload } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import {
  getCatalogStatusLabel,
  getWorkCategoryLabel,
  joinList,
} from "@/lib/official/catalog";
import { parseWorkExcel, WORK_TEMPLATE_PATH } from "@/lib/official/excel";
import type { OfficialWork } from "@/types/official";

export default function AdminWorksPage() {
  const [works, setWorks] = useState<OfficialWork[]>([]);
  const [oshiCountByWork, setOshiCountByWork] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const fetchItems = async () => {
    setLoading(true);
    const { data: workData, error: workError } = await supabase
      .from("official_works")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("title", { ascending: true });

    if (workError) {
      console.error("Failed to load official works:", workError);
      setWorks([]);
      setOshiCountByWork(new Map());
      setLoading(false);
      return;
    } else {
      setWorks((workData ?? []) as OfficialWork[]);
    }

    const nextCounts = new Map<string, number>();
    await Promise.all(
      ((workData ?? []) as OfficialWork[]).map(async (work) => {
        const { count, error } = await supabase
          .from("official_oshi_characters")
          .select("id", { count: "exact", head: true })
          .eq("work_id", work.id);
        if (error) {
          console.error(`Failed to count oshi for work ${work.id}:`, error);
          nextCounts.set(work.id, 0);
          return;
        }
        nextCounts.set(work.id, count ?? 0);
      }),
    );
    setOshiCountByWork(nextCounts);
    setLoading(false);
  };

  useEffect(() => {
    void fetchItems();
  }, []);

  const handleExcelUpload = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    try {
      const rows = await parseWorkExcel(file);
      if (rows.length === 0) {
        alert("추가할 작품 데이터가 없습니다.");
        return;
      }

      const { error } = await supabase.from("official_works").upsert(
        rows.map((row) => ({
          ...row,
          cover_image_url: null,
        })),
        { onConflict: "slug" },
      );

      if (error) throw error;
      alert(`${rows.length}개 작품 데이터를 반영했습니다.`);
      await fetchItems();
    } catch (error) {
      alert(error instanceof Error ? error.message : "엑셀 업로드 실패");
    } finally {
      setUploading(false);
      if (uploadInputRef.current) uploadInputRef.current.value = "";
    }
  };

  const handleDeleteWork = async (work: OfficialWork) => {
    if (
      !confirm(
        `"${work.title}" 작품을 삭제할까요? 연결된 공식 최애캐도 함께 삭제되며 되돌릴 수 없습니다.`,
      )
    ) {
      return;
    }

    const { error } = await supabase.from("official_works").delete().eq("id", work.id);
    if (error) {
      alert(`작품 삭제 실패: ${error.message}`);
      return;
    }
    await fetchItems();
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-dashed border-gray-500 pb-4">
        <div>
          <h2 className="text-xl font-bold">작품/최애캐 관리</h2>
          <p className="mt-1 text-sm text-gray-600">
            온보딩과 작품 허브에서 사용할 작품과 작품별 최애캐를 관리합니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={WORK_TEMPLATE_PATH}
            download
            className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-4 py-2 text-sm transition-colors hover:bg-gray-100"
          >
            <Download size={16} />
            엑셀 폼
          </a>
          <button
            type="button"
            onClick={() => uploadInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-4 py-2 text-sm transition-colors hover:bg-gray-100 disabled:opacity-50"
          >
            <Upload size={16} />
            {uploading ? "업로드 중..." : "엑셀 업로드"}
          </button>
          <input
            ref={uploadInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(event) => void handleExcelUpload(event.target.files?.[0] ?? null)}
          />
          <Link
            href="/admin/works/create"
            className="inline-flex items-center gap-1 rounded bg-black px-4 py-2 text-sm text-white transition-opacity hover:opacity-80"
          >
            <Plus size={16} />
            작품 추가
          </Link>
        </div>
      </div>

      <section className="rounded border border-dashed border-gray-500 bg-white/70 p-6">
        {loading ? (
          <p className="text-sm text-gray-500">로딩 중...</p>
        ) : works.length === 0 ? (
          <div className="flex flex-col items-start gap-3 rounded border border-dashed border-gray-400 bg-white p-6">
            <p className="text-sm text-gray-500">등록된 작품이 없습니다.</p>
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
                  <th className="w-16 p-3 text-center font-semibold">우선</th>
                  <th className="p-3 font-semibold">작품</th>
                  <th className="p-3 font-semibold">분류</th>
                  <th className="p-3 font-semibold">장르/분기</th>
                  <th className="p-3 font-semibold">상태</th>
                  <th className="p-3 font-semibold">최애캐</th>
                  <th className="p-3 font-semibold text-right">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dashed">
                {works.map((work) => (
                  <tr key={work.id} className="transition-colors hover:bg-gray-100">
                    <td className="p-3 text-center">
                      <span className="inline-flex h-8 min-w-8 items-center justify-center rounded border border-gray-300 bg-white px-2 text-sm font-bold text-gray-700">
                        {work.sort_order}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-16 w-11 shrink-0 items-center justify-center overflow-hidden rounded border border-dashed border-gray-300 bg-gray-100 text-center text-[9px] font-bold leading-tight text-gray-400">
                          {work.cover_image_url ? (
                            <img
                              src={work.cover_image_url}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span>NO<br />IMAGE</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-medium">{work.title}</div>
                          <div className="truncate text-xs text-gray-500">/{work.slug}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-gray-600">
                      {getWorkCategoryLabel(work.category)}
                    </td>
                    <td className="p-3 text-gray-600">
                      <div>{joinList(work.genres) || "-"}</div>
                      <div className="text-xs text-gray-400">{work.season || "-"}</div>
                    </td>
                    <td className="p-3 text-gray-600">
                      {getCatalogStatusLabel(work.status)}
                    </td>
                    <td className="p-3 text-gray-600">
                      {oshiCountByWork.get(work.id) ?? 0}명
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/admin/works/${work.id}`}
                          className="text-blue-600 hover:underline"
                        >
                          수정
                        </Link>
                        <button
                          type="button"
                          onClick={() => void handleDeleteWork(work)}
                          className="text-red-600 hover:underline"
                        >
                          삭제
                        </button>
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
