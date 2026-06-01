"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { DEFAULT_QUESTION_MIX, QUESTION_TYPE_LABELS } from "@/lib/character-exam/constants";
import type { CharacterExamProduct, CharacterExamRule, QuestionMix } from "@/types/character-exam";

export default function RulesPage() {
  const [rules, setRules] = useState<CharacterExamRule[]>([]);
  const [products, setProducts] = useState<CharacterExamProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [editName, setEditName] = useState("");
  const [editProductId, setEditProductId] = useState("");
  const [editEnabled, setEditEnabled] = useState(true);
  const [editPriority, setEditPriority] = useState(0);
  const [editMix, setEditMix] = useState<QuestionMix>({ ...DEFAULT_QUESTION_MIX });
  const [editCondGenres, setEditCondGenres] = useState("");
  const [editCondTagMin, setEditCondTagMin] = useState(0);

  const fetchData = async () => {
    setLoading(true);
    const [rulesRes, productsRes] = await Promise.all([
      supabase.from("character_exam_rules").select("*").order("priority", { ascending: false }),
      supabase.from("character_exam_products").select("id, title").order("title"),
    ]);
    setRules((rulesRes.data ?? []) as CharacterExamRule[]);
    setProducts((productsRes.data ?? []) as CharacterExamProduct[]);
    setLoading(false);
  };

  useEffect(() => {
    void fetchData();
  }, []);

  const startNew = () => {
    setEditId("new");
    setEditName("");
    setEditProductId("");
    setEditEnabled(true);
    setEditPriority(0);
    setEditMix({ ...DEFAULT_QUESTION_MIX });
    setEditCondGenres("");
    setEditCondTagMin(0);
  };

  const startEdit = (r: CharacterExamRule) => {
    setEditId(r.id);
    setEditName(r.name);
    setEditProductId(r.product_id ?? "");
    setEditEnabled(r.enabled);
    setEditPriority(r.priority);
    setEditMix(r.question_mix_json);
    setEditCondGenres((r.condition_json.genres ?? []).join(", "));
    setEditCondTagMin(r.condition_json.tag_min_count ?? 0);
  };

  const cancelEdit = () => setEditId(null);

  const handleSave = async () => {
    if (!editName.trim()) {
      alert("규칙 이름을 입력해주세요.");
      return;
    }
    setSaving(true);

    const payload = {
      name: editName.trim(),
      product_id: editProductId || null,
      enabled: editEnabled,
      priority: editPriority,
      question_mix_json: editMix,
      condition_json: {
        genres: editCondGenres
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        tag_min_count: editCondTagMin,
      },
      updated_at: new Date().toISOString(),
    };

    let error;
    if (editId === "new") {
      ({ error } = await supabase.from("character_exam_rules").insert(payload));
    } else {
      ({ error } = await supabase
        .from("character_exam_rules")
        .update(payload)
        .eq("id", editId!));
    }

    setSaving(false);
    if (error) {
      alert(`저장 실패: ${error.message}`);
      return;
    }
    cancelEdit();
    await fetchData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("이 규칙을 삭제할까요?")) return;
    await supabase.from("character_exam_rules").delete().eq("id", id);
    await fetchData();
  };

  const toggleEnabled = async (r: CharacterExamRule) => {
    await supabase
      .from("character_exam_rules")
      .update({ enabled: !r.enabled })
      .eq("id", r.id);
    await fetchData();
  };

  const mixTotal = Object.values(editMix).reduce((s, v) => s + (v ?? 0), 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between border-b border-dashed border-gray-500 pb-4">
        <div>
          <h2 className="text-xl font-bold">출제 규칙 관리</h2>
          <p className="mt-1 text-sm text-gray-600">
            캐릭터 조건별로 어떤 문항 템플릿을 어떤 비율로 출제할지 설정합니다.
          </p>
        </div>
        <button
          type="button"
          onClick={startNew}
          className="inline-flex items-center gap-1 rounded bg-black px-4 py-2 text-sm text-white transition-opacity hover:opacity-80"
        >
          <Plus size={16} />
          규칙 추가
        </button>
      </div>

      {editId && (
        <section className="rounded border border-black bg-gray-50 p-6">
          <h3 className="mb-4 font-semibold">
            {editId === "new" ? "새 규칙" : "규칙 편집"}
          </h3>
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="col-span-2">
                <label className="mb-1 block text-sm font-medium">규칙 이름 *</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  placeholder="기본 규칙"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">대상 시험 상품</label>
                <select
                  value={editProductId}
                  onChange={(e) => setEditProductId(e.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">전체 시험에 적용</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">우선순위</label>
                <input
                  type="number"
                  value={editPriority}
                  onChange={(e) => setEditPriority(parseInt(e.target.value) || 0)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium">필수 장르 (쉼표 구분)</label>
                <input
                  type="text"
                  value={editCondGenres}
                  onChange={(e) => setEditCondGenres(e.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  placeholder="로맨스, 판타지"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">태그 최소 개수</label>
                <input
                  type="number"
                  min={0}
                  value={editCondTagMin}
                  onChange={(e) => setEditCondTagMin(parseInt(e.target.value) || 0)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <label className="flex items-center gap-2 self-end text-sm">
                <input
                  type="checkbox"
                  checked={editEnabled}
                  onChange={(e) => setEditEnabled(e.target.checked)}
                />
                활성화
              </label>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">
                문항 유형 비율 (합계: {mixTotal}문항)
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {(Object.keys(QUESTION_TYPE_LABELS) as Array<keyof QuestionMix>).map((key) => (
                  <div key={key}>
                    <label className="mb-1 block text-xs text-gray-600">
                      {QUESTION_TYPE_LABELS[key]}
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={10}
                      value={editMix[key] ?? 0}
                      onChange={(e) =>
                        setEditMix((prev) => ({
                          ...prev,
                          [key]: parseInt(e.target.value) || 0,
                        }))
                      }
                      className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm"
                    />
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
        </section>
      )}

      <section className="rounded border border-dashed border-gray-500 bg-white/70 p-6">
        {loading ? (
          <p className="text-sm text-gray-500">로딩 중...</p>
        ) : rules.length === 0 ? (
          <p className="text-sm text-gray-500">등록된 규칙이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b">
                <tr>
                  <th className="p-3 font-semibold">우선순위</th>
                  <th className="p-3 font-semibold">규칙 이름</th>
                  <th className="p-3 font-semibold">대상</th>
                  <th className="p-3 font-semibold">문항 구성</th>
                  <th className="p-3 font-semibold">상태</th>
                  <th className="p-3 font-semibold text-right">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dashed">
                {rules.map((r) => (
                  <tr key={r.id} className="transition-colors hover:bg-gray-100">
                    <td className="p-3 font-mono">{r.priority}</td>
                    <td className="p-3 font-medium">{r.name}</td>
                    <td className="p-3 text-gray-500">
                      {r.product_id
                        ? products.find((p) => p.id === r.product_id)?.title ?? "알 수 없음"
                        : "전체 시험"}
                    </td>
                    <td className="p-3 text-gray-600">
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(r.question_mix_json)
                          .filter(([, v]) => (v ?? 0) > 0)
                          .map(([k, v]) => (
                            <span key={k} className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">
                              {QUESTION_TYPE_LABELS[k as keyof typeof QUESTION_TYPE_LABELS]}×{v}
                            </span>
                          ))}
                      </div>
                    </td>
                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() => void toggleEnabled(r)}
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          r.enabled
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {r.enabled ? "활성" : "비활성"}
                      </button>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(r)}
                          className="text-blue-600 hover:underline"
                        >
                          수정
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(r.id)}
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
