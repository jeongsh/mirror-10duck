"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useAuthUser } from "@/lib/supabase/useAuthUser";
import {
  fetchOtakuTypeResult,
  upsertOtakuTypeResult,
} from "@/lib/supabase/otakuTypeResults";
import {
  FORTUNE_STAGE_BG,
  type FortuneMotionTrigger,
} from "@/lib/fortune/fortuneLive2DStage";

const FortuneStage = dynamic(
  () => import("@/components/play/fortune/FortuneLive2DStage"),
  {
    ssr: false,
    loading: () => (
      <div style={{ aspectRatio: "480 / 540", background: FORTUNE_STAGE_BG }} className="w-full" />
    ),
  }
);

// ── Typewriter ────────────────────────────────────────────────
function useTypewriter(text: string, speed = 26) {
  const [shown, setShown] = useState("");
  useEffect(() => {
    setShown("");
    if (!text) return;
    let i = 0;
    const id = setInterval(() => {
      i++;
      setShown(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);
  return { shown, done: shown.length >= text.length };
}

// ── Types ──────────────────────────────────────────────────────
interface OptionData {
  text: string;
  score: 0 | 1 | 2 | 3;
  reaction: string;
  expressionId: string;
  motionGroup: string;
  motionIndex: number;
}

interface QuestionData {
  num: number;
  dialogue: string;
  options: OptionData[];
}

interface TierData {
  minScore: number;
  code: string;
  badge: string;
  emoji: string;
  color: string;
  bg: string;
  title: string;
  sub: string;
  traits: [string, string, string];
  dialogue: string;
  expressionId: string;
  motionGroup: string;
  motionIndex: number;
}

type GamePhase = "intro" | "quiz" | "result";
type QuizStep = "asking" | "choosing" | "reacting";

// ── Data ───────────────────────────────────────────────────────
const QUESTIONS: QuestionData[] = [
  {
    num: 1,
    dialogue: "첫 번째 질문이에요. 한 주에 애니를 얼마나 보고 있어요?",
    options: [
      { text: "거의 안 봐요. 생각날 때 가끔요.", score: 0, reaction: "으음... 그렇군요.", expressionId: "exp_05", motionGroup: "Idle", motionIndex: 0 },
      { text: "1-2편 정도는 챙겨 봐요.", score: 1, reaction: "입문은 한 편이에요.", expressionId: "exp_01", motionGroup: "Idle", motionIndex: 0 },
      { text: "5편 이상, 여러 작품 동시 진행이에요.", score: 2, reaction: "꽤 많이 챙겨 보는 편이네요.", expressionId: "exp_03", motionGroup: "", motionIndex: 1 },
      { text: "매일 최소 2시간 이상이에요.", score: 3, reaction: "이미 루틴이 된 거군요. 인정해요.", expressionId: "exp_04", motionGroup: "", motionIndex: 3 },
    ],
  },
  {
    num: 2,
    dialogue: "두 번째. 소장 중인 굿즈나 피규어가 있나요?",
    options: [
      { text: "없어요. 딱히 사고 싶지도 않아요.", score: 0, reaction: "현실적이네요.", expressionId: "exp_05", motionGroup: "Idle", motionIndex: 0 },
      { text: "마음에 드는 건 하나둘 샀어요.", score: 1, reaction: "조금씩 모으고 있는 거군요.", expressionId: "exp_01", motionGroup: "Idle", motionIndex: 0 },
      { text: "선반 하나는 채웠어요.", score: 2, reaction: "꽤 모았네요. 선반이 꽉 찼군요.", expressionId: "exp_03", motionGroup: "", motionIndex: 2 },
      { text: "방 전체가 반은 굿즈예요.", score: 3, reaction: "...방이요?! 그게 진짜 오타쿠예요.", expressionId: "exp_04", motionGroup: "", motionIndex: 3 },
    ],
  },
  {
    num: 3,
    dialogue: "세 번째. 좋아하는 성우를 알고 있어요?",
    options: [
      { text: "성우가 누군지 잘 모르겠어요.", score: 0, reaction: "그렇군요.", expressionId: "exp_05", motionGroup: "Idle", motionIndex: 0 },
      { text: "유명한 분 몇 명은 알아요.", score: 1, reaction: "조금은 아는군요.", expressionId: "exp_01", motionGroup: "Idle", motionIndex: 0 },
      { text: "좋아하는 성우 탑 5는 확실히 있어요.", score: 2, reaction: "탑 5라니... 취향이 확실한 편이네요.", expressionId: "exp_03", motionGroup: "", motionIndex: 1 },
      { text: "생일이랑 출연작 다 외우고 있어요.", score: 3, reaction: "생일까지요?! 그건 찐이에요.", expressionId: "exp_04", motionGroup: "", motionIndex: 3 },
    ],
  },
  {
    num: 4,
    dialogue: "네 번째. 같은 작품을 반복해서 본 적 있어요?",
    options: [
      { text: "한 번 보면 다음 작품으로 가요.", score: 0, reaction: "효율적인 감상 방식이네요.", expressionId: "exp_05", motionGroup: "Idle", motionIndex: 0 },
      { text: "좋아하는 건 두 번은 봐요.", score: 1, reaction: "두 번은 볼 만큼 좋아한다는 거네요.", expressionId: "exp_01", motionGroup: "Idle", motionIndex: 0 },
      { text: "명작이면 3회 이상은 당연히 봐요.", score: 2, reaction: "3회 이상이라니, 확실히 좋아하는 거네요.", expressionId: "exp_03", motionGroup: "", motionIndex: 2 },
      { text: "대사를 외울 때까지 돌려봐요.", score: 3, reaction: "...외울 때까지요. 진짜예요.", expressionId: "exp_04", motionGroup: "", motionIndex: 3 },
    ],
  },
  {
    num: 5,
    dialogue: "다섯 번째. 오프라인 이벤트에 가본 적 있어요?",
    options: [
      { text: "딱히 가보고 싶다는 생각이 없어요.", score: 0, reaction: "그렇군요.", expressionId: "exp_05", motionGroup: "Idle", motionIndex: 0 },
      { text: "한두 번 다녀온 적은 있어요.", score: 1, reaction: "한두 번은 가봤군요.", expressionId: "exp_01", motionGroup: "Idle", motionIndex: 0 },
      { text: "자주 챙겨서 가는 편이에요.", score: 2, reaction: "자주 가는 편이라니, 적극적이네요.", expressionId: "exp_03", motionGroup: "", motionIndex: 1 },
      { text: "원정 포함, 빠진 적이 거의 없어요.", score: 3, reaction: "원정까지요... 정말 진심이군요.", expressionId: "exp_04", motionGroup: "", motionIndex: 3 },
    ],
  },
  {
    num: 6,
    dialogue: "여섯 번째. 애니 OST나 애니송을 자주 찾아 들어요?",
    options: [
      { text: "노래까지 찾아 듣진 않아요.", score: 0, reaction: "그렇군요.", expressionId: "exp_05", motionGroup: "Idle", motionIndex: 0 },
      { text: "좋아하는 건 저장해두는 편이에요.", score: 1, reaction: "저장해두는군요.", expressionId: "exp_01", motionGroup: "Idle", motionIndex: 0 },
      { text: "애니송 플리가 따로 있어요.", score: 2, reaction: "전용 플리가 있다니, 꽤 진심이에요.", expressionId: "exp_03", motionGroup: "", motionIndex: 2 },
      { text: "CD나 블루레이까지 구매해요.", score: 3, reaction: "실물 앨범까지요!? 완전 찐이에요.", expressionId: "exp_04", motionGroup: "", motionIndex: 3 },
    ],
  },
  {
    num: 7,
    dialogue: "일곱 번째. 애니 관련 커뮤니티 활동을 해요?",
    options: [
      { text: "커뮤니티는 딱히...", score: 0, reaction: "혼자 조용히 감상하는 타입이군요.", expressionId: "exp_05", motionGroup: "Idle", motionIndex: 0 },
      { text: "가끔 둘러보는 정도예요.", score: 1, reaction: "관망하는 타입이네요.", expressionId: "exp_01", motionGroup: "Idle", motionIndex: 0 },
      { text: "자주 글 쓰고 댓글도 달아요.", score: 2, reaction: "활발하게 활동하는군요.", expressionId: "exp_03", motionGroup: "", motionIndex: 1 },
      { text: "운영진이거나 직접 커뮤니티를 운영해요.", score: 3, reaction: "운영진이라고요!? 그건 레전드예요.", expressionId: "exp_04", motionGroup: "", motionIndex: 3 },
    ],
  },
  {
    num: 8,
    dialogue: "마지막이에요. 주변에 애니를 전도하거나 입문시킨 적 있어요?",
    options: [
      { text: "굳이 꺼내지는 않아요.", score: 0, reaction: "혼자 즐기는 타입이군요.", expressionId: "exp_05", motionGroup: "Idle", motionIndex: 0 },
      { text: "물어보면 이야기해주는 편이에요.", score: 1, reaction: "물어볼 때만 말하는군요.", expressionId: "exp_01", motionGroup: "Idle", motionIndex: 0 },
      { text: "자연스럽게 화제로 만들어요.", score: 2, reaction: "자연스럽게 끌어들이는 타입이네요.", expressionId: "exp_03", motionGroup: "", motionIndex: 2 },
      { text: "모르는 사람도 입문시키는 편이에요.", score: 3, reaction: "전도사네요... 덕질 생태계를 넓히는 사람.", expressionId: "exp_04", motionGroup: "", motionIndex: 3 },
    ],
  },
];

const TIERS: TierData[] = [
  {
    minScore: 0,
    code: "normie",
    badge: "일반인",
    emoji: "😐",
    color: "#9ca3af",
    bg: "#1f2937",
    title: "오타쿠와는 거리가 있어요",
    sub: "애니를 즐기지 않는 건 아니지만, 덕질이라 부르기엔 아직 가볍네요. 언젠가 빠지는 날이 올지도 모르지만, 지금은 일반인이에요.",
    traits: ["애니를 가끔 보긴 하지만 찾아보진 않아요", "굿즈나 이벤트엔 별로 관심이 없어요", "덕질이라는 단어가 나에게 해당한다고 생각 못 했어요"],
    dialogue: "...흠. 일반인이에요. 오타쿠와는 꽤 거리가 있군요. 그것도 나름 행복한 삶이에요.",
    expressionId: "exp_05",
    motionGroup: "Idle",
    motionIndex: 0,
  },
  {
    minScore: 5,
    code: "lite",
    badge: "패션 오타쿠",
    emoji: "🌸",
    color: "#c084fc",
    bg: "#2e1065",
    title: "입문은 했어요",
    sub: "가볍게 시작했지만 이미 발은 들여놓은 상태예요. 좋아하는 작품도 생겼고, 취향도 조금씩 만들어지고 있어요. 슬슬 빠져들기 시작했을지 몰라요.",
    traits: ["좋아하는 작품이 몇 개 생겼어요", "취향은 있지만 깊이 파고들진 않아요", "덕질의 맛을 조금씩 알아가고 있는 중이에요"],
    dialogue: "나쁘지 않아요. 패션 오타쿠... 조금만 더 빠지면 달라질 것 같은 느낌이에요.",
    expressionId: "exp_01",
    motionGroup: "Idle",
    motionIndex: 0,
  },
  {
    minScore: 10,
    code: "otaku",
    badge: "덕후",
    emoji: "✨",
    color: "#60a5fa",
    bg: "#1e3a8a",
    title: "충분히 오타쿠예요",
    sub: "취향도 확실하고, 덕질도 생활의 일부가 된 단계예요. 굿즈도 모으고, 이벤트도 가고, 커뮤니티도 활동하고... 어느새 오타쿠가 되어있었던 거예요.",
    traits: ["덕질이 일상의 일부로 자리 잡았어요", "취향이 뚜렷하고 작품 감상도 깊어요", "주변에서 '애니 많이 보는 사람'으로 불러요"],
    dialogue: "인정해요. 충분히 오타쿠예요. 이 정도면 당당히 말해도 되는 수준이에요.",
    expressionId: "exp_03",
    motionGroup: "",
    motionIndex: 1,
  },
  {
    minScore: 16,
    code: "real",
    badge: "진성 오타쿠",
    emoji: "🔥",
    color: "#f87171",
    bg: "#7f1d1d",
    title: "진짜 오타쿠네요",
    sub: "덕질의 깊이가 남달라요. 좋아하는 것에 시간과 돈과 감정을 아낌없이 쏟는 타입이에요. 주변 사람들도 '저 사람은 진짜 오타쿠야'라고 인정하는 수준이에요.",
    traits: ["덕질이 정체성의 일부가 되어있어요", "좋아하는 것에 아낌없이 투자해요", "주변에서 오타쿠 대표로 인정받아요"],
    dialogue: "...대단하네요. 진성 오타쿠예요. 저도 솔직히 인정할 수밖에 없어요.",
    expressionId: "exp_04",
    motionGroup: "",
    motionIndex: 3,
  },
  {
    minScore: 21,
    code: "chad",
    badge: "찐 오타쿠",
    emoji: "👑",
    color: "#fbbf24",
    bg: "#78350f",
    title: "저보다 더 오타쿠잖아요",
    sub: "이건... 저도 혀를 내두를 수준이에요. 오타쿠로서의 헌신, 열정, 투자량이 모두 최고치에 달해 있어요. 오타쿠계의 끝판왕, 전설이에요.",
    traits: ["오타쿠가 삶의 방식 그 자체예요", "덕질에서만큼은 타협하지 않아요", "주변 오타쿠들에게도 존경받는 레전드예요"],
    dialogue: "잠깐, 저보다... 더 오타쿠잖아요. 이건 진짜 찐이에요. 감탄했어요.",
    expressionId: "exp_04",
    motionGroup: "",
    motionIndex: 3,
  },
];

function getTier(score: number): TierData {
  return [...TIERS].reverse().find((t) => score >= t.minScore) ?? TIERS[0];
}

// ── Main component ─────────────────────────────────────────────
function OtakuTypeV3Content() {
  const router = useRouter();
  const authUser = useAuthUser();
  const searchParams = useSearchParams();
  const showSaved = searchParams.get("saved") === "1";
  const savedResultRef = useRef(false);

  // Game state
  const [gamePhase, setGamePhase] = useState<GamePhase>("intro");
  const [quizStep, setQuizStep] = useState<QuizStep>("asking");
  const [curQ, setCurQ] = useState(0);
  const [scores, setScores] = useState<number[]>([]);
  const [chosenIdx, setChosenIdx] = useState<number | null>(null);
  const [restoring, setRestoring] = useState(showSaved);
  const [restoredTier, setRestoredTier] = useState<TierData | null>(null);

  // Live2D controls
  const [expressionId, setExpressionId] = useState("exp_01");
  const [motionTrigger, setMotionTrigger] = useState<FortuneMotionTrigger | null>(null);
  const motionNonceRef = useRef(0);
  const [ambient, setAmbient] = useState(true);
  const [talking, setTalking] = useState(false);

  const fireMotion = useCallback((group: string, index: number) => {
    motionNonceRef.current++;
    setMotionTrigger({ group, index, nonce: motionNonceRef.current, priority: 3 });
  }, []);

  // Current dialogue text
  const dialogue = (() => {
    if (gamePhase === "intro") return "안녕하세요! 저는 마오예요. 오늘은 '얼마나 오타쿠인지' 진단해드릴게요. 솔직하게 답해줘요, 결과가 달라질 수 있으니까요.";
    if (gamePhase === "result") {
      if (restoredTier) return restoredTier.dialogue;
      const total = scores.reduce((s, v) => s + v, 0);
      return getTier(total).dialogue;
    }
    const q = QUESTIONS[curQ];
    if (!q) return "";
    if (quizStep === "asking" || quizStep === "choosing") return q.dialogue;
    if (quizStep === "reacting" && chosenIdx !== null) return q.options[chosenIdx]?.reaction ?? "";
    return "";
  })();

  const { shown, done: typingDone } = useTypewriter(dialogue);

  // Skip typing on click
  const skipTyping = useCallback(() => {
    // useTypewriter re-triggers on text change; we can't skip from outside easily.
    // Instead we expose a "force done" approach by immediately moving on after click.
  }, []);

  // Sync talking state
  useEffect(() => {
    setTalking(!typingDone && dialogue.length > 0);
  }, [typingDone, dialogue]);

  // Load saved result
  useEffect(() => {
    if (!showSaved) return;
    if (authUser === undefined) return;
    let cancelled = false;
    void (async () => {
      setRestoring(true);
      try {
        if (!authUser?.id) return;
        const row = await fetchOtakuTypeResult(authUser.id, "v3");
        if (cancelled || !row) return;
        const tier = TIERS.find((t) => t.code === row.result_code);
        if (!tier) return;
        setRestoredTier(tier);
        setExpressionId(tier.expressionId);
        fireMotion(tier.motionGroup, tier.motionIndex);
        setAmbient(false);
        setGamePhase("result");
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setRestoring(false);
      }
    })();
    return () => { cancelled = true; };
  }, [showSaved, authUser, fireMotion]);

  // Save result when reaching result phase
  useEffect(() => {
    if (restoredTier) return;
    if (gamePhase !== "result" || !authUser?.id || savedResultRef.current) return;
    if (scores.length < QUESTIONS.length) return;
    savedResultRef.current = true;
    const total = scores.reduce((s, v) => s + v, 0);
    const tier = getTier(total);
    void upsertOtakuTypeResult(authUser.id, {
      testVersion: "v3",
      resultCode: tier.code,
      resultTitle: tier.title,
      resultBadge: tier.badge,
      scores: { total, maxScore: QUESTIONS.length * 3, pct: Math.round((total / (QUESTIONS.length * 3)) * 100) },
    }).catch(console.error);
  }, [gamePhase, authUser?.id, scores, restoredTier]);

  // Handlers
  const startQuiz = () => {
    setGamePhase("quiz");
    setQuizStep("asking");
    setCurQ(0);
    setScores([]);
    setChosenIdx(null);
    setAmbient(false);
    setExpressionId("exp_03");
    fireMotion("", 1);
  };

  const handleChoose = (optIdx: number) => {
    if (quizStep !== "choosing") return;
    const opt = QUESTIONS[curQ]?.options[optIdx];
    if (!opt) return;
    setChosenIdx(optIdx);
    setScores((prev) => {
      const next = [...prev];
      next[curQ] = opt.score;
      return next;
    });
    setExpressionId(opt.expressionId);
    fireMotion(opt.motionGroup, opt.motionIndex);
    setQuizStep("reacting");
  };

  const handleNext = () => {
    const nextQ = curQ + 1;
    if (nextQ >= QUESTIONS.length) {
      const total = scores.reduce((s, v) => s + v, 0);
      const tier = getTier(total);
      setExpressionId(tier.expressionId);
      fireMotion(tier.motionGroup, tier.motionIndex);
      setGamePhase("result");
    } else {
      setCurQ(nextQ);
      setChosenIdx(null);
      setExpressionId("exp_03");
      fireMotion("", 1);
      setQuizStep("asking");
    }
  };

  // When typing finishes in "asking" step → switch to "choosing"
  useEffect(() => {
    if (gamePhase !== "quiz" || quizStep !== "asking" || !typingDone) return;
    setQuizStep("choosing");
  }, [gamePhase, quizStep, typingDone]);

  const reset = () => {
    savedResultRef.current = false;
    setRestoredTier(null);
    setGamePhase("intro");
    setQuizStep("asking");
    setCurQ(0);
    setScores([]);
    setChosenIdx(null);
    setExpressionId("exp_01");
    setAmbient(true);
    fireMotion("Idle", 0);
    router.replace("/play/otaku-type/v3");
  };

  if (restoring) {
    return (
      <main className="v3-root flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />
          <p className="text-sm text-violet-300">저장된 결과 불러오는 중...</p>
        </div>
      </main>
    );
  }

  const totalScore = scores.reduce((s, v) => s + v, 0);
  const resultTier = restoredTier ?? (gamePhase === "result" ? getTier(totalScore) : null);
  const progress = gamePhase === "quiz" ? Math.round((curQ / QUESTIONS.length) * 100) : gamePhase === "result" ? 100 : 0;

  return (
    <>
      <style>{`
        .v3-root {
          min-height: calc(100dvh - var(--layout-header-height, 56px));
          background: linear-gradient(170deg, #13082b 0%, #0a0618 50%, #050310 100%);
          color: #f0e6ff;
          position: relative;
          overflow-x: hidden;
        }
        .v3-root::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background-image:
            radial-gradient(1.5px 1.5px at 15% 20%, rgba(180,120,255,.4), transparent),
            radial-gradient(1px 1px at 35% 70%, rgba(120,80,220,.3), transparent),
            radial-gradient(1.5px 1.5px at 78% 15%, rgba(200,150,255,.35), transparent),
            radial-gradient(1px 1px at 88% 65%, rgba(140,100,240,.25), transparent),
            radial-gradient(1px 1px at 55% 90%, rgba(180,120,255,.3), transparent),
            radial-gradient(1.5px 1.5px at 5% 85%, rgba(120,80,220,.3), transparent);
        }
        .v3-textbox {
          border-top: 1px solid rgba(192,132,252,0.35);
          background: linear-gradient(170deg, rgba(30,15,64,0.97) 0%, rgba(17,7,48,0.99) 100%);
          border-radius: 0 0 1rem 1rem;
        }
        @media (min-width: 640px) {
          .v3-textbox { border-radius: 0 0 1.25rem 1.25rem; }
        }
        @keyframes v3-rise {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: none; }
        }
        .v3-rise { animation: v3-rise 0.35s ease-out both; }
        .v3-caret::after {
          content: "▍";
          margin-left: 1px;
          color: #c084fc;
          animation: v3-blink .7s steps(2) infinite;
        }
        @keyframes v3-blink { 50% { opacity: 0; } }
        .v3-choice {
          position: relative;
          text-align: left;
          width: 100%;
          padding: 0.45rem 0.625rem;
          border-radius: 0.5rem;
          border: 1px solid rgba(192,132,252,0.2);
          background: rgba(255,255,255,0.03);
          color: #e9d5ff;
          font-size: 0.75rem;
          line-height: 1.45;
          transition: all 0.15s;
          cursor: pointer;
        }
        @media (min-width: 640px) {
          .v3-choice {
            padding: 0.625rem 1rem;
            font-size: 0.8125rem;
            line-height: 1.5;
          }
        }
        .v3-choice:hover {
          border-color: rgba(192,132,252,0.5);
          background: rgba(192,132,252,0.08);
          color: #f3e8ff;
        }
        .v3-choice:active {
          background: rgba(192,132,252,0.15);
        }
        .v3-choice::before {
          content: "▶";
          margin-right: 0.35rem;
          color: rgba(192,132,252,0.5);
          font-size: 0.5rem;
        }
        @media (min-width: 640px) {
          .v3-choice::before { margin-right: 0.5rem; font-size: 0.625rem; }
        }
        .v3-next-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.4rem 0.875rem;
          border-radius: 9999px;
          background: linear-gradient(135deg, #7c3aed, #4f46e5);
          color: white;
          font-size: 0.75rem;
          font-weight: 700;
          border: none;
          cursor: pointer;
          transition: all 0.15s;
          box-shadow: 0 4px 14px rgba(124,58,237,0.4);
        }
        @media (min-width: 640px) {
          .v3-next-btn { padding: 0.5rem 1.25rem; font-size: 0.8125rem; }
        }
        .v3-next-btn:hover { filter: brightness(1.1); }
        .v3-start-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.5rem 1rem;
          border-radius: 9999px;
          background: linear-gradient(135deg, #a855f7, #7c3aed);
          color: white;
          font-size: 0.8125rem;
          font-weight: 800;
          border: none;
          cursor: pointer;
          width: 100%;
          justify-content: center;
          transition: all 0.15s;
          box-shadow: 0 4px 20px rgba(168,85,247,0.45);
        }
        @media (min-width: 640px) {
          .v3-start-btn { padding: 0.625rem 1.5rem; font-size: 0.875rem; }
        }
        .v3-start-btn:hover { filter: brightness(1.1); }
      `}</style>

      {/* 전체 뷰포트를 채우는 VN 레이아웃 */}
      <div
        className="v3-root"
        style={{
          height: "calc(100dvh - var(--layout-header-height, 56px))",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* 최대 너비 컨테이너 — flex col, 전체 높이 */}
        <div
          className="relative z-10 mx-auto w-full flex flex-col"
          style={{ maxWidth: 600, height: "100%", padding: "10px 16px 0" }}
        >
          {/* ── Header ── */}
          <div className="flex items-center justify-between mb-1.5 shrink-0">
            <Link
              href="/play/otaku-type"
              className="flex h-7 w-7 items-center justify-center rounded-full border border-violet-500/30 bg-violet-900/30 text-violet-300 text-xs hover:bg-violet-800/40 transition"
            >
              ←
            </Link>
            <div className="text-center">
              <p className="text-[9px] font-bold uppercase tracking-[0.28em] text-violet-400">Otaku Level Test</p>
              <h1 className="text-sm font-black text-violet-100 leading-tight">얼마나 오타쿠예요?</h1>
            </div>
            <div className="w-7" />
          </div>

          {/* ── Progress bar ── */}
          <div className="shrink-0 mb-1.5" style={{ minHeight: 18 }}>
            {gamePhase !== "intro" && (
              <>
                <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(192,132,252,0.15)" }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${progress}%`, background: "linear-gradient(90deg, #7c3aed, #a855f7)" }}
                  />
                </div>
                {gamePhase === "quiz" && (
                  <p className="text-right text-[10px] text-violet-400/50 leading-tight">
                    {curQ + 1} / {QUESTIONS.length}
                  </p>
                )}
              </>
            )}
          </div>

          {/* ── Character area (flex-1: 남은 공간 전부) ── */}
          <div
            className="shrink-0"
            style={{
              flex: "1 1 0",
              minHeight: 0,
              display: "flex",
              justifyContent: "center",
              alignItems: "flex-end",   // 캐릭터를 아래 기준 정렬 → 머리가 항상 보임
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: "clamp(220px, 72vw, 460px)",
                position: "relative",
                flexShrink: 0,
              }}
            >
              {/* 캐릭터 카드 — 위만 둥근 모서리, 아래는 텍스트박스와 이음 */}
              <div
                style={{
                  overflow: "hidden",
                  borderRadius: "14px 14px 0 0",
                  border: "1px solid rgba(192,132,252,0.3)",
                  borderBottom: "none",
                  background: "#fff",
                  boxShadow: "0 -4px 20px rgba(124,58,237,0.18)",
                }}
              >
                <FortuneStage
                  expressionId={expressionId}
                  motionTrigger={motionTrigger}
                  ambient={ambient}
                  talking={talking}
                  tracking={false}
                />
              </div>
              {/* 이름 칩 — 캐릭터 하단에 그라데이션 오버레이로 */}
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: 36,
                  background: "linear-gradient(0deg, rgba(10,6,24,0.9) 0%, transparent 100%)",
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "center",
                  paddingBottom: 4,
                  pointerEvents: "none",
                }}
              >
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.18em", color: "#c084fc" }}>마오</span>
              </div>
            </div>
          </div>

          {/* ── VN 텍스트박스 (화면 하단에 고정) ── */}
          <div
            className="v3-rise v3-textbox shrink-0"
            style={{ padding: "10px 14px 12px" }}
          >
            {/* 이름 태그 행 */}
            <div className="flex items-center gap-2 mb-1.5">
              <span
                style={{
                  background: "rgba(192,132,252,0.15)",
                  border: "1px solid rgba(192,132,252,0.45)",
                  color: "#c084fc",
                  borderRadius: 6,
                  padding: "1px 8px",
                  fontSize: 11,
                  fontWeight: 800,
                }}
              >
                마오
              </span>
              <span style={{ fontSize: 10, color: "rgba(192,132,252,0.4)" }}>오타쿠 심사관</span>
              {gamePhase === "quiz" && (
                <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 700, color: "rgba(192,132,252,0.45)" }}>
                  Q{QUESTIONS[curQ]?.num}
                </span>
              )}
            </div>

            {/* 대화 텍스트 — 탭하면 다음으로 */}
            <div
              className="cursor-pointer select-none"
              style={{ marginBottom: 10 }}
              onClick={() => {
                if (!typingDone) return;
                if (gamePhase === "quiz" && quizStep === "reacting") handleNext();
              }}
            >
              <p
                className={!typingDone ? "v3-caret" : ""}
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  lineHeight: 1.65,
                  color: "#f3e8ff",
                  minHeight: 44,
                }}
              >
                {shown}
              </p>
            </div>

            {/* 선택지 / 버튼 (타이핑 완료 후 등장) */}
            {typingDone && (
              <div className="v3-rise" style={{ display: "flex", flexDirection: "column", gap: 6 }}>

                {/* 인트로 */}
                {gamePhase === "intro" && (
                  <button className="v3-start-btn" onClick={startQuiz}>
                    <span>✦</span>테스트 시작하기
                  </button>
                )}

                {/* 선택지 */}
                {gamePhase === "quiz" && quizStep === "choosing" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    {QUESTIONS[curQ]?.options.map((opt, i) => (
                      <button key={i} className="v3-choice" onClick={() => handleChoose(i)}>
                        {opt.text}
                      </button>
                    ))}
                  </div>
                )}

                {/* 반응 후 */}
                {gamePhase === "quiz" && quizStep === "reacting" && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 10, color: "rgba(192,132,252,0.4)" }}>탭해서 계속</span>
                    <button className="v3-next-btn" onClick={handleNext}>
                      {curQ + 1 >= QUESTIONS.length ? "결과 보기 →" : "다음 →"}
                    </button>
                  </div>
                )}

                {/* 결과 */}
                {gamePhase === "result" && resultTier && (
                  <ResultActions
                    tier={resultTier}
                    totalScore={totalScore}
                    maxScore={QUESTIONS.length * 3}
                    onReset={reset}
                    isRestored={!!restoredTier}
                  />
                )}
              </div>
            )}
          </div>
        </div>

        {/* 결과 카드 — 텍스트박스 아래로 스크롤 가능 */}
        {gamePhase === "result" && resultTier && typingDone && (
          <div
            className="v3-rise"
            style={{
              overflowY: "auto",
              WebkitOverflowScrolling: "touch" as React.CSSProperties["WebkitOverflowScrolling"],
              padding: "0 16px 20px",
              maxWidth: 600,
              margin: "0 auto",
              width: "100%",
            }}
          >
            <ResultCard
              tier={resultTier}
              totalScore={totalScore}
              maxScore={QUESTIONS.length * 3}
              isRestored={!!restoredTier}
            />
          </div>
        )}
      </div>
    </>
  );
}

// ── Result card component ───────────────────────────────────────
function ResultCard({
  tier,
  totalScore,
  maxScore,
  isRestored,
}: {
  tier: TierData;
  totalScore: number;
  maxScore: number;
  isRestored: boolean;
}) {
  const pct = Math.round((totalScore / maxScore) * 100);
  return (
    <div
      className="rounded-xl sm:rounded-2xl border overflow-hidden"
      style={{ borderColor: "rgba(192,132,252,0.25)", background: "linear-gradient(160deg, #1a0d38 0%, #0d0620 100%)" }}
    >
      {/* Top badge */}
      <div
        className="flex flex-col items-center py-5 sm:py-7 gap-2"
        style={{ background: `linear-gradient(135deg, ${tier.bg}33 0%, ${tier.bg}11 100%)` }}
      >
        <div className="text-4xl sm:text-5xl leading-none">{tier.emoji}</div>
        <span
          className="rounded-full border px-2.5 sm:px-3.5 py-0.5 sm:py-1 text-[11px] sm:text-xs font-black"
          style={{ borderColor: tier.color + "55", color: tier.color, background: tier.bg + "22" }}
        >
          {tier.badge}
        </span>
        <div className="text-[15px] sm:text-[18px] font-semibold text-violet-100 mt-0.5 sm:mt-1 text-center px-3">{tier.title}</div>
      </div>

      {/* Score bar */}
      <div className="px-3 sm:px-5 py-3 sm:py-4 border-t" style={{ borderColor: "rgba(192,132,252,0.1)" }}>
        <div className="flex justify-between text-[11px] sm:text-xs text-violet-400/70 mb-1.5">
          <span>오타쿠 지수</span>
          <span className="font-bold" style={{ color: tier.color }}>{totalScore}/{maxScore}점 ({pct}%)</span>
        </div>
        <div className="h-2 sm:h-2.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${tier.color}99, ${tier.color})` }}
          />
        </div>
      </div>

      {/* Sub desc */}
      <div className="px-3 sm:px-5 pb-3 sm:pb-4 text-[11px] sm:text-[13px] text-violet-200/70 leading-[1.6] sm:leading-6">{tier.sub}</div>

      {/* Traits */}
      <div className="px-3 sm:px-5 pb-4 sm:pb-5 border-t" style={{ borderColor: "rgba(192,132,252,0.1)" }}>
        <div className="text-[10px] sm:text-xs font-semibold mb-2 mt-2.5 sm:mt-3" style={{ color: "#c084fc" }}>이런 특징이 있어요</div>
        {tier.traits.map((tr) => (
          <div key={tr} className="flex gap-1.5 sm:gap-2 py-1.5 sm:py-2 border-b text-[11px] sm:text-[12px] text-violet-200/65 last:border-b-0" style={{ borderColor: "rgba(192,132,252,0.08)" }}>
            <span className="flex-shrink-0 mt-0.5" style={{ color: tier.color }}>✓</span>
            <span>{tr}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Result action buttons ───────────────────────────────────────
function ResultActions({
  tier,
  totalScore,
  maxScore,
  onReset,
  isRestored,
}: {
  tier: TierData;
  totalScore: number;
  maxScore: number;
  onReset: () => void;
  isRestored: boolean;
}) {
  const pct = Math.round((totalScore / maxScore) * 100);
  return (
    <div className="flex flex-wrap gap-1.5 sm:gap-2">
      <button onClick={onReset} className="v3-next-btn">
        🔄 다시하기
      </button>
      <Link
        href="/play/oshi-card"
        className="v3-next-btn no-underline"
        style={{ background: "rgba(192,132,252,0.15)", boxShadow: "none", border: "1px solid rgba(192,132,252,0.3)" }}
      >
        최애 카드 →
      </Link>
      {!isRestored && (
        <span className="self-center text-[10px] sm:text-[11px] text-violet-400/50">{pct}% 오타쿠</span>
      )}
    </div>
  );
}

// ── Page with Suspense ─────────────────────────────────────────
export default function OtakuTypeV3Page() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-[60vh] items-center justify-center" style={{ background: "#0a0618" }}>
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />
            <p className="text-sm text-violet-300">불러오는 중...</p>
          </div>
        </main>
      }
    >
      <OtakuTypeV3Content />
    </Suspense>
  );
}
