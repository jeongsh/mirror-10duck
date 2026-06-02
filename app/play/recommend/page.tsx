"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock,
  Download,
  FileText,
  Film,
  HeartPulse,
  Leaf,
  Menu,
  MessageCircle,
  PawPrint,
  Pill,
  RefreshCcw,
  Share2,
  Sparkles,
  Stethoscope,
} from "lucide-react";
import PrescriptionResultCard from "@/components/play/clinic/PrescriptionResultCard";
import ClinicWorkPicker from "@/components/play/clinic/ClinicWorkPicker";
import type {
  AnimeCandidate,
  Axis,
  ClinicCopyResult,
  ClinicSharePayload,
  DepartmentId,
  DepartmentInfo,
  Prescription,
  Question,
  RetryAction,
  Step,
} from "@/lib/clinic/types";
import {
  LOADING_LINES,
  applyLikedDislikedToScores,
  buildPrescriptions,
  decodeClinicPayload,
  encodeClinicPayload,
  getAvoidText,
  getDiagnosis,
  getImmersionScore,
  initialScores,
  addAxes,
} from "@/lib/clinic/scoring";
import { fetchClinicCopy } from "@/lib/clinic/fetchCopy";
import { buildTemplateCopy, enrichCopyWithAi, mergeCopyIntoPrescriptions } from "@/lib/clinic/templateCopy";
import { FALLBACK_CANDIDATES } from "@/lib/clinic/workMapping";
import { buildCoverMap, getClinicCandidates } from "@/lib/supabase/clinicCandidates";
import { getWorkCoversByTitles } from "@/lib/supabase/animeRecommendations";
import { mapUrlsToDataUrls } from "@/lib/imageDataUrl";

const DEPARTMENTS: Array<{
  id: DepartmentId;
  name: string;
  button: string;
  summary: string;
  direction: string;
  expected: string;
  axes: Partial<Record<Axis, number>>;
}> = [
  {
    id: "heal",
    name: "멘탈 회복과",
    button: "밥 먹고 웃는 애들 주세요",
    summary: "현실에 치인 당신에게 저자극 회복식을 처방합니다.",
    direction: "일상, 코미디, 학원, 따뜻한 관계성",
    expected: "기분 전환과 부담 없는 재시청 욕구",
    axes: { heal: 20, light: 12, relationship: 6 },
  },
  {
    id: "after",
    name: "후유증 내과",
    button: "보고 나서 멍해지고 싶어요",
    summary: "다 본 뒤 천장을 바라보는 시간을 처방합니다.",
    direction: "감정선, 여운, 구원서사, 강한 결말",
    expected: "강한 몰입과 인생작 후보",
    axes: { after: 22, relationship: 8, character: 6 },
  },
  {
    id: "battle",
    name: "배틀뽕 정형외과",
    button: "가슴이 웅장해지는 장면이 부족해요",
    summary: "OST가 깔리고 주인공이 일어서는 순간을 보충합니다.",
    direction: "액션, 이능력, 라이벌, 성장, 작화 폭발",
    expected: "즉각적인 카타르시스와 명장면 회상",
    axes: { battle: 24, relationship: 6 },
  },
  {
    id: "oshi",
    name: "최애중독 정신과",
    button: "캐릭터 한 명에게 인생 저당 잡힌 적 있어요",
    summary: "작품보다 사람 하나에 먼저 감기는 증상을 확인합니다.",
    direction: "캐릭터성, 처연캐, 천재캐, 빌런, 관계성",
    expected: "최애 발생과 관계성 탐색",
    axes: { character: 24, relationship: 14, after: 4 },
  },
  {
    id: "safe",
    name: "지뢰 회피과",
    button: "싫은 것부터 빼고 싶어요",
    summary: "좋아하는 것을 찾기 전에 못 견디는 성분을 제거합니다.",
    direction: "지뢰 필터링, 완결 여부, 서비스신, 고구마 회피",
    expected: "추천 실패 감소와 납득 가능한 제외",
    axes: { heal: 10, light: 8 },
  },
];

const QUESTIONS: Question[] = [
  {
    id: "symptom",
    eyebrow: "문진 1",
    text: "최근 애니를 볼 때 가장 자주 드는 증상은?",
    options: [
      {
        id: "flat",
        label: "재밌긴 한데 심장이 예전만큼 뛰지 않는다",
        description: "무난한 작품보다 강한 몰입이나 카타르시스가 필요합니다.",
        axes: { after: 10, battle: 6 },
        keywords: ["후유증", "카타르시스"],
      },
      {
        id: "character",
        label: "캐릭터가 안 꽂히면 1화도 버티기 어렵다",
        description: "작품보다 최애 발생 가능성이 먼저 작동합니다.",
        axes: { character: 14, relationship: 6 },
        keywords: ["최애발생률높음", "캐릭터성"],
      },
      {
        id: "world",
        label: "세계관이 얕으면 금방 식는다",
        description: "설정, 조직, 떡밥, 권력 구조를 뜯어보는 쪽입니다.",
        axes: { world: 14, mystery: 4 },
        keywords: ["세계관", "설정분석"],
      },
      {
        id: "laugh",
        label: "아무 생각 없이 웃고 싶다",
        description: "지금은 뇌를 잠시 퇴근시키는 처방이 잘 맞습니다.",
        axes: { heal: 12, light: 10 },
        keywords: ["저자극", "뇌퇴근"],
      },
      {
        id: "tear",
        label: "누가 내 멘탈을 정중하게 찢어줬으면 좋겠다",
        description: "감정선과 여운에 대한 반응성이 높습니다.",
        axes: { after: 16, relationship: 6 },
        keywords: ["감정선", "여운"],
      },
    ],
  },
  {
    id: "emotion",
    eyebrow: "문진 2",
    text: "오늘 처방받고 싶은 감정은 무엇인가요?",
    options: [
      {
        id: "warm",
        label: "따뜻하게 회복되고 싶다",
        description: "일상, 학원, 코미디 성분을 우선합니다.",
        axes: { heal: 14, light: 8 },
        keywords: ["멘탈회복", "일상"],
      },
      {
        id: "quiet-cry",
        label: "울고 싶지만 울었다고 인정하긴 싫다",
        description: "절제된 감정선과 성장 서사가 잘 맞습니다.",
        axes: { after: 10, character: 4 },
        keywords: ["절제된눈물", "성장"],
      },
      {
        id: "epic",
        label: "가슴이 웅장해지고 싶다",
        description: "각성 연출과 배틀 카타르시스를 강화합니다.",
        axes: { battle: 16 },
        keywords: ["배틀뽕", "각성연출"],
      },
      {
        id: "brain-off",
        label: "뇌를 잠시 퇴근시키고 싶다",
        description: "개그와 에피소드형 작품을 우선합니다.",
        axes: { light: 14, heal: 8 },
        keywords: ["개그", "뇌퇴근"],
      },
      {
        id: "ceiling",
        label: "다 보고 나서 천장만 바라보고 싶다",
        description: "후유증 고함량 작품을 허용합니다.",
        axes: { after: 18, mystery: 4 },
        keywords: ["후유증", "강한결말"],
      },
    ],
  },
  {
    id: "character",
    eyebrow: "문진 3",
    text: "다음 중 당신이 가장 쉽게 무너지는 캐릭터는?",
    options: [
      {
        id: "strong",
        label: "혼자 다 짊어지는 무뚝뚝한 강자",
        description: "책임감, 고립, 처연한 강자 성분에 약합니다.",
        axes: { character: 12, after: 6 },
        keywords: ["처연캐", "강자"],
      },
      {
        id: "smile",
        label: "웃고 있지만 속은 이미 너덜너덜한 캐릭터",
        description: "내면 상처와 구원 욕구가 강하게 반응합니다.",
        axes: { character: 14, relationship: 8, after: 4 },
        keywords: ["상처보유", "구원서사"],
      },
      {
        id: "genius",
        label: "재능은 미쳤는데 인성이 약간 불량한 천재",
        description: "문제적 매력과 전략가 타입에 흔들립니다.",
        axes: { character: 12, world: 4 },
        keywords: ["천재캐", "문제적매력"],
      },
      {
        id: "villain",
        label: "서사는 빌런인데 얼굴과 과거사가 설득하는 타입",
        description: "도덕적 회색지대와 사연 있는 빌런 서사에 약합니다.",
        axes: { character: 12, after: 8, mystery: 4 },
        keywords: ["빌런서사", "과거사"],
      },
      {
        id: "late",
        label: "처음엔 별생각 없었는데 어느 순간 최애가 되어 있는 타입",
        description: "케미와 성장형 호감이 천천히 누적됩니다.",
        axes: { character: 8, relationship: 10, heal: 2 },
        keywords: ["늦게감김", "케미"],
      },
    ],
  },
  {
    id: "relation",
    eyebrow: "문진 4",
    text: "좋아하는 관계성은?",
    options: [
      {
        id: "rival",
        label: "처음엔 티격태격하다가 결국 서로를 인정하는 라이벌",
        description: "경쟁과 인정, 성장 서사가 핵심입니다.",
        axes: { relationship: 12, battle: 8 },
        keywords: ["라이벌", "성장"],
      },
      {
        id: "mentor",
        label: "스승과 제자처럼 서로를 성장시키는 관계",
        description: "전승과 성장의 약효가 있습니다.",
        axes: { relationship: 10, character: 4 },
        keywords: ["사제관계", "전승"],
      },
      {
        id: "save",
        label: "말은 험하지만 결국 서로를 구원하는 관계",
        description: "관계성 중독과 후유증 반응이 같이 올라갑니다.",
        axes: { relationship: 14, after: 8 },
        keywords: ["구원서사", "관계성중독"],
      },
      {
        id: "found-family",
        label: "피는 안 섞였지만 가족보다 가족 같은 관계",
        description: "유사가족과 소속감 보충에 반응합니다.",
        axes: { relationship: 12, heal: 8 },
        keywords: ["유사가족", "소속감"],
      },
      {
        id: "strange",
        label: "서로 이해하면 안 될 것 같은데 이상하게 얽히는 관계",
        description: "심리전과 금기성 케미가 잘 맞습니다.",
        axes: { relationship: 10, mystery: 8, character: 4 },
        keywords: ["심리전", "위험한케미"],
      },
    ],
  },
  {
    id: "length",
    eyebrow: "문진 5",
    text: "원하는 작품 길이는?",
    options: [
      {
        id: "short",
        label: "12화 정도로 가볍게",
        description: "짧고 초반 약효가 빠른 후보를 우선합니다.",
        axes: { light: 6, heal: 4 },
        keywords: ["짧은처방"],
      },
      {
        id: "medium",
        label: "24화 정도는 가능",
        description: "2쿨 작품까지 허용합니다.",
        axes: { after: 3, battle: 3 },
        keywords: ["표준용량"],
      },
      {
        id: "long",
        label: "장편도 괜찮음",
        description: "장기복용약 후보를 적극 활성화합니다.",
        axes: { world: 8, battle: 4, relationship: 4 },
        keywords: ["장기복용"],
      },
      {
        id: "complete",
        label: "완결작만 원함",
        description: "미완결 대기 스트레스를 강하게 회피합니다.",
        axes: { heal: 4 },
        keywords: ["완결선호"],
      },
      {
        id: "any",
        label: "상관없음",
        description: "길이보다 약효를 우선합니다.",
        axes: { after: 2, battle: 2, character: 2 },
        keywords: ["길이무관"],
      },
    ],
  },
  {
    id: "pace",
    eyebrow: "문진 6",
    text: "초반 3화가 조용할 때 당신의 상태는?",
    options: [
      {
        id: "drop",
        label: "바로 다른 약을 찾는다",
        description: "즉효약과 초반 몰입도를 강하게 봅니다.",
        axes: { light: 8, battle: 5 },
        keywords: ["즉효약"],
      },
      {
        id: "wait",
        label: "후반 약효를 믿고 기다린다",
        description: "느린 전개와 축적형 서사도 허용합니다.",
        axes: { after: 8, world: 6 },
        keywords: ["지연성약효"],
      },
      {
        id: "search",
        label: "스포 없는 후기만 조심스럽게 확인한다",
        description: "납득 가능한 근거와 커뮤니티 반응이 중요합니다.",
        axes: { mystery: 4, world: 4 },
        keywords: ["근거중시"],
      },
      {
        id: "character-check",
        label: "캐릭터가 보이면 계속 본다",
        description: "초반 전개보다 최애 후보가 더 중요합니다.",
        axes: { character: 9, relationship: 4 },
        keywords: ["캐릭터우선"],
      },
    ],
  },
  {
    id: "ending",
    eyebrow: "문진 7",
    text: "엔딩을 보고 가장 견디기 어려운 부작용은?",
    options: [
      {
        id: "open",
        label: "열린 결말이라 해석만 남는 것",
        description: "깔끔한 결말과 완결성을 중요하게 봅니다.",
        axes: { heal: 5 },
        keywords: ["결말안정"],
      },
      {
        id: "plain",
        label: "너무 무난해서 아무 감정이 안 남는 것",
        description: "후유증과 강한 결말을 더 허용합니다.",
        axes: { after: 12 },
        keywords: ["강한결말"],
      },
      {
        id: "no-char",
        label: "좋아할 캐릭터가 하나도 없는 것",
        description: "캐릭터 밀도와 관계성을 더 강하게 봅니다.",
        axes: { character: 10, relationship: 4 },
        keywords: ["최애성분"],
      },
      {
        id: "no-world",
        label: "세계관이 다 보고 나면 남는 게 없는 것",
        description: "설정과 떡밥 회수에 가중치를 줍니다.",
        axes: { world: 10, mystery: 4 },
        keywords: ["세계관잔향"],
      },
    ],
  },
];

const ALLERGY_OPTIONS = [
  "답답한 주인공",
  "열린 결말",
  "과한 서비스신",
  "작화 기복",
  "너무 느린 초반",
  "설명만 많은 세계관",
  "갑자기 분위기 하렘",
  "너무 잔인한 장면",
  "미완결",
  "지나친 고구마 전개",
];

export default function AnimeRecommendPage() {
  const [step, setStep] = useState<Step>("intro");
  const [departmentId, setDepartmentId] = useState<DepartmentId>("heal");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [allergies, setAllergies] = useState<string[]>([]);
  const [liked, setLiked] = useState<string[]>([]);
  const [disliked, setDisliked] = useState<string[]>([]);
  const [retry, setRetry] = useState<RetryAction | undefined>();
  const [copied, setCopied] = useState(false);
  const [loadingLineIndex, setLoadingLineIndex] = useState(0);
  const [candidates, setCandidates] = useState<AnimeCandidate[]>(FALLBACK_CANDIDATES);
  const [copyResult, setCopyResult] = useState<ClinicCopyResult | null>(null);
  const [coverByTitle, setCoverByTitle] = useState<Record<string, string>>({});
  const [imageDataUrls, setImageDataUrls] = useState<Record<string, string>>({});
  const [imagesReady, setImagesReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  const department = DEPARTMENTS.find((item) => item.id === departmentId) ?? DEPARTMENTS[0];
  const answeredCount = QUESTIONS.filter((question) => answers[question.id]).length;
  const canSeeResult = answeredCount === QUESTIONS.length;
  const currentQuestion = QUESTIONS[questionIndex];
  const currentAnswer = currentQuestion ? answers[currentQuestion.id] : undefined;
  const isQuestionDone = questionIndex >= QUESTIONS.length;

  const scores = useMemo(() => {
    const next = initialScores();
    addAxes(next, department.axes);

    QUESTIONS.forEach((question) => {
      const option = question.options.find((item) => item.id === answers[question.id]);
      if (option) addAxes(next, option.axes);
    });

    return applyLikedDislikedToScores(next, candidates, liked, disliked);
  }, [answers, candidates, department.axes, disliked, liked]);

  const diagnosis = useMemo(() => getDiagnosis(scores, allergies), [allergies, scores]);
  const prescriptions = useMemo(
    () => buildPrescriptions(candidates, scores, allergies, answers, retry),
    [allergies, answers, candidates, retry, scores],
  );
  const displayPrescriptions = useMemo(
    () => mergeCopyIntoPrescriptions(prescriptions, copyResult),
    [copyResult, prescriptions],
  );
  const immersionScore = useMemo(() => getImmersionScore(scores, allergies), [allergies, scores]);
  const keywords = useMemo(() => {
    const selectedKeywords = QUESTIONS.flatMap((question) => {
      const option = question.options.find((item) => item.id === answers[question.id]);
      return option?.keywords ?? [];
    });
    const prescriptionKeywords = prescriptions.flatMap((item) => item.matchedTags);
    return [...new Set([...selectedKeywords, ...prescriptionKeywords])].slice(0, 7);
  }, [answers, prescriptions]);

  const currentPayload = useMemo<ClinicSharePayload>(
    () => ({
      departmentId,
      answers,
      allergies,
      liked,
      disliked,
      retry,
    }),
    [allergies, answers, departmentId, disliked, liked, retry],
  );

  useEffect(() => {
    void getClinicCandidates().then(setCandidates);
  }, []);

  useEffect(() => {
    const baseMap = buildCoverMap(candidates);
    const missing = prescriptions.map((item) => item.title).filter((title) => !baseMap[title]);
    if (!missing.length) {
      setCoverByTitle(baseMap);
      return;
    }
    void getWorkCoversByTitles(missing).then((extra) => setCoverByTitle({ ...baseMap, ...extra }));
  }, [candidates, prescriptions]);

  useEffect(() => {
    const urls = prescriptions
      .map((item) => coverByTitle[item.title])
      .filter((url): url is string => Boolean(url));
    if (!urls.length) {
      setImagesReady(false);
      return;
    }

    let cancelled = false;
    void mapUrlsToDataUrls(urls).then((map) => {
      if (cancelled) return;
      setImageDataUrls(map);
      setImagesReady(Object.keys(map).length > 0);
    });

    return () => {
      cancelled = true;
    };
  }, [coverByTitle, prescriptions]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get("clinic");
    if (!encoded) return;

    const payload = decodeClinicPayload(encoded);
    if (!payload) return;

    setDepartmentId(payload.departmentId);
    setAnswers(payload.answers);
    setAllergies(payload.allergies);
    setLiked(payload.liked);
    setDisliked(payload.disliked);
    setRetry(payload.retry);
    setQuestionIndex(QUESTIONS.length);
    setStep("result");
  }, []);

  useEffect(() => {
    if (step !== "loading") return;

    setLoadingLineIndex(0);
    const interval = window.setInterval(() => {
      setLoadingLineIndex((prev) => (prev + 1) % LOADING_LINES.length);
    }, 650);

    let cancelled = false;
    const template = buildTemplateCopy(diagnosis, prescriptions, allergies, immersionScore);

    // 최소 로딩 시간과 AI 응답(최대 대기 6초)을 함께 기다린 뒤 결과로 전환한다.
    const minDelay = new Promise<void>((resolve) => window.setTimeout(resolve, 1200));
    const copyPromise = fetchClinicCopy({
      departmentName: department.name,
      diagnosis,
      prescriptions,
      allergies,
      keywords,
      immersionScore,
    }).catch(() => null);
    const cappedCopy = Promise.race([
      copyPromise,
      new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 6000)),
    ]);

    void Promise.all([minDelay, cappedCopy]).then(([, ai]) => {
      if (cancelled) return;
      setCopyResult(enrichCopyWithAi(template, ai));
      setStep("result");
    });

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // 공유 링크로 결과에 바로 진입하면 로딩 단계를 거치지 않으므로 템플릿 카피를 채워준다.
  useEffect(() => {
    if (step !== "result" || copyResult) return;
    setCopyResult(buildTemplateCopy(diagnosis, prescriptions, allergies, immersionScore));
  }, [step, copyResult, diagnosis, prescriptions, allergies, immersionScore]);

  useEffect(() => {
    if (step !== "result") return;

    try {
      localStorage.setItem(
        "anime-clinic:last-result",
        JSON.stringify({
          savedAt: new Date().toISOString(),
          diagnosis,
          prescriptions: displayPrescriptions,
          keywords,
          immersionScore,
          copyResult,
          payload: currentPayload,
        }),
      );
    } catch {
      // localStorage may be blocked in private browsing; result display should still work.
    }

    try {
      const encoded = encodeClinicPayload(currentPayload);
      window.history.replaceState(null, "", `/play/recommend?clinic=${encoded}`);
    } catch {
      // URL sharing is an enhancement; the rendered result remains valid without it.
    }
  }, [copyResult, currentPayload, diagnosis, displayPrescriptions, immersionScore, keywords, step]);

  const reset = () => {
    setStep("intro");
    setDepartmentId("heal");
    setQuestionIndex(0);
    setAnswers({});
    setAllergies([]);
    setLiked([]);
    setDisliked([]);
    setRetry(undefined);
    setCopyResult(null);
    setCopied(false);
    window.history.replaceState(null, "", "/play/recommend");
  };

  const beginDiagnosis = () => {
    if (!canSeeResult) return;
    setCopied(false);
    setStep("loading");
  };

  const applyRetry = (action: RetryAction) => {
    setRetry(action);
    setCopied(false);
    setStep("loading");
  };

  const shareText = `[과몰입 클리닉 진단 결과]

진단명: ${diagnosis.name}
과몰입 수치: ${immersionScore}/100
${copyResult?.shareSummary ?? diagnosis.summary}
키워드: ${keywords.join(", ")}
처방 작품: ${displayPrescriptions.map((item) => item.title).join(", ")}
주의사항: ${getAvoidText(allergies)}

나도 진단 받기 → ${typeof window !== "undefined" ? window.location.origin : ""}/play/recommend`;

  const handleDownload = async () => {
    const el = resultRef.current;
    if (!el) return;
    setBusy(true);
    try {
      const urls = displayPrescriptions
        .map((item) => coverByTitle[item.title])
        .filter((url): url is string => Boolean(url));

      const captureMap = imagesReady ? { ...imageDataUrls } : await mapUrlsToDataUrls(urls);
      if (!imagesReady) setImageDataUrls(captureMap);

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

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `anime-clinic-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("prescription download failed:", err);
    } finally {
      setBusy(false);
    }
  };

  const handleShare = async () => {
    try {
      const shareUrl = `${window.location.origin}/play/recommend?clinic=${encodeClinicPayload(currentPayload)}`;
      const shareTitle = "과몰입 클리닉 진단 결과";
      let copiedLink = false;

      try {
        await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
        copiedLink = true;
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      } catch {
        /* ignore */
      }

      const canOpenNativeShare =
        typeof navigator.share === "function" &&
        (window.matchMedia("(pointer: coarse)").matches ||
          /Android|iPhone|iPad|iPod/i.test(navigator.userAgent));

      if (canOpenNativeShare) {
        await navigator.share({ title: shareTitle, text: shareText, url: shareUrl });
        return;
      }

      if (!copiedLink) {
        setCopied(false);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      console.error("prescription share failed:", err);
    }
  };

  const activeStage = step === "result" ? 3 : step === "loading" ? 2 : 1;

  return (
    <div className="anime-clinic-page w-full">
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-3 py-4 sm:px-4 lg:px-6">
      {step !== "intro" && (
        <section className="border-b border-gray-200 pb-3">
          <div className="grid grid-cols-[36px_1fr_88px] items-center gap-2 sm:grid-cols-[40px_1fr_96px]">
            <Link
              href="/play"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 sm:h-10 sm:w-10"
              aria-label="바이럴 허브로 돌아가기"
            >
              {step === "result" ? <ArrowLeft className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Link>
            <div className="text-center">
              <p className="text-xl font-black tracking-tight sm:text-2xl">
                과몰입 <span className="text-indigo-500">클리닉+</span>
              </p>
              <p className="mt-0.5 text-[11px] font-bold text-gray-500 sm:text-xs">애니 처방전 발급소</p>
            </div>
            <button
              type="button"
              className="inline-flex h-9 items-center justify-center gap-1 rounded-lg border border-gray-200 bg-white px-2 text-[11px] font-black text-gray-700 sm:h-10 sm:text-xs"
            >
              <BookOpen className="h-3.5 w-3.5" />
              이용 안내
            </button>
          </div>

          <div className="mt-3 grid grid-cols-[1fr_1fr_1fr] items-center gap-2">
            {[
              { stage: 1, label: "상담" },
              { stage: 2, label: "진단" },
              { stage: 3, label: "처방전" },
            ].map(({ stage, label }) => {
              const active = activeStage === stage;
              const done = activeStage > stage;
              return (
                <div key={stage} className="flex items-center gap-2">
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-black sm:h-9 sm:w-9 ${
                      active || done ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-400"
                    }`}
                  >
                    {done ? <CheckCircle2 className="h-4 w-4" /> : stage}
                  </span>
                  <span className={`text-sm font-black sm:text-[15px] ${active || done ? "text-gray-900" : "text-gray-400"}`}>
                    {label}
                  </span>
                  {stage !== 3 && <span className={`h-0.5 flex-1 ${done ? "bg-gray-900" : "bg-gray-200"}`} />}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {step === "intro" && (
        <section className="pb-2">
          <div className="flex flex-col gap-4 lg:min-h-[560px] lg:flex-row lg:items-stretch">
            <div className="relative min-h-[360px] overflow-hidden rounded-lg border border-gray-200 bg-gray-50 lg:w-[430px] lg:min-h-[560px] lg:shrink-0">
              <div className="absolute left-4 top-6 z-10 w-32 rotate-[-7deg] rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                <p className="text-sm font-black leading-6">
                  당신의
                  <br />
                  덕심도,
                  <br />
                  돌봐드립니다.
                </p>
              </div>

              <div className="absolute right-4 top-10 z-10 w-40 rounded-lg border border-gray-200 bg-white p-3 text-center shadow-sm">
                <p className="text-sm font-black leading-6">
                  오늘은
                  <br />
                  어떤 이야기에
                  <br />
                  빠지셨나요?
                </p>
              </div>

              <div className="absolute bottom-4 left-4 z-10 w-36 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                <p className="text-xs font-black">오늘의 처방 체크</p>
                <ul className="mt-2 grid gap-1.5 text-[11px] font-bold text-gray-600">
                  <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" /> 마음 상담</li>
                  <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" /> 몰입도 진단</li>
                  <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" /> 애니 처방전</li>
                </ul>
              </div>

              <div className="absolute bottom-8 right-4 z-10 w-32 rotate-[5deg] rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                <p className="text-xl font-black text-indigo-500">Rx</p>
                <p className="mt-2 text-xs font-black leading-5">
                  딱 맞는
                  <br />
                  이야기를
                  <br />
                  처방해요.
                </p>
              </div>

              <div className="flex h-full min-h-[360px] items-end justify-center bg-gradient-to-b from-gray-100 to-white px-5 pt-16 lg:min-h-[560px]">
                <div className="relative flex h-[300px] w-[270px] flex-col items-center justify-end lg:h-[420px] lg:w-[330px]">
                  <div className="absolute top-1 flex h-40 w-40 items-center justify-center rounded-full border border-gray-200 bg-white shadow-sm lg:h-52 lg:w-52">
                    <div className="flex h-28 w-28 flex-col items-center justify-center rounded-full bg-gray-100 lg:h-36 lg:w-36">
                      <Stethoscope className="h-9 w-9 lg:h-12 lg:w-12" />
                      <span className="mt-2 text-xs font-black lg:text-sm">나루 원장</span>
                    </div>
                  </div>
                  <div className="h-48 w-56 rounded-t-[70px] border border-gray-200 bg-white shadow-sm lg:h-64 lg:w-72" />
                  <div className="absolute bottom-0 h-24 w-72 rounded-t-full bg-white lg:h-32 lg:w-96" />
                </div>
              </div>
            </div>

            <div className="flex flex-1 flex-col justify-center rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-5 lg:p-6">
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-indigo-400">Anime Prescription</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
                과몰입 <span className="text-indigo-500">클리닉+</span>
              </h1>
              <p className="mt-1 text-sm font-black text-gray-500">애니 처방전 발급소</p>
              <p className="mt-4 max-w-md text-[15px] font-bold leading-7 text-gray-700">
                나루 원장과 짧게 상담하면 지금의 몰입 상태를 진단하고, 바로 볼 수 있는 애니 처방전을 발급해드려요.
              </p>
              <p className="mt-3 max-w-md text-xs font-bold leading-5 text-gray-500">
                본 서비스는 엔터테인먼트 목적의 취향 진단입니다. 실제 의학적·정신건강 상담을 대체하지 않습니다.
              </p>

              <div className="mt-5 grid gap-2 sm:max-w-md">
                <button
                  type="button"
                  onClick={() => setStep("department")}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-gray-900 px-5 text-base font-black text-white shadow-sm hover:bg-gray-800"
                >
                  <MessageCircle className="h-5 w-5" />
                  진료 시작하기
                  <ArrowRight className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => document.getElementById("clinic-flow")?.scrollIntoView({ behavior: "smooth", block: "center" })}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 text-sm font-black text-gray-700 shadow-sm hover:bg-gray-50 sm:w-fit"
                >
                  <BookOpen className="h-4 w-4" />
                  이용 방법 보기
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>

              <div id="clinic-flow" className="mt-6 rounded-lg border border-gray-200 bg-white p-4">
                <p className="text-sm font-black text-indigo-500">진료는 이렇게 진행돼요!</p>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    { Icon: MessageCircle, title: "상담", desc: "마음 이야기" },
                    { Icon: HeartPulse, title: "진단", desc: "성향 분석" },
                    { Icon: FileText, title: "처방전", desc: "맞춤 발급" },
                    { Icon: Film, title: "추천 애니", desc: "작품 추천" },
                  ].map(({ Icon, title, desc }) => (
                    <div key={title} className="min-w-0 text-center">
                      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-gray-200 bg-gray-50">
                        <Icon className="h-5 w-5" />
                      </div>
                      <p className="mt-1.5 text-xs font-black">{title}</p>
                      <p className="mt-0.5 text-[11px] font-bold leading-4 text-gray-500">{desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              <p className="mt-4 text-sm font-black text-indigo-400">당신의 덕질, 더 행복해지도록</p>
            </div>
          </div>
        </section>
      )}

      {step === "department" && (
        <section className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <aside className="lg:sticky lg:top-4 lg:w-[380px] lg:shrink-0">
            <div className="relative min-h-[330px] overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
              <div className="absolute right-4 top-4 z-10 max-w-[190px] rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                <p className="text-sm font-black leading-6">
                  안녕하세요! 나루 원장입니다.
                  <br />
                  먼저 <span className="text-indigo-500">진료 방향</span>을 정할게요.
                </p>
                <p className="mt-2 text-xs font-bold leading-5 text-gray-500">
                  가장 가까운 느낌 하나만 골라주세요.
                </p>
              </div>
              <div className="flex min-h-[330px] items-end justify-start px-5 pt-16">
                <div className="relative flex h-72 w-64 flex-col items-center justify-end">
                  <div className="absolute top-2 flex h-40 w-40 items-center justify-center rounded-full border border-gray-200 bg-white shadow-sm">
                    <div className="flex h-28 w-28 flex-col items-center justify-center rounded-full bg-gray-100">
                      <Stethoscope className="h-9 w-9" />
                      <span className="mt-2 text-xs font-black">나루 원장</span>
                    </div>
                  </div>
                  <div className="h-48 w-56 rounded-t-[70px] border border-gray-200 bg-white shadow-sm" />
                </div>
              </div>
            </div>
          </aside>

          <section className="flex-1 rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-black text-indigo-500">
                Q0
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-black leading-7">오늘은 어떤 진료가 필요할까요?</h2>
                <p className="mt-1 text-sm font-bold text-gray-500">하나를 선택해 주세요.</p>
              </div>
            </div>

            <div className="mt-4 grid gap-2.5">
              {DEPARTMENTS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setDepartmentId(item.id)}
                  className={`grid min-h-[58px] grid-cols-[40px_1fr_18px] items-center gap-3 rounded-lg border px-3 py-2 text-left transition ${
                    departmentId === item.id
                      ? "border-gray-900 bg-gray-50"
                      : "border-gray-200 bg-white hover:border-gray-400"
                  }`}
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
                    <Pill className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-black leading-5 text-gray-950">{item.button}</span>
                    <span className="mt-0.5 block text-xs font-bold leading-4 text-gray-500">{item.name} · {item.summary}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                </button>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setQuestionIndex(0);
                  setStep("questions");
                }}
                className="inline-flex h-11 min-w-[180px] items-center justify-center gap-2 rounded-lg bg-gray-900 px-5 text-sm font-black text-white hover:bg-gray-800"
              >
                다음 문진
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </section>
        </section>
      )}

      {step === "questions" && (
        <section className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <aside className="lg:sticky lg:top-4 lg:w-[380px] lg:shrink-0">
            <div className="relative min-h-[330px] overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
              <div className="absolute right-4 top-4 z-10 max-w-[200px] rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                <p className="text-sm font-black leading-6">
                  {isQuestionDone ? "기본 상담은 끝났어요." : "좋아요, 계속 상담해볼게요."}
                </p>
                <p className="mt-2 text-xs font-bold leading-5 text-gray-600">
                  {isQuestionDone ? (
                    <>
                      이제 <span className="text-indigo-500">지뢰 성분</span>과 최근 감상 기록을 확인할게요.
                    </>
                  ) : (
                    <>
                      가장 가까운 답을 고르면 차트에 바로 반영됩니다.
                    </>
                  )}
                </p>
              </div>
              <div className="flex min-h-[330px] items-end justify-start px-5 pt-16">
                <div className="relative flex h-72 w-64 flex-col items-center justify-end">
                  <div className="absolute top-2 flex h-40 w-40 items-center justify-center rounded-full border border-gray-200 bg-white shadow-sm">
                    <div className="flex h-28 w-28 flex-col items-center justify-center rounded-full bg-gray-100">
                      <HeartPulse className="h-9 w-9" />
                      <span className="mt-2 text-xs font-black">나루 원장</span>
                    </div>
                  </div>
                  <div className="h-48 w-56 rounded-t-[70px] border border-gray-200 bg-white shadow-sm" />
                </div>
              </div>
            </div>
          </aside>

          <section className="flex-1 rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
            {!isQuestionDone && currentQuestion ? (
              <>
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-black text-indigo-500">
                    Q{questionIndex + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-xl font-black leading-7">{currentQuestion.text}</h2>
                    <p className="mt-1 text-sm font-bold text-gray-500">하나를 선택해 주세요.</p>
                  </div>
                  <ClipboardList className="hidden h-9 w-9 text-gray-300 sm:block" />
                </div>

                <div className="mt-4 grid gap-2.5">
                  {currentQuestion.options.map((option, optionIndex) => {
                    const checked = currentAnswer === option.id;
                    const optionIcons = [MessageCircle, HeartPulse, Pill, Sparkles, ClipboardList];
                    const OptionIcon = optionIcons[optionIndex % optionIcons.length];
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setAnswers((prev) => ({ ...prev, [currentQuestion.id]: option.id }))}
                        className={`grid min-h-[58px] grid-cols-[40px_1fr_18px] items-center gap-3 rounded-lg border px-3 py-2 text-left transition ${
                          checked
                            ? "border-gray-900 bg-gray-50"
                            : "border-gray-200 bg-white hover:border-gray-400"
                        }`}
                      >
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
                          <OptionIcon className="h-5 w-5" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-black leading-5 text-gray-950">{option.label}</span>
                          <span className="mt-0.5 block text-xs font-bold leading-4 text-gray-500">{option.description}</span>
                        </span>
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      </button>
                    );
                  })}
                </div>

                {currentAnswer && (
                  <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <p className="text-xs font-black text-indigo-500">나루 원장 코멘트</p>
                    <p className="mt-1.5 text-xs font-bold leading-5 text-gray-700">
                      네, 이 항목은 차트에 남기겠습니다. 본인은 가볍게 고른 선택지라고 생각할 수 있지만,
                      추천 로직에는 꽤 큰 신호로 들어갑니다.
                    </p>
                  </div>
                )}

                <div className="mt-5 flex flex-wrap justify-between gap-2">
                  <button
                    type="button"
                    disabled={questionIndex === 0}
                    onClick={() => setQuestionIndex((prev) => Math.max(0, prev - 1))}
                    className="inline-flex h-10 items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 text-sm font-black text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    이전 문진
                  </button>
                  <button
                    type="button"
                    disabled={!currentAnswer}
                    onClick={() => setQuestionIndex((prev) => Math.min(QUESTIONS.length, prev + 1))}
                    className="inline-flex h-11 min-w-[180px] items-center justify-center gap-2 rounded-lg bg-gray-900 px-5 text-sm font-black text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500"
                  >
                    다음 문진
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-black text-indigo-500">
                    Rx
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-xl font-black leading-7">복용 전 알레르기 검사가 필요해요</h2>
                    <p className="mt-1 text-sm font-bold text-gray-500">
                      못 견디는 요소는 추천에서 강하게 제외하거나 주의약으로 분류합니다.
                    </p>
                  </div>
                </div>

                <section className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    {ALLERGY_OPTIONS.map((item) => {
                      const checked = allergies.includes(item);
                      return (
                        <label
                          key={item}
                          className={`flex min-h-[38px] cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs font-black ${
                            checked
                              ? "border-gray-900 bg-white text-gray-900"
                              : "border-gray-200 bg-white text-gray-600"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setAllergies((prev) =>
                                checked ? prev.filter((value) => value !== item) : [...prev, item],
                              )
                            }
                            className="h-3.5 w-3.5 accent-amber-600"
                          />
                          {item}
                        </label>
                      );
                    })}
                  </div>
                </section>

                <section className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <h3 className="text-sm font-black text-gray-950">최근 감상 기록</h3>
                  <p className="mt-1 text-xs leading-5 text-gray-600">
                    작품을 검색해 추가하면 취향 태그에 반영됩니다. 모르는 경우 건너뛰어도 됩니다.
                  </p>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <ClinicWorkPicker
                      label="최근 재밌게 본 작품"
                      values={liked}
                      onChange={setLiked}
                      placeholder="예: 모브사이코 100"
                    />
                    <ClinicWorkPicker
                      label="최근 별로였던 작품"
                      values={disliked}
                      onChange={setDisliked}
                      placeholder="예: 슈타인즈 게이트"
                    />
                  </div>
                </section>

                <div className="mt-5 flex flex-wrap justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setQuestionIndex(QUESTIONS.length - 1)}
                    className="inline-flex h-10 items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 text-sm font-black text-gray-700 hover:bg-gray-50"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    마지막 문진으로 돌아가기
                  </button>
                  <button
                    type="button"
                    disabled={!canSeeResult}
                    onClick={beginDiagnosis}
                    className="inline-flex h-11 min-w-[180px] items-center justify-center gap-2 rounded-lg bg-gray-900 px-5 text-sm font-black text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500"
                  >
                    처방전 발급하기
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </>
            )}
          </section>
        </section>
      )}

      {step === "loading" && (
        <section className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <aside className="lg:sticky lg:top-4 lg:w-[380px] lg:shrink-0">
            <div className="relative min-h-[330px] overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
              <div className="absolute right-4 top-4 z-10 max-w-[190px] rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                <p className="text-sm font-black leading-6">차트를 분석 중입니다.</p>
                <p className="mt-2 text-xs font-bold leading-5 text-gray-600">
                  너무 안전한 처방은 약효가 약해서 후보에서 제외하고 있습니다.
                </p>
              </div>
              <div className="flex min-h-[330px] items-end justify-start px-5 pt-16">
                <div className="relative flex h-72 w-64 flex-col items-center justify-end">
                  <div className="absolute top-2 flex h-40 w-40 items-center justify-center rounded-full border border-gray-200 bg-white shadow-sm">
                    <div className="flex h-28 w-28 flex-col items-center justify-center rounded-full bg-gray-100">
                      <HeartPulse className="h-9 w-9 animate-pulse" />
                      <span className="mt-2 text-xs font-black">진단 중</span>
                    </div>
                  </div>
                  <div className="h-48 w-56 rounded-t-[70px] border border-gray-200 bg-white shadow-sm" />
                </div>
              </div>
            </div>

            <div className="mt-3 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
              <p className="text-xs font-black text-gray-500">예상 진단</p>
              <p className="mt-1 text-base font-black text-gray-950">{diagnosis.name}</p>
              <p className="mt-2 text-xs leading-5 text-gray-600">
                지뢰 {allergies.length}개, 문진 {answeredCount}개, 최근 감상 기록을 함께 대조하고 있습니다.
              </p>
            </div>
          </aside>

          <section className="flex-1 rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="rounded-lg bg-gray-950 p-4 text-white">
              <p className="text-xs font-black text-indigo-300">Naru Clinic</p>
              <p className="mt-2 text-base font-black leading-7">애니 처방 후보를 정리하고 있어요.</p>
              <p className="mt-3 text-sm leading-6 text-gray-300">{LOADING_LINES[loadingLineIndex]}</p>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {prescriptions.map((item, index) => (
                <div key={item.title} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <p className="text-xs font-black text-gray-500">후보 {index + 1}</p>
                  <p className="mt-1 text-sm font-black text-gray-950">{item.category}</p>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                    <div className="h-full animate-pulse bg-indigo-500" style={{ width: `${70 + index * 10}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </section>
      )}

      {step === "result" && (
        <section className="flex flex-col items-center gap-4">
          <PrescriptionResultCard
            cardRef={resultRef}
            department={department}
            diagnosis={diagnosis}
            prescriptions={displayPrescriptions}
            keywords={keywords}
            immersionScore={immersionScore}
            avoidText={getAvoidText(allergies)}
            copyResult={copyResult}
            coverByTitle={coverByTitle}
            imageDataUrls={imageDataUrls}
          />

          <div className="flex w-full max-w-[580px] flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleDownload()}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-indigo-200 bg-white px-4 py-3 text-sm font-black text-indigo-600 shadow-sm hover:bg-indigo-50 disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              {busy ? "저장 중..." : "처방전 저장하기"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleShare()}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-indigo-500 px-4 py-3 text-sm font-black text-white shadow-[0_6px_18px_rgba(99,102,241,0.35)] hover:bg-indigo-600 disabled:opacity-50"
            >
              <Share2 className="h-4 w-4" />
              {copied ? "공유 문구 복사됨" : "공유하기"}
            </button>
          </div>

          <section className="w-full max-w-[580px] rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-black text-gray-950">재처방</h3>
            <p className="mt-1 text-[11px] font-bold text-gray-500">
              약효가 안 맞았다면 방향을 조정해 다시 처방받을 수 있어요.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { id: "lighter", label: "약이 너무 셌어요" },
                { id: "stronger", label: "효과가 약했어요" },
                { id: "oshi", label: "최애 성분 부족" },
                { id: "safe", label: "지뢰 밟았습니다" },
              ].map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => applyRetry(id as RetryAction)}
                  className={`inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border px-2 text-center text-[11px] font-black ${
                    retry === id
                      ? "border-indigo-400 bg-indigo-50 text-indigo-600"
                      : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <RefreshCcw className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={reset}
              className="mt-2 inline-flex h-10 w-full items-center justify-center rounded-xl border border-gray-200 bg-white text-sm font-black text-gray-700 hover:bg-gray-50"
            >
              처음부터 다시 진료
            </button>
          </section>
        </section>
      )}
    </main>
    </div>
  );
}
