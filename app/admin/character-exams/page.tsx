"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { EXAM_STATUS_LABELS, EXAM_TYPE_LABELS } from "@/lib/character-exam/constants";
import type { CharacterExamProduct } from "@/types/character-exam";

export default function AdminCharacterExamsPage() {
  const [products, setProducts] = useState<CharacterExamProduct[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("character_exam_products")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("시험 상품 로드 실패:", error);
      setProducts([]);
    } else {
      setProducts((data ?? []) as CharacterExamProduct[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    void fetchProducts();
  }, []);

  const handleDelete = async (product: CharacterExamProduct) => {
    if (!confirm(`"${product.title}" 시험 상품을 삭제할까요?`)) return;
    const { error } = await supabase
      .from("character_exam_products")
      .delete()
      .eq("id", product.id);
    if (error) {
      alert(`삭제 실패: ${error.message}`);
      return;
    }
    await fetchProducts();
  };

  const statusColor: Record<string, string> = {
    draft: "bg-gray-100 text-gray-600",
    review: "bg-yellow-100 text-yellow-700",
    approved: "bg-blue-100 text-blue-700",
    scheduled: "bg-purple-100 text-purple-700",
    published: "bg-green-100 text-green-700",
    stopped: "bg-red-100 text-red-700",
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-dashed border-gray-500 pb-4">
        <div>
          <h2 className="text-xl font-bold">시험 관리</h2>
          <p className="mt-1 text-sm text-gray-600">
            유저에게 노출할 캐릭터 중간고사 시험 콘텐츠를 관리합니다.
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-gray-700">
            <span className="rounded border border-dashed border-gray-400 bg-white px-2 py-1">
              전체 {products.length}개
            </span>
            <span className="rounded border border-dashed border-gray-400 bg-white px-2 py-1 text-green-700">
              공개 {products.filter((p) => p.status === "published").length}개
            </span>
          </div>
        </div>
        <Link
          href="/admin/character-exams/create"
          className="inline-flex items-center gap-1 rounded bg-black px-4 py-2 text-sm text-white transition-opacity hover:opacity-80"
        >
          <Plus size={16} />
          시험 추가
        </Link>
      </div>

      <section className="rounded border border-dashed border-gray-500 bg-white/70 p-6">
        {loading ? (
          <p className="text-sm text-gray-500">로딩 중...</p>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-start gap-3 rounded border border-dashed border-gray-400 bg-white p-6">
            <p className="text-sm text-gray-500">등록된 시험 상품이 없습니다.</p>
            <Link
              href="/admin/character-exams/create"
              className="rounded bg-black px-3 py-2 text-xs text-white transition-opacity hover:opacity-80"
            >
              첫 시험 추가
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b">
                <tr>
                  <th className="p-3 font-semibold">시험명</th>
                  <th className="p-3 font-semibold">유형</th>
                  <th className="p-3 font-semibold">문항 수</th>
                  <th className="p-3 font-semibold">상태</th>
                  <th className="p-3 font-semibold">등록일</th>
                  <th className="p-3 font-semibold text-right">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dashed">
                {products.map((product) => (
                  <tr key={product.id} className="transition-colors hover:bg-gray-100">
                    <td className="p-3">
                      <div className="font-medium">{product.title}</div>
                      {product.description && (
                        <div className="mt-0.5 truncate text-xs text-gray-500">
                          {product.description}
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-gray-600">
                      {EXAM_TYPE_LABELS[product.exam_type] ?? product.exam_type}
                    </td>
                    <td className="p-3 text-gray-600">{product.question_count}문항</td>
                    <td className="p-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor[product.status] ?? "bg-gray-100 text-gray-600"}`}
                      >
                        {EXAM_STATUS_LABELS[product.status] ?? product.status}
                      </span>
                    </td>
                    <td className="p-3 text-gray-500">
                      {new Date(product.created_at).toLocaleDateString("ko-KR")}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/admin/character-exams/${product.id}`}
                          className="text-blue-600 hover:underline"
                        >
                          수정
                        </Link>
                        <button
                          type="button"
                          onClick={() => void handleDelete(product)}
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

      <div className="flex gap-3 text-sm text-gray-500">
        <Link href="/admin/character-exams/templates" className="hover:underline">
          문항 템플릿 관리 →
        </Link>
        <Link href="/admin/character-exams/simulator" className="hover:underline">
          시뮬레이터 →
        </Link>
      </div>
    </div>
  );
}
