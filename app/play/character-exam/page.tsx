"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { EXAM_TYPE_LABELS, SPOILER_LEVEL_LABELS } from "@/lib/character-exam/constants";
import type { CharacterExamProduct } from "@/types/character-exam";

export default function CharacterExamHubPage() {
  const [products, setProducts] = useState<CharacterExamProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("character_exam_products")
      .select("*")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .then(({ data }) => {
        setProducts((data ?? []) as CharacterExamProduct[]);
        setLoading(false);
      });
  }, []);

  const estimateMinutes = (count: number) => Math.ceil((count * 20) / 60);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold tracking-tight">캐릭터 탐구 중간고사</h1>
        <p className="mt-2 text-gray-500">
          좋아하는 캐릭터를 얼마나 잘 아는지 시험처럼 풀어보세요.
          <br />
          점수, 등급, 생활기록부 코멘트가 담긴 결과지를 받습니다.
        </p>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center text-sm text-gray-400">
          로딩 중...
        </div>
      ) : products.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center gap-2 rounded border border-dashed border-gray-300 text-sm text-gray-400">
          <p>아직 공개된 시험이 없습니다.</p>
          <p className="text-xs">곧 새로운 시험이 열릴 예정입니다.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {products.map((product) => (
            <Link
              key={product.id}
              href={`/play/character-exam/${product.id}`}
              className="group flex flex-col gap-3 rounded border border-gray-200 bg-white p-5 shadow-sm transition-all hover:border-gray-400 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-semibold leading-snug group-hover:underline">
                  {product.title}
                </h2>
                {product.spoiler_level > 0 && (
                  <span className="shrink-0 rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-600">
                    스포 주의
                  </span>
                )}
              </div>
              {product.description && (
                <p className="line-clamp-2 text-sm text-gray-500">{product.description}</p>
              )}
              <div className="mt-auto flex flex-wrap items-center gap-2 text-xs text-gray-400">
                <span className="rounded bg-gray-100 px-2 py-0.5">
                  {EXAM_TYPE_LABELS[product.exam_type]}
                </span>
                <span>{product.question_count}문항</span>
                <span>약 {estimateMinutes(product.question_count)}분</span>
                {product.spoiler_level > 0 && (
                  <span className="text-orange-500">
                    {SPOILER_LEVEL_LABELS[product.spoiler_level]}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
