"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useAuthUser } from "@/lib/supabase/useAuthUser";
import { generateExamQuestions } from "@/lib/character-exam/generator";
import { calculateResult } from "@/lib/character-exam/scorer";
import { DEFAULT_QUESTION_MIX } from "@/lib/character-exam/constants";
import type {
  CharacterExamProduct,
  CharacterExamResultTemplate,
  ExamResult,
  GeneratedQuestion,
  QuestionOptionSnapshot,
} from "@/types/character-exam";

type Stage = "loading" | "character_pick" | "intro" | "quiz" | "submitting" | "result";

interface CharacterInfo {
  id: string;
  name: string;
  work_title: string;
  work_id: string;
  tags: string[];
  genres: string[];
  profile_image_url: string | null;
}

export default function ExamPlayPage() {
  const { productId } = useParams<{ productId: string }>();
  const searchParams = useSearchParams();
  const authUser = useAuthUser();

  const [stage, setStage] = useState<Stage>("loading");
  const [product, setProduct] = useState<CharacterExamProduct | null>(null);
  const [character, setCharacter] = useState<CharacterInfo | null>(null);
  const [resultTemplate, setResultTemplate] = useState<CharacterExamResultTemplate | null>(null);
  const [questions, setQuestions] = useState<GeneratedQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<ExamResult | null>(null);
  const [characterSearch, setCharacterSearch] = useState("");
  const [characterResults, setCharacterResults] = useState<CharacterInfo[]>([]);
  const sessionIdRef = useRef<string | null>(null);
  const questionStartRef = useRef<number>(Date.now());

  const characterId = searchParams.get("character");

  useEffect(() => {
    const init = async () => {
      const { data: productData, error: productError } = await supabase
        .from("character_exam_products")
        .select("*")
        .eq("id", productId)
        .eq("status", "published")
        .single();

      if (productError || !productData) {
        setStage("loading");
        return;
      }
      const p = productData as CharacterExamProduct;
      setProduct(p);

      const { data: rtData } = p.result_template_id
        ? await supabase
            .from("character_exam_result_templates")
            .select("*")
            .eq("id", p.result_template_id)
            .single()
        : await supabase
            .from("character_exam_result_templates")
            .select("*")
            .order("created_at", { ascending: true })
            .limit(1)
            .single();
      setResultTemplate(rtData as CharacterExamResultTemplate);

      if (characterId) {
        const { data: charData } = await supabase
          .from("official_oshi_characters")
          .select("id, name, tags, work_id, profile_image_url, official_works(id, title, genres)")
          .eq("id", characterId)
          .single();
        if (charData) {
          const row = charData as {
            id: string;
            name: string;
            tags: string[];
            work_id: string;
            profile_image_url: string | null;
            official_works: { id: string; title: string; genres: string[] } | null;
          };
          setCharacter({
            id: row.id,
            name: row.name,
            work_title: row.official_works?.title ?? "알 수 없음",
            work_id: row.official_works?.id ?? row.work_id,
            tags: row.tags ?? [],
            genres: row.official_works?.genres ?? [],
            profile_image_url: row.profile_image_url,
          });
          setStage("intro");
        } else {
          setStage("character_pick");
        }
      } else if (p.exam_type === "character_single") {
        setStage("character_pick");
      } else {
        setStage("intro");
      }
    };
    void init();
  }, [productId, characterId]);

  const searchCharacters = async () => {
    if (!characterSearch.trim()) return;
    const { data } = await supabase
      .from("official_oshi_characters")
      .select("id, name, tags, work_id, profile_image_url, official_works(id, title, genres)")
      .ilike("name", `%${characterSearch.trim()}%`)
      .eq("status", "PUBLISHED")
      .limit(8);

    setCharacterResults(
      (data ?? []).map((row: {
        id: string;
        name: string;
        tags: string[];
        work_id: string;
        profile_image_url: string | null;
        official_works: { id: string; title: string; genres: string[] } | null;
      }) => ({
        id: row.id,
        name: row.name,
        work_title: row.official_works?.title ?? "알 수 없음",
        work_id: row.official_works?.id ?? row.work_id,
        tags: row.tags ?? [],
        genres: row.official_works?.genres ?? [],
        profile_image_url: row.profile_image_url,
      })),
    );
  };

  const selectCharacter = (c: CharacterInfo) => {
    setCharacter(c);
    setCharacterResults([]);
    setStage("intro");
  };

  const startExam = async () => {
    if (!character || !product) return;
    setStage("loading");

    const generated = await generateExamQuestions(
      {
        id: character.id,
        name: character.name,
        work_title: character.work_title,
        tags: character.tags,
        genres: character.genres,
      },
      DEFAULT_QUESTION_MIX,
      product.question_count,
    );

    if (generated.length === 0) {
      alert("아직 이 캐릭터에 대한 문항이 준비되지 않았습니다. 다른 캐릭터를 선택해보세요.");
      setStage("character_pick");
      return;
    }

    const { data: sessionData } = await supabase
      .from("character_exam_sessions")
      .insert({
        user_id: authUser?.id ?? null,
        product_id: product.id,
        character_id: character.id,
        work_id: character.work_id,
      })
      .select("id")
      .single();

    if (sessionData) {
      sessionIdRef.current = sessionData.id;

      const questionRows = generated.map((q, idx) => ({
        session_id: sessionData.id,
        template_id: q.template_id,
        character_id: q.character_id,
        question_body: q.question_body,
        options_snapshot: q.options_snapshot,
        sort_order: idx,
      }));
      await supabase.from("character_exam_questions").insert(questionRows);
    }

    setQuestions(generated);
    setCurrentIdx(0);
    setAnswers({});
    questionStartRef.current = Date.now();
    setStage("quiz");
  };

  const selectAnswer = (optionIdx: number) => {
    setAnswers((prev) => ({ ...prev, [currentIdx]: optionIdx }));
  };

  const nextQuestion = () => {
    if (currentIdx < questions.length - 1) {
      setCurrentIdx((i) => i + 1);
      questionStartRef.current = Date.now();
    }
  };

  const submitExam = async () => {
    if (!resultTemplate) return;
    setStage("submitting");

    const responses = questions.map((q, idx) => {
      const optIdx = answers[idx] ?? 0;
      const opt = q.options_snapshot[optIdx];
      return {
        scoring_type: q.scoring_type,
        selected_option: opt,
      };
    });

    const examResult = calculateResult(responses, resultTemplate);
    setResult(examResult);

    if (sessionIdRef.current) {
      const sessionId = sessionIdRef.current;

      await supabase
        .from("character_exam_sessions")
        .update({
          completed_at: new Date().toISOString(),
          score: examResult.score,
          grade: examResult.grade,
          percentile: examResult.percentile,
          result_snapshot: examResult,
        })
        .eq("id", sessionId);

      const { data: savedQuestions } = await supabase
        .from("character_exam_questions")
        .select("id, sort_order")
        .eq("session_id", sessionId)
        .order("sort_order");

      if (savedQuestions && character) {
        const responseRows = questions.map((q, idx) => {
          const optIdx = answers[idx] ?? 0;
          const opt = q.options_snapshot[optIdx];
          const qRow = savedQuestions[idx];
          return {
            session_id: sessionId,
            question_id: qRow?.id ?? sessionId,
            option_id: opt.id,
            response_time_ms: null,
            score_delta: opt.score,
            tag_payload: opt.tag_payload,
          };
        });
        await supabase.from("character_exam_responses").insert(responseRows);

        const tagSignalRows = responses.flatMap((r) =>
          (r.selected_option.tag_payload ?? []).map((tp) => ({
            character_id: character.id,
            tag: tp.tag,
            weight: tp.weight,
            session_id: sessionId,
          })),
        );
        if (tagSignalRows.length > 0) {
          await supabase.from("character_tag_signals").insert(tagSignalRows);
        }

        if (authUser?.id) {
          const prefRows = responses.flatMap((r) =>
            (r.selected_option.tag_payload ?? []).map((tp) => ({
              user_id: authUser.id,
              tag: tp.tag,
              weight: tp.weight,
            })),
          );
          if (prefRows.length > 0) {
            await supabase.from("user_preference_signals").insert(prefRows);
          }
        }
      }
    }

    setStage("result");
  };

  const currentQuestion = questions[currentIdx];
  const selectedOptIdx = answers[currentIdx];
  const progress = ((currentIdx + 1) / questions.length) * 100;
  const allAnswered = questions.length > 0 && Object.keys(answers).length === questions.length;

  if (stage === "loading") {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-gray-400">
        로딩 중...
      </div>
    );
  }

  if (stage === "character_pick") {
    return (
      <div className="mx-auto max-w-xl px-4 py-10">
        <div className="mb-6 text-center">
          <p className="text-sm text-gray-500">{product?.title}</p>
          <h1 className="mt-1 text-xl font-bold">시험 볼 캐릭터를 선택하세요</h1>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={characterSearch}
            onChange={(e) => setCharacterSearch(e.target.value)}
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
        {characterResults.length > 0 && (
          <div className="mt-2 rounded border border-gray-200 bg-white shadow-sm">
            {characterResults.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => selectCharacter(c)}
                className="flex w-full items-center gap-3 border-b border-gray-100 px-4 py-3 text-left text-sm last:border-0 hover:bg-gray-50"
              >
                {c.profile_image_url ? (
                  <img
                    src={c.profile_image_url}
                    alt=""
                    className="h-8 w-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-200 text-xs text-gray-500">
                    {c.name[0]}
                  </div>
                )}
                <div>
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-gray-400">{c.work_title}</div>
                </div>
              </button>
            ))}
          </div>
        )}
        <div className="mt-4 text-center">
          <Link href="/play/character-exam" className="text-sm text-gray-400 hover:underline">
            시험 목록으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  if (stage === "intro" && character && product) {
    return (
      <div className="mx-auto max-w-md px-4 py-10">
        <div className="rounded border border-gray-200 bg-white p-8 text-center shadow-sm">
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-gray-400">
            2026학년도
          </p>
          <h1 className="mb-2 text-xl font-bold">{product.title}</h1>
          <p className="mb-6 text-sm text-gray-500">{product.description}</p>

          {character.profile_image_url && (
            <img
              src={character.profile_image_url}
              alt={character.name}
              className="mx-auto mb-4 h-24 w-24 rounded-full border-2 border-gray-200 object-cover"
            />
          )}
          <p className="text-lg font-bold">{character.name}</p>
          <p className="mb-6 text-sm text-gray-400">{character.work_title}</p>

          <div className="mb-6 flex justify-center gap-6 text-sm text-gray-500">
            <div className="text-center">
              <div className="text-2xl font-bold text-black">{product.question_count}</div>
              <div className="text-xs text-gray-400">문항</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-black">
                약 {Math.ceil((product.question_count * 20) / 60)}분
              </div>
              <div className="text-xs text-gray-400">예상 시간</div>
            </div>
          </div>

          {product.spoiler_level > 0 && (
            <div className="mb-4 rounded bg-orange-50 p-3 text-sm text-orange-700">
              이 시험에는 스포일러 내용이 포함될 수 있습니다.
            </div>
          )}

          <button
            type="button"
            onClick={() => void startExam()}
            className="w-full rounded bg-black py-3 text-sm font-semibold text-white transition-opacity hover:opacity-80"
          >
            시험 시작
          </button>
          <div className="mt-3">
            {product.exam_type === "character_single" && (
              <button
                type="button"
                onClick={() => setStage("character_pick")}
                className="text-sm text-gray-400 hover:underline"
              >
                다른 캐릭터 선택
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if ((stage === "quiz" || stage === "submitting") && currentQuestion && character) {
    return (
      <div className="mx-auto max-w-xl px-4 py-8">
        <div className="mb-4">
          <div className="mb-1 flex items-center justify-between text-xs text-gray-400">
            <span>
              {currentIdx + 1} / {questions.length}
            </span>
            <span>{character.name} · {character.work_title}</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-gray-200">
            <div
              className="h-1.5 rounded-full bg-black transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="rounded border border-gray-200 bg-white p-6 shadow-sm">
          <p className="mb-6 text-base font-semibold leading-relaxed">
            {currentIdx + 1}. {currentQuestion.question_body}
          </p>

          <div className="flex flex-col gap-2">
            {currentQuestion.options_snapshot.map((opt, optIdx) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => selectAnswer(optIdx)}
                className={`flex items-start gap-3 rounded border p-3.5 text-left text-sm transition-all ${
                  selectedOptIdx === optIdx
                    ? "border-black bg-black text-white"
                    : "border-gray-200 hover:border-gray-400"
                }`}
              >
                <span className="mt-0.5 shrink-0 font-bold">{opt.label}</span>
                <span className="leading-relaxed">{opt.body}</span>
              </button>
            ))}
          </div>

          <div className="mt-6 flex justify-between">
            {currentIdx > 0 ? (
              <button
                type="button"
                onClick={() => setCurrentIdx((i) => i - 1)}
                className="text-sm text-gray-400 hover:underline"
              >
                이전
              </button>
            ) : (
              <div />
            )}

            {currentIdx < questions.length - 1 ? (
              <button
                type="button"
                onClick={nextQuestion}
                disabled={selectedOptIdx === undefined}
                className="rounded bg-black px-5 py-2 text-sm text-white disabled:opacity-30"
              >
                다음 문항
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void submitExam()}
                disabled={!allAnswered || stage === "submitting"}
                className="rounded bg-black px-5 py-2 text-sm text-white disabled:opacity-30"
              >
                {stage === "submitting" ? "채점 중..." : "제출하기"}
              </button>
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1">
          {questions.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setCurrentIdx(idx)}
              className={`h-6 w-6 rounded-full text-xs font-medium transition-colors ${
                idx === currentIdx
                  ? "bg-black text-white"
                  : answers[idx] !== undefined
                    ? "bg-gray-700 text-white"
                    : "bg-gray-200 text-gray-500"
              }`}
            >
              {idx + 1}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (stage === "result" && result && character) {
    return (
      <div className="mx-auto max-w-md px-4 py-10">
        <div className="rounded border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-dashed border-gray-200 p-6 text-center">
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-gray-400">
              2026학년도 캐릭터 탐구 중간고사
            </p>
            <p className="mt-1 text-sm font-medium text-gray-600">
              {character.name} · {character.work_title}
            </p>
          </div>

          <div className="p-6 text-center">
            <div className="mb-4">
              <div className="text-6xl font-black">{result.score}</div>
              <div className="text-lg text-gray-400">/ 100</div>
            </div>

            <div className="mb-4 inline-block rounded-full border-2 border-black px-4 py-1 text-sm font-bold">
              {result.grade}
            </div>

            <p className="text-sm font-semibold text-gray-700">{result.grade_title}</p>
            <p className="mt-1 text-xs text-gray-400">{result.percentile_label}</p>
          </div>

          <div className="border-t border-dashed border-gray-200 p-6">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
              평가
            </p>
            <p className="text-sm leading-relaxed text-gray-700">{result.grade_description}</p>
          </div>

          <div className="border-t border-dashed border-gray-200 bg-amber-50 p-6">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-700">
              생활기록부
            </p>
            <p className="text-sm leading-relaxed text-gray-800 whitespace-pre-wrap">
              {result.school_record_comment}
            </p>
          </div>

          {result.top_tags.length > 0 && (
            <div className="border-t border-dashed border-gray-200 p-6">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                내 해석 키워드
              </p>
              <div className="flex flex-wrap gap-1.5">
                {result.top_tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-gray-300 bg-gray-100 px-3 py-1 text-xs text-gray-700"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-gray-200 p-6">
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  const text = `[캐릭터 탐구 중간고사]\n${character.name} (${character.work_title})\n\n점수: ${result.score}점\n등급: ${result.grade}\n${result.percentile_label}\n\n${result.grade_title}`;
                  void navigator.clipboard.writeText(text);
                  alert("결과가 클립보드에 복사되었습니다!");
                }}
                className="w-full rounded border border-gray-300 py-2.5 text-sm hover:bg-gray-50"
              >
                결과 복사하기
              </button>
              <button
                type="button"
                onClick={() => {
                  setStage("intro");
                  setAnswers({});
                  setCurrentIdx(0);
                }}
                className="w-full rounded bg-black py-2.5 text-sm text-white hover:opacity-80"
              >
                다시 풀기
              </button>
              <Link
                href="/play/character-exam"
                className="block w-full rounded border border-gray-200 py-2.5 text-center text-sm text-gray-600 hover:bg-gray-50"
              >
                다른 시험 보기
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
