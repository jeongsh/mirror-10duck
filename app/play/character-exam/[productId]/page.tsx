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

type Stage = "loading" | "work_pick" | "character_pick" | "intro" | "quiz" | "submitting" | "result";

interface WorkInfo {
  id: string;
  title: string;
  cover_image_url: string | null;
}

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
  const [workSearch, setWorkSearch] = useState("");
  const [workResults, setWorkResults] = useState<WorkInfo[]>([]);
  const [selectedWork, setSelectedWork] = useState<WorkInfo | null>(null);
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

      const resolveCharacter = async (charId: string): Promise<CharacterInfo | null> => {
        const { data } = await supabase
          .from("official_oshi_characters")
          .select("id, name, tags, work_id, profile_image_url, official_works(id, title, genres)")
          .eq("id", charId)
          .single();
        if (!data) return null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const row = data as any as {
          id: string; name: string; tags: string[]; work_id: string;
          profile_image_url: string | null;
          official_works: { id: string; title: string; genres: string[] } | null;
        };
        return {
          id: row.id, name: row.name,
          work_title: row.official_works?.title ?? "알 수 없음",
          work_id: row.official_works?.id ?? row.work_id,
          tags: row.tags ?? [], genres: row.official_works?.genres ?? [],
          profile_image_url: row.profile_image_url,
        };
      };

      // URL ?character= 우선
      if (characterId) {
        const c = await resolveCharacter(characterId);
        if (c) { setCharacter(c); setStage("intro"); }
        else { setStage(p.exam_type === "character_single" ? "work_pick" : "intro"); }
        return;
      }

      if (p.exam_type === "character_single") {
        // 어드민 고정 캐릭터가 있으면 바로 intro
        if (p.pinned_character_id) {
          const c = await resolveCharacter(p.pinned_character_id);
          if (c) { setCharacter(c); setStage("intro"); return; }
        }
        setStage("work_pick");
      } else if (p.exam_type === "work_unit") {
        // 어드민 고정 작품이 있으면 work_pick 건너뛰고 character_pick 으로
        if (p.pinned_work_id) {
          const { data: wData } = await supabase
            .from("official_works")
            .select("id, title, cover_image_url")
            .eq("id", p.pinned_work_id)
            .single();
          if (wData) {
            const w = wData as WorkInfo;
            setSelectedWork(w);
            const { data: chars } = await supabase
              .from("official_oshi_characters")
              .select("id, name, tags, work_id, profile_image_url, official_works(id, title, genres)")
              .eq("work_id", w.id)
              .eq("status", "PUBLISHED")
              .order("sort_order", { ascending: true })
              .limit(30);
            setCharacterResults(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ((chars ?? []) as any[]).map((row) => ({
                id: row.id, name: row.name,
                work_title: row.official_works?.title ?? w.title,
                work_id: row.official_works?.id ?? row.work_id,
                tags: row.tags ?? [], genres: row.official_works?.genres ?? [],
                profile_image_url: row.profile_image_url,
              })),
            );
            setStage("character_pick");
            return;
          }
        }
        setStage("intro");
      } else {
        setStage("intro");
      }
    };
    void init();
  }, [productId, characterId]);

  const searchWorks = async () => {
    if (!workSearch.trim()) return;
    const { data } = await supabase
      .from("official_works")
      .select("id, title, cover_image_url")
      .ilike("title", `%${workSearch.trim()}%`)
      .eq("status", "PUBLISHED")
      .order("sort_order", { ascending: true })
      .limit(8);
    setWorkResults((data ?? []) as WorkInfo[]);
  };

  const selectWork = async (w: WorkInfo) => {
    setSelectedWork(w);
    setWorkResults([]);
    setWorkSearch("");
    setCharacterSearch("");

    const { data } = await supabase
      .from("official_oshi_characters")
      .select("id, name, tags, work_id, profile_image_url, official_works(id, title, genres)")
      .eq("work_id", w.id)
      .eq("status", "PUBLISHED")
      .order("sort_order", { ascending: true })
      .limit(30);

    setCharacterResults(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((data ?? []) as any[]).map((row) => ({
        id: row.id as string,
        name: row.name as string,
        work_title: (row.official_works?.title as string | undefined) ?? w.title,
        work_id: (row.official_works?.id as string | undefined) ?? (row.work_id as string),
        tags: (row.tags as string[]) ?? [],
        genres: (row.official_works?.genres as string[] | undefined) ?? [],
        profile_image_url: row.profile_image_url as string | null,
      })),
    );
    setStage("character_pick");
  };

  const searchCharacters = async () => {
    if (!selectedWork) return;
    const { data } = await supabase
      .from("official_oshi_characters")
      .select("id, name, tags, work_id, profile_image_url, official_works(id, title, genres)")
      .eq("work_id", selectedWork.id)
      .ilike("name", `%${characterSearch.trim()}%`)
      .eq("status", "PUBLISHED")
      .limit(20);

    setCharacterResults(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((data ?? []) as any[]).map((row) => ({
        id: row.id as string,
        name: row.name as string,
        work_title: (row.official_works?.title as string | undefined) ?? selectedWork.title,
        work_id: (row.official_works?.id as string | undefined) ?? (row.work_id as string),
        tags: (row.tags as string[]) ?? [],
        genres: (row.official_works?.genres as string[] | undefined) ?? [],
        profile_image_url: row.profile_image_url as string | null,
      })),
    );
  };

  const selectCharacter = (c: CharacterInfo) => {
    setCharacter(c);
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
  const answeredCount = Object.keys(answers).length;
  const CIRCLE = ["①", "②", "③", "④", "⑤"];

  if (stage === "loading") {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-gray-400">
        로딩 중...
      </div>
    );
  }

  if (stage === "work_pick") {
    return (
      <div className="mx-auto max-w-xl px-4 py-10">
        <div className="mb-6 text-center">
          <p className="text-sm text-gray-500">{product?.title}</p>
          <h1 className="mt-1 text-xl font-bold">시험 볼 작품을 선택하세요</h1>
        </div>
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
                onClick={() => void selectWork(w)}
                className="flex w-full items-center gap-3 border-b border-gray-100 px-4 py-3 text-left text-sm last:border-0 hover:bg-gray-50"
              >
                {w.cover_image_url ? (
                  <img
                    src={w.cover_image_url}
                    alt=""
                    className="h-10 w-8 rounded object-cover shrink-0"
                  />
                ) : (
                  <div className="flex h-10 w-8 shrink-0 items-center justify-center rounded bg-gray-200 text-xs text-gray-500">
                    ?
                  </div>
                )}
                <div className="font-medium">{w.title}</div>
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

  if (stage === "character_pick" && selectedWork) {
    const filtered = characterSearch.trim()
      ? characterResults.filter((c) => c.name.includes(characterSearch.trim()))
      : characterResults;

    return (
      <div className="mx-auto max-w-xl px-4 py-10">
        <div className="mb-6 text-center">
          <p className="text-sm text-gray-500">{product?.title}</p>
          <h1 className="mt-1 text-xl font-bold">시험 볼 캐릭터를 선택하세요</h1>
        </div>

        <div className="mb-4 flex items-center justify-between rounded border border-gray-200 bg-gray-50 px-4 py-2.5">
          <div className="flex items-center gap-2">
            {selectedWork.cover_image_url && (
              <img src={selectedWork.cover_image_url} alt="" className="h-6 w-5 rounded object-cover" />
            )}
            <span className="text-sm font-medium">{selectedWork.title}</span>
          </div>
          <button
            type="button"
            onClick={() => { setStage("work_pick"); setSelectedWork(null); setCharacterResults([]); }}
            className="text-xs text-gray-400 hover:text-gray-600 hover:underline"
          >
            변경
          </button>
        </div>

        {characterResults.length > 5 && (
          <div className="mb-2">
            <input
              type="text"
              value={characterSearch}
              onChange={(e) => setCharacterSearch(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none"
              placeholder="캐릭터 이름으로 필터"
            />
          </div>
        )}

        {filtered.length > 0 ? (
          <div className="rounded border border-gray-200 bg-white shadow-sm">
            {filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => selectCharacter(c)}
                className="flex w-full items-center gap-3 border-b border-gray-100 px-4 py-3 text-left text-sm last:border-0 hover:bg-gray-50"
              >
                {c.profile_image_url ? (
                  <img src={c.profile_image_url} alt="" className="h-9 w-9 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-200 text-xs text-gray-500">
                    {c.name[0]}
                  </div>
                )}
                <div className="font-medium">{c.name}</div>
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-center text-sm text-gray-400">이 작품에 등록된 캐릭터가 없습니다.</p>
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
      <div className="mx-auto max-w-sm px-4 py-10">
        <div className="border-2 border-black bg-white">
          {/* 수험표 헤더 */}
          <div className="border-b-2 border-black px-5 py-3 text-center">
            <p className="text-[10px] tracking-widest text-gray-500">2026학년도</p>
            <h1 className="text-lg font-black tracking-tight leading-tight">{product.title}</h1>
            <p className="mt-0.5 text-[11px] text-gray-500">수험표</p>
          </div>

          {/* 사진 + 정보 */}
          <div className="flex border-b border-black">
            <div className="flex w-24 shrink-0 items-center justify-center border-r border-black p-3">
              {character.profile_image_url ? (
                <img src={character.profile_image_url} alt={character.name}
                  className="h-20 w-16 object-cover border border-gray-300" />
              ) : (
                <div className="h-20 w-16 border border-gray-300 flex items-center justify-center text-xs text-gray-400">사진</div>
              )}
            </div>
            <div className="flex-1 divide-y divide-gray-200 text-sm">
              {[
                ["성  명", character.name],
                ["작  품", character.work_title],
                ["문항수", `${product.question_count}문항`],
                ["시  간", `약 ${Math.ceil((product.question_count * 20) / 60)}분`],
              ].map(([label, value]) => (
                <div key={label} className="flex px-3 py-1.5 gap-2">
                  <span className="w-12 shrink-0 text-[11px] text-gray-500">{label}</span>
                  <span className="font-medium text-[13px]">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 주의사항 */}
          <div className="border-b border-black px-4 py-2.5">
            <p className="text-[10px] text-gray-500 leading-relaxed">
              ※ 시험 시작 전 수험번호와 성명을 확인하시오.<br />
              ※ 모든 문항에 답한 후 제출하시오.
              {product.spoiler_level > 0 && <><br />※ 스포일러 내용이 포함될 수 있습니다.</>}
            </p>
          </div>

          {/* 시작 버튼 */}
          <div className="px-4 py-4 text-center">
            <button type="button" onClick={() => void startExam()}
              className="w-full border-2 border-black bg-black py-2.5 text-sm font-bold text-white hover:bg-white hover:text-black transition-colors">
              시험 시작
            </button>
            {product.exam_type === "character_single" && !product.pinned_character_id && (
              <div className="mt-2.5 flex justify-center gap-3 text-[11px] text-gray-400">
                <button type="button" onClick={() => setStage("character_pick")} className="hover:underline">다른 캐릭터</button>
                <span>·</span>
                <button type="button" onClick={() => { setStage("work_pick"); setSelectedWork(null); setCharacter(null); setCharacterResults([]); }} className="hover:underline">다른 작품</button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if ((stage === "quiz" || stage === "submitting") && questions.length > 0 && character) {
    const half = Math.ceil(questions.length / 2);
    const leftCol = questions.slice(0, half);
    const rightCol = questions.slice(half);

    const QuestionBlock = ({ q, idx }: { q: typeof questions[0]; idx: number }) => (
      <div className="py-3 border-b border-gray-200 last:border-b-0">
        <p className="text-[13px] font-bold leading-relaxed mb-2">
          {idx + 1}. {q.question_body}
        </p>
        <div className="pl-1 flex flex-col gap-1">
          {q.options_snapshot.map((opt, optIdx) => {
            const selected = answers[idx] === optIdx;
            return (
              <button key={opt.id} type="button"
                onClick={() => setAnswers((prev) => ({ ...prev, [idx]: optIdx }))}
                className="flex items-start gap-2 text-left group"
              >
                <span className={`mt-0.5 shrink-0 w-[18px] h-[18px] flex items-center justify-center rounded-full border text-[11px] font-bold transition-colors
                  ${selected ? "bg-black text-white border-black" : "border-gray-500 text-gray-600 group-hover:border-black"}`}>
                  {optIdx + 1}
                </span>
                <span className={`text-[12px] leading-relaxed ${selected ? "font-bold" : "text-gray-700"}`}>
                  {opt.body}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );

    return (
      <div className="mx-auto max-w-3xl px-3 py-6">
        <div className="border-2 border-black bg-white">

          {/* 시험지 헤더 */}
          <div className="flex items-center border-b-2 border-black">
            <div className="w-20 shrink-0 border-r border-black px-3 py-2">
              <p className="text-[10px] text-gray-500">제 1 교시</p>
            </div>
            <div className="flex-1 py-2 text-center">
              <h1 className="text-2xl font-black tracking-widest">{product?.title ?? "중간고사"}</h1>
            </div>
            <div className="w-20 shrink-0 border-l border-black px-3 py-2 text-right">
              <span className="inline-block border border-black px-1.5 py-0.5 text-[11px] font-bold">㉮형</span>
              <p className="mt-0.5 text-[10px] text-gray-400">1 / 1</p>
            </div>
          </div>

          {/* 수험 정보 */}
          <div className="flex border-b border-black text-[12px]">
            <div className="flex flex-1 items-center gap-2 border-r border-black px-4 py-1.5">
              <span className="shrink-0 text-gray-500">수험번호</span>
              <div className="flex gap-0.5">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-5 w-4 border border-gray-400" />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 px-4 py-1.5">
              <span className="shrink-0 text-gray-500">성  명</span>
              <span className="font-bold">{character.name}</span>
            </div>
          </div>

          {/* 진행 상황 + 지시문 */}
          <div className="flex items-center justify-between border-b border-gray-300 bg-gray-50 px-4 py-1.5">
            <p className="text-[11px] text-gray-600">
              ※ 각 문제의 보기 중에서 물음에 가장 합당한 답을 고르시오.
            </p>
            <p className="shrink-0 text-[11px] font-bold text-gray-700">
              {answeredCount} / {questions.length} 완료
            </p>
          </div>

          {/* 문제 영역 — 2열 */}
          <div className="grid grid-cols-1 md:grid-cols-2 md:divide-x md:divide-black">
            <div className="px-4 divide-y divide-gray-100">
              {leftCol.map((q, i) => <QuestionBlock key={i} q={q} idx={i} />)}
            </div>
            <div className="px-4 divide-y divide-gray-100 border-t border-black md:border-t-0">
              {rightCol.map((q, i) => <QuestionBlock key={i + half} q={q} idx={i + half} />)}
            </div>
          </div>

          {/* 제출 */}
          <div className="border-t-2 border-black flex items-center justify-between px-4 py-3">
            <p className="text-[11px] text-gray-400">
              {allAnswered ? "모든 문항에 답했습니다." : `${questions.length - answeredCount}문항 미완료`}
            </p>
            <button type="button" onClick={() => void submitExam()}
              disabled={!allAnswered || stage === "submitting"}
              className="border-2 border-black bg-black px-6 py-2 text-sm font-bold text-white hover:bg-white hover:text-black transition-colors disabled:opacity-30">
              {stage === "submitting" ? "채점 중..." : "답안 제출"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (stage === "result" && result && character) {
    return (
      <div className="mx-auto max-w-md px-4 py-10">
        <div className="border-2 border-black bg-white">

          {/* 성적표 헤더 */}
          <div className="border-b-2 border-black px-5 py-3 text-center">
            <p className="text-[10px] tracking-widest text-gray-500">2026학년도</p>
            <h2 className="text-lg font-black tracking-tight">{product?.title ?? "중간고사"} 성적표</h2>
          </div>

          {/* 수험자 정보 */}
          <div className="grid grid-cols-2 border-b border-black text-[12px]">
            {[
              ["성  명", character.name],
              ["작  품", character.work_title],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center gap-2 border-r border-b border-gray-300 last:border-r-0 px-4 py-2">
                <span className="w-10 shrink-0 text-gray-500">{label}</span>
                <span className="font-bold truncate">{value}</span>
              </div>
            ))}
          </div>

          {/* 점수 + 등급 */}
          <div className="flex border-b-2 border-black">
            <div className="flex flex-1 flex-col items-center justify-center border-r-2 border-black py-6">
              <p className="text-[10px] text-gray-500 mb-1">원점수</p>
              <p className="text-6xl font-black leading-none">{result.score}</p>
              <p className="text-sm text-gray-400 mt-1">/ 100</p>
            </div>
            <div className="flex flex-1 flex-col items-center justify-center py-6 gap-2">
              <p className="text-[10px] text-gray-500">등급</p>
              <div className="border-2 border-black px-4 py-1">
                <span className="text-xl font-black">{result.grade}</span>
              </div>
              <p className="text-[11px] font-semibold text-gray-700">{result.grade_title}</p>
              <p className="text-[10px] text-gray-400">{result.percentile_label}</p>
            </div>
          </div>

          {/* 총평 */}
          <div className="border-b border-black px-5 py-4">
            <p className="text-[10px] font-bold tracking-widest text-gray-500 mb-2">■ 총평</p>
            <p className="text-[12px] leading-relaxed text-gray-700">{result.grade_description}</p>
          </div>

          {/* 생활기록부 */}
          <div className="border-b border-black bg-amber-50 px-5 py-4">
            <p className="text-[10px] font-bold tracking-widest text-amber-700 mb-2">■ 생활기록부</p>
            <p className="text-[12px] leading-relaxed text-gray-800 whitespace-pre-wrap">{result.school_record_comment}</p>
          </div>

          {/* 해석 키워드 */}
          {result.top_tags.length > 0 && (
            <div className="border-b border-black px-5 py-4">
              <p className="text-[10px] font-bold tracking-widest text-gray-500 mb-2">■ 해석 키워드</p>
              <div className="flex flex-wrap gap-1.5">
                {result.top_tags.map((tag) => (
                  <span key={tag} className="border border-black px-2.5 py-0.5 text-[11px] font-medium">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 액션 */}
          <div className="px-5 py-4 flex flex-col gap-2">
            <button type="button"
              onClick={() => {
                const text = `[캐릭터 탐구 중간고사]\n${character.name} (${character.work_title})\n\n점수: ${result.score}점  등급: ${result.grade}\n${result.percentile_label}\n\n${result.grade_title}`;
                void navigator.clipboard.writeText(text);
                alert("결과가 클립보드에 복사되었습니다!");
              }}
              className="w-full border border-black py-2 text-[12px] font-bold hover:bg-gray-50">
              결과 복사하기
            </button>
            <button type="button"
              onClick={() => { setStage("intro"); setAnswers({}); setCurrentIdx(0); }}
              className="w-full border-2 border-black bg-black py-2 text-[12px] font-bold text-white hover:bg-white hover:text-black transition-colors">
              다시 풀기
            </button>
            <Link href="/play/character-exam"
              className="block w-full border border-gray-300 py-2 text-center text-[12px] text-gray-500 hover:bg-gray-50">
              다른 시험 보기
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
