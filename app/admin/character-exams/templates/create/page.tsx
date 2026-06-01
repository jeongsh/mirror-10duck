"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import {
  QUESTION_TYPE_LABELS,
  SCORING_TYPE_LABELS,
  SPOILER_LEVEL_LABELS,
  TEMPLATE_VARIABLES,
  DEFAULT_TAG_DICT,
  OPTION_LABELS,
} from "@/lib/character-exam/constants";
import type { QuestionType, ScoringType, TagSignalItem } from "@/types/character-exam";

interface DraftOption {
  label: string;
  body: string;
  is_correct: boolean;
  score: number;
  tags: string[];
}

const DEFAULT_OPTIONS: DraftOption[] = [
  { label: "A", body: "", is_correct: false, score: 0, tags: [] },
  { label: "B", body: "", is_correct: false, score: 0, tags: [] },
  { label: "C", body: "", is_correct: false, score: 0, tags: [] },
  { label: "D", body: "", is_correct: false, score: 0, tags: [] },
];

export default function CreateTemplatePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const [questionType, setQuestionType] = useState<QuestionType>("situation_reaction");
  const [body, setBody] = useState("");
  const [scoringType, setScoringType] = useState<ScoringType>("tag_signal");
  const [isInterpretation, setIsInterpretation] = useState(false);
  const [spoilerLevel, setSpoilerLevel] = useState(0);
  const [weight, setWeight] = useState(1.0);
  const [options, setOptions] = useState<DraftOption[]>(DEFAULT_OPTIONS);

  const [condRequireGenres, setCondRequireGenres] = useState("");
  const [condRequireTagMin, setCondRequireTagMin] = useState(0);
  const [condRequireRelated, setCondRequireRelated] = useState(false);
  const [condRequireDialogue, setCondRequireDialogue] = useState(false);
  const [condMaxSpoiler, setCondMaxSpoiler] = useState(2);

  const updateOption = (idx: number, field: keyof DraftOption, value: unknown) => {
    setOptions((prev) =>
      prev.map((opt, i) => (i === idx ? { ...opt, [field]: value } : opt)),
    );
  };

  const toggleTag = (optIdx: number, tag: string) => {
    setOptions((prev) =>
      prev.map((opt, i) => {
        if (i !== optIdx) return opt;
        const has = opt.tags.includes(tag);
        return { ...opt, tags: has ? opt.tags.filter((t) => t !== tag) : [...opt.tags, tag] };
      }),
    );
  };

  const addOption = () => {
    if (options.length >= 5) return;
    setOptions((prev) => [
      ...prev,
      { label: OPTION_LABELS[prev.length], body: "", is_correct: false, score: 0, tags: [] },
    ]);
  };

  const removeOption = (idx: number) => {
    if (options.length <= 2) return;
    setOptions((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) {
      alert("질문 내용을 입력해주세요.");
      return;
    }
    if (options.some((o) => !o.body.trim())) {
      alert("모든 선택지 내용을 입력해주세요.");
      return;
    }

    setSaving(true);

    const condJson = {
      require_genres: condRequireGenres
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      require_tag_min: condRequireTagMin,
      require_related_characters: condRequireRelated,
      require_signature_dialogue: condRequireDialogue,
      max_spoiler_level: condMaxSpoiler,
    };

    const { data: templateData, error: templateError } = await supabase
      .from("character_exam_templates")
      .insert({
        question_type: questionType,
        body: body.trim(),
        scoring_type: scoringType,
        is_interpretation: isInterpretation,
        spoiler_level: spoilerLevel,
        weight,
        condition_json: condJson,
        status: "active",
      })
      .select("id")
      .single();

    if (templateError || !templateData) {
      setSaving(false);
      alert(`저장 실패: ${templateError?.message}`);
      return;
    }

    const optionRows = options.map((opt, idx) => ({
      template_id: templateData.id,
      label: opt.label || OPTION_LABELS[idx],
      body: opt.body.trim(),
      is_correct: opt.is_correct,
      score: opt.score,
      tag_payload: opt.tags.map((tag): TagSignalItem => ({ tag, weight: 1.0 })),
      sort_order: idx,
    }));

    const { error: optionError } = await supabase
      .from("character_exam_template_options")
      .insert(optionRows);

    setSaving(false);
    if (optionError) {
      alert(`선택지 저장 실패: ${optionError.message}`);
      return;
    }
    router.push(`/admin/character-exams/templates/${templateData.id}`);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="border-b border-dashed border-gray-500 pb-4">
        <h2 className="text-xl font-bold">문항 템플릿 추가</h2>
        <p className="mt-1 text-sm text-gray-600">
          변수 예시:{" "}
          {TEMPLATE_VARIABLES.map((v) => (
            <code key={v.key} className="mr-2 rounded bg-gray-100 px-1 text-xs">
              {v.key}
            </code>
          ))}
        </p>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-6">
        <section className="rounded border border-dashed border-gray-500 bg-white/70 p-6">
          <h3 className="mb-4 font-semibold">문항 기본 설정</h3>
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <label className="mb-1 block text-sm font-medium">문항 유형</label>
                <select
                  value={questionType}
                  onChange={(e) => setQuestionType(e.target.value as QuestionType)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                >
                  {Object.entries(QUESTION_TYPE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">채점 방식</label>
                <select
                  value={scoringType}
                  onChange={(e) => setScoringType(e.target.value as ScoringType)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                >
                  {Object.entries(SCORING_TYPE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">스포일러 수준</label>
                <select
                  value={spoilerLevel}
                  onChange={(e) => setSpoilerLevel(parseInt(e.target.value))}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                >
                  {Object.entries(SPOILER_LEVEL_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">출제 가중치</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={weight}
                  onChange={(e) => setWeight(parseFloat(e.target.value) || 1.0)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isInterpretation}
                onChange={(e) => setIsInterpretation(e.target.checked)}
                className="rounded"
              />
              해석형 문항 (오답 없음, 태그/취향만 수집)
            </label>
            <div>
              <label className="mb-1 block text-sm font-medium">질문 문장 *</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={3}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black"
                placeholder="{character_name}이(가) 고백을 받았을 때 가장 가까운 반응은?"
              />
            </div>
          </div>
        </section>

        <section className="rounded border border-dashed border-gray-500 bg-white/70 p-6">
          <h3 className="mb-1 font-semibold">출제 조건</h3>
          <p className="mb-4 text-xs text-gray-500">조건이 없으면 모든 캐릭터에 적용됩니다.</p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium">필수 장르 (쉼표 구분)</label>
              <input
                type="text"
                value={condRequireGenres}
                onChange={(e) => setCondRequireGenres(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                placeholder="로맨스, 판타지"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">태그 최소 개수</label>
              <input
                type="number"
                min={0}
                value={condRequireTagMin}
                onChange={(e) => setCondRequireTagMin(parseInt(e.target.value) || 0)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">최대 스포일러 수준</label>
              <select
                value={condMaxSpoiler}
                onChange={(e) => setCondMaxSpoiler(parseInt(e.target.value))}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              >
                {Object.entries(SPOILER_LEVEL_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-3 flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={condRequireRelated}
                onChange={(e) => setCondRequireRelated(e.target.checked)}
                className="rounded"
              />
              관련 캐릭터 필요
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={condRequireDialogue}
                onChange={(e) => setCondRequireDialogue(e.target.checked)}
                className="rounded"
              />
              대표 대사 필요
            </label>
          </div>
        </section>

        <section className="rounded border border-dashed border-gray-500 bg-white/70 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold">선택지 ({options.length}개)</h3>
            {options.length < 5 && (
              <button
                type="button"
                onClick={addOption}
                className="inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50"
              >
                <Plus size={12} />
                선택지 추가
              </button>
            )}
          </div>
          <div className="flex flex-col gap-4">
            {options.map((opt, idx) => (
              <div
                key={idx}
                className="rounded border border-gray-200 bg-white p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="font-bold text-gray-700">{opt.label}</span>
                  {options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeOption(idx)}
                      className="text-red-400 hover:text-red-600"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <textarea
                  value={opt.body}
                  onChange={(e) => updateOption(idx, "body", e.target.value)}
                  rows={2}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black"
                  placeholder="선택지 내용을 입력하세요"
                />
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      checked={opt.is_correct}
                      onChange={(e) => updateOption(idx, "is_correct", e.target.checked)}
                      className="rounded"
                    />
                    정답
                  </label>
                  {scoringType === "answer_score" && (
                    <div className="flex items-center gap-1.5 text-sm">
                      <span className="text-gray-500">점수</span>
                      <input
                        type="number"
                        value={opt.score}
                        onChange={(e) => updateOption(idx, "score", parseInt(e.target.value) || 0)}
                        min={0}
                        max={20}
                        className="w-16 rounded border border-gray-300 px-2 py-1 text-sm"
                      />
                    </div>
                  )}
                </div>
                <div className="mt-3">
                  <p className="mb-1.5 text-xs font-medium text-gray-600">태그 신호</p>
                  <div className="flex flex-wrap gap-1">
                    {DEFAULT_TAG_DICT.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleTag(idx, tag)}
                        className={`rounded border px-2 py-0.5 text-xs transition-colors ${
                          opt.tags.includes(tag)
                            ? "border-black bg-black text-white"
                            : "border-gray-300 hover:border-gray-400"
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                  {opt.tags.length > 0 && (
                    <p className="mt-1 text-xs text-gray-500">
                      선택됨: {opt.tags.join(", ")}
                    </p>
                  )}
                </div>
              </div>
            ))}
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
            {saving ? "저장 중..." : "템플릿 추가"}
          </button>
        </div>
      </form>
    </div>
  );
}
