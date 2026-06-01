"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import type { CharacterExamResultTemplate, ScoreRange, TagComboComment } from "@/types/character-exam";

const DEFAULT_SCORE_RANGES: ScoreRange[] = [
  { min: 90, max: 100, grade: "1등급", title: "공식 팬 인증", description: "이 캐릭터의 모든 것을 꿰뚫고 있는 진정한 팬입니다.", percentile_label: "상위 4%" },
  { min: 75, max: 89, grade: "2등급", title: "시험지에 낙서해도 맞히는 타입", description: "공식 설정 이해도는 높지만 해석에 약간의 개성이 있습니다.", percentile_label: "상위 11%" },
  { min: 60, max: 74, grade: "3등급", title: "감정선은 강하지만 설정 복습 필요", description: "캐릭터를 향한 사랑은 크지만 세부 설정을 더 파악할 필요가 있습니다.", percentile_label: "상위 23%" },
  { min: 40, max: 59, grade: "4등급", title: "좋아하지만 헷갈리는 부분 있음", description: "이 캐릭터를 좋아하는 마음은 느껴지지만 설정 이해도를 높일 필요가 있습니다.", percentile_label: "상위 40%" },
  { min: 0, max: 39, grade: "보충학습", title: "작품 복습 권장", description: "이 캐릭터와 더 친해지기 위해 작품을 다시 한번 감상해 보세요.", percentile_label: "-" },
];

export default function ResultTemplatesPage() {
  const [templates, setTemplates] = useState<CharacterExamResultTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editRanges, setEditRanges] = useState<ScoreRange[]>(DEFAULT_SCORE_RANGES);
  const [editCombos, setEditCombos] = useState<TagComboComment[]>([]);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchTemplates = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("character_exam_result_templates")
      .select("*")
      .order("created_at", { ascending: true });
    setTemplates((data ?? []) as CharacterExamResultTemplate[]);
    setLoading(false);
  };

  useEffect(() => {
    void fetchTemplates();
  }, []);

  const startEdit = (t: CharacterExamResultTemplate) => {
    setEditId(t.id);
    setEditName(t.name);
    setEditRanges(t.score_ranges);
    setEditCombos(t.tag_combo_comments ?? []);
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditName("");
    setEditRanges(DEFAULT_SCORE_RANGES);
    setEditCombos([]);
  };

  const handleSave = async () => {
    if (!editId || !editName.trim()) return;
    setSaving(true);
    const { error } = await supabase
      .from("character_exam_result_templates")
      .update({
        name: editName.trim(),
        score_ranges: editRanges,
        tag_combo_comments: editCombos,
        updated_at: new Date().toISOString(),
      })
      .eq("id", editId);
    setSaving(false);
    if (error) {
      alert(`저장 실패: ${error.message}`);
      return;
    }
    cancelEdit();
    await fetchTemplates();
  };

  const handleCreate = async () => {
    if (!newTemplateName.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("character_exam_result_templates").insert({
      name: newTemplateName.trim(),
      score_ranges: DEFAULT_SCORE_RANGES,
      grade_labels: DEFAULT_SCORE_RANGES.map((r) => ({ grade: r.grade, label: r.title })),
      tag_combo_comments: [],
    });
    setSaving(false);
    if (error) {
      alert(`생성 실패: ${error.message}`);
      return;
    }
    setNewTemplateName("");
    await fetchTemplates();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("이 결과지 템플릿을 삭제할까요?")) return;
    await supabase.from("character_exam_result_templates").delete().eq("id", id);
    await fetchTemplates();
  };

  const updateRange = (idx: number, field: keyof ScoreRange, value: string | number) => {
    setEditRanges((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)),
    );
  };

  const updateCombo = (idx: number, field: keyof TagComboComment, value: string) => {
    setEditCombos((prev) =>
      prev.map((c, i) =>
        i === idx
          ? {
              ...c,
              [field]: field === "tags" ? value.split(",").map((s) => s.trim()).filter(Boolean) : value,
            }
          : c,
      ),
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="border-b border-dashed border-gray-500 pb-4">
        <h2 className="text-xl font-bold">결과지 템플릿 관리</h2>
        <p className="mt-1 text-sm text-gray-600">
          점수 구간별 등급과 태그 조합에 따른 생활기록부 문구를 관리합니다.
        </p>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={newTemplateName}
          onChange={(e) => setNewTemplateName(e.target.value)}
          className="rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none"
          placeholder="새 결과지 템플릿 이름"
        />
        <button
          type="button"
          onClick={() => void handleCreate()}
          disabled={!newTemplateName.trim() || saving}
          className="inline-flex items-center gap-1 rounded bg-black px-3 py-2 text-sm text-white disabled:opacity-50"
        >
          <Plus size={14} />
          생성
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">로딩 중...</p>
      ) : (
        <div className="flex flex-col gap-6">
          {templates.map((t) => (
            <section
              key={t.id}
              className="rounded border border-dashed border-gray-500 bg-white/70 p-6"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-semibold">{t.name}</h3>
                <div className="flex gap-2">
                  {editId !== t.id && (
                    <button
                      type="button"
                      onClick={() => startEdit(t)}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      편집
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleDelete(t.id)}
                    className="text-sm text-red-600 hover:underline"
                  >
                    삭제
                  </button>
                </div>
              </div>

              {editId === t.id ? (
                <div className="flex flex-col gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium">템플릿 이름</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full max-w-sm rounded border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <p className="mb-2 text-sm font-medium">점수 구간별 결과</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="border-b">
                          <tr>
                            <th className="p-2 text-left font-medium">최솟값</th>
                            <th className="p-2 text-left font-medium">최댓값</th>
                            <th className="p-2 text-left font-medium">등급</th>
                            <th className="p-2 text-left font-medium">제목</th>
                            <th className="p-2 text-left font-medium">설명</th>
                            <th className="p-2 text-left font-medium">백분위</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-dashed">
                          {editRanges.map((range, idx) => (
                            <tr key={idx}>
                              <td className="p-2">
                                <input
                                  type="number"
                                  value={range.min}
                                  onChange={(e) => updateRange(idx, "min", parseInt(e.target.value))}
                                  className="w-16 rounded border border-gray-300 px-2 py-1 text-sm"
                                />
                              </td>
                              <td className="p-2">
                                <input
                                  type="number"
                                  value={range.max}
                                  onChange={(e) => updateRange(idx, "max", parseInt(e.target.value))}
                                  className="w-16 rounded border border-gray-300 px-2 py-1 text-sm"
                                />
                              </td>
                              <td className="p-2">
                                <input
                                  type="text"
                                  value={range.grade}
                                  onChange={(e) => updateRange(idx, "grade", e.target.value)}
                                  className="w-20 rounded border border-gray-300 px-2 py-1 text-sm"
                                />
                              </td>
                              <td className="p-2">
                                <input
                                  type="text"
                                  value={range.title}
                                  onChange={(e) => updateRange(idx, "title", e.target.value)}
                                  className="w-40 rounded border border-gray-300 px-2 py-1 text-sm"
                                />
                              </td>
                              <td className="p-2">
                                <input
                                  type="text"
                                  value={range.description}
                                  onChange={(e) => updateRange(idx, "description", e.target.value)}
                                  className="w-52 rounded border border-gray-300 px-2 py-1 text-sm"
                                />
                              </td>
                              <td className="p-2">
                                <input
                                  type="text"
                                  value={range.percentile_label}
                                  onChange={(e) => updateRange(idx, "percentile_label", e.target.value)}
                                  className="w-24 rounded border border-gray-300 px-2 py-1 text-sm"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-medium">태그 조합 생활기록부 문구</p>
                      <button
                        type="button"
                        onClick={() =>
                          setEditCombos((prev) => [...prev, { tags: [], comment: "" }])
                        }
                        className="inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50"
                      >
                        <Plus size={11} />
                        추가
                      </button>
                    </div>
                    <div className="flex flex-col gap-2">
                      {editCombos.map((combo, idx) => (
                        <div key={idx} className="flex gap-2">
                          <input
                            type="text"
                            value={combo.tags.join(", ")}
                            onChange={(e) => updateCombo(idx, "tags", e.target.value)}
                            className="w-48 rounded border border-gray-300 px-2 py-1 text-sm"
                            placeholder="무심다정, 책임감"
                          />
                          <input
                            type="text"
                            value={combo.comment}
                            onChange={(e) => updateCombo(idx, "comment", e.target.value)}
                            className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
                            placeholder="생활기록부 문구"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setEditCombos((prev) => prev.filter((_, i) => i !== idx))
                            }
                            className="text-red-400 hover:text-red-600"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSave()}
                      disabled={saving}
                      className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
                    >
                      {saving ? "저장 중..." : "저장"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-600">
                  <p>점수 구간 {t.score_ranges.length}개</p>
                  <p>태그 조합 문구 {(t.tag_combo_comments ?? []).length}개</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {t.score_ranges.map((r) => (
                      <span
                        key={r.grade}
                        className="rounded bg-gray-100 px-2 py-0.5 text-xs"
                      >
                        {r.grade}: {r.title}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
