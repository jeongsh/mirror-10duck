"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  ChevronLeft,
  Download,
  Eye,
  Info,
  MoonStar,
  RotateCcw,
  Share2,
  Sparkles,
  X,
} from "lucide-react";
import dynamic from "next/dynamic";
import { FortuneResultCard, FORTUNE_CARD_W } from "@/components/play/fortune/FortuneResultCard";
import { mapUrlsToDataUrls } from "@/lib/imageDataUrl";
import {
  FORTUNE_STAGE_BG,
  type FortuneMotionTrigger,
} from "@/lib/fortune/fortuneLive2DStage";
import {
  GENRE_OPTIONS,
  INTEREST_OPTIONS,
  TRAIT_OPTIONS,
  buildMaoFortuneLine,
  clearStoredFortuneDay,
  composeBirthday,
  formatBirthdayPreview,
  generateCharacterFortune,
  hashFortuneInput,
  loadStoredFortuneDay,
  saveStoredFortuneDay,
  scheduleFortuneExpiryCleanup,
  splitBirthday,
  type CharacterTrait,
  type FortuneInput,
  type FortuneResult,
  type InterestField,
  type PreferredGenre,
} from "@/lib/fortune/dailyFortune";

const FortuneStage = dynamic(() => import("@/components/play/fortune/FortuneLive2DStage"), {
  ssr: false,
  loading: () => (
    <div
      className="mx-auto flex w-full items-end justify-center pb-12 text-[11px] font-bold uppercase tracking-[0.3em] text-stone-400"
      style={{ maxWidth: 360, aspectRatio: "360 / 480", background: FORTUNE_STAGE_BG }}
    >
      마오를 부르는 중...
    </div>
  ),
});

type Step =
  | "start"
  | "birthday"
  | "nickname"
  | "interest"
  | "genre"
  | "trait"
  | "analyzing"
  | "result"
  | "alreadyDone";

const ANALYZING_LINES = [
  "별자리 흐름을 확인하는 중...",
  "오늘의 운세 점수를 계산하는 중...",
  "취향에 맞는 캐릭터를 찾는 중...",
  "오늘의 한마디를 고르는 중...",
];

const STEP_SPEECH: Partial<Record<Step, string>> = {
  start: "어서 와요. 오늘의 캐릭터 운세, 나랑 같이 들여다볼까요?",
  birthday: "생일을 알려줄래요? 월·일만 입력하면 별자리를 계산할 수 있어요. MM-DD 형식이에요.",
  nickname: "닉네임도 알려줘요. 결과를 더 나답게 맞춰줄게요.",
  interest: "요즘 제일 관심 있는 분야는 뭐예요?",
  genre: "좋아하는 장르를 골라줘요. 추천 캐릭터에 반영할게요.",
  trait: "마음에 드는 캐릭터 성향을 골라줘요. 오늘 잘 맞는 타입을 찾아볼게요.",
};

const STEP_ORDER: Step[] = ["start", "birthday", "nickname", "interest", "genre", "trait"];

const FEATURES = [
  { icon: <Sparkles size={16} />, title: "별자리 운세", desc: "생일로 별자리를 계산해 오늘의 운세 제공" },
  { icon: <MoonStar size={16} />, title: "최애운", desc: "취향에 맞는 캐릭터 타입과 추천" },
  { icon: <Sparkles size={16} />, title: "매일 고정", desc: "같은 날·같은 별자리는 같은 운세" },
  { icon: <RotateCcw size={16} />, title: "하루 저장", desc: "자정(KST)까지 localStorage에 보관" },
];

function isGoodFortune(r: FortuneResult): boolean {
  return r.scores.overall >= 60;
}

/* ── 타이핑 효과 ──────────────────────────────────────────────── */
function useTypewriter(text: string, speed = 32) {
  const [shown, setShown] = useState("");
  useEffect(() => {
    setShown("");
    if (!text) return;
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setShown(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);
  return { shown, done: shown.length >= text.length };
}

/* ── 라벤더 선택 칩 (대화 패널 내부) ──────────────────────────── */
function Chip({
  label,
  icon,
  selected,
  onClick,
}: {
  label: string;
  icon?: React.ReactNode;
  selected?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1 rounded-xl border px-3 py-3 text-sm font-bold transition-all duration-150 ${
        selected
          ? "border-amber-400 bg-amber-300/20 text-amber-100 shadow-[0_0_16px_rgba(217,164,65,0.35)]"
          : "border-violet-300/15 bg-violet-200/[0.06] text-violet-100/85 hover:border-amber-300/40 hover:bg-violet-200/[0.12]"
      }`}
    >
      {icon ? <span className={selected ? "text-amber-200" : "text-violet-200/70"}>{icon}</span> : null}
      <span>{label}</span>
    </button>
  );
}

/* ── 골드 pill 버튼 ───────────────────────────────────────────── */
function GoldButton({
  children,
  onClick,
  disabled,
  full,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  full?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 rounded-full px-6 py-2.5 text-sm font-black text-[#3a2d5c] shadow-[0_4px_14px_rgba(217,164,65,0.4)] transition-all hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none ${
        full ? "w-full" : ""
      }`}
      style={{
        background: disabled
          ? "rgba(255,255,255,0.12)"
          : "linear-gradient(180deg, #f3cd72 0%, #d9a441 100%)",
        color: disabled ? "rgba(255,255,255,0.35)" : undefined,
      }}
    >
      {children}
    </button>
  );
}

function BirthdayFields({
  month,
  day,
  onMonthChange,
  onDayChange,
}: {
  month: string;
  day: string;
  onMonthChange: (v: string) => void;
  onDayChange: (v: string) => void;
}) {
  const inputClass =
    "rounded-xl border border-violet-300/20 bg-violet-200/[0.06] px-3 py-3 text-center text-base font-bold text-white outline-none placeholder:text-violet-200/30 focus:border-amber-300/60";
  const digitsOnly = (v: string, maxLen: number) => v.replace(/\D/g, "").slice(0, maxLen);
  const preview = composeBirthday(month, day);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-center gap-2">
        <input
          type="text"
          inputMode="numeric"
          placeholder="05"
          value={month}
          maxLength={2}
          onChange={(e) => onMonthChange(digitsOnly(e.target.value, 2))}
          className={`${inputClass} w-16`}
          aria-label="월"
        />
        <span className="text-lg font-black text-amber-300/80">-</span>
        <input
          type="text"
          inputMode="numeric"
          placeholder="14"
          value={day}
          maxLength={2}
          onChange={(e) => onDayChange(digitsOnly(e.target.value, 2))}
          className={`${inputClass} w-16`}
          aria-label="일"
        />
      </div>
      {preview ? (
        <p className="text-center text-xs font-bold text-amber-200/80">{formatBirthdayPreview(month, day)}</p>
      ) : (
        <p className="text-center text-xs text-violet-200/40">예: 05-14</p>
      )}
    </div>
  );
}

export default function FortunePage() {
  const [step, setStep] = useState<Step>("start");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthDay, setBirthDay] = useState("");
  const [nickname, setNickname] = useState("");
  const [interest, setInterest] = useState<InterestField | null>(null);
  const [genre, setGenre] = useState<PreferredGenre | null>(null);
  const [characterTrait, setCharacterTrait] = useState<CharacterTrait | null>(null);
  const [result, setResult] = useState<FortuneResult | null>(null);
  const [analyzingLine, setAnalyzingLine] = useState(0);

  // 마오 연출 상태
  const [expressionId, setExpressionId] = useState("exp_01");
  const [ambient, setAmbient] = useState(true);
  const [motionTrigger, setMotionTrigger] = useState<FortuneMotionTrigger | null>(null);
  const motionNonceRef = useRef(0);
  const fireMotion = useCallback((group: string, index: number, priority = 3) => {
    motionNonceRef.current += 1;
    setMotionTrigger({ group, index, nonce: motionNonceRef.current, priority });
  }, []);

  const isResult = step === "result" || step === "alreadyDone";
  const birthday = useMemo(() => composeBirthday(birthMonth, birthDay), [birthMonth, birthDay]);
  const birthdayValid = birthday !== null;

  useEffect(() => {
    const stored = loadStoredFortuneDay();
    if (!stored) return;
    setResult(stored.result);
    const parts = splitBirthday(stored.input.birthday);
    setBirthMonth(parts.month);
    setBirthDay(parts.day);
    setNickname(stored.input.nickname);
    setInterest(stored.input.interest);
    setGenre(stored.input.genre);
    setCharacterTrait(stored.input.characterTrait);
    setStep("alreadyDone");
  }, []);

  useEffect(() => {
    if (!result?.expiresAt) return;
    return scheduleFortuneExpiryCleanup(result.expiresAt, () => {
      clearStoredFortuneDay();
      setResult(null);
      setStep("start");
    });
  }, [result?.expiresAt]);

  // ── 마오 연출 choreography ─────────────────────────────────────
  useEffect(() => {
    if (step === "birthday") {
      setExpressionId("exp_03");
      setAmbient(false);
      fireMotion("", 1, 3);
    } else if (isResult && result) {
      const good = isGoodFortune(result);
      setExpressionId(good ? "exp_04" : "exp_05");
      setAmbient(false);
      fireMotion("", good ? 3 : 4, 3);
    } else {
      setExpressionId("exp_01");
      setAmbient(true);
      fireMotion("Idle", 0, 3);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, result]);

  const buildInput = useCallback((): FortuneInput | null => {
    if (!birthday || !interest || !genre || !characterTrait) return null;
    return {
      birthday,
      nickname,
      interest,
      genre,
      characterTrait,
    };
  }, [birthday, characterTrait, genre, interest, nickname]);

  const runFortune = useCallback(async () => {
    const input = buildInput();
    if (!input) return;

    const stored = loadStoredFortuneDay();
    if (stored && stored.inputHash === hashFortuneInput(input)) {
      setResult(stored.result);
      setStep("result");
      return;
    }

    setStep("analyzing");
    setAnalyzingLine(0);

    const lineInterval = setInterval(() => {
      setAnalyzingLine((prev) => Math.min(prev + 1, ANALYZING_LINES.length - 1));
    }, 460);

    await new Promise((resolve) => setTimeout(resolve, 2000));
    clearInterval(lineInterval);

    const fortune = await generateCharacterFortune(input);
    saveStoredFortuneDay(input, fortune);
    setResult(fortune);
    setStep("result");
  }, [buildInput]);

  const handleReset = () => {
    setBirthMonth("");
    setBirthDay("");
    setNickname("");
    setInterest(null);
    setGenre(null);
    setCharacterTrait(null);
    setResult(null);
    setStep("start");
  };

  const handleRetry = () => {
    clearStoredFortuneDay();
    handleReset();
  };

  const goBack = () => {
    const idx = STEP_ORDER.indexOf(step);
    if (idx > 0) setStep(STEP_ORDER[idx - 1]);
  };

  const speech = useMemo(() => {
    if (isResult && result) return buildMaoFortuneLine(result);
    if (step === "analyzing") return ANALYZING_LINES[analyzingLine] ?? ANALYZING_LINES[0];
    return STEP_SPEECH[step] ?? "";
  }, [isResult, step, result, analyzingLine]);

  const { shown: typed, done: typingDone } = useTypewriter(speech);
  const showBack = STEP_ORDER.indexOf(step) > 0;
  const stepIndex = STEP_ORDER.indexOf(step);

  return (
    <>
      <style>{`
        #fortune-root {
          position: fixed; inset: 0; z-index: 9999; overflow-y: auto; overflow-x: hidden;
          overscroll-behavior: contain;
          background:
            radial-gradient(ellipse 70% 50% at 50% -8%, #fbf3e3 0%, transparent 60%),
            linear-gradient(180deg, #f8f1e3 0%, #f1e5d1 55%, #ecddc6 100%);
          color: #3a2d5c;
        }
        /* 은은한 별 장식 */
        #fortune-root::after {
          content: ""; position: fixed; inset: 0; pointer-events: none; opacity: .5;
          background-image:
            radial-gradient(1.5px 1.5px at 12% 18%, rgba(180,138,60,.5), transparent),
            radial-gradient(1px 1px at 26% 64%, rgba(74,58,114,.35), transparent),
            radial-gradient(1.5px 1.5px at 80% 22%, rgba(180,138,60,.45), transparent),
            radial-gradient(1px 1px at 90% 70%, rgba(74,58,114,.3), transparent),
            radial-gradient(1px 1px at 60% 88%, rgba(180,138,60,.4), transparent);
        }
        @keyframes fortune-rise { from { opacity: 0; transform: translateY(12px);} to {opacity:1; transform:none;} }
        .fortune-rise { animation: fortune-rise .4s ease-out both; }
        .fortune-caret::after { content:"▍"; margin-left:1px; color:#f3cd72; animation: fortune-blink .8s steps(2) infinite; }
        @keyframes fortune-blink { 50% { opacity: 0; } }
        .fortune-flip-scene { perspective: 900px; }
        .fortune-flip-inner {
          position: relative; width: 100%; height: 100%;
          transition: transform 0.55s cubic-bezier(.4,.2,.2,1);
          transform-style: preserve-3d;
        }
        .fortune-flip-inner.is-flipping { transform: rotateY(180deg); }
        .fortune-flip-face {
          position: absolute; inset: 0; backface-visibility: hidden;
          border-radius: 1rem;
        }
        .fortune-flip-back { transform: rotateY(180deg); }
        @keyframes fortune-modal-in {
          from { opacity: 0; transform: scale(.96) translateY(8px); }
          to { opacity: 1; transform: none; }
        }
        .fortune-modal-panel { animation: fortune-modal-in .35s ease-out both; }
      `}</style>

      <div id="fortune-root">
        <div className="relative z-10 mx-auto flex w-full max-w-4xl flex-col px-4 pb-6 pt-5">
          {/* 상단 바: 뒤로 / 닫기 */}
          <div className="flex items-center justify-between">
            {showBack ? (
              <button
                type="button"
                onClick={goBack}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-[#e0d2b8] bg-white/60 text-[#6b5b8a] transition hover:bg-white"
                aria-label="이전"
              >
                <ChevronLeft size={18} />
              </button>
            ) : (
              <span className="h-9 w-9" />
            )}

            {/* 중앙 타이틀 */}
            <div className="flex flex-col items-center">
              <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-[#b58a3c]">Daily Fortune</p>
              <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight text-[#4a3a78]">
                <MoonStar size={20} className="text-[#caa14e]" />
                오늘의 캐릭터 운세
              </h1>
              <p className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-[#8a7a5c]">
                <Sparkles size={11} className="text-[#caa14e]" />
                별자리 운세와 최애 추천을 함께
                <Sparkles size={11} className="text-[#caa14e]" />
              </p>
            </div>

            <Link
              href="/play"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[#e0d2b8] bg-white/60 text-[#6b5b8a] transition hover:bg-white"
              aria-label="닫기"
            >
              <X size={18} />
            </Link>
          </div>

          {/* 스텝 인디케이터 */}
          {stepIndex >= 0 ? (
            <div className="mt-4 flex items-center justify-center gap-1.5">
              {STEP_ORDER.map((s, i) => (
                <span
                  key={s}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === stepIndex ? "w-7 bg-[#d9a441]" : i < stepIndex ? "w-1.5 bg-[#e0bd6e]" : "w-1.5 bg-[#e2d6bf]"
                  }`}
                />
              ))}
            </div>
          ) : null}

          {/* 본문: PC 좌우 / 모바일 상하 */}
          <div className="mt-5 flex flex-col items-center gap-5 lg:flex-row lg:items-start lg:gap-6">
            {/* 마오 — 흰 카드 (PC 에서는 고정되어 오른쪽 길이에 영향받지 않음) */}
            <div className="flex w-full shrink-0 justify-center lg:w-[460px] lg:sticky lg:top-5 lg:self-start">
              <div className="relative w-full max-w-[460px] overflow-hidden rounded-[20px] border border-[#e7dcc4] bg-white shadow-[0_12px_40px_rgba(74,58,114,0.14)]">
                {/* 카드 모서리 장식 */}
                <span className="pointer-events-none absolute left-3 top-3 z-10 text-[#caa14e]/70">
                  <MoonStar size={18} />
                </span>
                <span className="pointer-events-none absolute right-3 top-3 z-10 text-[#b9a8e0]/70">
                  <Sparkles size={16} />
                </span>
                <FortuneStage
                  expressionId={expressionId}
                  motionTrigger={motionTrigger}
                  ambient={ambient}
                  talking={!typingDone && !!speech}
                  tracking
                  // 캐릭터 크기/위치·캔버스 크기 조절 패널 (필요할 때 주석 해제)
                  // adjustable
                />
              </div>
            </div>

            {/* 대화 패널 */}
            <div className="flex min-w-0 flex-1 flex-col">
              <section
                className="relative flex flex-col fortune-rise rounded-[20px] border p-5 shadow-[0_12px_40px_rgba(46,33,80,0.28)] sm:p-6"
                style={{
                  background: "linear-gradient(150deg, #4a3a72 0%, #2c2150 100%)",
                  borderColor: "rgba(201,168,95,0.55)",
                }}
              >
                {/* 말풍선 꼬리: 모바일 위 / PC 왼쪽 */}
                <span
                  className="absolute -top-2 left-10 h-4 w-4 rotate-45 lg:hidden"
                  style={{ background: "#4a3a72", borderLeft: "1px solid rgba(201,168,95,0.55)", borderTop: "1px solid rgba(201,168,95,0.55)" }}
                />
                <span
                  className="absolute -left-2 top-12 hidden h-4 w-4 rotate-45 lg:block"
                  style={{ background: "#473873", borderBottom: "1px solid rgba(201,168,95,0.55)", borderLeft: "1px solid rgba(201,168,95,0.55)" }}
                />

                {/* 마오 이름표 */}
                <div className="mb-3 flex items-center gap-2">
                  <span
                    className="rounded-lg border px-2.5 py-1 text-sm font-black text-[#f3cd72]"
                    style={{ background: "rgba(243,205,114,0.12)", borderColor: "rgba(201,168,95,0.5)" }}
                  >
                    마오
                  </span>
                  <span className="text-[11px] font-semibold text-violet-200/55">점성술사</span>
                </div>

                {/* 대사 */}
                <p className={`text-[15px] font-medium leading-7 text-violet-50 ${typingDone ? "" : "fortune-caret"}`}>
                  {typed}
                </p>

                {/* 인터랙션 / 결과 (대사 타이핑 완료 후) */}
                {typingDone ? (
                <div className="mt-5 fortune-rise">
                  {isResult && result ? (
                    <ResultBody
                      result={result}
                      isReplay={step === "alreadyDone"}
                      onReset={handleReset}
                      onRetry={handleRetry}
                    />
                  ) : (
                    <StepBody
                      step={step}
                      birthMonth={birthMonth}
                      birthDay={birthDay}
                      setBirthMonth={setBirthMonth}
                      setBirthDay={setBirthDay}
                      birthdayValid={birthdayValid}
                      birthdayFilled={birthday !== null}
                      nickname={nickname}
                      setNickname={setNickname}
                      interest={interest}
                      setInterest={setInterest}
                      genre={genre}
                      setGenre={setGenre}
                      characterTrait={characterTrait}
                      setCharacterTrait={setCharacterTrait}
                      setStep={setStep}
                      runFortune={() => void runFortune()}
                    />
                  )}
                </div>
                ) : null}
              </section>
            </div>
          </div>

          {/* 하단 안내 */}
          <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-xs font-semibold text-[#8a7a5c]">
            <Sparkles size={12} className="text-[#caa14e]" />
            마오와 함께 오늘의 운세를 확인해 보세요!
            <Sparkles size={12} className="text-[#caa14e]" />
          </p>

          {/* feature 4종 (PC) */}
          <div className="mt-5 hidden grid-cols-4 gap-3 border-t border-[#e3d6bf] pt-5 lg:grid">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex items-start gap-2">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#4a3a72]/10 text-[#6b5b8a]">
                  {f.icon}
                </span>
                <div>
                  <p className="text-[12px] font-black text-[#4a3a78]">{f.title}</p>
                  <p className="mt-0.5 text-[11px] leading-4 text-[#8a7a5c]">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

/* ── 단계별 인터랙션 ──────────────────────────────────────────── */
function StepBody({
  step,
  birthMonth,
  birthDay,
  setBirthMonth,
  setBirthDay,
  birthdayValid,
  birthdayFilled,
  nickname,
  setNickname,
  interest,
  setInterest,
  genre,
  setGenre,
  characterTrait,
  setCharacterTrait,
  setStep,
  runFortune,
}: {
  step: Step;
  birthMonth: string;
  birthDay: string;
  setBirthMonth: (v: string) => void;
  setBirthDay: (v: string) => void;
  birthdayValid: boolean;
  birthdayFilled: boolean;
  nickname: string;
  setNickname: (v: string) => void;
  interest: InterestField | null;
  setInterest: (v: InterestField) => void;
  genre: PreferredGenre | null;
  setGenre: (v: PreferredGenre) => void;
  characterTrait: CharacterTrait | null;
  setCharacterTrait: (v: CharacterTrait) => void;
  setStep: (s: Step) => void;
  runFortune: () => void;
}) {
  if (step === "start") {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-2 rounded-xl border border-violet-300/15 bg-violet-200/[0.05] p-3">
          <Info size={14} className="mt-0.5 shrink-0 text-amber-200/80" />
          <p className="text-xs leading-5 text-violet-100/70">
            생일·닉네임·취향은 운세 계산에만 쓰고 서버에 저장하지 않아요. 결과는 오늘 자정(KST)까지만
            기기에 보관됩니다.
          </p>
        </div>
        <GoldButton full onClick={() => setStep("birthday")}>
          <Sparkles size={15} />
          오늘의 캐릭터 운세 보기
        </GoldButton>
      </div>
    );
  }

  if (step === "birthday") {
    return (
      <div className="flex flex-col gap-4">
        <BirthdayFields
          month={birthMonth}
          day={birthDay}
          onMonthChange={setBirthMonth}
          onDayChange={setBirthDay}
        />
        {birthdayFilled && !birthdayValid ? (
          <p className="text-center text-xs font-bold text-rose-300">올바른 월·일을 입력해 주세요.</p>
        ) : null}
        <GoldButton full disabled={!birthdayValid} onClick={() => setStep("nickname")}>
          다음
        </GoldButton>
      </div>
    );
  }

  if (step === "nickname") {
    return (
      <div className="flex flex-col gap-4">
        <input
          type="text"
          value={nickname}
          maxLength={16}
          placeholder="닉네임"
          onChange={(e) => setNickname(e.target.value)}
          className="w-full rounded-xl border border-violet-300/20 bg-violet-200/[0.06] px-4 py-3 text-sm font-bold text-white placeholder:text-violet-200/35 outline-none focus:border-amber-300/60"
        />
        <GoldButton full disabled={!nickname.trim()} onClick={() => setStep("interest")}>
          다음
        </GoldButton>
      </div>
    );
  }

  if (step === "interest") {
    return (
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {INTEREST_OPTIONS.map((opt) => (
            <Chip key={opt.value} label={opt.label} selected={interest === opt.value} onClick={() => setInterest(opt.value)} />
          ))}
        </div>
        <GoldButton full disabled={!interest} onClick={() => setStep("genre")}>
          다음
        </GoldButton>
      </div>
    );
  }

  if (step === "genre") {
    return (
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {GENRE_OPTIONS.map((opt) => (
            <Chip key={opt.value} label={opt.label} selected={genre === opt.value} onClick={() => setGenre(opt.value)} />
          ))}
        </div>
        <GoldButton full disabled={!genre} onClick={() => setStep("trait")}>
          다음
        </GoldButton>
      </div>
    );
  }

  if (step === "trait") {
    return (
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {TRAIT_OPTIONS.map((opt) => (
            <Chip
              key={opt.value}
              label={opt.label}
              selected={characterTrait === opt.value}
              onClick={() => setCharacterTrait(opt.value)}
            />
          ))}
        </div>
        <GoldButton full disabled={!characterTrait} onClick={runFortune}>
          <Sparkles size={15} />
          운세 보기
        </GoldButton>
      </div>
    );
  }

  if (step === "analyzing") {
    return (
      <div className="flex items-center gap-2 py-1 text-xs font-bold text-amber-200/80">
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-amber-300 border-t-transparent" />
        운세를 계산하는 중...
      </div>
    );
  }

  return null;
}

/* ── 결과: 요약 카드 · 상세 모달 · 공유용 PNG ─────────────────── */
function ResultBody({
  result,
  isReplay,
  onReset,
  onRetry,
}: {
  result: FortuneResult;
  isReplay: boolean;
  onReset: () => void;
  onRetry: () => void;
}) {
  const displayName = result.nickname.trim() || "오늘의 나";
  const cardRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [flipping, setFlipping] = useState(false);
  const [imageDataUrls, setImageDataUrls] = useState<Record<string, string>>({});

  const characterImageUrl = result.recommendedCharacter?.imageUrl ?? null;

  useEffect(() => {
    if (!characterImageUrl) {
      setImageDataUrls({});
      return;
    }
    let cancelled = false;
    void mapUrlsToDataUrls([characterImageUrl]).then((map) => {
      if (!cancelled) setImageDataUrls(map);
    });
    return () => {
      cancelled = true;
    };
  }, [characterImageUrl]);

  const exportBlob = async (): Promise<Blob> => {
    const el = cardRef.current;
    if (!el) throw new Error("운세 카드를 찾을 수 없습니다.");
    setBusy(true);
    setMessage("");
    try {
      const urls = characterImageUrl ? [characterImageUrl] : [];
      const captureMap =
        Object.keys(imageDataUrls).length > 0 ? { ...imageDataUrls } : await mapUrlsToDataUrls(urls);
      if (Object.keys(captureMap).length > 0) setImageDataUrls(captureMap);

      const restores: Array<{ img: HTMLImageElement; src: string }> = [];
      el.querySelectorAll("img").forEach((node) => {
        const img = node as HTMLImageElement;
        const original = img.getAttribute("src") ?? "";
        const inlined = captureMap[original] ?? (original.startsWith("data:") ? original : null);
        if (inlined && inlined !== original) {
          restores.push({ img, src: original });
          img.setAttribute("src", inlined);
        }
      });

      await Promise.all(
        [...el.querySelectorAll("img")].map(
          (img) =>
            new Promise<void>((resolve) => {
              if (img.complete) resolve();
              else {
                img.onload = () => resolve();
                img.onerror = () => resolve();
              }
            }),
        ),
      );

      const { domToBlob } = await import("modern-screenshot");
      const blob = await domToBlob(el, {
        scale: 2,
        type: "image/png",
        fetchFn: async (url) => captureMap[url] ?? false,
      });

      restores.forEach(({ img, src }) => img.setAttribute("src", src));
      return blob;
    } finally {
      setBusy(false);
    }
  };

  const openDetail = () => {
    if (flipping || modalOpen) return;
    setFlipping(true);
    window.setTimeout(() => {
      setModalOpen(true);
      setFlipping(false);
    }, 520);
  };

  const closeDetail = () => setModalOpen(false);

  const handleDownload = async () => {
    try {
      const blob = await exportBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `10duck-fortune-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
      setMessage("운세 카드 이미지를 저장했습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "이미지 생성에 실패했습니다.");
    }
  };

  const handleShare = async () => {
    try {
      const url = `${window.location.origin}/play/fortune`;
      const shareTitle = "오늘의 캐릭터 운세";
      const shareText = `나는 오늘 ${result.zodiac.name} 운세 ${result.scores.overall}점! 너도 오늘의 캐릭터 운세 해봐.`;
      let copied = false;

      try {
        await navigator.clipboard.writeText(url);
        copied = true;
      } catch {
        /* ignore */
      }

      const canOpenNativeShare =
        typeof navigator.share === "function" &&
        (window.matchMedia("(pointer: coarse)").matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent));

      if (canOpenNativeShare) {
        await navigator.share({ title: shareTitle, text: shareText, url });
        setMessage(
          copied ? "운세 페이지 링크를 복사했고 공유 창을 열었어요." : "공유 창을 열었어요.",
        );
        return;
      }
      if (copied) {
        setMessage("운세 페이지 링크(/play/fortune)가 복사됐어요.");
        return;
      }
      setMessage("클립보드 권한이 막혀 링크 복사에 실패했습니다.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setMessage("공유 창을 닫았습니다.");
        return;
      }
      setMessage("공유에 실패했습니다. 다시 시도해 주세요.");
    }
  };

  const cardWrapStyle = { width: `min(${FORTUNE_CARD_W}px, calc(100vw - 2rem))` } as const;
  const modalPanelStyle = {
    width: `min(${FORTUNE_CARD_W + 32}px, calc(100vw - 2rem))`,
    maxWidth: "100%",
    borderColor: "rgba(201,168,95,0.45)",
    background: "#1c1438",
  } as const;

  const modalPortal =
    modalOpen && typeof document !== "undefined"
      ? createPortal(
          <div
            className="fixed inset-0 z-[10050] flex items-center justify-center overflow-x-hidden bg-black/55 p-4"
            onClick={closeDetail}
            role="presentation"
          >
            <div
              className="fortune-modal-panel flex max-h-[90vh] min-w-0 flex-col overflow-hidden rounded-2xl border shadow-2xl"
              style={modalPanelStyle}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="운세 상세"
            >
              <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
                <p className="text-sm font-black text-amber-200">운세 상세</p>
                <button
                  type="button"
                  onClick={closeDetail}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-violet-200/70 transition hover:bg-white/10"
                  aria-label="닫기"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="min-w-0 overflow-x-hidden overflow-y-auto p-4">
                <div className="mx-auto min-w-0 shrink-0" style={cardWrapStyle}>
                  <FortuneResultCard result={result} imageDataUrls={imageDataUrls} />
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  const capturePortal =
    typeof document !== "undefined"
      ? createPortal(
          <div
            className="pointer-events-none fixed top-0 left-0 -z-10 opacity-0"
            style={{ width: FORTUNE_CARD_W }}
            aria-hidden
          >
            <FortuneResultCard result={result} innerRef={cardRef} imageDataUrls={imageDataUrls} />
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      {/* 요약 카드 + 플립 */}
      <div className="flex flex-col items-center gap-4">
        <div className="fortune-flip-scene mx-auto w-[220px] sm:w-[240px]" style={{ height: 300 }}>
          <div className={`fortune-flip-inner h-full w-full ${flipping ? "is-flipping" : ""}`}>
            <div
              className="fortune-flip-face flex flex-col items-center justify-between border p-4 shadow-lg"
              style={{
                background: "linear-gradient(160deg, #3d2f62 0%, #241a3e 100%)",
                borderColor: "rgba(201,168,95,0.5)",
              }}
            >
              <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-amber-200/55">캐릭터 운세</p>
              <span className="text-4xl">{result.zodiac.emoji}</span>
              <div className="text-center">
                <p className="text-sm font-black text-white">{result.zodiac.name}</p>
                <p className="mt-1 text-[11px] leading-4 text-amber-200/80">{result.starRatings.overall}</p>
                <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-violet-200/65">{displayName}</p>
              </div>
              <button
                type="button"
                onClick={openDetail}
                disabled={flipping}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-full py-2 text-xs font-black text-[#3a2d5c] shadow-[0_3px_12px_rgba(217,164,65,0.35)] transition hover:brightness-105 disabled:opacity-60"
                style={{ background: "linear-gradient(180deg, #f3cd72 0%, #d9a441 100%)" }}
              >
                <Eye size={13} />
                자세히 보기
              </button>
            </div>
            <div
              className="fortune-flip-face fortune-flip-back flex flex-col items-center justify-center gap-2 border p-4"
              style={{
                background: "linear-gradient(160deg, #4a3a72 0%, #2c2150 100%)",
                borderColor: "rgba(201,168,95,0.5)",
              }}
            >
              <Sparkles size={22} className="text-amber-300/80" />
              <p className="text-xs font-bold text-violet-100/80">운세를 펼치는 중...</p>
            </div>
          </div>
        </div>

        <p className="max-w-xs text-center text-xs leading-5 text-violet-200/60">
          {result.recommendedCharacter
            ? `오늘의 추천 · ${result.recommendedCharacter.name}`
            : result.todayMessage}
        </p>
      </div>

      {/* 상세 모달 — body 포털, 카드 420px(좁은 화면은 비율 축소) */}
      {modalPortal}

      {/* PNG·OG 캡처용 — 항상 420px, 레이아웃·스크롤에 영향 없음 */}
      {capturePortal}

      {message ? (
        <p className="text-center text-xs leading-5 text-amber-200/90">{message}</p>
      ) : isReplay ? (
        <p className="text-center text-xs leading-5 text-violet-200/60">
          오늘 저장된 운세예요. 입력을 바꾸려면 다시하기를 눌러주세요.
        </p>
      ) : (
        <p className="text-center text-[11px] leading-5 text-violet-200/45">
          운세 결과는 오늘 자정(KST)까지 이 기기에만 저장돼요.
        </p>
      )}

      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleDownload()}
          className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-black text-[#3a2d5c] shadow-[0_4px_14px_rgba(217,164,65,0.4)] transition hover:brightness-105 disabled:opacity-50"
          style={{ background: "linear-gradient(180deg, #f3cd72 0%, #d9a441 100%)" }}
        >
          <Download size={15} />
          {busy ? "저장 중..." : "이미지 저장"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleShare()}
          className="inline-flex items-center gap-2 rounded-full border border-violet-200/25 px-5 py-2.5 text-sm font-bold text-violet-50 transition hover:bg-white/5 disabled:opacity-50"
        >
          <Share2 size={15} />
          공유하기
        </button>
        <button
          type="button"
          onClick={isReplay ? onRetry : onReset}
          className="inline-flex items-center gap-2 rounded-full border border-violet-200/25 px-5 py-2.5 text-sm font-bold text-violet-50 transition hover:bg-white/5"
        >
          <RotateCcw size={15} />
          다시하기
        </button>
        <Link
          href="/play"
          className="inline-flex items-center gap-2 rounded-full border border-violet-200/25 px-5 py-2.5 text-sm font-bold text-violet-50 transition hover:bg-white/5"
        >
          다른 놀이 보기
        </Link>
      </div>
    </>
  );
}
