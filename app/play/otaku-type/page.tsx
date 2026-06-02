"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthUser } from "@/lib/supabase/useAuthUser";
import {
  fetchOtakuTypeResult,
  upsertOtakuTypeResult,
  fetchOtakuTypeDistribution,
  type OtakuTypeResultRow,
} from "@/lib/supabase/otakuTypeResults";
import {
  getAnimeRecommendationsByType,
  type AnimeRecommendation,
} from "@/lib/supabase/animeRecommendations";

/* ============================================================
 * 기존 질문지 보관 (어떤 오타쿠인가 — 타입 테스트)
 * ============================================================
 * Q1: 새 애니 1화, 10분이 지났는데 아직 아무것도 안 일어났다. 당신은?
 *   → idol/munchkin/school/animal/monster
 * Q2: 나는 애니에서 어떤 장면에 두근거리나?
 *   → sports/adventure/bishounen/family/idol
 * Q3: 최애 캐릭터가 다쳤다. 내 반응은?
 *   → munchkin/school/animal/monster/sports
 * Q4: 시즌 2 제작 발표. 가장 기대되는 건?
 *   → adventure/bishounen/family/idol/munchkin
 * Q5: 덕질하면서 가장 '아 이래서 이거 보는구나' 싶었던 순간
 *   → school/animal/sports/adventure/monster
 * Q6: 애니 속 세계에 들어간다면 제일 먼저 하고 싶은 건?
 *   → bishounen/family/idol/munchkin/school
 * Q7: 다음 중 나를 가장 잘 설명하는 문장은?
 *   → animal/monster/sports/adventure/bishounen
 * Q8: 마지막화를 다 보고 난 뒤 제일 먼저 드는 생각은?
 *   → family/idol/munchkin/school/animal
 * Q9: 주변에 애니를 추천할 때 내 기준은?
 *   → monster/sports/adventure/bishounen/family
 * Q10: 지금 이 순간, 나를 가장 잘 표현하는 취향은?
 *   → idol/munchkin/school/animal/monster
 *
 * 결과 유형: idol, munchkin, school, animal, monster, sports, adventure, bishounen, family
 * ============================================================ */

// ─── 타입 정의 ───────────────────────────────────────────────

type AxisType = "S/N" | "D/C" | "M/L";
type AxisChoice = "S" | "N" | "D" | "C" | "M" | "L";
type ResultCode = "SDM" | "SDL" | "SCM" | "SCL" | "NDM" | "NDL" | "NCM" | "NCL";

interface LevelOption {
  label: string;
  text: string;
  axis: AxisChoice;
  weight: 1 | 2 | 3;
}

interface LevelQuestion {
  num: number;
  axis: AxisType;
  text: string;
  image: string;
  options: LevelOption[];
}

interface AnimeRec {
  title: string;
  reason: string;
}

interface ResultInfo {
  code: string;
  emoji: string;
  badge: string;
  badgeColor: string;
  badgeBg: string;
  title: string;
  sub: string;
  traits: [string, string, string];
  compat: string;
  recommendedAnime: AnimeRec[];
}

interface Tier {
  min: number;
  max: number;
  name: string;
  desc: string;
}

interface AxisDetail {
  hi: number;
  lo: number;
  hiMax: number;
  loMax: number;
  hiCount: number;
  loCount: number;
  questionCount: number;
  pct: number;
  side: "hi" | "lo";
}

interface PerQuestionResult {
  num: number;
  axis: AxisType;
  axisLabel: string;
  pickedAxis: AxisChoice;
  pickedSideLabel: string;
  weight: 1 | 2 | 3;
  intensityLabel: string;
  isHi: boolean;
}

interface ScoreData {
  sn: AxisDetail;
  dc: AxisDetail;
  ml: AxisDetail;
  total: number;
  totalMax: number;
  pct: number;
  snT: "S" | "N";
  dcT: "D" | "C";
  mlT: "M" | "L";
  tier: Tier;
  perQuestion: PerQuestionResult[];
}

const AXIS_LABELS: Record<AxisType, string> = {
  "S/N": "몰입 성향",
  "D/C": "표현 성향",
  "M/L": "소비 성향",
};

const SIDE_LABELS: Record<AxisChoice, string> = {
  S: "가볍게 즐김",
  N: "파고들기",
  D: "적극적 표현",
  C: "조용히 혼자",
  M: "과감한 소비",
  L: "절제와 선택",
};

const SIDE_SHORT_LABELS: Record<AxisChoice, string> = {
  S: "S",
  N: "N",
  D: "D",
  C: "C",
  M: "M",
  L: "L",
};

const SIDE_COLORS: Record<AxisChoice, string> = {
  S: "#9C95E8",
  N: "#534AB7",
  D: "#0F6E56",
  C: "#5DA88F",
  M: "#993556",
  L: "#D88AA4",
};

const INTENSITY_LABELS: Record<1 | 2 | 3, string> = {
  1: "약함",
  2: "보통",
  3: "강함",
};

const HI_AXIS: Record<AxisType, AxisChoice> = {
  "S/N": "N",
  "D/C": "D",
  "M/L": "M",
};

const LO_AXIS: Record<AxisType, AxisChoice> = {
  "S/N": "S",
  "D/C": "C",
  "M/L": "L",
};

// ─── 질문 데이터 ─────────────────────────────────────────────

const QUESTIONS: LevelQuestion[] = [
  { num: 1, axis: "S/N", text: "주말에 갑자기 아무 계획이 없어졌다. 당신은?", image: "/taku-test/v1/Q1.webp",
    options: [
      { label: "A", text: "친구에게 연락해서 카페나 영화를 보러 나간다.", axis: "S", weight: 3 },
      { label: "B", text: "좋아하는 시리즈를 다시 보며 방구석 힐링을 즐긴다.", axis: "N", weight: 2 },
      { label: "C", text: "드디어! 밀린 애니 정주행 리스트를 꺼낸다. 오늘은 쉬지 않는다.", axis: "N", weight: 3 },
      { label: "D", text: "생산적인 걸 해야 한다며 청소하고 운동한다.", axis: "S", weight: 2 },
    ] },
  { num: 2, axis: "D/C", text: "좋아하는 작품에 비판적인 리뷰가 달렸다. 당신의 반응은?", image: "/taku-test/v1/Q2.webp",
    options: [
      { label: "A", text: "같은 팬들과 공유하며 함께 분노한다.", axis: "D", weight: 2 },
      { label: "B", text: "그 리뷰의 논리적 허점을 조목조목 반박하는 댓글을 작성한다.", axis: "D", weight: 3 },
      { label: "C", text: "속으로 화가 나지만 그냥 닫는다.", axis: "C", weight: 2 },
      { label: "D", text: "'그럴 수도 있지' 하며 쿨하게 넘긴다.", axis: "C", weight: 3 },
    ] },
  { num: 3, axis: "M/L", text: "좋아하는 캐릭터의 굿즈를 발견했다. 당신은?", image: "/taku-test/v1/Q3.webp",
    options: [
      { label: "A", text: "정말 퀄리티 좋은 굿즈만 신중하게 구매한다.", axis: "L", weight: 2 },
      { label: "B", text: "갖고 싶지만 공간이나 돈이 걱정돼 참는다.", axis: "L", weight: 3 },
      { label: "C", text: "한정판이면 무조건. 일반판은 고민한다.", axis: "M", weight: 2 },
      { label: "D", text: "가격 불문. 지르고 나서 생각한다.", axis: "M", weight: 3 },
    ] },
  { num: 4, axis: "S/N", text: "친구가 '추천할 만한 애니 있어?'라고 물었다. 당신은?", image: "/taku-test/v1/Q4.webp",
    options: [
      { label: "A", text: "장르, 분위기, 화수까지 분석해 맞춤 추천 리스트를 만들어준다.", axis: "N", weight: 3 },
      { label: "B", text: "'뭐 좋아해?'라고 반문하며 대화로 이어간다.", axis: "S", weight: 2 },
      { label: "C", text: "'요즘 유행하는 거 봐봐'라며 인기작 하나만 추천한다.", axis: "S", weight: 3 },
      { label: "D", text: "내가 제일 좋아하는 작품을 강력히 밀어붙인다.", axis: "N", weight: 2 },
    ] },
  { num: 5, axis: "D/C", text: "좋아하는 성우나 아티스트의 오프라인 이벤트가 열렸다. 당신은?", image: "/taku-test/v1/Q5.webp",
    options: [
      { label: "A", text: "같이 갈 동료를 모집해 단체 원정을 계획한다.", axis: "D", weight: 2 },
      { label: "B", text: "온라인 중계가 있으면 집에서 본다.", axis: "C", weight: 3 },
      { label: "C", text: "알림 설정해두고 티켓팅 시작 30분 전부터 대기한다.", axis: "D", weight: 3 },
      { label: "D", text: "가고 싶지만 줄 서고 대기하는 게 귀찮아서 고민한다.", axis: "C", weight: 2 },
    ] },
  { num: 6, axis: "M/L", text: "방 안에 굿즈와 피규어가 점점 늘어가고 있다. 당신의 생각은?", image: "/taku-test/v1/Q6.webp",
    options: [
      { label: "A", text: "슬슬 미니멀리즘을 실천해야 할 것 같다.", axis: "L", weight: 3 },
      { label: "B", text: "이게 행복이다. 더 늘릴 계획을 세운다.", axis: "M", weight: 3 },
      { label: "C", text: "정리하고 싶은데 손이 안 간다.", axis: "L", weight: 2 },
      { label: "D", text: "사진 찍고 SNS에 올리며 컬렉션을 뽐낸다.", axis: "M", weight: 2 },
    ] },
  { num: 7, axis: "S/N", text: "새 시즌 첫 화를 봤는데 기대와 달랐다. 당신은?", image: "/taku-test/v1/Q7.webp",
    options: [
      { label: "A", text: "'그럴 수도 있지, 계속 보다 보면 좋아지겠지' 생각한다.", axis: "S", weight: 2 },
      { label: "B", text: "커뮤니티에서 다른 팬들의 반응을 확인한다.", axis: "N", weight: 2 },
      { label: "C", text: "바로 드롭하고 다른 작품을 찾아본다.", axis: "S", weight: 3 },
      { label: "D", text: "스태프 정보, 원작 비교 등을 찾아보며 이유를 분석한다.", axis: "N", weight: 3 },
    ] },
  { num: 8, axis: "D/C", text: "덕질 관련 이야기를 모르는 사람에게 할 때 당신은?", image: "/taku-test/v1/Q8.webp",
    options: [
      { label: "A", text: "설명하다 보면 흥분해서 한 시간은 기본이다.", axis: "D", weight: 3 },
      { label: "B", text: "굳이 설명하지 않는다. 어차피 모를 것 같아서.", axis: "C", weight: 3 },
      { label: "C", text: "'입문하게 해주겠다'며 자료를 준비해온다.", axis: "D", weight: 2 },
      { label: "D", text: "상대가 관심 있어 보이면 조금, 아니면 생략한다.", axis: "C", weight: 2 },
    ] },
  { num: 9, axis: "M/L", text: "최애 작품이 실망스러운 엔딩으로 끝났다. 당신은?", image: "/taku-test/v1/Q9.webp",
    options: [
      { label: "A", text: "커뮤니티에서 실컷 떠들고 털어버린다.", axis: "M", weight: 2 },
      { label: "B", text: "한동안 멍하다가 다른 작품으로 넘어간다.", axis: "L", weight: 2 },
      { label: "C", text: "이차창작이나 팬픽으로 내 머릿속의 엔딩을 완성한다.", axis: "M", weight: 3 },
      { label: "D", text: "엔딩은 아쉽지만 전체적인 여정을 기억하기로 한다.", axis: "L", weight: 3 },
    ] },
  { num: 10, axis: "S/N", text: "처음 만난 사람이 같은 작품을 좋아한다는 걸 알게 됐다. 당신은?", image: "/taku-test/v1/Q10.webp",
    options: [
      { label: "A", text: "가볍게 공감하고 다른 얘기로 넘어간다.", axis: "S", weight: 3 },
      { label: "B", text: "운명이다. 숨겨둔 덕력을 전부 꺼낸다.", axis: "N", weight: 3 },
      { label: "C", text: "'혹시 OO도 알아?' 하며 레이더를 가동한다.", axis: "N", weight: 2 },
      { label: "D", text: "공통 화제가 생겨 반갑지만 일단 천천히 탐색한다.", axis: "S", weight: 2 },
    ] },
  { num: 11, axis: "D/C", text: "좋아하는 캐릭터의 생일이 다가왔다. 당신은?", image: "/taku-test/v1/Q11.webp",
    options: [
      { label: "A", text: "SNS에 축하 일러스트나 글을 올리며 함께 기념한다.", axis: "D", weight: 2 },
      { label: "B", text: "속으로 축하하고 굿즈를 하나 사며 조용히 챙긴다.", axis: "C", weight: 2 },
      { label: "C", text: "'아 오늘이었구나' 하고 마음속으로만 축하한다.", axis: "C", weight: 3 },
      { label: "D", text: "카페 대관해 생일 카페를 열거나, 광고·서포트에 참여한다.", axis: "D", weight: 3 },
    ] },
  { num: 12, axis: "M/L", text: "좋아하는 작품의 콜라보 카페·팝업스토어가 열렸다. 당신은?", image: "/taku-test/v1/Q12.webp",
    options: [
      { label: "A", text: "오픈런 한다. 메뉴 풀세트에 굿즈도 종류별로 쓸어담는다.", axis: "M", weight: 3 },
      { label: "B", text: "한정 굿즈만 노리고 가서 그것만 사 온다.", axis: "M", weight: 2 },
      { label: "C", text: "가서 분위기를 즐기고 마음에 드는 굿즈 한두 개만 산다.", axis: "L", weight: 2 },
      { label: "D", text: "인증샷용으로 음료 하나만 시키고 구경한다.", axis: "L", weight: 3 },
    ] },
];

// ─── 결과 유형 ───────────────────────────────────────────────

const TYPES: Record<ResultCode, ResultInfo> = {
  SDM: { code: "S · D · M", emoji: "🎪", badge: "인싸 컬렉터", badgeColor: "#D4537E", badgeBg: "#FBEAF0",
    title: "축제형 수집가",
    sub: "덕질이 시작되면 굿즈부터 지릅니다. '일단 이것만' 하고 결제창을 닫았다가 다시 열었다가를 반복하다 결국 다 사버린 경험, 한 번쯤은 있죠? 팬미팅 현장에서 가장 신나는 사람, 생일 카페에서 가장 먼저 웃는 사람 — 바로 당신이에요.",
    traits: ["'이것만' 하고 결제하면 어느새 전부 담겨 있음", "팬미팅 현장 에너지 충전소 역할 자처", "지르고 나서 반성하지만 다음엔 또 지름"],
    compat: "🤝 잘 맞는 유형: 분석형 전도사 (NDM)",
    recommendedAnime: [
      { title: "러브라이브!", reason: "라이브 떼창과 팬덤의 축제 그 자체" },
      { title: "아이돌마스터 신데렐라걸즈", reason: "끝없는 캐릭터·굿즈·콜라보 천국" },
      { title: "봇치 더 록!", reason: "트렌디한 화제성 + 굿즈 풍부" },
      { title: "우마무스메 프리티 더비", reason: "화려한 라이브와 인싸 친화 화제성" },
    ] },
  SDL: { code: "S · D · L", emoji: "🎤", badge: "소셜 라이트", badgeColor: "#185FA5", badgeBg: "#E6F1FB",
    title: "사교형 라이트 덕후",
    sub: "덕질이 삶의 전부는 아니지만, 공통 취향 하나로 어색한 사람과도 금방 친해집니다. '이거 봤어요?' 한마디면 세상 어디서든 분위기를 만드는 사람. 지갑은 단단히 지키면서 즐거움은 최대치로 끌어올리는 효율형 덕후예요.",
    traits: ["공통 취향 하나로 어색한 분위기 즉시 해제", "깊이보다 분위기와 화제성이 우선", "지갑은 이성적, 감정은 감성적"],
    compat: "🤝 잘 맞는 유형: 분석형 전도사 (NDL)",
    recommendedAnime: [
      { title: "스파이 패밀리", reason: "누구나 함께 보기 좋은 화제작" },
      { title: "주술회전", reason: "사람들과 떠들기 좋은 핫한 액션" },
      { title: "체인소 맨", reason: "입문자도 빠지는 트렌디한 분위기" },
      { title: "장송의 프리렌", reason: "가볍게 보기 좋지만 여운은 깊음" },
    ] },
  SCM: { code: "S · C · M", emoji: "🛍️", badge: "조용한 지름러", badgeColor: "#BA7517", badgeBg: "#FAEEDA",
    title: "은둔형 컬렉터",
    sub: "겉으로는 '그냥 가끔 보는 편'이라고 말하지만, 방 한쪽에는 피규어가 줄을 섰습니다. '이건 한정판이라서' — 이 말이 입에 붙었다면 이미 당신입니다. 아무에게도 말 안 하고 혼자 쌓아가는 컬렉션, 그게 진짜 행복이죠.",
    traits: ["겉으로는 라이트, 방 안에서는 찐덕", "한정판이라는 단어에 지갑이 저절로 열림", "컬렉션 인증은 나만 보는 폴더에"],
    compat: "🤝 잘 맞는 유형: 은둔형 분석가 (NCM)",
    recommendedAnime: [
      { title: "그 비스크 돌은 사랑을 한다", reason: "코스튬·굿즈의 무한 컬렉션 욕구" },
      { title: "카드캡터 사쿠라", reason: "모으고 싶은 카드와 의상의 상징" },
      { title: "마법소녀 마도카☆마기카", reason: "비주얼·굿즈 모두 풍부" },
      { title: "카구야 님은 고백받고 싶어", reason: "캐릭터 굿즈 컬렉션의 정석" },
    ] },
  SCL: { code: "S · C · L", emoji: "🌿", badge: "라이트 덕후", badgeColor: "#639922", badgeBg: "#EAF3DE",
    title: "균형형 라이트 덕후",
    sub: "덕질도 하고 일상도 챙기고, 지갑도 지키고. 이 세 가지를 동시에 해내는 게 말처럼 쉬운 줄 아세요? 당신은 덕질계에서 가장 지속 가능한 삶을 사는 현자입니다. 10년 후에도 취미로 애니 보고 있을 사람이에요.",
    traits: ["덕질과 일상의 균형을 실제로 이루는 희귀종", "좋아하는 건 확실하지만 과몰입은 스스로 조절", "오래, 건강하게 덕질하는 현자 스타일"],
    compat: "🤝 잘 맞는 유형: 은둔형 컬렉터 (SCM)",
    recommendedAnime: [
      { title: "유루캠△", reason: "잔잔한 캠핑 힐링" },
      { title: "케이온!", reason: "부담 없는 동아리 일상" },
      { title: "바라카몬", reason: "따뜻한 시골 힐링 일상" },
      { title: "일상", reason: "부담 0의 가벼운 코미디" },
    ] },
  NDM: { code: "N · D · M", emoji: "🔥", badge: "하드코어 오타쿠", badgeColor: "#534AB7", badgeBg: "#EEEDFE",
    title: "최고급 하드코어 오타쿠",
    sub: "분석 리포트는 평론가급, 굿즈 지출은 가계부에 '기타'로 처리하는 편. 덕질이 정체성이 된 지 오래됐고, 주변 사람들은 이미 당신을 그 분야 전문가로 여깁니다. 당신이 오타쿠가 아니면 누가 오타쿠입니까.",
    traits: ["작품 분석이 웬만한 전문 리뷰어 수준", "굿즈 지출은 월 예산에 '필수 항목'으로 편성", "이미 덕질이 정체성이 된 지 오래"],
    compat: "🤝 잘 맞는 유형: 축제형 수집가 (SDM)",
    recommendedAnime: [
      { title: "신세기 에반게리온", reason: "분석할 거리가 무한, 굿즈도 무한" },
      { title: "코드 기어스 반역의 를르슈", reason: "서사·연출·캐릭터 모두 끝판왕" },
      { title: "Fate/Zero", reason: "설정·세계관·굿즈의 종합 백과사전" },
      { title: "강철의 연금술사 BROTHERHOOD", reason: "완벽한 명작 + 풍부한 굿즈" },
    ] },
  NDL: { code: "N · D · L", emoji: "📣", badge: "덕질 전도사", badgeColor: "#0F6E56", badgeBg: "#E1F5EE",
    title: "분석형 전도사",
    sub: "좋아하는 작품을 두 번 이상 본 다음에야 '봤다'고 인정하는 유형. 지인에게 애니 추천할 때 장르·화수·주의사항까지 자동으로 브리핑되지만, 정작 본인 지갑은 철저하게 지킵니다. 입덕 성공률은 높고, 후회는 없어요.",
    traits: ["추천할 때 장르·화수·주의사항 세트로 제공", "논리적 허점을 조목조목 짚어내는 분석력", "지갑은 지키면서 덕질 생태계는 넓힘"],
    compat: "🤝 잘 맞는 유형: 사교형 라이트 덕후 (SDL)",
    recommendedAnime: [
      { title: "강철의 연금술사 BROTHERHOOD", reason: "누구에게나 추천 가능한 정통 명작" },
      { title: "진격의 거인", reason: "서사 분석·토론 거리가 산더미" },
      { title: "죠죠의 기묘한 모험", reason: "입문시키는 재미가 큰 시리즈" },
      { title: "모노노케 히메", reason: "미야자키 거장의 전도용 명작" },
    ] },
  NCM: { code: "N · C · M", emoji: "📚", badge: "심층 수집가", badgeColor: "#993C1D", badgeBg: "#FAECE7",
    title: "은둔형 분석가",
    sub: "말은 없지만 정보량은 상위 1%. 작품 이야기가 나오면 멈출 수 없고, 컬렉션 규모는 아무도 모르는 사람. '사실 이거 꽤 알아'라는 카드를 결정적인 순간에만 꺼내는, 알수록 깊이가 느껴지는 진성 덕후예요.",
    traits: ["말없다가 작품 얘기 나오면 3시간 가동", "소장 규모를 아는 사람이 거의 없음", "커뮤 눈팅 연차는 길지만 댓글은 마음속으로만"],
    compat: "🤝 잘 맞는 유형: 조용한 지름러 (SCM)",
    recommendedAnime: [
      { title: "〈물어〉 시리즈 (모노가타리)", reason: "매니악한 매력과 풍부한 굿즈" },
      { title: "슈타인즈;게이트", reason: "깊은 SF 서사 + 알찬 굿즈 라인업" },
      { title: "마법소녀 마도카☆마기카", reason: "해석 여지와 굿즈 모두 풍부" },
      { title: "사이코패스", reason: "진중한 SF 추리, 컬렉션 가치 있음" },
    ] },
  NCL: { code: "N · C · L", emoji: "🔍", badge: "고독한 연구가", badgeColor: "#3C3489", badgeBg: "#EEEDFE",
    title: "고독한 덕질 연구가",
    sub: "작품 하나를 끝내고 나면 OST, 감독 인터뷰, 원작 비교까지 파고드는 게 당연한 일. 굿즈보다 이해를 사고, 팬덤보다 작품 자체를 우선하는 진짜 덕후입니다. 화려하지 않아도 내공만큼은 누구보다 깊어요.",
    traits: ["작품 보고 나서 감독 인터뷰까지 찾아보는 루틴", "가장 조용하지만 이해도는 가장 깊음", "굿즈 없어도 애정은 누구보다 진지함"],
    compat: "🤝 잘 맞는 유형: 균형형 라이트 덕후 (SCL)",
    recommendedAnime: [
      { title: "신세기 에반게리온", reason: "평생 분석할 만한 텍스트" },
      { title: "핑퐁 THE ANIMATION", reason: "연출·미장센 연구의 보고" },
      { title: "모노노케 히메", reason: "미야자키 세계관 학문적 탐구" },
      { title: "메이드 인 어비스", reason: "촘촘한 세계관과 깊은 여운" },
    ] },
};

const TIERS: Tier[] = [
  { min: 0, max: 9, name: "일반인", desc: "아직 덕질보다 일상이 더 많은 단계예요." },
  { min: 10, max: 18, name: "패션 오타쿠", desc: "취향은 생겼는데 본격적으로 빠지진 않은 단계예요." },
  { min: 19, max: 27, name: "오타쿠", desc: "덕질이 삶의 일부가 된 진짜 오타쿠 단계예요." },
  { min: 28, max: 99, name: "찐", desc: "덕질이 곧 정체성. 부정할 수 없는 찐 오타쿠입니다." },
];

const RESULT_GRADIENTS: Record<ResultCode, string> = {
  SDM: "linear-gradient(150deg, #F9A8D4 0%, #FEE0EC 55%, #FBEAF0 100%)",
  SDL: "linear-gradient(150deg, #93C5FD 0%, #C3DFFB 55%, #E6F1FB 100%)",
  SCM: "linear-gradient(150deg, #FCD34D 0%, #FDE68A 55%, #FAEEDA 100%)",
  SCL: "linear-gradient(150deg, #86EFAC 0%, #BBF7D0 55%, #EAF3DE 100%)",
  NDM: "linear-gradient(150deg, #A78BFA 0%, #C4B5FD 55%, #EEEDFE 100%)",
  NDL: "linear-gradient(150deg, #34D399 0%, #6EE7B7 55%, #E1F5EE 100%)",
  NCM: "linear-gradient(150deg, #FCA5A5 0%, #FECACA 55%, #FAECE7 100%)",
  NCL: "linear-gradient(150deg, #818CF8 0%, #A5B4FC 55%, #EEEDFE 100%)",
};

// ─── 결과 계산 ───────────────────────────────────────────────

const HI_SET = new Set<AxisChoice>(["N", "D", "M"]);

function calcResult(answers: (number | null)[]): { type: ResultInfo; scores: ScoreData } {
  const bucket: Record<AxisChoice, number> = { S: 0, N: 0, D: 0, C: 0, M: 0, L: 0 };
  const picked: Record<AxisChoice, number> = { S: 0, N: 0, D: 0, C: 0, M: 0, L: 0 };
  const qCountByAxis: Record<AxisType, number> = { "S/N": 0, "D/C": 0, "M/L": 0 };
  const perQuestion: PerQuestionResult[] = [];

  answers.forEach((ans, qi) => {
    const q = QUESTIONS[qi];
    qCountByAxis[q.axis] += 1;
    if (ans === null) return;
    const opt = q.options[ans];
    bucket[opt.axis] += opt.weight;
    picked[opt.axis] += 1;
    perQuestion.push({
      num: q.num,
      axis: q.axis,
      axisLabel: AXIS_LABELS[q.axis],
      pickedAxis: opt.axis,
      pickedSideLabel: SIDE_LABELS[opt.axis],
      weight: opt.weight,
      intensityLabel: INTENSITY_LABELS[opt.weight],
      isHi: HI_SET.has(opt.axis),
    });
  });

  const buildAxis = (axisType: AxisType): AxisDetail => {
    const hiKey = HI_AXIS[axisType];
    const loKey = LO_AXIS[axisType];
    const qCount = qCountByAxis[axisType];
    const hi = bucket[hiKey];
    const lo = bucket[loKey];
    const sum = hi + lo;
    const pct = sum === 0 ? 50 : Math.round((hi / sum) * 100);
    return {
      hi,
      lo,
      hiMax: qCount * 3,
      loMax: qCount * 3,
      hiCount: picked[hiKey],
      loCount: picked[loKey],
      questionCount: qCount,
      pct,
      side: hi >= lo ? "hi" : "lo",
    };
  };

  const sn = buildAxis("S/N");
  const dc = buildAxis("D/C");
  const ml = buildAxis("M/L");

  const total = sn.hi + dc.hi + ml.hi;
  const totalMax = sn.hiMax + dc.hiMax + ml.hiMax;
  const pct = totalMax === 0 ? 0 : Math.round((total / totalMax) * 100);

  const snT: "S" | "N" = sn.side === "hi" ? "N" : "S";
  const dcT: "D" | "C" = dc.side === "hi" ? "D" : "C";
  const mlT: "M" | "L" = ml.side === "hi" ? "M" : "L";
  const tier = TIERS.find((x) => total >= x.min && total <= x.max) ?? TIERS[TIERS.length - 1];

  return {
    type: TYPES[(snT + dcT + mlT) as ResultCode],
    scores: { sn, dc, ml, total, totalMax, pct, snT, dcT, mlT, tier, perQuestion },
  };
}

function fallbackAxis(picked: AxisChoice, axisType: AxisType): AxisDetail {
  const hiKey = HI_AXIS[axisType];
  const isHi = picked === hiKey;
  return {
    hi: isHi ? 6 : 4,
    lo: isHi ? 4 : 6,
    hiMax: 12,
    loMax: 12,
    hiCount: 0,
    loCount: 0,
    questionCount: 4,
    pct: isHi ? 60 : 40,
    side: isHi ? "hi" : "lo",
  };
}

function buildV1FromSavedRow(row: OtakuTypeResultRow): { type: ResultInfo; scores: ScoreData } | null {
  const code = row.result_code as ResultCode;
  const type = TYPES[code];
  if (!type) return null;

  const raw = row.scores as Partial<ScoreData>;
  const snT = (raw.snT ?? code[0]) as "S" | "N";
  const dcT = (raw.dcT ?? code[1]) as "D" | "C";
  const mlT = (raw.mlT ?? code[2]) as "M" | "L";
  const tier =
    raw.tier ??
    TIERS.find((item) => item.name === row.tier_name) ??
    TIERS[TIERS.length - 1];

  const sn = raw.sn ?? fallbackAxis(snT, "S/N");
  const dc = raw.dc ?? fallbackAxis(dcT, "D/C");
  const ml = raw.ml ?? fallbackAxis(mlT, "M/L");
  const total = raw.total ?? sn.hi + dc.hi + ml.hi;
  const totalMax = raw.totalMax ?? sn.hiMax + dc.hiMax + ml.hiMax;
  const pct = raw.pct ?? (totalMax === 0 ? 0 : Math.round((total / totalMax) * 100));

  return {
    type,
    scores: {
      sn,
      dc,
      ml,
      total,
      totalMax,
      pct,
      snT,
      dcT,
      mlT,
      tier,
      perQuestion: raw.perQuestion ?? [],
    },
  };
}

// ─── 메인 페이지 ─────────────────────────────────────────────

export default function OtakuTypePage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex max-w-[560px] flex-col items-center gap-6 py-24 px-4">
          <div className="h-8 w-8 animate-spin border-2 border-[#E5527E] border-t-transparent rounded-full" />
          <p className="text-sm text-gray-500">불러오는 중...</p>
        </main>
      }
    >
      <OtakuTypePageContent />
    </Suspense>
  );
}

function OtakuTypePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const showSaved = searchParams.get("saved") === "1";
  const authUser = useAuthUser();
  const savedResultRef = useRef(false);
  const [restoring, setRestoring] = useState(showSaved);
  const [loadedResult, setLoadedResult] = useState<{ type: ResultInfo; scores: ScoreData } | null>(
    null,
  );
  const [phase, setPhase] = useState<"intro" | "quiz" | "result">("intro");
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

        const row = await fetchOtakuTypeResult(authUser.id, "v1");
        if (cancelled) return;
        if (!row) return;

        const restored = buildV1FromSavedRow(row);
        if (!restored) return;

        setLoadedResult(restored);
        setPhase("result");
      } catch (error) {
        console.error("[otaku-type] saved result load failed:", error);
      } finally {
        if (!cancelled) setRestoring(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [showSaved, authUser]);

  useEffect(() => {
    if (loadedResult) return;
    if (phase !== "result" || !authUser?.id || savedResultRef.current) return;
    if (answers.some((answer) => answer === null)) return;

    savedResultRef.current = true;
    const { type, scores } = calcResult(answers);
    void upsertOtakuTypeResult(authUser.id, {
      testVersion: "v1",
      resultCode: `${scores.snT}${scores.dcT}${scores.mlT}`,
      resultTitle: type.title,
      resultBadge: type.badge,
      tierName: scores.tier.name,
      scores: {
        pct: scores.pct,
        snT: scores.snT,
        dcT: scores.dcT,
        mlT: scores.mlT,
        total: scores.total,
        totalMax: scores.totalMax,
        sn: scores.sn,
        dc: scores.dc,
        ml: scores.ml,
        tier: scores.tier,
      },
    }).catch(console.error);
  }, [phase, authUser?.id, answers, loadedResult]);

  useEffect(() => {
    if (phase !== "result") {
      setDbAnimeRecs(undefined);
      setDistribution(null);
      return;
    }
    const { scores } = loadedResult ?? calcResult(answers);
    const typeCode = `${scores.snT}${scores.dcT}${scores.mlT}`;
    let cancelled = false;
    getAnimeRecommendationsByType("v1", typeCode)
      .then((recs) => { if (!cancelled) setDbAnimeRecs(recs); })
      .catch(() => { if (!cancelled) setDbAnimeRecs([]); });
    fetchOtakuTypeDistribution("v1")
      .then((dist) => { if (!cancelled) setDistribution(dist); })
      .catch(() => { if (!cancelled) setDistribution({}); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, loadedResult]);

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
        setCur((current) => (current === clickedAt ? current + 1 : current));
      }
    }, 180);
  };

  const reset = () => {
    savedResultRef.current = false;
    setLoadedResult(null);
    setPhase("intro");
    setCur(0);
    setAnswers(new Array(QUESTIONS.length).fill(null));
    router.replace("/play/otaku-type");
  };

  if (restoring) {
    return (
      <main className="mx-auto flex max-w-[560px] flex-col items-center gap-6 py-24 px-4">
        <div className="h-8 w-8 animate-spin border-2 border-[#E5527E] border-t-transparent rounded-full" />
        <p className="text-sm text-gray-500">저장된 결과 불러오는 중...</p>
      </main>
    );
  }

  // ── 인트로 ──
  if (phase === "intro") {
    return (
      <main className="mx-auto flex max-w-[560px] flex-col gap-6 py-8 px-4">
        <div className="text-center">
          <h1 className="text-[22px] font-medium mb-1.5">오타쿠 테스트</h1>
          <p className="text-sm text-gray-500">나의 덕후 유형을 알아보는 세 가지 테스트</p>
        </div>
        <div className="flex flex-col gap-3">
          {/* v1 카드 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "#FBEAF0", color: "#D4537E" }}>12문항</span>
              <span className="text-sm font-medium text-gray-800">덕후 타입 테스트</span>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              덕질 성향을 <strong>S/N · D/C · M/L</strong> 세 가지 축으로 분석해 8가지 유형 중 하나로 진단합니다. 축별·문항별 점수를 상세하게 보여줘요.
            </p>
            <button
              onClick={() => setPhase("quiz")}
              className="w-full py-2.5 rounded-lg text-sm font-medium text-white bg-[#E5527E] hover:bg-[#C73D69] active:bg-[#A82E58] shadow-sm hover:shadow-md transition-all duration-150"
            >
              타입 테스트 시작하기 →
            </button>
          </div>

          {/* v2 카드 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "#EEEDFE", color: "#534AB7" }}>10문항</span>
              <span className="text-sm font-medium text-gray-800">어떤 오타쿠?</span>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              질문에 답하면 <strong>9가지 덕후 장르</strong> 중 나와 가장 가까운 유형을 찾아드려요. 아이돌·배틀·스포츠·모험 등 장르 취향으로 분류합니다.
            </p>
            <Link
              href="/play/otaku-type/v2?start=1"
              className="block w-full py-2.5 rounded-lg text-sm font-medium text-center text-white bg-[#534AB7] hover:bg-[#3E3899] active:bg-[#2E2A80] shadow-sm hover:shadow-md transition-all duration-150"
            >
              어떤 오타쿠? 시작하기 →
            </Link>
          </div>

          {/* v3 카드 */}
          <div className="rounded-xl p-5 flex flex-col gap-3 border" style={{ background: "#13082b", borderColor: "rgba(192,132,252,0.3)" }}>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(192,132,252,0.15)", color: "#c084fc" }}>8문항 · VN</span>
              <span className="text-sm font-medium" style={{ color: "#e9d5ff" }}>얼마나 오타쿠예요?</span>
              <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: "rgba(168,85,247,0.2)", color: "#a855f7" }}>NEW</span>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: "rgba(233,213,255,0.6)" }}>
              비주얼 노벨 스타일로 진행되는 오타쿠 수준 측정 테스트예요. <strong style={{ color: "#c084fc" }}>마오</strong>가 직접 심사해 <strong style={{ color: "#c084fc" }}>5단계</strong> 중 당신의 오타쿠 레벨을 진단해줘요.
            </p>
            <Link
              href="/play/otaku-type/v3"
              className="block w-full py-2.5 rounded-lg text-sm font-medium text-center text-white transition-all duration-150"
              style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)" }}
            >
              ✦ 비주얼 노벨 테스트 시작 →
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // ── 결과 ──
  if (phase === "result") {
    const { type: t, scores: d } = loadedResult ?? calcResult(answers);

    const AxisBar = ({ axisType, name }: {
      axisType: AxisType; name: string;
    }) => {
      const axisDetail = axisType === "S/N" ? d.sn : axisType === "D/C" ? d.dc : d.ml;
      const hiKey = HI_AXIS[axisType];
      const loKey = LO_AXIS[axisType];
      const isHi = axisDetail.side === "hi";
      const winnerKey = isHi ? hiKey : loKey;
      const winnerPoints = isHi ? axisDetail.hi : axisDetail.lo;
      const winnerPct = isHi ? axisDetail.pct : (axisDetail.hi + axisDetail.lo === 0 ? 50 : 100 - axisDetail.pct);
      const winnerColor = SIDE_COLORS[winnerKey];
      return (
        <div className="rounded-lg p-3 px-3.5" style={{ background: "#f1efe8" }}>
          <div className="flex justify-between items-baseline text-xs mb-1.5">
            <span className="text-gray-500">{name}</span>
            <span className="font-semibold" style={{ color: winnerColor }}>
              {SIDE_LABELS[winnerKey]} ({winnerKey}) · {winnerPct}%
            </span>
          </div>
          <div className="h-2 rounded bg-white border border-gray-200 overflow-hidden">
            <div
              className="h-full rounded transition-all duration-500"
              style={{ width: `${winnerPct}%`, background: winnerColor }}
            />
          </div>
          <div className="text-[11px] text-gray-400 mt-1.5 text-right">{winnerPoints}점</div>
        </div>
      );
    };

    const resultCode = `${d.snT}${d.dcT}${d.mlT}` as ResultCode;
    const heroGradient = RESULT_GRADIENTS[resultCode];

    const totalDist = distribution ? Object.values(distribution).reduce((a, b) => a + b, 0) : 0;
    const myCount = distribution ? (distribution[resultCode] ?? 0) : 0;
    const rarePct = distribution && totalDist >= 5 ? Math.round((myCount / totalDist) * 100) : null;

    return (
      <main className="mx-auto flex max-w-[560px] flex-col gap-6 py-8 px-4">
        <div className="text-center">
          <h1 className="text-[22px] font-medium mb-1.5">오타쿠 레벨 테스트</h1>
          <p className="text-sm text-gray-500">진단이 완료됐습니다!</p>
        </div>

        <div className="border border-gray-200 rounded-xl overflow-hidden">
          {/* 그라디언트 히어로 섹션 */}
          <div className="px-6 pt-8 pb-6 text-center" style={{ background: heroGradient }}>
            <div className="text-[64px] leading-none mb-3">{t.emoji}</div>
            <div className="text-[13px] font-medium mb-2" style={{ color: t.badgeColor, letterSpacing: "0.15em" }}>{t.code}</div>
            <span className="inline-block px-3.5 py-1 rounded-lg text-xs font-medium mb-3 bg-white/70" style={{ color: t.badgeColor }}>{t.badge}</span>
            <div className="text-[22px] font-medium mb-4 text-gray-900">{t.title}</div>

            <div className="grid grid-cols-3 gap-2.5 mb-4">
              {[
                { v: `${d.total}/${d.totalMax}`, l: `덕력 점수 (${d.pct}%)` },
                { v: d.tier.name, l: "등급" },
                { v: t.code, l: "유형 코드" },
              ].map((s) => (
                <div key={s.l} className="rounded-lg p-3 text-center bg-white/60">
                  <div className="text-[15px] font-semibold" style={{ color: t.badgeColor }}>{s.v}</div>
                  <div className="text-[11px] text-gray-500 mt-0.5">{s.l}</div>
                </div>
              ))}
            </div>

            {rarePct !== null && (
              <div className="bg-white/60 rounded-lg px-4 py-2.5 text-center">
                <div className="text-xs font-medium" style={{ color: rarePct < 10 ? t.badgeColor : "#555" }}>
                  {rarePct < 10 ? "✨ 희귀! " : ""}{`전체 참여자 중 ${rarePct}%${rarePct < 10 ? "만" : "가"} 받은 유형이에요`}
                </div>
                <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden mx-auto max-w-[180px] mt-2">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${Math.max(rarePct, 2)}%`, background: t.badgeColor }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* 흰 배경 본문 섹션 */}
          <div className="bg-white px-6 py-6">
            <div className="text-sm text-gray-500 leading-7 mb-6">{t.sub}</div>

            <div className="flex flex-col gap-3 mb-6">
              <AxisBar axisType="S/N" name="몰입 성향" />
              <AxisBar axisType="D/C" name="표현 성향" />
              <AxisBar axisType="M/L" name="소비 성향" />
            </div>

            <div className="text-left border-t border-gray-100 pt-3">
              {t.traits.map((tr) => (
                <div key={tr} className="flex gap-2.5 py-2 border-b border-gray-100 text-sm text-gray-500 last:border-b-0">
                  <span className="font-bold flex-shrink-0 mt-0.5" style={{ color: t.badgeColor }}>✓</span>
                  <span>{tr}</span>
                </div>
              ))}
            </div>

            <div className="mt-3.5 p-3 rounded-lg text-sm text-left" style={{ background: t.badgeBg, color: t.badgeColor }}>{t.compat}</div>

            <div className="mt-3 p-3.5 rounded-lg text-left bg-gray-50">
              <div className="text-sm font-medium text-gray-700 mb-2.5">🎬 추천 애니</div>
              {dbAnimeRecs === undefined ? (
                <div className="text-xs text-gray-400 py-1">불러오는 중...</div>
              ) : (
                <div className="flex flex-col gap-2">
                  {(dbAnimeRecs.length > 0 ? dbAnimeRecs : t.recommendedAnime).map((a) => (
                    <div key={a.title} className="flex flex-col gap-0.5">
                      <span className="text-[13px] font-medium text-gray-800">· {a.title}</span>
                      <span className="text-[11px] text-gray-500 leading-snug pl-2.5">{a.reason}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-3 p-3 rounded-lg text-sm text-left bg-gray-50 text-gray-500">
              <strong>{d.tier.name}</strong> — {d.tier.desc}
            </div>

            <button onClick={reset} className="mt-5 w-full px-7 py-2.5 border border-gray-300 rounded-lg bg-white text-sm text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-colors duration-150">
              🔄 다시 테스트하기
            </button>
          </div>
        </div>

        {/* 친구 유도 CTA */}
        <div className="rounded-xl p-5 text-center border border-gray-200" style={{ background: "#FFFAF8" }}>
          <div className="text-base font-medium text-gray-800 mb-1.5">친구는 어떤 오타쿠일까요? 👀</div>
          <div className="text-sm text-gray-500 leading-relaxed">
            친구한테도 테스트 해보라고 알려주세요!
          </div>
          <div className="text-xs text-gray-400 mt-1">결과 비교하면 더 재밌어요</div>
        </div>

        <Link href="/play/oshi-card" className="block text-center border border-gray-200 rounded-xl bg-white px-4 py-3 text-sm font-medium text-gray-700 hover:bg-[#FCE7EF] hover:border-[#E5527E] hover:text-[#A82E58] transition-colors duration-150">
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
    <main className="mx-auto flex max-w-[560px] flex-col gap-6 py-8 px-4">
      <div className="text-center">
        <h1 className="text-[22px] font-medium mb-1.5">오타쿠 레벨 테스트</h1>
        <p className="text-sm text-gray-500">12문항으로 알아보는 8가지 덕후 유형</p>
      </div>

      <div>
        <div className="h-1.5 bg-gray-100 rounded overflow-hidden">
          <div className="h-full rounded transition-all duration-300" style={{ width: `${progress}%`, background: "#E5527E" }} />
        </div>
        <div className="flex justify-between items-center mt-1.5">
          {safeCur >= 5 ? (
            <span className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ background: "#FCE7EF", color: "#A82E58" }}>
              {safeCur >= QUESTIONS.length - 1
                ? "✨ 마지막 질문이에요! 결과가 곧 나와요"
                : safeCur >= 8
                ? "💪 거의 다 왔어요! 조금만 더"
                : "🎯 절반 지났어요! 잘 하고 있어요"}
            </span>
          ) : <span />}
          <span className="text-xs text-gray-400">{safeCur + 1} / {QUESTIONS.length}</span>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="relative w-full aspect-[3/2] rounded-lg mb-5 overflow-hidden bg-gray-50">
          <Image
            src={q.image}
            alt={`Q${q.num} 일러스트`}
            fill
            sizes="(max-width: 560px) 100vw, 560px"
            className="object-cover"
            priority={q.num <= 2}
          />
        </div>
        <div className="text-xs font-medium mb-2" style={{ color: "#E5527E", letterSpacing: "0.05em" }}>
          Q{q.num} · {q.axis} 유형 측정
        </div>
        <div className="text-base font-medium leading-relaxed mb-5 text-gray-800">{q.text}</div>

        <div className="flex flex-col gap-2.5">
          {q.options.map((opt, i) => {
            const isSelected = answers[safeCur] === i;
            const isAnimating = selectedAnim === i;
            return (
              <button
                key={i}
                onClick={() => select(i)}
                className="text-left px-4 py-3 rounded-lg border text-sm leading-relaxed"
                style={{
                  ...(isSelected
                    ? { borderColor: "#E5527E", background: "#FCE7EF", color: "#A82E58" }
                    : { borderColor: "rgba(0,0,0,0.12)", background: "#fff", color: "#2c2c2a" }),
                  transform: isAnimating ? "scale(1.025)" : "scale(1)",
                  transition: "transform 0.15s ease, background 0.12s ease, border-color 0.12s ease, color 0.12s ease",
                }}
              >
                <span className="font-medium mr-2" style={{ color: "#E5527E" }}>{opt.label}</span>
                {opt.text}
              </button>
            );
          })}
        </div>

        <div className="flex justify-between items-center mt-5">
          <button
            onClick={() => setCur((c) => Math.max(0, c - 1))}
            disabled={safeCur === 0}
            className="px-5 py-2.5 border rounded-lg text-sm bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-gray-400 transition-colors duration-150 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-white"
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
            className="px-5 py-2.5 border rounded-lg text-sm font-medium text-white bg-[#E5527E] hover:bg-[#C73D69] active:bg-[#A82E58] border-[#E5527E] hover:border-[#C73D69] shadow-sm hover:shadow-md transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-[#E5527E] disabled:hover:shadow-sm"
          >
            {safeCur === QUESTIONS.length - 1 ? "결과 보기 →" : "다음 →"}
          </button>
        </div>
      </div>
    </main>
  );
}
