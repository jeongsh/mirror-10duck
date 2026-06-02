"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { generateExamQuestions } from "@/lib/character-exam/generator";
import { DEFAULT_QUESTION_MIX, QUESTION_TYPE_LABELS, SCORING_TYPE_LABELS } from "@/lib/character-exam/constants";
import type { GeneratedQuestion, QuestionMix } from "@/types/character-exam";

interface CharacterSearchResult {
  id: string;
  name: string;
  tags: string[];
  work_id: string;
  work_title: string;
  work_genres: string[];
}

export default function SimulatorPage() {
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<CharacterSearchResult[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState<CharacterSearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [questions, setQuestions] = useState<GeneratedQuestion[]>([]);
  const [mix, setMix] = useState<QuestionMix>({ ...DEFAULT_QUESTION_MIX });

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    const { data } = await supabase
      .from("official_oshi_characters")
      .select("id, name, tags, work_id, official_works(title, genres)")
      .ilike("name", `%${query.trim()}%`)
      .eq("status", "PUBLISHED")
      .limit(10);

    const results: CharacterSearchResult[] = (data ?? []).map((row) => {
      const work = Array.isArray(row.official_works)
        ? row.official_works[0]
        : row.official_works;
      return {
        id: row.id,
        name: row.name,
        tags: row.tags ?? [],
        work_id: row.work_id,
        work_title: work?.title ?? "알 수 없음",
        work_genres: work?.genres ?? [],
      };
    });
    setSearchResults(results);
    setSearching(false);
  };

  const selectCharacter = (char: CharacterSearchResult) => {
    setSelectedCharacter(char);
    setSearchResults([]);
    setQuestions([]);
  };

  const handleGenerate = async () => {
    if (!selectedCharacter) return;
    setGenerating(true);
    const result = await generateExamQuestions(
      {
        id: selectedCharacter.id,
        name: selectedCharacter.name,
        work_title: selectedCharacter.work_title,
        tags: selectedCharacter.tags,
        genres: selectedCharacter.work_genres,
      },
      mix,
      Object.values(mix).reduce((s, v) => s + (v ?? 0), 0),
    );
    setQuestions(result);
    setGenerating(false);
  };

  const mixTotal = Object.values(mix).reduce((s, v) => s + (v ?? 0), 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="border-b border-dashed border-gray-500 pb-4">
        <h2 className="text-xl font-bold">시험 시뮬레이터</h2>
        <p className="mt-1 text-sm text-gray-600">
          캐릭터를 선택해 실제로 생성될 시험 문항을 미리 확인합니다.
        </p>
      </div>

      <section className="rounded border border-dashed border-gray-500 bg-white/70 p-6">
        <h3 className="mb-4 font-semibold">캐릭터 선택</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void handleSearch()}
            className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none"
            placeholder="캐릭터 이름 검색"
          />
          <button
            type="button"
            onClick={() => void handleSearch()}
            disabled={searching}
            className="rounded border border-gray-300 bg-white px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            {searching ? "검색 중..." : "검색"}
          </button>
        </div>

        {searchResults.length > 0 && (
          <div className="mt-2 rounded border border-gray-200 bg-white">
            {searchResults.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => selectCharacter(c)}
                className="flex w-full items-center gap-3 border-b border-gray-100 px-4 py-3 text-left text-sm last:border-0 hover:bg-gray-50"
              >
                <div>
                  <span className="font-medium">{c.name}</span>
                  <span className="ml-2 text-gray-500">{c.work_title}</span>
                </div>
                <div className="ml-auto flex flex-wrap gap-1">
                  {c.tags.slice(0, 3).map((tag) => (
                    <span key={tag} className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">
                      {tag}
                    </span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        )}

        {selectedCharacter && (
          <div className="mt-3 flex items-center gap-3 rounded border border-green-200 bg-green-50 px-4 py-3">
            <div>
              <span className="font-semibold">{selectedCharacter.name}</span>
              <span className="ml-2 text-sm text-gray-600">· {selectedCharacter.work_title}</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {selectedCharacter.tags.slice(0, 5).map((tag) => (
                <span key={tag} className="rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-700">
                  {tag}
                </span>
              ))}
              {selectedCharacter.tags.length > 5 && (
                <span className="text-xs text-gray-500">+{selectedCharacter.tags.length - 5}</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setSelectedCharacter(null)}
              className="ml-auto text-xs text-gray-400 hover:text-gray-600"
            >
              변경
            </button>
          </div>
        )}
      </section>

      <section className="rounded border border-dashed border-gray-500 bg-white/70 p-6">
        <h3 className="mb-4 font-semibold">
          문항 구성 설정 (합계: {mixTotal}문항)
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {(Object.keys(QUESTION_TYPE_LABELS) as Array<keyof QuestionMix>).map((key) => (
            <div key={key}>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                {QUESTION_TYPE_LABELS[key]}
              </label>
              <input
                type="number"
                min={0}
                max={10}
                value={mix[key] ?? 0}
                onChange={(e) =>
                  setMix((prev) => ({ ...prev, [key]: parseInt(e.target.value) || 0 }))
                }
                className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm"
              />
            </div>
          ))}
        </div>
        <div className="mt-4">
          <button
            type="button"
            onClick={() => void handleGenerate()}
            disabled={!selectedCharacter || generating}
            className="rounded bg-black px-4 py-2 text-sm text-white transition-opacity hover:opacity-80 disabled:opacity-50"
          >
            {generating ? "생성 중..." : "문항 생성 미리보기"}
          </button>
        </div>
      </section>

      {questions.length > 0 && (
        <section className="rounded border border-dashed border-gray-500 bg-white/70 p-6">
          <h3 className="mb-4 font-semibold">
            생성 결과 — {questions.length}문항
          </h3>
          <div className="flex flex-col gap-6">
            {questions.map((q, idx) => (
              <div key={idx} className="rounded border border-gray-200 bg-white p-5">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium">
                    {idx + 1}번
                  </span>
                  <span className="rounded bg-gray-100 px-2 py-0.5 text-xs">
                    {QUESTION_TYPE_LABELS[q.question_type]}
                  </span>
                  <span className="rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                    {SCORING_TYPE_LABELS[q.scoring_type]}
                  </span>
                  {q.is_interpretation && (
                    <span className="rounded bg-purple-50 px-2 py-0.5 text-xs text-purple-700">
                      해석형
                    </span>
                  )}
                  <span className="ml-auto font-mono text-xs text-gray-400">
                    template: {q.template_id.slice(0, 8)}...
                  </span>
                </div>
                <p className="mb-3 font-medium">{q.question_body}</p>
                <div className="flex flex-col gap-2">
                  {q.options_snapshot.map((opt) => (
                    <div
                      key={opt.id}
                      className={`flex items-start gap-3 rounded border p-2.5 ${
                        opt.is_correct
                          ? "border-green-300 bg-green-50"
                          : "border-gray-200 bg-gray-50"
                      }`}
                    >
                      <span className="mt-0.5 shrink-0 font-bold text-gray-500">
                        {opt.label}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm">{opt.body}</p>
                        {opt.tag_payload.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {opt.tag_payload.map((tp) => (
                              <span
                                key={tp.tag}
                                className="rounded bg-gray-200 px-1.5 py-0.5 text-xs text-gray-600"
                              >
                                {tp.tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      {opt.is_correct && (
                        <span className="ml-auto shrink-0 text-xs text-green-600">정답</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {questions.length === 0 && !generating && (
            <div className="rounded border border-dashed border-yellow-400 bg-yellow-50 p-4 text-sm text-yellow-700">
              이 캐릭터에 대해 생성 가능한 문항이 없습니다. 활성화된 문항 템플릿을 추가하세요.
            </div>
          )}
        </section>
      )}

      {selectedCharacter && questions.length === 0 && !generating && (
        <div className="rounded border border-dashed border-yellow-400 bg-yellow-50 p-4 text-sm text-yellow-700">
          아직 생성된 문항이 없습니다. 위에서 &ldquo;문항 생성 미리보기&rdquo; 버튼을 눌러보세요.
          <br />
          문항이 표시되지 않으면 활성화된 문항 템플릿이 없거나 조건에 맞지 않는 것입니다.
        </div>
      )}
    </div>
  );
}
