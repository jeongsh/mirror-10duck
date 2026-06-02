"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  Heart,
  BookOpen,
  ShoppingBag,
  Users,
  Sparkles,
  Package,
  Brain,
  Wallet,
  Tv,
} from "lucide-react";
import { useAuthUser } from "@/lib/supabase/useAuthUser";
import {
  fetchOtakuTypeResult,
  upsertOtakuTypeResult,
  fetchOtakuTypeDistribution,
} from "@/lib/supabase/otakuTypeResults";
import {
  getAnimeRecommendationsByType,
  type AnimeRecommendation,
} from "@/lib/supabase/animeRecommendations";

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
  image: string;
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
  compat: string;
  traits: [string, string, string];
  recommendedAnime: AnimeRec[];
  /** 카드 상단 부제(필살기) — pill로 표시 */
  tagline: string;
  /** 5축 능력치 (0~100) — 카드의 오타쿠 지수 바 차트 */
  stats: { 덕력: number; 수집력: number; 몰입도: number; 정보력: number; 지출력: number };
  /** 좋아할 장르 TOP3 — 카드 우하단 */
  topGenres: [string, string, string];
  /** 4분면 특징(❤️/📖/🛒/👥 순서) — 카드 중단의 4-icon 박스 */
  traits4: [string, string, string, string];
  /** 카드 하단 명언 — quote 박스 */
  quote: string;
}

// ─── 질문 데이터 ─────────────────────────────────────────────

const QUESTIONS: V2Question[] = [
  {
    num: 1,
    text: "새 애니 1화, 10분이 지났는데 아직 아무것도 안 일어났다. 당신은?",
    icon: "📺",
    image: "/taku-test/v2/Q1.webp",
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
    image: "/taku-test/v2/Q2.webp",
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
    image: "/taku-test/v2/Q3.webp",
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
    image: "/taku-test/v2/Q4.webp",
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
    image: "/taku-test/v2/Q5.webp",
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
    image: "/taku-test/v2/Q6.webp",
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
    image: "/taku-test/v2/Q7.webp",
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
    image: "/taku-test/v2/Q8.webp",
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
    image: "/taku-test/v2/Q9.webp",
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
    image: "/taku-test/v2/Q10.webp",
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
    sub: "신보 발매일은 달력에 표시해두고, 라이브 영상은 구간 반복으로 외워버리는 타입. 최애가 무대에 서는 순간이 일주일 중 가장 빛나는 시간이에요. 응원봉 배터리 충전 잊은 적 없죠?",
    traits: ["신보 발매일 전날 밤은 절대 일찍 못 잠", "최애 직캠은 화질별로 분류해서 저장 중", "OST 플리가 폰 저장공간의 반 이상을 차지해요"],
    compat: "🤝 잘 맞는 유형: 미형 캐릭터 덕후",
    recommendedAnime: [
      { title: "러브라이브!", reason: "팬덤과 함께 만들어가는 아이돌의 정수" },
      { title: "아이돌마스터", reason: "각 캐릭터 스토리와 노래가 풍부" },
      { title: "봇치 더 록!", reason: "음악 덕후라면 공감 100% 성장기" },
      { title: "우마무스메 프리티 더비", reason: "화려한 라이브와 열정적인 팬덤" },
    ],
    tagline: "무대 위 한 컷이면 일주일이 행복!",
    stats: { 덕력: 90, 수집력: 92, 몰입도: 88, 정보력: 82, 지출력: 95 },
    topGenres: ["아이돌 / 음악", "청춘 / 일상", "판타지 / 이세계"],
    traits4: [
      "최애 무대 직캠은 화질별로 저장해놨어요.",
      "신곡 가사·뮤비·인터뷰까지 다 파악해요.",
      "발매일은 달력 알람. 굿즈는 풀세트 구매!",
      "같은 최애 팬들과 정보·짤 공유로 매일 소통!",
    ],
    quote: "무대 위 최애가 빛날 때 내 인생도 같이 빛나요",
  },
  munchkin: {
    emoji: "⚡",
    badge: "먼치킨 덕후",
    badgeColor: "#534AB7",
    badgeBg: "#EEEDFE",
    headerGradient: "linear-gradient(135deg, #A5B4FC 0%, #818CF8 100%)",
    title: "최강 주인공을 쫓는 오타쿠",
    sub: "'주인공이 얼마나 강해졌는지'를 기준으로 애니를 평가하는 타입. 각성 장면에서 BGM까지 외워버리고, 스펙 비교는 취미를 넘어 소명이에요. 전생 + 이능력 + 먼치킨이면 일단 1화는 봅니다.",
    traits: ["주인공 스탯 계산은 머릿속에서 자동으로 돌아감", "각성 BGM 시작하면 자기도 모르게 손에 힘이 들어감", "이능력·전생물 신작 놓치면 허전해서 못 살아요"],
    compat: "🤝 잘 맞는 유형: 배틀 덕후",
    recommendedAnime: [
      { title: "전생했더니 슬라임이었던 건에 대하여", reason: "먼치킨 성장의 교과서" },
      { title: "나 혼자만 레벨업", reason: "압도적 성장 서사의 끝판왕" },
      { title: "귀멸의 칼날", reason: "성장과 강함 추구의 정석" },
      { title: "Re:제로부터 시작하는 이세계 생활", reason: "먼치킨 속 깊은 서사" },
    ],
    tagline: "각성 BGM 한 소절에 닭살이 돋아요!",
    stats: { 덕력: 88, 수집력: 72, 몰입도: 95, 정보력: 90, 지출력: 68 },
    topGenres: ["판타지 / 이세계", "액션 / 배틀", "다크 / 음모"],
    traits4: [
      "각성 씬에서 자동으로 손에 힘이 들어가요.",
      "주인공 스펙·이능력 설정은 머리에 다 있어요.",
      "신간 라노벨·게임은 한정판으로 모아요.",
      "강함 토론은 밤새도 가능. 떡밥은 못 참아요.",
    ],
    quote: "주인공이 한계를 넘는 그 순간이 곧 카타르시스!",
  },
  school: {
    emoji: "🏫",
    badge: "학원물 덕후",
    badgeColor: "#185FA5",
    badgeBg: "#E6F1FB",
    headerGradient: "linear-gradient(135deg, #93C5FD 0%, #60A5FA 100%)",
    title: "청춘의 한 페이지를 사는 사람",
    sub: "학교 배경 애니를 보면 본인 학창 시절 추억이 자동 소환되는 타입. 동아리 결성 씬에 설레고, 졸업 씬에 울고, '나도 저런 청춘이었으면'을 매번 생각해요. 일상물이 힐링이 되는 이유를 알아요.",
    traits: ["학원물 추천 목록은 장르별로 분류되어 있음", "졸업 씬에서 실제로 눈물을 흘린 기록 다수", "캐릭터들 일상 보며 '나도 저때 잘 살았나' 자동 회상"],
    compat: "🤝 잘 맞는 유형: 우정·가족 덕후",
    recommendedAnime: [
      { title: "케이온!", reason: "청춘과 음악, 우정의 완벽한 조화" },
      { title: "나의 청춘 러브코메디는 잘못됐다", reason: "학원물 명작 중의 명작" },
      { title: "토라도라!", reason: "학창 시절의 설렘을 완벽히 재현" },
      { title: "스즈미야 하루히의 우울", reason: "학원물 장르의 고전 명작" },
    ],
    tagline: "졸업 씬 한 컷에 가슴이 뭉클해져요!",
    stats: { 덕력: 78, 수집력: 70, 몰입도: 90, 정보력: 75, 지출력: 62 },
    topGenres: ["청춘 / 일상", "로맨스 / 코미디", "음악 / 동아리"],
    traits4: [
      "졸업 씬 BGM 들으면 자동으로 눈물이 나와요.",
      "동아리·학교 분위기까지 다 기억하고 있어요.",
      "추억템 BD·아트북에는 지갑이 자꾸 열려요.",
      "친구랑 같이 보며 학창 시절을 떠올려요.",
    ],
    quote: "그 시절의 풋풋함, 애니에서라도 다시 살고 싶어요",
  },
  animal: {
    emoji: "🐾",
    badge: "동물·귀여움 덕후",
    badgeColor: "#3D7A1A",
    badgeBg: "#EAF3DE",
    headerGradient: "linear-gradient(135deg, #86EFAC 0%, #4ADE80 100%)",
    title: "귀여운 것에 힐링받는 사람",
    sub: "귀여운 캐릭터 하나면 스토리가 조금 부족해도 OK. '이 마스코트 너무 귀엽다'를 하루에도 몇 번씩 하는 사람이에요. 힐링 콘텐츠 없이는 하루를 버티기 힘든 체질입니다.",
    traits: ["귀여운 마스코트 하나면 작화 논쟁도 사라짐", "힐링 애니 없는 계절은 삶의 활력 -50%", "수인·동물 캐릭터 목소리 들으면 저절로 미소 지어짐"],
    compat: "🤝 잘 맞는 유형: 학원물 덕후",
    recommendedAnime: [
      { title: "치이카와", reason: "귀여움과 감동의 완벽한 조화" },
      { title: "스파이 패밀리", reason: "아냐의 귀여움으로 세상이 평화로워짐" },
      { title: "유루캠△", reason: "힐링 그 자체인 캠핑 일상물" },
      { title: "케모노 프렌즈", reason: "동물 캐릭터 천국" },
    ],
    tagline: "귀여우면 다 용서, 힐링이 최고예요!",
    stats: { 덕력: 75, 수집력: 92, 몰입도: 82, 정보력: 65, 지출력: 90 },
    topGenres: ["일상 / 힐링", "동물 / 마스코트", "판타지 / 모험"],
    traits4: [
      "귀여운 마스코트 하나에 하루가 행복해져요.",
      "작가별·작품별 마스코트 데이터를 줄줄 알아요.",
      "키링·인형 굿즈가 방을 가득 채우는 중!",
      "귀여운 짤·움짤로 친구들과 매일 소통해요.",
    ],
    quote: "오늘도 귀여움이 세상을 구합니다",
  },
  monster: {
    emoji: "💥",
    badge: "배틀 덕후",
    badgeColor: "#993C1D",
    badgeBg: "#FAECE7",
    headerGradient: "linear-gradient(135deg, #FCA5A5 0%, #F87171 100%)",
    title: "압도적인 배틀에 사는 오타쿠",
    sub: "배틀 씬 작화가 떨어지면 화가 나는 타입. 거대 보스가 등장하는 순간 볼륨을 올리고, 전투가 길고 치열할수록 만족감이 높아요. 작화, 연출, 사운드 삼박자가 다 맞아야 진짜 명작이에요.",
    traits: ["배틀 씬 작화 퀄리티에 확실한 기준이 있음", "보스 등장 씬에 자기도 모르게 볼륨 올리는 손", "다크하고 치열할수록 '이게 진짜 명작'이라고 생각함"],
    compat: "🤝 잘 맞는 유형: 먼치킨 덕후",
    recommendedAnime: [
      { title: "진격의 거인", reason: "압도적인 배틀과 충격적인 서사" },
      { title: "주술회전", reason: "시원시원한 배틀 연출의 정점" },
      { title: "헌터×헌터", reason: "두뇌와 배틀이 모두 완벽한 명작" },
      { title: "도쿄 구울", reason: "다크한 세계관과 강렬한 배틀" },
    ],
    tagline: "박력 한 컷이면 즉시 충성 맹세!",
    stats: { 덕력: 92, 수집력: 78, 몰입도: 95, 정보력: 88, 지출력: 80 },
    topGenres: ["액션 / 배틀", "다크 판타지", "호러 / 스릴러"],
    traits4: [
      "압도적 배틀 씬엔 자동으로 몰입돼요.",
      "연출·작화 감독 이름까지 기억하고 봐요.",
      "한정 BD·피규어는 예약 필수!",
      "명장면 토론은 한 번 시작하면 안 끝나요.",
    ],
    quote: "전투 작화 한 컷이면 인생작 인증입니다",
  },
  sports: {
    emoji: "🏆",
    badge: "스포츠 덕후",
    badgeColor: "#0F6E56",
    badgeBg: "#E1F5EE",
    headerGradient: "linear-gradient(135deg, #6EE7B7 0%, #34D399 100%)",
    title: "땀과 열정으로 우는 오타쿠",
    sub: "역전 장면에서 소리를 지른 경험이 있고, 감동 BGM이 흐르면 눈물이 자동으로 나오는 타입. 스포츠 애니 보고 나서 갑자기 열심히 살고 싶어진 적이 한두 번이 아니에요. 노력은 배신하지 않는다, 진심으로 믿어요.",
    traits: ["역전 장면에서 손에 땀 쥐고 소리 지른 경험 多", "감동 BGM 시작하면 눈물이 자동 발사됨", "스포츠 애니 보고 뭔가 시작하려다 그만둔 횟수는 세지 않음"],
    compat: "🤝 잘 맞는 유형: 모험 덕후",
    recommendedAnime: [
      { title: "하이큐!!", reason: "스포츠 애니의 교과서이자 끝판왕" },
      { title: "블루록", reason: "냉혹한 성장 서사의 신예 명작" },
      { title: "쿠로코의 농구", reason: "팀워크와 개인기의 완벽한 조화" },
      { title: "다이아의 A", reason: "야구 덕후라면 필수 시청" },
    ],
    tagline: "땀과 눈물, 그게 진짜 청춘이에요!",
    stats: { 덕력: 85, 수집력: 65, 몰입도: 92, 정보력: 80, 지출력: 60 },
    topGenres: ["스포츠", "청춘 / 우정", "휴먼 드라마"],
    traits4: [
      "역전 장면엔 진심으로 응원하게 돼요.",
      "룰·전술·선수 능력까지 분석하면서 봐요.",
      "응원 유니폼·필기구 굿즈 모으는 중!",
      "팬 단톡으로 매주 함께 시청 모임을 해요.",
    ],
    quote: "노력은 배신하지 않는다, 진심으로 믿어요",
  },
  adventure: {
    emoji: "🗺️",
    badge: "모험 덕후",
    badgeColor: "#925D10",
    badgeBg: "#FAEEDA",
    headerGradient: "linear-gradient(135deg, #FCD34D 0%, #FBBF24 100%)",
    title: "미지의 세계를 탐험하는 오타쿠",
    sub: "지도에 새로운 땅이 나오면 화면 앞으로 당겨 앉는 타입. 세계관 설정이 촘촘할수록, 탐험할 장소가 많을수록 더 빠져들어요. 새 동료가 합류하는 장면은 매번 설레는데, 이유를 모르겠어요.",
    traits: ["세계관 설정집·용어집 있으면 꼭 읽어야 직성이 풀림", "지도 등장 씬에서 화면에 가까이 다가가는 버릇", "새 동료 합류 씬은 몇 번을 봐도 설렘"],
    compat: "🤝 잘 맞는 유형: 스포츠 덕후",
    recommendedAnime: [
      { title: "메이드 인 어비스", reason: "탐험과 세계관의 극한을 보여주는 명작" },
      { title: "헌터×헌터", reason: "끝없이 넓어지는 모험의 세계" },
      { title: "던전 밥", reason: "탐험 + 먹방의 신선한 조합" },
      { title: "마법사의 신부", reason: "이세계의 신비로운 탐험" },
    ],
    tagline: "미지의 세계, 한 번 더 들어가고 싶어요!",
    stats: { 덕력: 82, 수집력: 78, 몰입도: 88, 정보력: 92, 지출력: 72 },
    topGenres: ["모험 / 판타지", "이세계 / 환생", "SF / 미스터리"],
    traits4: [
      "새 세계가 열릴 때마다 가슴이 뛰어요.",
      "세계관 설정집·용어집은 정독이 필수예요.",
      "아트북·세계지도 굿즈에 약해요.",
      "세계관 추측·고찰을 친구들과 자주 나눠요.",
    ],
    quote: "지도 너머의 풍경이 늘 궁금합니다",
  },
  bishounen: {
    emoji: "✨",
    badge: "미형 캐릭터 덕후",
    badgeColor: "#3C3489",
    badgeBg: "#EEEDFE",
    headerGradient: "linear-gradient(135deg, #C4B5FD 0%, #A78BFA 100%)",
    title: "아름다운 캐릭터에 홀린 오타쿠",
    sub: "작화가 예쁘면 스토리가 조금 아쉬워도 끝까지 봅니다. 미형 캐릭터의 눈빛 하나로 심장이 요동치고, 그 캐릭터 일러스트는 어느새 갤러리에 빼곡히 쌓여 있어요. 눈이 즐거운 게 최고입니다.",
    traits: ["작화 퀄리티가 애니 입문 결정의 70% 이상 담당", "미형 캐릭터 눈빛 하나에 심장이 실제로 요동침", "폰 갤러리 특정 폴더에 캐릭터 일러스트가 쌓여가는 중"],
    compat: "🤝 잘 맞는 유형: 아이돌 덕후",
    recommendedAnime: [
      { title: "흑집사", reason: "완벽한 미형과 다크한 스토리의 조화" },
      { title: "코드 기어스 반역의 를르슈", reason: "서사와 미형이 모두 완벽" },
      { title: "Free! 이와토비 수영부", reason: "미형 캐릭터 팬이라면 필수" },
      { title: "체인소 맨", reason: "독특하고 강렬한 캐릭터 비주얼" },
    ],
    tagline: "작화가 곧 정의, 미형이 곧 행복!",
    stats: { 덕력: 85, 수집력: 92, 몰입도: 88, 정보력: 78, 지출력: 92 },
    topGenres: ["미형 캐릭터", "판타지 / 로맨스", "다크 미스터리"],
    traits4: [
      "캐릭터 한 컷에 진심으로 사랑에 빠져요.",
      "작화 감독·일러스트레이터까지 외워요.",
      "일러스트북·아크릴 스탠드 컬렉터예요.",
      "캐릭터 일러스트로 친구들과 교류 활발!",
    ],
    quote: "아름다움은 정의입니다 ✨",
  },
  family: {
    emoji: "💛",
    badge: "우정·가족 덕후",
    badgeColor: "#C73D69",
    badgeBg: "#FCE7EF",
    headerGradient: "linear-gradient(135deg, #FDE68A 0%, #FCD34D 100%)",
    title: "따뜻한 유대에 감동받는 오타쿠",
    sub: "멤버들이 서로를 위해 싸우는 장면에서 눈물이 자동으로 나오는 타입. '이 팀 해체되면 어떡하지'를 매번 걱정하면서도 계속 보는 게 당신입니다. 그 따뜻함이 애니를 보는 이유예요.",
    traits: ["유대감 씬에서 눈물 참는 건 이미 포기한 상태", "팀원 중 하나라도 다치면 마음이 같이 아픔", "'이 멤버들 절대 해체되면 안 돼'를 진지하게 생각함"],
    compat: "🤝 잘 맞는 유형: 학원물 덕후",
    recommendedAnime: [
      { title: "스파이 패밀리", reason: "가족이라는 유대의 따뜻한 시작" },
      { title: "나루토", reason: "우정과 유대의 역대급 서사" },
      { title: "원피스", reason: "동료를 위해 싸우는 열정의 끝판왕" },
      { title: "장송의 프리렌", reason: "지나간 유대의 소중함을 느끼는 명작" },
    ],
    tagline: "함께 있는 그 자체로 감동이에요!",
    stats: { 덕력: 82, 수집력: 75, 몰입도: 92, 정보력: 72, 지출력: 70 },
    topGenres: ["우정 / 유대", "가족 / 일상", "휴먼 드라마"],
    traits4: [
      "동료 위해 싸우는 장면에 매번 울어요.",
      "인물 관계도·성장 서사를 머리에 그려요.",
      "단체 굿즈·전 등장인물 세트에 약해요.",
      "함께 본 친구와 추억을 평생 공유해요.",
    ],
    quote: "함께 걷는 그 길이 가장 빛나는 길이에요",
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

function OtakuTypeV2PageContent() {
  const router = useRouter();
  const authUser = useAuthUser();
  const savedResultRef = useRef(false);
  const searchParams = useSearchParams();
  const showSaved = searchParams.get("saved") === "1";
  const [restoring, setRestoring] = useState(showSaved);
  const [restoredWinner, setRestoredWinner] = useState<V2Type | null>(null);
  const [phase, setPhase] = useState<"intro" | "quiz" | "result">(
    searchParams.get("start") === "1" ? "quiz" : "intro",
  );
  const [cur, setCur] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(new Array(QUESTIONS.length).fill(null));
  const [dbAnimeRecs, setDbAnimeRecs] = useState<AnimeRecommendation[] | undefined>(undefined);
  const [distribution, setDistribution] = useState<Record<string, number> | null>(null);
  const [selectedAnim, setSelectedAnim] = useState<number | null>(null);

  useEffect(() => {
    if (!showSaved) return;
    if (authUser === undefined) return;

    let cancelled = false;

    void (async () => {
      setRestoring(true);
      try {
        if (!authUser?.id) return;

        const row = await fetchOtakuTypeResult(authUser.id, "v2");
        if (cancelled) return;
        if (!row) return;

        const winner = row.result_code as V2Type;
        if (!TYPES[winner]) return;

        setRestoredWinner(winner);
        setPhase("result");
      } catch (error) {
        console.error("[otaku-type/v2] saved result load failed:", error);
      } finally {
        if (!cancelled) setRestoring(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [showSaved, authUser]);

  useEffect(() => {
    if (restoredWinner) return;
    if (phase !== "result" || !authUser?.id || savedResultRef.current) return;
    if (answers.some((answer) => answer === null)) return;

    savedResultRef.current = true;
    const { winner, votes } = calcResult(answers);
    const result = TYPES[winner];
    void upsertOtakuTypeResult(authUser.id, {
      testVersion: "v2",
      resultCode: winner,
      resultTitle: result.title,
      resultBadge: result.badge,
      scores: { votes },
    }).catch(console.error);
  }, [phase, authUser?.id, answers, restoredWinner]);

  useEffect(() => {
    if (phase !== "result") {
      setDbAnimeRecs(undefined);
      setDistribution(null);
      return;
    }
    const winner = restoredWinner ?? calcResult(answers).winner;
    let cancelled = false;
    getAnimeRecommendationsByType("v2", winner)
      .then((recs) => { if (!cancelled) setDbAnimeRecs(recs); })
      .catch(() => { if (!cancelled) setDbAnimeRecs([]); });
    fetchOtakuTypeDistribution("v2")
      .then((dist) => { if (!cancelled) setDistribution(dist); })
      .catch(() => { if (!cancelled) setDistribution({}); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, restoredWinner]);

  useEffect(() => {
    setSelectedAnim(null);
  }, [cur]);

  const select = (idx: number) => {
    const clickedAt = cur;
    setSelectedAnim(idx);
    setAnswers((prev) => { const next = [...prev]; next[clickedAt] = idx; return next; });
    setTimeout(() => {
      if (clickedAt >= QUESTIONS.length - 1) {
        setPhase((p) => (p === "quiz" ? "result" : p));
      } else {
        setCur((c) => (c === clickedAt ? c + 1 : c));
      }
    }, 180);
  };

  const reset = () => {
    savedResultRef.current = false;
    setRestoredWinner(null);
    setPhase("intro");
    setCur(0);
    setAnswers(new Array(QUESTIONS.length).fill(null));
    router.replace("/play/otaku-type/v2");
  };

  if (restoring) {
    return (
      <main className="mx-auto flex max-w-[560px] flex-col items-center gap-6 py-24 px-4">
        <div className="h-8 w-8 animate-spin border-2 border-[#534AB7] border-t-transparent rounded-full" />
        <p className="text-sm text-gray-500">저장된 결과 불러오는 중...</p>
      </main>
    );
  }

  // ── 인트로 ──
  if (phase === "intro") {
    return (
      <main className="mx-auto flex max-w-[560px] flex-col gap-6 py-8 px-4">
        <div className="text-center">
          <h1 className="text-[22px] font-medium mb-1.5">어떤 오타쿠?</h1>
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
          ← 메인으로 돌아가기
        </Link>
      </main>
    );
  }

  // ── 결과 ──
  if (phase === "result") {
    const winner = restoredWinner ?? calcResult(answers).winner;
    const t = TYPES[winner];

    const totalDist = distribution ? Object.values(distribution).reduce((a, b) => a + b, 0) : 0;
    const myCount = distribution ? (distribution[winner] ?? 0) : 0;
    const rarePct = distribution && totalDist >= 5 ? Math.round((myCount / totalDist) * 100) : null;

    return (
      <main className="mx-auto flex max-w-[480px] flex-col gap-5 py-6 px-3">
        <OtakuResultCard
          typeKey={winner}
          t={t}
          rarePct={rarePct}
          dbAnimeRecs={dbAnimeRecs}
        />

        <button
          onClick={reset}
          className="w-full py-2.5 border border-[#C9BBED] rounded-xl bg-white text-sm text-[#6B5BC7] hover:bg-[#F5F0FF] transition-colors"
        >
          🔄 다시 테스트하기
        </button>

        <Link
          href="/play/oshi-card"
          className="block text-center border border-[#C9BBED] rounded-xl bg-white px-4 py-3 text-sm font-medium text-[#6B5BC7] hover:bg-[#F5F0FF] transition-colors"
        >
          최애 카드 만들기 →
        </Link>
      </main>
    );
  }

  // ── 퀴즈 ──
  const safeCur = Math.min(Math.max(cur, 0), QUESTIONS.length - 1);
  const q = QUESTIONS[safeCur];
  const progress = Math.round(((safeCur + 1) / QUESTIONS.length) * 100);
  const epLabel = String(safeCur + 1).padStart(2, "0");
  const totalEpLabel = String(QUESTIONS.length).padStart(2, "0");
  const cheer = (() => {
    if (safeCur === 0) return "🎬 본 방송 시작!";
    if (safeCur <= 2) return "📺 1쿨 시청 중...";
    if (safeCur <= 4) return "💫 본격 전개 진입!";
    if (safeCur <= 6) return "🎯 절반 돌파! 잘 하고 있어요";
    if (safeCur <= 7) return "🔥 거의 다 왔어요!";
    if (safeCur === QUESTIONS.length - 1) return "✨ 최종화! 결과가 곧 나와요";
    return "⚡ 클라이맥스 진입!";
  })();

  return (
    <main className="mx-auto flex max-w-[480px] flex-col gap-4 py-6 px-3">
      {/* 헤더 */}
      <div className="text-center">
        <h1
          className="text-[22px] font-extrabold mb-1 tracking-tight"
          style={{ color: CARD_PURPLE_DARK }}
        >
          ✦ 어떤 오타쿠? ✦
        </h1>
        <p className="text-[11px] font-mono tracking-wider" style={{ color: CARD_PURPLE_MID }}>
          NOW PLAYING — EP.{epLabel} / 전 {totalEpLabel}화
        </p>
      </div>

      {/* 진행 바 + 단계 응원 */}
      <div className="flex flex-col gap-2">
        <div
          className="h-2.5 rounded-full overflow-hidden"
          style={{ background: CARD_LAVENDER, border: `1px solid ${CARD_PURPLE_SOFT}` }}
        >
          <div
            className="h-full transition-all duration-500 ease-out"
            style={{
              width: `${progress}%`,
              background: `linear-gradient(90deg, ${CARD_PURPLE_MID} 0%, ${CARD_PIXEL_PINK} 100%)`,
            }}
          />
        </div>
        <div className="flex justify-between items-center px-0.5">
          <span
            className="text-[10.5px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: CARD_LAVENDER_SOFT, color: CARD_PURPLE_DARK, border: `1px solid ${CARD_PURPLE_SOFT}` }}
          >
            {cheer}
          </span>
          <span className="text-[10.5px] font-mono font-bold" style={{ color: CARD_PURPLE_MID }}>
            {epLabel} / {totalEpLabel}
          </span>
        </div>
      </div>

      {/* 카드 (Y2K 윈도우 풍 — 결과 카드와 통일) */}
      <div
        className="rounded-[24px] overflow-hidden shadow-[0_8px_24px_rgba(126,87,194,0.15)]"
        style={{
          border: `3px solid ${CARD_PURPLE_SOFT}`,
          background: CARD_LAVENDER_SOFT,
        }}
      >
        {/* 타이틀 바 */}
        <div
          className="flex items-center justify-between px-3.5 py-2"
          style={{
            background: CARD_LAVENDER,
            borderBottom: `2px solid ${CARD_PURPLE_SOFT}`,
          }}
        >
          <div className="text-[14px]" style={{ color: CARD_PIXEL_PINK }} aria-hidden>
            ♥
          </div>
          <div
            className="text-[11px] font-semibold tracking-[0.15em] flex items-center gap-1.5"
            style={{ color: CARD_PURPLE_DARK }}
          >
            <span>EP.{epLabel}</span>
            <span className="opacity-60">·</span>
            <span>오타쿠 진단</span>
          </div>
          <div className="flex gap-1 text-[10px]" style={{ color: CARD_PURPLE_DARK }} aria-hidden>
            <span>□</span>
            <span>—</span>
            <span>×</span>
          </div>
        </div>

        {/* 본문 */}
        <div className="p-4 flex flex-col gap-3.5">
          {/* 이미지 + 배지 오버레이 */}
          <div
            className="relative w-full aspect-[3/2] rounded-lg overflow-hidden bg-white"
            style={{ border: `2px dashed ${CARD_PURPLE_SOFT}` }}
          >
            <Image
              src={q.image}
              alt={`EP.${epLabel} 일러스트`}
              fill
              sizes="(max-width: 480px) 100vw, 480px"
              className="object-cover"
              priority={q.num <= 2}
            />
          </div>

          {/* 질문 박스 (말풍선 풍) */}
          <div
            className="relative bg-white rounded-lg p-3.5"
            style={{ border: `2px solid ${CARD_PURPLE_SOFT}` }}
          >
            <div
              className="text-[10px] font-bold tracking-wider mb-1.5"
              style={{ color: CARD_PURPLE_MID }}
            >
              QUESTION · {safeCur + 1}화
            </div>
            <div
              className="text-[15px] font-bold leading-relaxed"
              style={{ color: CARD_PURPLE_DARK }}
            >
              {q.text}
            </div>
            {/* 말풍선 꼬리 */}
            <div
              className="absolute -bottom-[7px] left-7 w-3 h-3 transform rotate-45 bg-white"
              style={{
                borderRight: `2px solid ${CARD_PURPLE_SOFT}`,
                borderBottom: `2px solid ${CARD_PURPLE_SOFT}`,
              }}
              aria-hidden
            />
          </div>

          {/* 선택지 */}
          <div className="flex flex-col gap-2 mt-1">
            {q.options.map((opt, i) => {
              const isSelected = answers[safeCur] === i;
              const isAnimating = selectedAnim === i;
              return (
                <button
                  key={i}
                  onClick={() => select(i)}
                  className="text-left px-3 py-2.5 rounded-lg flex items-center gap-2.5"
                  style={{
                    border: `2px solid ${isSelected ? CARD_PURPLE_DARK : CARD_PURPLE_SOFT}`,
                    background: isSelected ? CARD_LAVENDER : "#fff",
                    color: CARD_PURPLE_DARK,
                    transform: isAnimating ? "scale(1.03)" : "scale(1)",
                    transition: "all 0.15s ease",
                    boxShadow: isSelected
                      ? `0 4px 12px ${CARD_PURPLE_SOFT}66`
                      : "0 1px 0 rgba(0,0,0,0.02)",
                  }}
                >
                  <span
                    className="flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-[12px] font-extrabold text-white shadow-sm"
                    style={{
                      background: isSelected ? CARD_PIXEL_PINK : CARD_PURPLE_MID,
                      transition: "background 0.15s ease",
                    }}
                  >
                    {opt.label}
                  </span>
                  <span className="flex-1 text-[13.5px] leading-snug font-medium">
                    {opt.text}
                  </span>
                  {isSelected && (
                    <span
                      className="flex-shrink-0 text-[14px] font-extrabold"
                      style={{ color: CARD_PIXEL_PINK }}
                      aria-hidden
                    >
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* 네비게이션 */}
          <div className="flex justify-between items-center mt-1 pt-1">
            <button
              onClick={() => setCur((c) => Math.max(0, c - 1))}
              disabled={safeCur === 0}
              className="px-4 py-2.5 rounded-lg text-[13px] font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              style={{
                background: "#fff",
                color: CARD_PURPLE_MID,
                border: `2px solid ${CARD_PURPLE_SOFT}`,
              }}
            >
              ← 이전 화
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
              className="px-5 py-2.5 rounded-lg text-[13px] font-bold text-white shadow-sm hover:shadow-md transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              style={{
                background: safeCur === QUESTIONS.length - 1
                  ? `linear-gradient(135deg, ${CARD_PURPLE_DARK} 0%, ${CARD_PIXEL_PINK} 100%)`
                  : CARD_PURPLE_DARK,
                border: "none",
              }}
            >
              {safeCur === QUESTIONS.length - 1 ? "엔딩 보기 ✨" : "다음 화 →"}
            </button>
          </div>
        </div>
      </div>

      {/* 푸터 안내 */}
      <div
        className="text-center text-[10.5px] flex items-center justify-center gap-1.5"
        style={{ color: CARD_PURPLE_MID }}
      >
        <span aria-hidden>✦</span>
        <span>솔직하게 골라야 진짜 내 덕후 유형이 나와요</span>
        <span aria-hidden>✦</span>
      </div>
    </main>
  );
}

// ─── 결과 카드 (Y2K 템플릿 스타일) ─────────────────────────────

const CARD_PURPLE_DARK = "#6B5BC7";
const CARD_PURPLE_MID = "#9B86DD";
const CARD_PURPLE_SOFT = "#C8B8F2";
const CARD_LAVENDER = "#E9DCFF";
const CARD_LAVENDER_SOFT = "#F5F0FF";
const CARD_PIXEL_PINK = "#F472B6";

interface OtakuResultCardProps {
  typeKey: V2Type;
  t: V2Result;
  rarePct: number | null;
  dbAnimeRecs: AnimeRecommendation[] | undefined;
}

function OtakuResultCard({ t, rarePct, dbAnimeRecs }: OtakuResultCardProps) {
  const traitIcons = [Heart, BookOpen, ShoppingBag, Users];
  const statRows = [
    { Icon: Sparkles, label: "덕력", value: t.stats.덕력 },
    { Icon: Package, label: "수집력", value: t.stats.수집력 },
    { Icon: Heart, label: "몰입도", value: t.stats.몰입도 },
    { Icon: Brain, label: "정보력", value: t.stats.정보력 },
    { Icon: Wallet, label: "지출력", value: t.stats.지출력 },
  ];

  return (
    <div className="flex flex-col gap-3">
      {/* ─── 메인 결과 카드 ─── */}
      <div
        className="rounded-[28px] overflow-hidden shadow-[0_10px_32px_rgba(126,87,194,0.18)]"
        style={{
          border: `3px solid ${CARD_PURPLE_SOFT}`,
          background: CARD_LAVENDER_SOFT,
        }}
      >
        {/* 타이틀 바 (Y2K 윈도우 풍) */}
        <div
          className="flex items-center justify-between px-3.5 py-2"
          style={{
            background: CARD_LAVENDER,
            borderBottom: `2px solid ${CARD_PURPLE_SOFT}`,
          }}
        >
          <div className="text-[14px]" style={{ color: CARD_PIXEL_PINK }} aria-hidden>
            ♥
          </div>
          <div
            className="text-[11px] font-semibold tracking-[0.15em]"
            style={{ color: CARD_PURPLE_DARK }}
          >
            ✦✧ 오타쿠 테스트 결과 ✧✦
          </div>
          <div className="flex gap-1 text-[10px]" style={{ color: CARD_PURPLE_DARK }} aria-hidden>
            <span>□</span>
            <span>—</span>
            <span>×</span>
          </div>
        </div>

        {/* 카드 본문 */}
        <div className="p-4 flex flex-col gap-3.5 relative">
          {/* #OTAKU_TEST 해시태그 */}
          <div className="flex justify-end -mb-1">
            <span
              className="text-[10px] font-bold tracking-[0.15em]"
              style={{ color: CARD_PURPLE_DARK }}
            >
              #OTAKU_TEST
            </span>
          </div>

          {/* 상단: 포트레이트 + 타이틀 */}
          <div className="grid grid-cols-[125px_1fr] gap-3 items-start">
            {/* 포트레이트 박스 */}
            <div className="flex flex-col gap-1.5">
              <div
                className="aspect-square rounded-xl relative overflow-hidden flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, ${CARD_LAVENDER} 0%, ${CARD_PURPLE_SOFT} 100%)`,
                  border: `2px dashed ${CARD_PURPLE_SOFT}`,
                }}
              >
                {/* 좌상단 채팅 아이콘 */}
                <div
                  className="absolute top-1.5 left-1.5 w-5 h-5 rounded-md bg-white/85 flex items-center justify-center text-[9px]"
                  style={{ color: CARD_PIXEL_PINK }}
                >
                  ♥
                </div>
                {/* 이모지 캐릭터 */}
                <div className="text-[56px] leading-none drop-shadow-sm">{t.emoji}</div>
                {/* 우하단 별 */}
                <div className="absolute bottom-1.5 right-1.5 text-[18px]">⭐</div>
                {/* 코너 sparkles */}
                <span className="absolute top-2.5 right-2.5 text-[10px]" style={{ color: CARD_PURPLE_DARK }}>✦</span>
                <span className="absolute bottom-3 left-2.5 text-[8px]" style={{ color: CARD_PURPLE_DARK }}>✧</span>
              </div>
              <div
                className="text-center text-[9px] tracking-[0.18em] font-medium"
                style={{ color: CARD_PURPLE_MID }}
              >
                + YOUR OTAKU TYPE +
              </div>
            </div>

            {/* 타이틀 영역 */}
            <div className="flex flex-col gap-1.5 pt-1">
              <div className="text-[11px] flex items-center gap-1" style={{ color: CARD_PURPLE_MID }}>
                <span>당신은</span>
                <span className="text-[8px]">✦</span>
                <span className="text-[8px]">☄</span>
              </div>
              <div
                className="text-[19px] leading-[1.25] font-extrabold tracking-tight"
                style={{ color: CARD_PURPLE_DARK }}
              >
                {t.title}
              </div>
              <div
                className="inline-flex self-start items-center gap-1 text-[10px] font-bold text-white rounded-full px-2.5 py-1 mt-1 shadow-sm"
                style={{ background: CARD_PURPLE_MID }}
              >
                <span className="text-white/70 text-[8px]">✦</span>
                <span>{t.tagline}</span>
                <span className="text-white/70 text-[8px]">✦</span>
              </div>
            </div>
          </div>

          {/* 설명 */}
          <p className="text-[12px] leading-[1.7]" style={{ color: CARD_PURPLE_DARK }}>
            {t.sub}
          </p>

          {/* 특징 4분면 */}
          <div>
            <div
              className="inline-block text-[10px] font-bold rounded-full px-2.5 py-1 mb-2 bg-white"
              style={{ color: CARD_PURPLE_DARK, border: `1px solid ${CARD_PURPLE_SOFT}` }}
            >
              ✦ 당신의 오타쿠 특징 ✦
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {t.traits4.map((text, i) => {
                const Icon = traitIcons[i];
                return (
                  <div
                    key={i}
                    className="bg-white rounded-lg p-2 flex flex-col items-center text-center gap-1"
                    style={{ border: `1px solid ${CARD_PURPLE_SOFT}` }}
                  >
                    <Icon size={18} style={{ color: CARD_PURPLE_MID }} strokeWidth={2} />
                    <div
                      className="text-[8.5px] leading-[1.35]"
                      style={{ color: CARD_PURPLE_DARK }}
                    >
                      {text}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2단: 지수 + 장르 */}
          <div className="grid grid-cols-2 gap-2">
            {/* 오타쿠 지수 */}
            <div
              className="bg-white rounded-lg p-2.5"
              style={{ border: `1px solid ${CARD_PURPLE_SOFT}` }}
            >
              <div
                className="text-[9px] font-bold rounded-full px-2 py-0.5 inline-block mb-2"
                style={{ background: CARD_LAVENDER, color: CARD_PURPLE_DARK }}
              >
                ✦ 오타쿠 지수 ✦
              </div>
              <div className="flex flex-col gap-1.5">
                {statRows.map(({ Icon, label, value }) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <Icon size={11} style={{ color: CARD_PURPLE_MID }} strokeWidth={2} className="flex-shrink-0" />
                    <span
                      className="text-[9px] w-9 flex-shrink-0 font-medium"
                      style={{ color: CARD_PURPLE_DARK }}
                    >
                      {label}
                    </span>
                    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "#EAE0FA" }}>
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${value}%`, background: CARD_PURPLE_MID }}
                      />
                    </div>
                    <span
                      className="text-[8.5px] font-bold w-7 text-right"
                      style={{ color: CARD_PURPLE_DARK }}
                    >
                      {value}%
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* 좋아할 애니 TOP 3 */}
            <div
              className="bg-white rounded-lg p-2.5"
              style={{ border: `1px solid ${CARD_PURPLE_SOFT}` }}
            >
              <div
                className="text-[9px] font-bold rounded-full px-2 py-0.5 inline-block mb-2"
                style={{ background: CARD_LAVENDER, color: CARD_PURPLE_DARK }}
              >
                ✦ 좋아할 애니 TOP 3 ✦
              </div>
              <div className="flex flex-col gap-1.5">
                {(dbAnimeRecs && dbAnimeRecs.length > 0 ? dbAnimeRecs : t.recommendedAnime)
                  .slice(0, 3)
                  .map((a, i) => (
                    <div
                      key={a.title}
                      className="flex items-start gap-1.5 rounded-md p-1.5"
                      style={{ background: CARD_LAVENDER_SOFT }}
                    >
                      <div
                        className="w-4 h-4 rounded-full text-white text-[8px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ background: CARD_PURPLE_MID }}
                      >
                        {i + 1}
                      </div>
                      <Tv
                        size={13}
                        style={{ color: CARD_PURPLE_MID }}
                        strokeWidth={2}
                        className="flex-shrink-0 mt-0.5"
                      />
                      <span
                        className="text-[10px] flex-1 font-semibold leading-tight"
                        style={{ color: CARD_PURPLE_DARK }}
                      >
                        {a.title}
                      </span>
                      <Heart
                        size={11}
                        style={{ color: CARD_PURPLE_SOFT }}
                        strokeWidth={2}
                        className="mt-0.5"
                      />
                    </div>
                  ))}
              </div>
            </div>
          </div>

          {/* 명언 박스 */}
          <div
            className="rounded-lg p-3.5 relative"
            style={{ background: CARD_LAVENDER, border: `1px solid ${CARD_PURPLE_SOFT}` }}
          >
            <span
              className="absolute top-1 left-2.5 font-bold text-lg leading-none"
              style={{ color: CARD_PIXEL_PINK }}
              aria-hidden
            >
              &ldquo;
            </span>
            <p
              className="text-center text-[11.5px] leading-relaxed font-medium px-3"
              style={{ color: CARD_PURPLE_DARK }}
            >
              {t.quote}
            </p>
            <span
              className="absolute bottom-0 right-2.5 font-bold text-lg leading-none"
              style={{ color: CARD_PIXEL_PINK }}
              aria-hidden
            >
              &rdquo;
            </span>
            <div className="absolute -bottom-0.5 right-7 text-[10px]" style={{ color: CARD_PIXEL_PINK }} aria-hidden>
              ♥♥
            </div>
          </div>

          {/* 푸터 (공유 안내) */}
          <div
            className="flex items-center justify-center gap-2 pt-1 text-[10px]"
            style={{ color: CARD_PURPLE_MID }}
          >
            <span>테스트가 재미있었다면? 친구에게 공유해보세요!</span>
          </div>
        </div>
      </div>

      {/* 희귀도 표시 */}
      {rarePct !== null && (
        <div
          className="text-[11px] text-center rounded-xl py-2 px-3"
          style={{
            background: rarePct < 10 ? "#FFF0F8" : CARD_LAVENDER_SOFT,
            color: rarePct < 10 ? CARD_PIXEL_PINK : CARD_PURPLE_DARK,
            border: `1px solid ${rarePct < 10 ? "#F8D0E5" : CARD_PURPLE_SOFT}`,
          }}
        >
          {rarePct < 10 ? "✨ 희귀! " : ""}
          전체 참여자 중 <strong>{rarePct}%</strong>
          {rarePct < 10 ? "만" : "가"} 받은 유형이에요
        </div>
      )}

    </div>
  );
}

export default function OtakuTypeV2Page() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex max-w-[560px] flex-col items-center gap-6 py-24 px-4">
          <div className="h-8 w-8 animate-spin border-2 border-[#534AB7] border-t-transparent rounded-full" />
          <p className="text-sm text-gray-500">불러오는 중...</p>
        </main>
      }
    >
      <OtakuTypeV2PageContent />
    </Suspense>
  );
}
