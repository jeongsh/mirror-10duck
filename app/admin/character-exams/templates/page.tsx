"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import {
  QUESTION_TYPE_LABELS,
  SCORING_TYPE_LABELS,
  TEMPLATE_STATUS_LABELS,
} from "@/lib/character-exam/constants";
import type { CharacterExamTemplate } from "@/types/character-exam";

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<CharacterExamTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("all");

  const fetchTemplates = async () => {
    setLoading(true);
    const query = supabase
      .from("character_exam_templates")
      .select("*")
      .order("question_type", { ascending: true })
      .order("weight", { ascending: false });

    const { data, error } = await query;
    if (error) {
      console.error("템플릿 로드 실패:", error);
      setTemplates([]);
    } else {
      setTemplates((data ?? []) as CharacterExamTemplate[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    void fetchTemplates();
  }, []);

  const handleDelete = async (id: string, body: string) => {
    if (!confirm(`"${body.slice(0, 30)}..." 템플릿을 삭제할까요?`)) return;
    const { error } = await supabase
      .from("character_exam_templates")
      .delete()
      .eq("id", id);
    if (error) {
      alert(`삭제 실패: ${error.message}`);
      return;
    }
    await fetchTemplates();
  };

  const filtered =
    filterType === "all" ? templates : templates.filter((t) => t.question_type === filterType);

  const countByType = templates.reduce<Record<string, number>>((acc, t) => {
    acc[t.question_type] = (acc[t.question_type] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-dashed border-gray-500 pb-4">
        <div>
          <h2 className="text-xl font-bold">문항 템플릿 관리</h2>
          <p className="mt-1 text-sm text-gray-600">
            캐릭터 변수를 활용한 재사용 가능한 문항 틀을 관리합니다.
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-gray-700">
            <span className="rounded border border-dashed border-gray-400 bg-white px-2 py-1">
              전체 {templates.length}개
            </span>
            {Object.entries(QUESTION_TYPE_LABELS).map(([key, label]) => (
              <span
                key={key}
                className="rounded border border-dashed border-gray-400 bg-white px-2 py-1"
              >
                {label} {countByType[key] ?? 0}개
              </span>
            ))}
          </div>
        </div>
        <Link
          href="/admin/character-exams/templates/create"
          className="inline-flex items-center gap-1 rounded bg-black px-4 py-2 text-sm text-white transition-opacity hover:opacity-80"
        >
          <Plus size={16} />
          템플릿 추가
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilterType("all")}
          className={`rounded-full border px-3 py-1 text-xs ${filterType === "all" ? "border-black bg-black text-white" : "border-gray-300 hover:bg-gray-50"}`}
        >
          전체
        </button>
        {Object.entries(QUESTION_TYPE_LABELS).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilterType(key)}
            className={`rounded-full border px-3 py-1 text-xs ${filterType === key ? "border-black bg-black text-white" : "border-gray-300 hover:bg-gray-50"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <section className="rounded border border-dashed border-gray-500 bg-white/70 p-6">
        {loading ? (
          <p className="text-sm text-gray-500">로딩 중...</p>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-start gap-3 rounded border border-dashed border-gray-400 bg-white p-6">
            <p className="text-sm text-gray-500">등록된 템플릿이 없습니다.</p>
            <Link
              href="/admin/character-exams/templates/create"
              className="rounded bg-black px-3 py-2 text-xs text-white transition-opacity hover:opacity-80"
            >
              첫 템플릿 추가
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b">
                <tr>
                  <th className="p-3 font-semibold">문항 유형</th>
                  <th className="p-3 font-semibold">질문</th>
                  <th className="p-3 font-semibold">채점 방식</th>
                  <th className="p-3 font-semibold">가중치</th>
                  <th className="p-3 font-semibold">상태</th>
                  <th className="p-3 font-semibold text-right">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dashed">
                {filtered.map((t) => (
                  <tr key={t.id} className="transition-colors hover:bg-gray-100">
                    <td className="p-3">
                      <span className="whitespace-nowrap rounded bg-gray-100 px-2 py-0.5 text-xs">
                        {QUESTION_TYPE_LABELS[t.question_type] ?? t.question_type}
                      </span>
                    </td>
                    <td className="max-w-xs p-3">
                      <div className="truncate font-medium">{t.body}</div>
                      {t.is_interpretation && (
                        <span className="mt-0.5 inline-block rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-600">
                          해석형
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-gray-600 whitespace-nowrap">
                      {SCORING_TYPE_LABELS[t.scoring_type] ?? t.scoring_type}
                    </td>
                    <td className="p-3 text-gray-600">{t.weight}</td>
                    <td className="p-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          t.status === "active"
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {TEMPLATE_STATUS_LABELS[t.status]}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/admin/character-exams/templates/${t.id}`}
                          className="text-blue-600 hover:underline"
                        >
                          수정
                        </Link>
                        <button
                          type="button"
                          onClick={() => void handleDelete(t.id, t.body)}
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
