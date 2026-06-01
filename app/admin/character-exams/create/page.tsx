"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import {
  EXAM_STATUS_LABELS,
  EXAM_TYPE_LABELS,
  SPOILER_LEVEL_LABELS,
} from "@/lib/character-exam/constants";
import type { CharacterExamResultTemplate, ExamType, ExamStatus } from "@/types/character-exam";

export default function CreateExamProductPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [resultTemplates, setResultTemplates] = useState<CharacterExamResultTemplate[]>([]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [examType, setExamType] = useState<ExamType>("character_single");
  const [questionCount, setQuestionCount] = useState(10);
  const [timeLimitSeconds, setTimeLimitSeconds] = useState<string>("");
  const [spoilerLevel, setSpoilerLevel] = useState(0);
  const [resultTemplateId, setResultTemplateId] = useState("");
  const [status, setStatus] = useState<ExamStatus>("draft");
  const [useRecommendation, setUseRecommendation] = useState(false);

  useEffect(() => {
    supabase
      .from("character_exam_result_templates")
      .select("id, name")
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (data) setResultTemplates(data as CharacterExamResultTemplate[]);
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert("시험명을 입력해주세요.");
      return;
    }
    setSaving(true);
    const { data, error } = await supabase
      .from("character_exam_products")
      .insert({
        title: title.trim(),
        description: description.trim() || null,
        exam_type: examType,
        question_count: questionCount,
        time_limit_seconds: timeLimitSeconds ? parseInt(timeLimitSeconds) : null,
        spoiler_level: spoilerLevel,
        result_template_id: resultTemplateId || null,
        status,
        use_recommendation: useRecommendation,
      })
      .select("id")
      .single();

    setSaving(false);
    if (error) {
      alert(`저장 실패: ${error.message}`);
      return;
    }
    router.push(`/admin/character-exams/${data.id}`);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="border-b border-dashed border-gray-500 pb-4">
        <h2 className="text-xl font-bold">시험 상품 추가</h2>
        <p className="mt-1 text-sm text-gray-600">
          새 캐릭터 중간고사 시험 콘텐츠를 만듭니다.
        </p>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-6">
        <section className="rounded border border-dashed border-gray-500 bg-white/70 p-6">
          <h3 className="mb-4 font-semibold">기본 정보</h3>
          <div className="flex flex-col gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium">시험명 *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black"
                placeholder="예: 2026학년도 캐릭터 탐구 중간고사"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">설명</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black"
                placeholder="유저에게 보이는 시험 소개 문구"
              />
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium">시험 유형</label>
                <select
                  value={examType}
                  onChange={(e) => setExamType(e.target.value as ExamType)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none"
                >
                  {Object.entries(EXAM_TYPE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">문항 수</label>
                <input
                  type="number"
                  value={questionCount}
                  onChange={(e) => setQuestionCount(parseInt(e.target.value) || 10)}
                  min={5}
                  max={30}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">제한 시간 (초)</label>
                <input
                  type="number"
                  value={timeLimitSeconds}
                  onChange={(e) => setTimeLimitSeconds(e.target.value)}
                  min={60}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none"
                  placeholder="없으면 빈칸"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">스포일러 수준</label>
                <select
                  value={spoilerLevel}
                  onChange={(e) => setSpoilerLevel(parseInt(e.target.value))}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none"
                >
                  {Object.entries(SPOILER_LEVEL_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">공개 상태</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ExamStatus)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none"
                >
                  {Object.entries(EXAM_STATUS_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">결과지 템플릿</label>
                <select
                  value={resultTemplateId}
                  onChange={(e) => setResultTemplateId(e.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none"
                >
                  <option value="">기본값 사용</option>
                  {resultTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={useRecommendation}
                onChange={(e) => setUseRecommendation(e.target.checked)}
                className="rounded"
              />
              시험 종료 후 추천 섹션 사용
            </label>
          </div>
        </section>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-black px-4 py-2 text-sm text-white transition-opacity hover:opacity-80 disabled:opacity-50"
          >
            {saving ? "저장 중..." : "시험 추가"}
          </button>
        </div>
      </form>
    </div>
  );
}
