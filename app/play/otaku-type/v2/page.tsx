"use client";

import { useState } from "react";
import Link from "next/link";

type V2Type = "idol" | "munchkin" | "school" | "animal" | "monster" | "sports" | "adventure" | "bishounen" | "family";

interface V2Option {
  label: string;
  text: string;
  type: V2Type;
}

interface V2Question {
  num: number;
  text: string;
  icon: string;
  options: V2Option[];
}

interface AnimeRec {
  title: string;
  reason: string;
}

interface V2Result {
  emoji: string;
  badge: string;
  badgeColor: string;
  badgeBg: string;
  headerGradient: string;
  title: string;
  sub: string;
  traits: [string, string, string];
  recommendedAnime: AnimeRec[];
}

// ─── 질문 데이터 ─────────────────────────────────────────────

const QUESTIONS: V2Question[] = [
  {
    num: 1,
    text: "새 애니 1화, 10분이 지났는데 아직 아무것도 안 일어났다. 당신은?",
    icon: "📺",
    options: [
      { label: "A", text: "OST가 분위기 있으면 일단 참고 본다.", type: "idol" },
      { label: "B", text: "10분이면 충분히 판단 가능. 바로 드롭한다.", type: "munchkin" },
      { label: "C", text: "일상물인가 보다 하고 느긋하게 감상한다.", type: "school" },
      { label: "D", text: "귀여운 캐릭터가 나오면 무조건 참는다.", type: "animal" },
      { label: "E", text: "설정 설명 중이겠거니 하고 계속 본다.", type: "monster" },
    ],
  },
  {
    num: 2,
    text: "나는 애니에서 어떤 장면에 가장 두근거리나?",
    icon: "💓",
    options: [
      { label: "A", text: "팀이 역전하는 그 순간의 열기!", type: "sports" },
      { label: "B", text: "넓은 세계로 떠나는 모험의 설렘", type: "adventure" },
      { label: "C", text: "잘생긴 캐릭터들의 눈빛 교환 장면", type: "bishounen" },
      { label: "D", text: "캐릭터들이 서로를 아끼는 따뜻한 장면", type: "family" },
      { label: "E", text: "아이돌이 무대에 서는 화려한 퍼포먼스", type: "idol" },
    ],
  },
  {
    num: 3,
    text: "최애 캐릭터가 다쳤다. 내 반응은?",
    icon: "😭",
    options: [
      { label: "A", text: "왜 더 강해지지 않았냐며 속에서 열불이 난다.", type: "munchkin" },
      { label: "B", text: "친구들이 곁에 있어서 다행이라고 생각한다.", type: "school" },
      { label: "C", text: "치료해주고 싶어서 안절부절 못한다.", type: "animal" },
      { label: "D", text: "이게 각성 플래그! 오히려 기대가 된다.", type: "monster" },
      { label: "E", text: "정신력으로 반드시 이겨낼 거라 믿는다.", type: "sports" },
    ],
  },
  {
    num: 4,
    text: "시즌 2 제작 발표. 가장 기대되는 건?",
    icon: "🎉",
    options: [
      { label: "A", text: "새로운 세계와 장소 탐험", type: "adventure" },
      { label: "B", text: "새 미남 캐릭터 추가될 것 같은 예감", type: "bishounen" },
      { label: "C", text: "주인공 팀의 유대가 더 깊어지는 것", type: "family" },
      { label: "D", text: "새 노래와 무대 퍼포먼스", type: "idol" },
      { label: "E", text: "주인공이 더 강해지는 모습", type: "munchkin" },
    ],
  },
  {
    num: 5,
    text: "덕질하면서 가장 '아 이래서 이거 보는구나' 싶었던 순간은?",
    icon: "✨",
    options: [
      { label: "A", text: "친구들이 웃고 떠들며 청춘을 보내는 장면", type: "school" },
      { label: "B", text: "귀여운 마스코트가 엄청 활약하는 장면", type: "animal" },
      { label: "C", text: "연습의 결실이 경기에서 폭발하는 그 순간", type: "sports" },
      { label: "D", text: "지도에 없는 미지의 장소를 발견했을 때", type: "adventure" },
      { label: "E", text: "거대한 보스와의 숨막히는 대결 장면", type: "monster" },
    ],
  },
  {
    num: 6,
    text: "애니 속 세계에 들어간다면 제일 먼저 하고 싶은 건?",
    icon: "🌀",
    options: [
      { label: "A", text: "멋진 캐릭터들 곁에서 눈호강하기", type: "bishounen" },
      { label: "B", text: "주인공 팀에 합류해서 따뜻하게 지내기", type: "family" },
      { label: "C", text: "아이돌 그룹 연습생으로 데뷔 준비하기", type: "idol" },
      { label: "D", text: "최강의 능력을 얻어서 무쌍 찍기", type: "munchkin" },
      { label: "E", text: "학교 다니며 친구 사귀고 청춘 즐기기", type: "school" },
    ],
  },
  {
    num: 7,
    text: "다음 중 나를 가장 잘 설명하는 문장은?",
    icon: "🪞",
    options: [
      { label: "A", text: "귀여운 것에 무장 해제. 힐링이 최우선이다.", type: "animal" },
      { label: "B", text: "강렬한 배틀과 박진감 넘치는 전개를 좋아한다.", type: "monster" },
      { label: "C", text: "땀과 노력, 팀워크로 이루는 승리가 감동적이다.", type: "sports" },
      { label: "D", text: "자유롭게 세계를 탐험하는 이야기에 설렌다.", type: "adventure" },
      { label: "E", text: "아름다운 캐릭터들의 미적인 연출에 눈이 간다.", type: "bishounen" },
    ],
  },
  {
    num: 8,
    text: "마지막화를 다 보고 난 뒤 제일 먼저 드는 생각은?",
    icon: "🌙",
    options: [
      { label: "A", text: "이 멤버들과 함께라서 행복한 여정이었다.", type: "family" },
      { label: "B", text: "OST가 너무 좋아서 BGM 플리를 만들어야겠다.", type: "idol" },
      { label: "C", text: "주인공 최종 스펙이 얼마나 됐는지 계산해본다.", type: "munchkin" },
      { label: "D", text: "학창 시절 추억이 떠오르며 코끝이 찡해진다.", type: "school" },
      { label: "E", text: "마스코트 캐릭터의 이후 이야기가 더 궁금해진다.", type: "animal" },
    ],
  },
  {
    num: 9,
    text: "주변에 애니를 추천할 때 나의 기준은?",
    icon: "📋",
    options: [
      { label: "A", text: "배틀 장면이 시원시원하고 연출이 화려한지", type: "monster" },
      { label: "B", text: "열혈 감동 요소가 있는지, 눈물 흘릴 각인지", type: "sports" },
      { label: "C", text: "세계관이 넓고 탐험의 재미가 있는지", type: "adventure" },
      { label: "D", text: "작화가 예쁘고 캐릭터가 매력적인지", type: "bishounen" },
      { label: "E", text: "따뜻하고 모두가 함께 볼 수 있는지", type: "family" },
    ],
  },
  {
    num: 10,
    text: "지금 이 순간, 나를 가장 잘 표현하는 취향은?",
    icon: "🎯",
    options: [
      { label: "A", text: "반짝이는 무대와 노래, 팬덤 문화", type: "idol" },
      { label: "B", text: "강함을 추구하고 성장하는 주인공", type: "munchkin" },
      { label: "C", text: "평범하지만 소중한 일상과 우정", type: "school" },
      { label: "D", text: "귀엽고 힐링되는 모든 것", type: "animal" },
      { label: "E", text: "압도적인 배틀과 다크한 서사", type: "monster" },
    ],
  },
];

// ─── 결과 유형 ───────────────────────────────────────────────

const TYPES: Record<V2Type, V2Result> = {
  idol: {
    emoji: "🎤",
    badge: "아이돌 덕후",
    badgeColor: "#D4537E",
    badgeBg: "#FBEAF0",
    headerGradient: "linear-gradient(135deg, #F9A8C9 0%, #F472B6 100%)",
    title: "무대 위의 별을 쫓는 팬",
    sub: "반짝이는 무대와 음악, 팬덤 문화에 진심인 타입. 좋아하는 아이돌의 신보가 나오는 날은 최고의 날이에요. 응원과 열정으로 세상을 채우는 빛나는 팬입니다.",
    traits: ["최애의 신곡은 발매일 당일 완청이 기본", "라이브 영상 반복 재생은 운동 루틴과 다름없어요", "OST 플리가 폰 저장공간의 절반을 차지해요"],
    compat: "🤝 잘 맞는 유형: 미형 캐릭터 덕후",
    recommendedAnime: [
      { title: "러브라이브!", reason: "팬덤과 함께 만들어가는 아이돌의 정수" },
      { title: "아이돌마스터", reason: "각 캐릭터 스토리와 노래가 풍부" },
      { title: "봇치 더 록!", reason: "음악 덕후라면 공감 100% 성장기" },
      { title: "우마무스메 프리티 더비", reason: "화려한 라이브와 열정적인 팬덤" },
    ],
  },
  munchkin: {
    emoji: "⚡",
    badge: "먼치킨 덕후",
    badgeColor: "#534AB7",
    badgeBg: "#EEEDFE",
    headerGradient: "linear-gradient(135deg, #A5B4FC 0%, #818CF8 100%)",
    title: "최강 주인공을 쫓는 오타쿠",
    sub: "주인공이 강해지는 과정에 가장 설레는 타입. 이능력, 전생, 먼치킨 장르의 핵심 독자예요. 스펙 계산과 능력 분석은 취미이자 특기입니다.",
    traits: ["주인공 스탯 계산은 기본 중의 기본", "각성 장면에서 소름이 돋는 건 매번", "이능력·전생물 신작 체크는 생활 루틴이에요"],
    compat: "🤝 잘 맞는 유형: 배틀 덕후",
    recommendedAnime: [
      { title: "전생했더니 슬라임이었던 건에 대하여", reason: "먼치킨 성장의 교과서" },
      { title: "나 혼자만 레벨업", reason: "압도적 성장 서사의 끝판왕" },
      { title: "귀멸의 칼날", reason: "성장과 강함 추구의 정석" },
      { title: "Re:제로부터 시작하는 이세계 생활", reason: "먼치킨 속 깊은 서사" },
    ],
  },
  school: {
    emoji: "🏫",
    badge: "학원물 덕후",
    badgeColor: "#185FA5",
    badgeBg: "#E6F1FB",
    headerGradient: "linear-gradient(135deg, #93C5FD 0%, #60A5FA 100%)",
    title: "청춘의 한 페이지를 사는 사람",
    sub: "학교를 배경으로 한 청춘, 우정, 로맨스에 감동받는 타입. 캐릭터들의 일상이 곧 위안이 되고, 보고 나면 왠지 모르게 학창 시절이 떠오르는 그 느낌을 좋아해요.",
    traits: ["학원물 추천 목록은 항상 준비되어 있어요", "동아리 결성 씬에서 괜히 가슴이 두근거려요", "캐릭터들의 졸업 씬에 실제로 눈물 흘린 적 있어요"],
    compat: "🤝 잘 맞는 유형: 우정·가족 덕후",
    recommendedAnime: [
      { title: "케이온!", reason: "청춘과 음악, 우정의 완벽한 조화" },
      { title: "나의 청춘 러브코메디는 잘못됐다", reason: "학원물 명작 중의 명작" },
      { title: "토라도라!", reason: "학창 시절의 설렘을 완벽히 재현" },
      { title: "스즈미야 하루히의 우울", reason: "학원물 장르의 고전 명작" },
    ],
  },
  animal: {
    emoji: "🐾",
    badge: "동물·귀여움 덕후",
    badgeColor: "#3D7A1A",
    badgeBg: "#EAF3DE",
    headerGradient: "linear-gradient(135deg, #86EFAC 0%, #4ADE80 100%)",
    title: "귀여운 것에 힐링받는 사람",
    sub: "귀엽고 따뜻한 것에 무장 해제되는 타입. 마스코트 캐릭터, 수인, 힐링계 콘텐츠가 주식이에요. 세상의 귀여움을 수집하는 것이 삶의 낙입니다.",
    traits: ["귀여운 캐릭터 굿즈가 방에 넘쳐나요", "힐링 애니 없이는 못 사는 체질이에요", "수인·동물 캐릭터를 보면 심장이 녹아요"],
    compat: "🤝 잘 맞는 유형: 학원물 덕후",
    recommendedAnime: [
      { title: "치이카와", reason: "귀여움과 감동의 완벽한 조화" },
      { title: "스파이 패밀리", reason: "아냐의 귀여움으로 세상이 평화로워짐" },
      { title: "유루캠△", reason: "힐링 그 자체인 캠핑 일상물" },
      { title: "케모노 프렌즈", reason: "동물 캐릭터 천국" },
    ],
  },
  monster: {
    emoji: "💥",
    badge: "배틀 덕후",
    badgeColor: "#993C1D",
    badgeBg: "#FAECE7",
    headerGradient: "linear-gradient(135deg, #FCA5A5 0%, #F87171 100%)",
    title: "압도적인 배틀에 사는 오타쿠",
    sub: "강렬한 배틀 씬과 박진감 넘치는 전개에 열광하는 타입. 다크한 세계관과 거대한 적과의 대결이야말로 애니의 꽃이라고 생각해요. 전투 연출 퀄리티에 진심입니다.",
    traits: ["배틀 씬 작화를 프레임 단위로 분석해요", "거대 보스 등장 씬에서 심장이 터질 것 같아요", "다크한 세계관일수록 더 빠지는 타입이에요"],
    compat: "🤝 잘 맞는 유형: 먼치킨 덕후",
    recommendedAnime: [
      { title: "진격의 거인", reason: "압도적인 배틀과 충격적인 서사" },
      { title: "주술회전", reason: "시원시원한 배틀 연출의 정점" },
      { title: "헌터×헌터", reason: "두뇌와 배틀이 모두 완벽한 명작" },
      { title: "도쿄 구울", reason: "다크한 세계관과 강렬한 배틀" },
    ],
  },
  sports: {
    emoji: "🏆",
    badge: "스포츠 덕후",
    badgeColor: "#0F6E56",
    badgeBg: "#E1F5EE",
    headerGradient: "linear-gradient(135deg, #6EE7B7 0%, #34D399 100%)",
    title: "땀과 열정으로 우는 오타쿠",
    sub: "스포츠 애니의 열혈 감동 서사에 진심인 타입. 팀이 역전하는 장면, 최선을 다하는 선수의 눈빛에 실제로 눈물 흘리는 게 자연스러워요. 노력과 우정의 가치를 믿는 덕후입니다.",
    traits: ["스포츠 애니 경기 중에 실제로 소리를 지른 적 있어요", "역전 장면에서 눈물이 자동으로 나와요", "최선을 다하는 캐릭터를 보면 나도 열심히 살고 싶어져요"],
    compat: "🤝 잘 맞는 유형: 모험 덕후",
    recommendedAnime: [
      { title: "하이큐!!", reason: "스포츠 애니의 교과서이자 끝판왕" },
      { title: "블루록", reason: "냉혹한 성장 서사의 신예 명작" },
      { title: "쿠로코의 농구", reason: "팀워크와 개인기의 완벽한 조화" },
      { title: "다이아의 A", reason: "야구 덕후라면 필수 시청" },
    ],
  },
  adventure: {
    emoji: "🗺️",
    badge: "모험 덕후",
    badgeColor: "#925D10",
    badgeBg: "#FAEEDA",
    headerGradient: "linear-gradient(135deg, #FCD34D 0%, #FBBF24 100%)",
    title: "미지의 세계를 탐험하는 오타쿠",
    sub: "넓은 세계관과 탐험, 모험에 가장 설레는 타입. 지도에 없는 땅, 새로운 문명, 미스터리한 유적이 나오면 심장이 두근거려요. 세계 구석구석을 탐험하고 싶은 탐험가 기질의 덕후입니다.",
    traits: ["세계관 설정집이 따로 있으면 무조건 읽어요", "지도가 나오는 장면에서 유독 설레요", "모험 중 새 동료 합류 씬을 너무 좋아해요"],
    compat: "🤝 잘 맞는 유형: 스포츠 덕후",
    recommendedAnime: [
      { title: "메이드 인 어비스", reason: "탐험과 세계관의 극한을 보여주는 명작" },
      { title: "헌터×헌터", reason: "끝없이 넓어지는 모험의 세계" },
      { title: "던전 밥", reason: "탐험 + 먹방의 신선한 조합" },
      { title: "마법사의 신부", reason: "이세계의 신비로운 탐험" },
    ],
  },
  bishounen: {
    emoji: "✨",
    badge: "미형 캐릭터 덕후",
    badgeColor: "#3C3489",
    badgeBg: "#EEEDFE",
    headerGradient: "linear-gradient(135deg, #C4B5FD 0%, #A78BFA 100%)",
    title: "아름다운 캐릭터에 홀린 오타쿠",
    sub: "아름다운 캐릭터 디자인과 섬세한 연출에 빠지는 타입. 작화가 예쁘고 캐릭터가 매력적이면 스토리가 조금 부족해도 괜찮아요. 눈이 즐거운 것이 최고라는 심미안 덕후입니다.",
    traits: ["작화 퀄리티는 애니 선택의 1순위예요", "미남 캐릭터 눈빛 하나에 심장이 요동쳐요", "캐릭터 일러스트 컬렉션이 은근히 방대해요"],
    compat: "🤝 잘 맞는 유형: 아이돌 덕후",
    recommendedAnime: [
      { title: "흑집사", reason: "완벽한 미형과 다크한 스토리의 조화" },
      { title: "코드 기어스 반역의 를르슈", reason: "서사와 미형이 모두 완벽" },
      { title: "Free! 이와토비 수영부", reason: "미형 캐릭터 팬이라면 필수" },
      { title: "체인소 맨", reason: "독특하고 강렬한 캐릭터 비주얼" },
    ],
  },
  family: {
    emoji: "💛",
    badge: "우정·가족 덕후",
    badgeColor: "#C73D69",
    badgeBg: "#FCE7EF",
    headerGradient: "linear-gradient(135deg, #FDE68A 0%, #FCD34D 100%)",
    title: "따뜻한 유대에 감동받는 오타쿠",
    sub: "캐릭터들 간의 유대, 우정, 가족애에 가장 감동받는 타입. 서로를 아끼는 장면에서 자연스럽게 눈물이 나오고, 그 따뜻함이 애니를 보는 이유가 되는 사람입니다.",
    traits: ["유대감 씬에서 펑펑 우는 건 기본이에요", "팀이 뭉쳐서 싸우는 장면에서 가장 설레요", "주인공 팀의 화합이 느껴지면 마음이 차올라요"],
    compat: "🤝 잘 맞는 유형: 학원물 덕후",
    recommendedAnime: [
      { title: "스파이 패밀리", reason: "가족이라는 유대의 따뜻한 시작" },
      { title: "나루토", reason: "우정과 유대의 역대급 서사" },
      { title: "원피스", reason: "동료를 위해 싸우는 열정의 끝판왕" },
      { title: "장송의 프리렌", reason: "지나간 유대의 소중함을 느끼는 명작" },
    ],
  },
};

const TYPE_ORDER: V2Type[] = ["idol", "munchkin", "school", "animal", "monster", "sports", "adventure", "bishounen", "family"];

// ─── 결과 계산 ───────────────────────────────────────────────

function calcResult(answers: (number | null)[]): { winner: V2Type; votes: Record<V2Type, number> } {
  const votes = Object.fromEntries(TYPE_ORDER.map((t) => [t, 0])) as Record<V2Type, number>;
  answers.forEach((ans, qi) => {
    if (ans === null) return;
    votes[QUESTIONS[qi].options[ans].type] += 1;
  });
  const winner = (Object.entries(votes) as [V2Type, number][]).reduce(
    (best, curr) => (curr[1] > best[1] ? curr : best)
  )[0];
  return { winner, votes };
}

// ─── 메인 페이지 ─────────────────────────────────────────────

export default function OtakuTypeV2Page() {
  const [phase, setPhase] = useState<"intro" | "quiz" | "result">("intro");
  const [cur, setCur] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(new Array(QUESTIONS.length).fill(null));

  const select = (idx: number) => {
    const clickedAt = cur;
    setAnswers((prev) => { const next = [...prev]; next[clickedAt] = idx; return next; });
    setTimeout(() => {
      if (clickedAt >= QUESTIONS.length - 1) {
        setPhase((p) => (p === "quiz" ? "result" : p));
      } else {
        setCur((c) => (c === clickedAt ? c + 1 : c));
      }
    }, 180);
  };

  const reset = () => { setPhase("intro"); setCur(0); setAnswers(new Array(QUESTIONS.length).fill(null)); };

  // ── 인트로 ──
  if (phase === "intro") {
    return (
      <main className="mx-auto flex max-w-[560px] flex-col gap-6 py-8 px-4">
        <div className="text-center">
          <h1 className="text-[22px] font-medium mb-1.5">🎌 어떤 오타쿠?</h1>
          <p className="text-sm text-gray-500">10문항으로 알아보는 나의 덕후 장르</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col gap-4">
          <p className="text-sm text-gray-600 leading-relaxed">
            질문에 답하면 <strong>9가지 덕후 장르</strong> 중 나와 가장 가까운 유형을 찾아드려요.<br />
            답변마다 해당 유형에 투표하고, 가장 많은 표를 받은 유형이 결과입니다.
          </p>
          <div className="grid grid-cols-3 gap-2 text-[11px]">
            {[
              { emoji: "🎤", label: "아이돌" },
              { emoji: "⚡", label: "먼치킨" },
              { emoji: "🏫", label: "학원물" },
              { emoji: "🐾", label: "귀여움" },
              { emoji: "💥", label: "배틀" },
              { emoji: "🏆", label: "스포츠" },
              { emoji: "🗺️", label: "모험" },
              { emoji: "✨", label: "미형" },
              { emoji: "💛", label: "우정·가족" },
            ].map((t) => (
              <div key={t.label} className="flex items-center gap-1.5 rounded-lg px-2 py-1.5" style={{ background: "#F3F1FF" }}>
                <span>{t.emoji}</span>
                <span className="text-gray-600">{t.label}</span>
              </div>
            ))}
          </div>
          <button
            onClick={() => setPhase("quiz")}
            className="mt-2 w-full py-3 rounded-lg text-sm font-medium text-white shadow-sm hover:shadow-md transition-all duration-150"
            style={{ background: "#534AB7" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#3E3899")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#534AB7")}
          >
            테스트 시작하기 →
          </button>
        </div>
        <Link href="/play/otaku-type" className="text-center text-sm text-gray-400 hover:text-gray-600 transition-colors">
          ← 타입 테스트 (v1)로 돌아가기
        </Link>
      </main>
    );
  }

  // ── 결과 ──
  if (phase === "result") {
    const { winner } = calcResult(answers);
    const t = TYPES[winner];

    return (
      <main className="mx-auto flex max-w-[560px] flex-col gap-5 py-8 px-4">
        <div className="text-center">
          <h1 className="text-[22px] font-medium mb-1.5">🎌 어떤 오타쿠?</h1>
          <p className="text-sm text-gray-500">진단이 완료됐습니다!</p>
        </div>

        {/* 결과 헤더 */}
        <div className="rounded-2xl overflow-hidden border border-gray-200">
          <div
            className="flex flex-col items-center justify-center py-10 gap-2"
            style={{ background: t.headerGradient }}
          >
            <div className="text-[64px] leading-none drop-shadow-sm">{t.emoji}</div>
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-white/70 backdrop-blur-sm" style={{ color: t.badgeColor }}>
              {t.badge}
            </span>
          </div>
          <div className="bg-white p-6">
            <div className="text-[20px] font-semibold text-gray-800 mb-2">{t.title}</div>
            <p className="text-sm text-gray-500 leading-7">{t.sub}</p>
          </div>
        </div>

        {/* 성향 특징 */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="text-xs font-semibold mb-3" style={{ color: "#534AB7" }}>이런 특징이 있어요</div>
          {t.traits.map((tr) => (
            <div key={tr} className="flex gap-2.5 py-2.5 border-b border-gray-100 text-sm text-gray-600 last:border-b-0">
              <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold mt-0.5" style={{ background: "#534AB7" }}>✓</span>
              <span>{tr}</span>
            </div>
          ))}
        </div>



        {/* 궁합 + 추천 */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-4">
          <div
            className="text-sm text-center py-2.5 rounded-lg font-medium"
            style={{ background: t.badgeBg, color: t.badgeColor }}
          >
            {t.compat}
          </div>
          <div>
            <div className="text-xs font-semibold mb-3" style={{ color: "#534AB7" }}>🎬 추천 애니</div>
            <div className="flex flex-col gap-2.5">
              {t.recommendedAnime.map((a) => (
                <div key={a.title} className="flex gap-2.5 items-start">
                  <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full mt-1.5" style={{ background: t.badgeColor }} />
                  <div>
                    <div className="text-[13px] font-medium text-gray-800">{a.title}</div>
                    <div className="text-[11px] text-gray-500 mt-0.5">{a.reason}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <button onClick={reset} className="w-full py-2.5 border border-gray-300 rounded-xl bg-white text-sm text-gray-700 hover:bg-gray-50 transition-colors">
          🔄 다시 테스트하기
        </button>

        <Link href="/play/oshi-card" className="block text-center border border-gray-200 rounded-xl bg-white px-4 py-3 text-sm font-medium text-gray-700 hover:bg-[#F3F1FF] transition-colors">
          최애 카드 만들기 →
        </Link>
      </main>
    );
  }

  // ── 퀴즈 ──
  const safeCur = Math.min(Math.max(cur, 0), QUESTIONS.length - 1);
  const q = QUESTIONS[safeCur];
  const progress = Math.round((safeCur / QUESTIONS.length) * 100);

  return (
    <main className="mx-auto flex max-w-[560px] flex-col gap-5 py-8 px-4">
      <div className="text-center">
        <h1 className="text-[22px] font-medium mb-1.5">🎌 어떤 오타쿠?</h1>
        <p className="text-sm text-gray-500">10문항으로 알아보는 나의 덕후 장르</p>
      </div>

      <div>
        <div className="h-1.5 rounded overflow-hidden" style={{ background: "#EDE9FE" }}>
          <div className="h-full rounded transition-all duration-300" style={{ width: `${progress}%`, background: "#534AB7" }} />
        </div>
        <div className="text-xs text-gray-400 mt-1.5 text-right">{safeCur + 1} / {QUESTIONS.length}</div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {/* 질문 헤더 — 이미지 대신 아이콘 배너 */}
        <div
          className="flex items-center justify-center py-10"
          style={{ background: "linear-gradient(135deg, #EDE9FE 0%, #DDD6FE 100%)" }}
        >
          <span className="text-[64px] leading-none">{q.icon}</span>
        </div>

        <div className="p-6">
          <div className="text-xs font-medium mb-2" style={{ color: "#534AB7", letterSpacing: "0.05em" }}>
            Q{q.num}
          </div>
          <div className="text-base font-medium leading-relaxed mb-5 text-gray-800">{q.text}</div>

          <div className="flex flex-col gap-2.5">
            {q.options.map((opt, i) => (
              <button
                key={i}
                onClick={() => select(i)}
                className="text-left px-4 py-3 rounded-lg border text-sm leading-relaxed transition-all"
                style={answers[safeCur] === i
                  ? { borderColor: "#534AB7", background: "#EDE9FE", color: "#3730A3" }
                  : { borderColor: "rgba(0,0,0,0.12)", background: "#fff", color: "#2c2c2a" }}
              >
                <span className="font-medium mr-2" style={{ color: "#534AB7" }}>{opt.label}</span>
                {opt.text}
              </button>
            ))}
          </div>

          <div className="flex justify-between items-center mt-5">
            <button
              onClick={() => setCur((c) => Math.max(0, c - 1))}
              disabled={safeCur === 0}
              className="px-5 py-2.5 border rounded-lg text-sm bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-gray-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ← 이전
            </button>
            <button
              onClick={() => {
                if (safeCur < QUESTIONS.length - 1) {
                  setCur((c) => Math.min(c + 1, QUESTIONS.length - 1));
                } else {
                  setPhase("result");
                }
              }}
              disabled={answers[safeCur] === null}
              className="px-5 py-2.5 border rounded-lg text-sm font-medium text-white shadow-sm hover:shadow-md transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ background: "#534AB7", borderColor: "#534AB7" }}
            >
              {safeCur === QUESTIONS.length - 1 ? "결과 보기 →" : "다음 →"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
