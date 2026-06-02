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
import { getWorkCoversByTitles } from "@/lib/supabase/animeRecommendations";
import { mapUrlsToDataUrls, resolveImageSrc } from "@/lib/imageDataUrl";

type DepartmentId = "heal" | "after" | "battle" | "oshi" | "safe";
type Step = "intro" | "department" | "questions" | "loading" | "result";
type RetryAction = "lighter" | "stronger" | "oshi" | "safe";

type Axis =
  | "heal"
  | "after"
  | "battle"
  | "character"
  | "relationship"
  | "world"
  | "mystery"
  | "light";

type Question = {
  id: string;
  eyebrow: string;
  text: string;
  options: Array<{
    id: string;
    label: string;
    description: string;
    axes: Partial<Record<Axis, number>>;
    keywords: string[];
  }>;
};

type AnimeCandidate = {
  title: string;
  tags: string[];
  length: "short" | "medium" | "long";
  complete: boolean;
  intro: "fast" | "slow" | "medium";
  riskTags: string[];
  reason: string;
};

type Prescription = {
  title: string;
  category: "즉효약" | "장기복용약" | "응급처방" | "고위험 고효능";
  effect: string;
  dosage: string;
  sideEffect: string;
  matchedTags: string[];
  warning?: string;
};

type ClinicSharePayload = {
  departmentId: DepartmentId;
  answers: Record<string, string>;
  allergies: string[];
  liked: string;
  disliked: string;
  retry?: RetryAction;
};

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

const CANDIDATES: AnimeCandidate[] = [
  {
    title: "스파이 패밀리",
    tags: ["일상", "코미디", "유사가족", "액션"],
    length: "medium",
    complete: false,
    intro: "fast",
    riskTags: ["미완결"],
    reason: "가족 코미디와 가벼운 액션이 같이 들어간 안전한 응급처방입니다.",
  },
  {
    title: "봇치 더 록!",
    tags: ["일상", "코미디", "성장", "학원", "음악"],
    length: "short",
    complete: true,
    intro: "fast",
    riskTags: [],
    reason: "개그와 성장선이 같이 있어 회복과 응원을 동시에 줍니다.",
  },
  {
    title: "하이큐!!",
    tags: ["스포츠", "성장", "라이벌", "유사가족"],
    length: "long",
    complete: true,
    intro: "medium",
    riskTags: ["장편"],
    reason: "라이벌 인정과 팀 성장 카타르시스가 누적형으로 강합니다.",
  },
  {
    title: "모브사이코 100",
    tags: ["이능력", "액션", "성장", "코미디", "사제관계"],
    length: "medium",
    complete: true,
    intro: "fast",
    riskTags: [],
    reason: "초능력 연출과 캐릭터 성장이 함께 작동하는 균형형 처방입니다.",
  },
  {
    title: "문호 스트레이독스",
    tags: ["이능력", "액션", "캐릭터성", "구원서사", "미스터리"],
    length: "long",
    complete: false,
    intro: "fast",
    riskTags: ["미완결", "장편"],
    reason: "개성 강한 캐릭터와 능력자 배틀로 최애 발생 가능성이 높습니다.",
  },
  {
    title: "86 -에이티식스-",
    tags: ["디스토피아", "정치극", "구원서사", "SF", "후유증"],
    length: "medium",
    complete: true,
    intro: "medium",
    riskTags: ["잔인함", "무거운 감정선"],
    reason: "세계관 압박과 관계성 후유증이 강하게 남는 처방입니다.",
  },
  {
    title: "강철의 연금술사 BROTHERHOOD",
    tags: ["판타지", "액션", "성장", "정치극", "유사가족"],
    length: "long",
    complete: true,
    intro: "fast",
    riskTags: ["장편"],
    reason: "세계관, 액션, 가족 서사, 완결성이 고르게 강합니다.",
  },
  {
    title: "슈타인즈 게이트",
    tags: ["SF", "미스터리", "후유증", "느린 전개"],
    length: "medium",
    complete: true,
    intro: "slow",
    riskTags: ["너무 느린 초반"],
    reason: "초반은 느리지만 후반 약효가 강한 지연성 처방입니다.",
  },
  {
    title: "카구야 님은 고백받고 싶어",
    tags: ["로맨스", "코미디", "학원", "캐릭터성"],
    length: "medium",
    complete: false,
    intro: "fast",
    riskTags: ["미완결"],
    reason: "로맨스 삽질과 개그 템포가 즉각적으로 작동합니다.",
  },
  {
    title: "바이올렛 에버가든",
    tags: ["후유증", "성장", "감정선", "일상"],
    length: "short",
    complete: true,
    intro: "medium",
    riskTags: ["무거운 감정선"],
    reason: "절제된 감정선과 회복 서사로 조용한 후유증을 남깁니다.",
  },
  {
    title: "진격의 거인",
    tags: ["액션", "디스토피아", "정치극", "미스터리", "잔인함"],
    length: "long",
    complete: true,
    intro: "fast",
    riskTags: ["너무 잔인한 장면", "장편"],
    reason: "세계관, 정치극, 고위험 고효능 성분이 매우 강합니다.",
  },
  {
    title: "일상",
    tags: ["일상", "코미디", "학원"],
    length: "medium",
    complete: true,
    intro: "fast",
    riskTags: [],
    reason: "큰 사건 없이도 뇌를 퇴근시키는 순도 높은 개그 처방입니다.",
  },
];

const TAG_AXIS: Record<string, Partial<Record<Axis, number>>> = {
  일상: { heal: 10, light: 8 },
  코미디: { light: 12, heal: 6 },
  학원: { heal: 4, light: 4, relationship: 3 },
  로맨스: { character: 5, relationship: 5, light: 3 },
  성장: { battle: 4, after: 4, character: 4 },
  라이벌: { relationship: 10, battle: 8 },
  사제관계: { relationship: 8, character: 5 },
  유사가족: { relationship: 10, heal: 6 },
  구원서사: { relationship: 12, after: 10, character: 5 },
  이능력: { battle: 10, world: 4 },
  액션: { battle: 12 },
  판타지: { world: 10, battle: 4 },
  정치극: { world: 12, mystery: 6 },
  디스토피아: { world: 10, after: 8 },
  SF: { world: 10, mystery: 8 },
  추리: { mystery: 12 },
  미스터리: { mystery: 12, world: 4 },
  후유증: { after: 14 },
  감정선: { after: 12, character: 4 },
  캐릭터성: { character: 12 },
  스포츠: { battle: 8, relationship: 8 },
  음악: { heal: 4, relationship: 4 },
};

const TAG_COPY: Record<string, string> = {
  액션: "전투 도파민",
  이능력: "능력자 배틀",
  성장: "각성 누적형",
  일상: "저자극 회복식",
  코미디: "뇌 퇴근제",
  학원: "관계성 밀집구역",
  구원서사: "관계성 진통제",
  유사가족: "소속감 보충제",
  라이벌: "인정 욕구 자극제",
  정치극: "권력 구조 해부",
  디스토피아: "멘탈 압박식",
  SF: "논리형 과몰입",
  미스터리: "떡밥 대사제",
  후유증: "천장 응시 성분",
  감정선: "조용한 멘탈 절개",
  캐릭터성: "최애 발생 성분",
  스포츠: "팀 성장 도파민",
  로맨스: "설렘 보충제",
};

const EFFECT_COPY = [
  "취향 반응이 빠르게 올라오는 성분이 확인됩니다.",
  "지금 상태에서 무난한 추천보다 약효가 선명할 가능성이 높습니다.",
  "선택한 문진 항목과 작품 태그가 여러 지점에서 겹칩니다.",
  "과몰입 수치가 과하게 튀지 않으면서도 충분히 자극을 줍니다.",
];

const DOSAGE_COPY = [
  "마음에 드는 캐릭터가 생겨도 즉시 검색하지 마세요. 스포일러는 약효를 망칩니다.",
  "1화만 보고 자가 판단하지 말고 최소 3화까지 경과를 관찰하세요.",
  "이어폰을 착용하고 복용하면 특정 장면의 약효가 올라갑니다.",
  "컨디션이 약한 날에는 연속 복용보다 하루 1~2화 복용을 권장합니다.",
];

const SIDE_COPY = [
  "작품보다 캐릭터 프로필을 더 오래 보고 있을 수 있습니다.",
  "엔딩곡이 며칠 동안 머릿속에서 자동 재생될 수 있습니다.",
  "관계성 해석글을 찾아보다 시간이 사라질 수 있습니다.",
  "가벼운 마음으로 시작했다가 원작이나 외전까지 확인할 수 있습니다.",
];

const LOADING_LINES = [
  "문진표를 분석 중입니다. 숨겨진 취향이 생각보다 많이 나왔습니다.",
  "최애 발생 가능성을 검사 중입니다. 위험 수치가 조금 높습니다.",
  "지뢰 요소를 제거하는 중입니다. 고구마와 열린 결말을 조심스럽게 분리하고 있습니다.",
  "처방전을 작성 중입니다. 너무 안전한 추천은 약효가 약해 제외했습니다.",
  "작품 후보를 선별 중입니다. 유명하다는 이유만으로 처방하지 않습니다.",
  "취향을 해석하는 중입니다. 본인은 부정하실 수 있지만 데이터는 솔직합니다.",
];

function isDepartmentId(value: string | undefined): value is DepartmentId {
  return Boolean(value && DEPARTMENTS.some((department) => department.id === value));
}

function isRetryAction(value: string | undefined): value is RetryAction {
  return value === "lighter" || value === "stronger" || value === "oshi" || value === "safe";
}

function encodeClinicPayload(payload: ClinicSharePayload) {
  const json = JSON.stringify(payload);
  return btoa(encodeURIComponent(json))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function decodeClinicPayload(value: string): ClinicSharePayload | null {
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const parsed = JSON.parse(decodeURIComponent(atob(padded))) as Partial<ClinicSharePayload>;

    if (!isDepartmentId(parsed.departmentId)) return null;

    return {
      departmentId: parsed.departmentId,
      answers: parsed.answers && typeof parsed.answers === "object" ? parsed.answers : {},
      allergies: Array.isArray(parsed.allergies)
        ? parsed.allergies.filter((item): item is string => typeof item === "string")
        : [],
      liked: typeof parsed.liked === "string" ? parsed.liked : "",
      disliked: typeof parsed.disliked === "string" ? parsed.disliked : "",
      retry: isRetryAction(parsed.retry) ? parsed.retry : undefined,
    };
  } catch {
    return null;
  }
}

function addAxes(target: Record<Axis, number>, axes: Partial<Record<Axis, number>>, multiplier = 1) {
  Object.entries(axes).forEach(([axis, value]) => {
    target[axis as Axis] += (value ?? 0) * multiplier;
  });
}

function getTopAxes(scores: Record<Axis, number>) {
  return (Object.entries(scores) as Array<[Axis, number]>).sort((a, b) => b[1] - a[1]).slice(0, 3);
}

function getDiagnosis(scores: Record<Axis, number>, allergies: string[]) {
  const [top] = getTopAxes(scores);
  const axis = top?.[0] ?? "heal";

  if (allergies.length >= 4) {
    return {
      name: "입덕 초기 안전처방형",
      summary: "좋아하는 것보다 싫은 것을 피해야 만족도가 올라갑니다.",
      opinion: "알레르기 검사에서 여러 지뢰 성분이 확인되었습니다. 현재는 강한 약효보다 추천 실패를 줄이는 처방이 먼저입니다.",
    };
  }

  const map: Record<Axis, { name: string; summary: string; opinion: string }> = {
    heal: {
      name: "현실도피성 개그 결핍",
      summary: "뇌를 잠시 퇴근시킬 처방이 필요합니다.",
      opinion: "복잡한 세계관이나 무거운 서사보다 즉각적인 웃음과 캐릭터 케미가 필요한 상태입니다.",
    },
    light: {
      name: "저자극 회복 필요형",
      summary: "큰 사건 없이 웃는 애들이 필요한 상태입니다.",
      opinion: "현재는 감정선을 깊게 찌르는 작품보다 부담 없이 회복되는 작품이 더 적합합니다.",
    },
    after: {
      name: "후유증 결핍 증후군",
      summary: "가볍게 보려다 며칠 생각나는 작품이 필요한 상태입니다.",
      opinion: "무난한 작품만 복용해 감정선 반응이 둔해진 상태입니다. 지금은 보고 나서 잠깐 멍해지는 작품이 필요합니다.",
    },
    battle: {
      name: "배틀뽕 금단증상",
      summary: "가슴이 웅장해지는 장면 섭취량이 부족합니다.",
      opinion: "OST, 각성, 작화 폭발, 동료의 외침에 대한 반응성이 높게 나타납니다.",
    },
    character: {
      name: "최애 의존성 과몰입",
      summary: "추천작보다 위험 인물을 먼저 찾는 상태입니다.",
      opinion: "작품 전체를 보기 전에 캐릭터 한 명에게 먼저 감기는 경향이 있습니다. 이번 처방에도 위험 인물이 포함되어 있을 수 있습니다.",
    },
    relationship: {
      name: "관계성 중독 의심",
      summary: "서로를 구원하는 관계에 반복적으로 무너집니다.",
      opinion: "개별 장르보다 인물 사이의 변화, 인정, 구원에 더 빠르게 반응하는 상태입니다.",
    },
    world: {
      name: "세계관 분석 과다증",
      summary: "작품을 보는 게 아니라 설정집을 뜯어먹는 중입니다.",
      opinion: "캐릭터보다 조직도, 설정, 권력 구조가 먼저 눈에 들어오는 상태입니다.",
    },
    mystery: {
      name: "떡밥 추적 과각성",
      summary: "엔딩 후에도 혼자 해석을 계속합니다.",
      opinion: "대사 하나를 그냥 넘기지 못하고, 작품이 끝난 뒤에도 뇌가 자체적으로 2차 진료를 시작합니다.",
    },
  };

  return map[axis];
}

function allergyPenalty(candidate: AnimeCandidate, allergies: string[], strict: boolean) {
  let penalty = 0;
  const warnings: string[] = [];

  allergies.forEach((allergy) => {
    const hit =
      candidate.riskTags.includes(allergy) ||
      (allergy === "미완결" && !candidate.complete) ||
      (allergy === "너무 느린 초반" && candidate.intro === "slow") ||
      (allergy === "열린 결말" && candidate.tags.includes("미스터리")) ||
      (allergy === "설명만 많은 세계관" && candidate.tags.some((tag) => ["SF", "정치극", "판타지"].includes(tag))) ||
      (allergy === "너무 잔인한 장면" && candidate.tags.some((tag) => ["잔인함", "디스토피아"].includes(tag)));

    if (hit) {
      penalty += strict ? 80 : 34;
      warnings.push(allergy);
    }
  });

  return { penalty, warnings };
}

function buildPrescriptions(
  scores: Record<Axis, number>,
  allergies: string[],
  answers: Record<string, string>,
  retry?: RetryAction,
) {
  const strict = retry === "safe";
  const adjustedScores = { ...scores };

  if (retry === "lighter") {
    adjustedScores.heal += 24;
    adjustedScores.light += 20;
    adjustedScores.after -= 12;
  }
  if (retry === "stronger") {
    adjustedScores.after += 18;
    adjustedScores.battle += 12;
    adjustedScores.world += 8;
  }
  if (retry === "oshi") {
    adjustedScores.character += 24;
    adjustedScores.relationship += 16;
  }

  const lengthAnswer = answers.length;

  const ranked = CANDIDATES.map((candidate) => {
    let score = 0;
    const matchedTags: string[] = [];

    candidate.tags.forEach((tag) => {
      const tagAxes = TAG_AXIS[tag] ?? {};
      const before = score;
      Object.entries(tagAxes).forEach(([axis, weight]) => {
        score += (adjustedScores[axis as Axis] ?? 0) * (weight ?? 0);
      });
      if (score > before) matchedTags.push(tag);
    });

    if (lengthAnswer === "short" && candidate.length === "short") score += 320;
    if (lengthAnswer === "short" && candidate.length === "long") score -= 260;
    if (lengthAnswer === "medium" && candidate.length !== "long") score += 160;
    if (lengthAnswer === "long" && candidate.length === "long") score += 220;
    if (lengthAnswer === "complete" && candidate.complete) score += 260;
    if (lengthAnswer === "complete" && !candidate.complete) score -= 500;
    if (answers.pace === "drop" && candidate.intro === "fast") score += 180;
    if (answers.pace === "drop" && candidate.intro === "slow") score -= 260;
    if (answers.pace === "wait" && candidate.intro === "slow") score += 170;

    const allergy = allergyPenalty(candidate, allergies, strict);
    score -= allergy.penalty;

    return { candidate, score, warnings: allergy.warnings, matchedTags: [...new Set(matchedTags)] };
  }).sort((a, b) => b.score - a.score);

  return ranked.slice(0, 3).map((item, index): Prescription => {
    const hasWarning = item.warnings.length > 0;
    const category: Prescription["category"] =
      hasWarning && item.score > 900
        ? "고위험 고효능"
        : index === 0
          ? item.candidate.intro === "slow"
            ? "장기복용약"
            : "즉효약"
          : item.candidate.tags.some((tag) => ["일상", "코미디"].includes(tag))
            ? "응급처방"
            : item.candidate.length === "long" || item.candidate.intro === "slow"
              ? "장기복용약"
              : "즉효약";

    const copyTags = item.matchedTags.slice(0, 3).map((tag) => TAG_COPY[tag] ?? tag);

    return {
      title: item.candidate.title,
      category,
      matchedTags: copyTags,
      effect: `${item.candidate.reason} ${EFFECT_COPY[index % EFFECT_COPY.length]}`,
      dosage: DOSAGE_COPY[(index + item.matchedTags.length) % DOSAGE_COPY.length],
      sideEffect: SIDE_COPY[(index + allergies.length) % SIDE_COPY.length],
      warning: hasWarning
        ? `${item.warnings.join(", ")} 성분이 감지되어 주의약으로 분류했습니다. 약효는 있지만 현재 상태에서는 용량 조절이 필요합니다.`
        : undefined,
    };
  });
}

function getAvoidText(allergies: string[]) {
  if (allergies.length === 0) {
    return "특별한 금지약은 확인되지 않았습니다. 다만 검색창에 캐릭터 이름을 입력하는 행동은 모든 처방에서 주의가 필요합니다.";
  }

  const primary = allergies.slice(0, 3).join(", ");
  return `${primary} 성분은 이번 처방에서 강하게 감량했습니다. 유명작이라도 지뢰 성분이 강하면 우선 제외합니다.`;
}

function getImmersionScore(scores: Record<Axis, number>, allergies: string[]) {
  const total = Object.values(scores).reduce((sum, value) => sum + Math.max(0, value), 0);
  return Math.min(98, Math.max(42, Math.round(total / 6) + allergies.length * 3));
}

function initialScores(): Record<Axis, number> {
  return {
    heal: 0,
    after: 0,
    battle: 0,
    character: 0,
    relationship: 0,
    world: 0,
    mystery: 0,
    light: 0,
  };
}

function PrescriptionCover({
  title,
  coverUrl,
  imageDataUrls,
  className = "",
}: {
  title: string;
  coverUrl?: string;
  imageDataUrls: Record<string, string>;
  className?: string;
}) {
  const src = resolveImageSrc(coverUrl, imageDataUrls);

  return (
    <div className={`overflow-hidden bg-gray-100 ${className}`}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={title} draggable={false} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <Film className="h-7 w-7 text-gray-400" />
        </div>
      )}
    </div>
  );
}

function ClinicStamp() {
  return (
    <div className="relative flex h-[68px] w-[68px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-dashed border-indigo-300 text-indigo-400">
      <div className="flex flex-col items-center justify-center text-center leading-none">
        <span className="text-[7px] font-black tracking-tight">과몰입 클리닉</span>
        <PawPrint className="my-1 h-5 w-5" />
        <span className="text-[7px] font-black tracking-tight">처방 완료</span>
      </div>
    </div>
  );
}

function PrescriptionResultCard({
  cardRef,
  diagnosis,
  prescriptions,
  immersionScore,
  allergies,
  coverByTitle,
  imageDataUrls,
}: {
  cardRef: React.RefObject<HTMLDivElement | null>;
  diagnosis: { name: string; summary: string; opinion: string };
  prescriptions: Prescription[];
  immersionScore: number;
  allergies: string[];
  coverByTitle: Record<string, string>;
  imageDataUrls: Record<string, string>;
}) {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const prescriptionDate = `${now.getFullYear()}.${mm}.${dd}`;
  const prescriptionNo = `A-${yy}${mm}${dd}`;

  return (
    <div
      ref={cardRef}
      className="w-full max-w-[580px] overflow-hidden rounded-[28px] border border-indigo-100 shadow-[0_18px_50px_rgba(99,102,241,0.18)]"
      style={{
        background:
          "radial-gradient(120% 60% at 80% -10%, #e6ebff 0%, transparent 55%), linear-gradient(180deg, #eef1fe 0%, #f6f4ff 38%, #ffffff 100%)",
      }}
    >
      {/* 히어로 */}
      <div className="relative px-5 pt-6 pb-3">
        <div className="absolute right-4 top-5 h-24 w-24 rounded-full bg-indigo-200/40 blur-2xl" aria-hidden />
        <div className="relative flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-100 bg-white px-3 py-1 text-[11px] font-black text-indigo-500 shadow-sm">
              <CheckCircle2 className="h-3.5 w-3.5" />
              진단 완료!
            </span>
            <p className="mt-3 text-[13px] font-black text-gray-500">당신의 진단 결과</p>
            <h2 className="mt-1 text-2xl font-black leading-8 text-indigo-600">
              “{diagnosis.name}”
            </h2>
            <p className="mt-3 text-[13px] font-bold leading-6 text-gray-600">
              {diagnosis.summary}
              <br />
              당신만을 위한 애니 처방전을 준비했어요.
            </p>
          </div>

          {/* 일러스트 영역 (나루 원장) */}
          <div className="relative hidden h-[150px] w-[120px] shrink-0 sm:block">
            <div className="absolute right-0 top-1 flex h-[110px] w-[110px] items-center justify-center rounded-full border border-white bg-white/70 shadow-sm">
              <div className="flex h-[84px] w-[84px] flex-col items-center justify-center rounded-full bg-indigo-100 text-indigo-500">
                <Stethoscope className="h-8 w-8" />
                <span className="mt-1 text-[10px] font-black">나루 원장</span>
              </div>
            </div>
            <div className="absolute bottom-0 left-0 w-[88px] rotate-[-6deg] rounded-xl border border-indigo-100 bg-white p-2 shadow-sm">
              <p className="text-[11px] font-black text-indigo-500">Rx</p>
              <p className="mt-0.5 text-[9px] font-bold leading-3 text-gray-500">
                딱 맞는
                <br />
                이야기를
                <br />
                처방해요.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 처방전 본체 */}
      <div className="mx-4 mb-4 rounded-3xl border border-indigo-100 bg-white px-4 py-5 shadow-sm">
        <div className="flex items-center justify-center gap-2">
          <Leaf className="h-4 w-4 -scale-x-100 text-indigo-300" />
          <h3 className="text-xl font-black tracking-[0.12em] text-indigo-600">애니 처방전</h3>
          <Leaf className="h-4 w-4 text-indigo-300" />
        </div>

        {/* 환자 정보 */}
        <div className="mt-4 flex items-start gap-3 rounded-2xl bg-indigo-50/60 p-3">
          <div className="grid flex-1 grid-cols-2 gap-x-3 gap-y-2 text-[11px] font-bold text-gray-600">
            <p>
              <span className="mr-1.5 rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-black text-indigo-500">
                환자명
              </span>
              과몰입 님
            </p>
            <p>
              <span className="mr-1.5 rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-black text-indigo-500">
                진단명
              </span>
              {diagnosis.name}
            </p>
            <p>
              <span className="mr-1.5 rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-black text-indigo-500">
                처방 일자
              </span>
              {prescriptionDate}
            </p>
            <p>
              <span className="mr-1.5 rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-black text-indigo-500">
                처방 번호
              </span>
              {prescriptionNo}
            </p>
          </div>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-dashed border-indigo-200 text-indigo-300">
            <PawPrint className="h-6 w-6" />
          </div>
        </div>

        {/* 처방 목록 */}
        <div className="mt-3 flex flex-col gap-2.5">
          {prescriptions.map((item) => (
            <div
              key={item.title}
              className="grid grid-cols-[52px_1fr_96px] gap-2.5 rounded-2xl border border-indigo-50 bg-white p-2.5 shadow-[0_2px_8px_rgba(99,102,241,0.06)]"
            >
              <PrescriptionCover
                title={item.title}
                coverUrl={coverByTitle[item.title]}
                imageDataUrls={imageDataUrls}
                className="h-[68px] w-[52px] rounded-lg border border-indigo-100"
              />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1">
                  <h4 className="text-[15px] font-black text-gray-900">{item.title}</h4>
                </div>
                {item.matchedTags.length > 0 && (
                  <p className="mt-0.5 text-[10px] font-bold text-indigo-400">
                    {item.matchedTags.slice(0, 2).join(" · ")}
                  </p>
                )}
                <p className="mt-1 line-clamp-2 text-[11px] font-bold leading-4 text-gray-500">
                  {item.effect}
                </p>
              </div>
              <div className="border-l border-indigo-50 pl-2.5">
                <p className="text-[10px] font-black text-indigo-500">복용법</p>
                <div className="mt-1 flex items-start gap-1">
                  <Pill className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-400" />
                  <p className="text-[10px] font-bold leading-4 text-gray-600">{item.dosage}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 주의사항 + 도장/서명 */}
        <div className="mt-4 flex items-end justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-[12px] font-black text-indigo-500">
              <HeartPulse className="h-3.5 w-3.5" />
              주의사항
            </p>
            <p className="mt-1.5 text-[11px] font-bold leading-5 text-gray-500">
              {getAvoidText(allergies)}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-center gap-1">
            <ClinicStamp />
            <span className="text-[13px] italic text-indigo-400" style={{ fontFamily: "cursive" }}>
              나루
            </span>
          </div>
        </div>
      </div>

      {/* 요약 스탯 */}
      <div className="mx-4 mb-3 grid grid-cols-4 gap-2 rounded-2xl border border-indigo-100 bg-white px-2 py-3 shadow-sm">
        {[
          { Icon: Clock, label: "총 추천 시간", value: "약 34시간" },
          { Icon: HeartPulse, label: "몰입도 상승", value: `+${immersionScore}%` },
          { Icon: Pill, label: "처방 애니", value: `${prescriptions.length}종` },
          { Icon: ClipboardList, label: "맞춤 처방 완료", value: "GOOD!" },
        ].map(({ Icon, label, value }) => (
          <div key={label} className="flex min-w-0 flex-col items-center gap-1 text-center">
            <Icon className="h-4 w-4 text-indigo-400" />
            <p className="text-[9px] font-black leading-3 text-gray-400">{label}</p>
            <p className="text-[11px] font-black text-indigo-500">{value}</p>
          </div>
        ))}
      </div>

      <p className="px-5 pb-5 text-center text-[11px] font-bold text-gray-400">
        나만의 애니 처방전, 소중한 사람에게도 공유해보세요 ✨
      </p>
    </div>
  );
}

export default function AnimeRecommendPage() {
  const [step, setStep] = useState<Step>("intro");
  const [departmentId, setDepartmentId] = useState<DepartmentId>("heal");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [allergies, setAllergies] = useState<string[]>([]);
  const [liked, setLiked] = useState("");
  const [disliked, setDisliked] = useState("");
  const [retry, setRetry] = useState<RetryAction | undefined>();
  const [copied, setCopied] = useState(false);
  const [loadingLineIndex, setLoadingLineIndex] = useState(0);
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

    const likedText = liked.toLowerCase();
    const dislikedText = disliked.toLowerCase();
    CANDIDATES.forEach((candidate) => {
      const title = candidate.title.toLowerCase();
      if (likedText.includes(title)) {
        candidate.tags.forEach((tag) => addAxes(next, TAG_AXIS[tag] ?? {}, 0.35));
      }
      if (dislikedText.includes(title)) {
        candidate.tags.forEach((tag) => addAxes(next, TAG_AXIS[tag] ?? {}, -0.18));
      }
    });

    return next;
  }, [answers, department.axes, disliked, liked]);

  const diagnosis = useMemo(() => getDiagnosis(scores, allergies), [allergies, scores]);
  const prescriptions = useMemo(() => buildPrescriptions(scores, allergies, answers, retry), [allergies, answers, retry, scores]);
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
    void getWorkCoversByTitles(CANDIDATES.map((candidate) => candidate.title)).then(setCoverByTitle);
  }, []);

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
    const timeout = window.setTimeout(() => {
      setStep("result");
    }, 2100);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [step]);

  useEffect(() => {
    if (step !== "result") return;

    try {
      localStorage.setItem(
        "anime-clinic:last-result",
        JSON.stringify({
          savedAt: new Date().toISOString(),
          diagnosis,
          prescriptions,
          keywords,
          immersionScore,
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
  }, [currentPayload, diagnosis, immersionScore, keywords, prescriptions, step]);

  const reset = () => {
    setStep("intro");
    setDepartmentId("heal");
    setQuestionIndex(0);
    setAnswers({});
    setAllergies([]);
    setLiked("");
    setDisliked("");
    setRetry(undefined);
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

  const shareText = `[과몰입 클리닉 진단 결과]\n\n진단명: ${diagnosis.name}\n요약: ${diagnosis.summary}\n처방 작품: ${prescriptions
    .map((item) => item.title)
    .join(", ")}\n주의사항: ${getAvoidText(allergies)}\n\n내 과몰입 진단 받기`;

  const handleDownload = async () => {
    const el = resultRef.current;
    if (!el) return;
    setBusy(true);
    try {
      const urls = prescriptions
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
                    작품명은 쉼표로 구분해 직접 입력할 수 있습니다. 등록 후보명과 일치하면 태그 신호로 반영합니다.
                  </p>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <label className="block">
                      <span className="text-xs font-black text-gray-700">최근 재밌게 본 작품</span>
                      <textarea
                        value={liked}
                        onChange={(event) => setLiked(event.target.value)}
                        rows={2}
                        placeholder="예: 모브사이코 100, 하이큐!!"
                        className="mt-1 w-full resize-none rounded-lg border border-gray-200 bg-white p-2.5 text-sm outline-none focus:border-gray-900"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-black text-gray-700">최근 별로였던 작품</span>
                      <textarea
                        value={disliked}
                        onChange={(event) => setDisliked(event.target.value)}
                        rows={2}
                        placeholder="예: 슈타인즈 게이트"
                        className="mt-1 w-full resize-none rounded-lg border border-gray-200 bg-white p-2.5 text-sm outline-none focus:border-gray-900"
                      />
                    </label>
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
            diagnosis={diagnosis}
            prescriptions={prescriptions}
            immersionScore={immersionScore}
            allergies={allergies}
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
