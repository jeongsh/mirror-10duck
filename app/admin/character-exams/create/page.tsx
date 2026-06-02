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

interface WorkOption { id: string; title: string; cover_image_url: string | null; }
interface CharacterOption { id: string; name: string; work_title: string; profile_image_url: string | null; }

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

  const [workSearch, setWorkSearch] = useState("");
  const [workResults, setWorkResults] = useState<WorkOption[]>([]);
  const [pinnedWork, setPinnedWork] = useState<WorkOption | null>(null);

  const [charSearch, setCharSearch] = useState("");
  const [charResults, setCharResults] = useState<CharacterOption[]>([]);
  const [pinnedCharacter, setPinnedCharacter] = useState<CharacterOption | null>(null);

  useEffect(() => {
    supabase
      .from("character_exam_result_templates")
      .select("id, name")
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (data) setResultTemplates(data as CharacterExamResultTemplate[]);
      });
  }, []);

  const searchWorks = async () => {
    if (!workSearch.trim()) return;
    const { data } = await supabase
      .from("official_works")
      .select("id, title, cover_image_url")
      .ilike("title", `%${workSearch.trim()}%`)
      .eq("status", "PUBLISHED")
      .order("sort_order", { ascending: true })
      .limit(8);
    setWorkResults((data ?? []) as WorkOption[]);
  };

  const searchCharacters = async () => {
    if (!charSearch.trim()) return;
    const { data } = await supabase
      .from("official_oshi_characters")
      .select("id, name, profile_image_url, official_works(title)")
      .ilike("name", `%${charSearch.trim()}%`)
      .eq("status", "PUBLISHED")
      .limit(8);
    setCharResults(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((data ?? []) as any[]).map((row) => ({
        id: row.id as string,
        name: row.name as string,
        work_title: (row.official_works?.title as string | undefined) ?? "알 수 없음",
        profile_image_url: row.profile_image_url as string | null,
      })),
    );
  };

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
        pinned_work_id: examType === "work_unit" ? (pinnedWork?.id ?? null) : null,
        pinned_character_id: examType === "character_single" ? (pinnedCharacter?.id ?? null) : null,
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
                  onChange={(e) => {
                    setExamType(e.target.value as ExamType);
                    setPinnedWork(null);
                    setPinnedCharacter(null);
                    setWorkResults([]);
                    setCharResults([]);
                  }}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none"
                >
                  {Object.entries(EXAM_TYPE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
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
                    <option key={k} value={k}>{v}</option>
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
                    <option key={k} value={k}>{v}</option>
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
                    <option key={t.id} value={t.id}>{t.name}</option>
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

        {/* 작품 고정 (work_unit) */}
        {examType === "work_unit" && (
          <section className="rounded border border-dashed border-gray-500 bg-white/70 p-6">
            <h3 className="mb-1 font-semibold">고정 작품 <span className="text-xs font-normal text-gray-400">(미지정 시 유저가 자유 선택)</span></h3>
            <p className="mb-4 text-xs text-gray-500">이 시험을 특정 애니메이션으로 한정하려면 선택하세요.</p>

            {pinnedWork ? (
              <div className="flex items-center justify-between rounded border border-gray-200 bg-gray-50 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  {pinnedWork.cover_image_url && (
                    <img src={pinnedWork.cover_image_url} alt="" className="h-7 w-5 rounded object-cover" />
                  )}
                  <span className="text-sm font-medium">{pinnedWork.title}</span>
                </div>
                <button type="button" onClick={() => setPinnedWork(null)} className="text-xs text-red-400 hover:text-red-600">
                  해제
                </button>
              </div>
            ) : (
              <>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={workSearch}
                    onChange={(e) => setWorkSearch(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && void searchWorks()}
                    className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none"
                    placeholder="작품명 검색"
                  />
                  <button
                    type="button"
                    onClick={() => void searchWorks()}
                    className="rounded border border-gray-300 bg-white px-4 py-2 text-sm hover:bg-gray-50"
                  >
                    검색
                  </button>
                </div>
                {workResults.length > 0 && (
                  <div className="mt-2 rounded border border-gray-200 bg-white shadow-sm">
                    {workResults.map((w) => (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => { setPinnedWork(w); setWorkResults([]); setWorkSearch(""); }}
                        className="flex w-full items-center gap-3 border-b border-gray-100 px-4 py-2.5 text-left text-sm last:border-0 hover:bg-gray-50"
                      >
                        {w.cover_image_url && (
                          <img src={w.cover_image_url} alt="" className="h-8 w-6 rounded object-cover shrink-0" />
                        )}
                        <span>{w.title}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {/* 캐릭터 고정 (character_single) */}
        {examType === "character_single" && (
          <section className="rounded border border-dashed border-gray-500 bg-white/70 p-6">
            <h3 className="mb-1 font-semibold">고정 캐릭터 <span className="text-xs font-normal text-gray-400">(미지정 시 유저가 자유 선택)</span></h3>
            <p className="mb-4 text-xs text-gray-500">특정 캐릭터로만 시험을 치르게 하려면 선택하세요.</p>

            {pinnedCharacter ? (
              <div className="flex items-center justify-between rounded border border-gray-200 bg-gray-50 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  {pinnedCharacter.profile_image_url ? (
                    <img src={pinnedCharacter.profile_image_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-200 text-xs">{pinnedCharacter.name[0]}</div>
                  )}
                  <div>
                    <div className="text-sm font-medium">{pinnedCharacter.name}</div>
                    <div className="text-xs text-gray-400">{pinnedCharacter.work_title}</div>
                  </div>
                </div>
                <button type="button" onClick={() => setPinnedCharacter(null)} className="text-xs text-red-400 hover:text-red-600">
                  해제
                </button>
              </div>
            ) : (
              <>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={charSearch}
                    onChange={(e) => setCharSearch(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && void searchCharacters()}
                    className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none"
                    placeholder="캐릭터 이름 검색"
                  />
                  <button
                    type="button"
                    onClick={() => void searchCharacters()}
                    className="rounded border border-gray-300 bg-white px-4 py-2 text-sm hover:bg-gray-50"
                  >
                    검색
                  </button>
                </div>
                {charResults.length > 0 && (
                  <div className="mt-2 rounded border border-gray-200 bg-white shadow-sm">
                    {charResults.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => { setPinnedCharacter(c); setCharResults([]); setCharSearch(""); }}
                        className="flex w-full items-center gap-3 border-b border-gray-100 px-4 py-2.5 text-left text-sm last:border-0 hover:bg-gray-50"
                      >
                        {c.profile_image_url ? (
                          <img src={c.profile_image_url} alt="" className="h-8 w-8 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-200 text-xs">{c.name[0]}</div>
                        )}
                        <div>
                          <div className="font-medium">{c.name}</div>
                          <div className="text-xs text-gray-400">{c.work_title}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>
        )}

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
