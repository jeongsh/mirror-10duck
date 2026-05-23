"use client";

import { useState } from "react";
import Link from "next/link";

type ResultType =
  | "idol"
  | "munchkin"
  | "school"
  | "animal"
  | "monster"
  | "sports"
  | "adventure"
  | "bishounen"
  | "family";

interface Choice {
  text: string;
  type: ResultType;
}

interface Question {
  q: string;
  choices: [Choice, Choice, Choice, Choice, Choice];
}

const LABELS = ["①", "②", "③", "④", "⑤"] as const;

const QUESTIONS: Question[] = [
  {
    q: "새 애니 1화, 10분이 지났는데 아직 아무것도 안 일어났다. 당신은?",
    choices: [
      { text: "이미 오프닝 노래가 좋았으니 됐다", type: "idol" },
      { text: "딱 5분만 더 준다. 그 이후는 모르겠다", type: "munchkin" },
      { text: "캐릭터 파악 중이라 오히려 집중하고 있음", type: "school" },
      { text: "배경에서 귀여운 동물 찾느라 바쁨", type: "animal" },
      { text: "폭풍 전 고요겠지. 기다릴 수 있다", type: "monster" },
    ],
  },
  {
    q: "나는 애니에서 어떤 장면에 두근거리나?",
    choices: [
      { text: "수많은 노력이 경기에서 단 한 방에 터질 때", type: "sports" },
      { text: "지도에도 없던 새로운 장소가 처음 등장할 때", type: "adventure" },
      { text: "주인공이 음악과 함께 멋있게 등장하는 첫 씬", type: "bishounen" },
      { text: "흩어졌던 팀이 다시 한 자리에 모이는 재결합 씬", type: "family" },
      { text: "무대 위에서 스포트라이트를 독차지하는 순간", type: "idol" },
    ],
  },
  {
    q: "최애 캐릭터가 다쳤다. 내 반응은?",
    choices: [
      { text: "회복력이 비현실적인 캐릭터니까 괜찮겠지", type: "munchkin" },
      { text: "왜 하필 그 순간에 그 사람이 옆에 없냐고", type: "school" },
      { text: "동물 파트너라도 곁에 있어서 다행이다", type: "animal" },
      { text: "이게 드디어 각성 조건이었나? 메모함", type: "monster" },
      { text: "부상 딛고 복귀하면 분명 더 강해지겠지", type: "sports" },
    ],
  },
  {
    q: "시즌 2 제작 발표가 났다. 가장 기대되는 건?",
    choices: [
      { text: "새로운 지역 또는 더 넓어진 세계관", type: "adventure" },
      { text: "성장하고 돌아온 주인공의 달라진 비주얼", type: "bishounen" },
      { text: "흩어졌던 멤버들이 다시 뭉치는 장면", type: "family" },
      { text: "시즌 2 오프닝 아티스트 발표", type: "idol" },
      { text: "주인공이 얼마나 더 강해졌는지 확인", type: "munchkin" },
    ],
  },
  {
    q: "덕질하면서 가장 '아 이래서 이거 보는구나' 싶었던 순간은?",
    choices: [
      { text: "두 캐릭터가 드디어 서로 마음을 확인하는 장면", type: "school" },
      { text: "귀여운 캐릭터가 화면 가득 채울 때", type: "animal" },
      { text: "연습과 노력이 경기에서 한 번에 증명될 때", type: "sports" },
      { text: "예상 못 한 새로운 지역이 처음 나올 때", type: "adventure" },
      { text: "평화로운 일상 뒤에 충격적인 반전이 터질 때", type: "monster" },
    ],
  },
  {
    q: "애니 속 세계에 들어간다면 제일 먼저 하고 싶은 건?",
    choices: [
      { text: "주인공 옆에서 멋있는 장면 같이 찍기", type: "bishounen" },
      { text: "전 멤버를 불러 모아 밥 한 끼 제대로 먹기", type: "family" },
      { text: "라이브 무대 최전선 자리 확보하기", type: "idol" },
      { text: "주인공한테 최강 기술 하나 전수받기", type: "munchkin" },
      { text: "학교 옥상에서 도시락 먹기", type: "school" },
    ],
  },
  {
    q: "다음 중 나를 가장 잘 설명하는 문장은?",
    choices: [
      { text: "귀엽고 작은 것들에 유독 눈이 먼저 간다", type: "animal" },
      { text: "어둡고 자극적인 것에 오히려 끌린다", type: "monster" },
      { text: "지면 분한데 이기면 아무 말도 안 나온다", type: "sports" },
      { text: "가본 적 없는 곳에 대한 상상을 자주 한다", type: "adventure" },
      { text: "어딜 가든 첫인상이 가장 중요하다고 생각한다", type: "bishounen" },
    ],
  },
  {
    q: "마지막화를 다 보고 난 뒤 제일 먼저 드는 생각은?",
    choices: [
      { text: "다들 행복하게 잘 살겠지...? 살겠지?", type: "family" },
      { text: "다음 시즌 공연은 언제야", type: "idol" },
      { text: "저 이후로 얼마나 더 강해졌을까", type: "munchkin" },
      { text: "저 둘 결국 이어진 거 맞지...? 맞지?", type: "school" },
      { text: "동물 파트너는 잘 살고 있는 거겠지", type: "animal" },
    ],
  },
  {
    q: "주변에 애니를 추천할 때 내 기준은?",
    choices: [
      { text: "세계관이 깊고 반전과 충격이 있는 것", type: "monster" },
      { text: "보고 나면 뭔가 하고 싶어지는 에너지가 있는 것", type: "sports" },
      { text: "세계가 넓고 탐험하는 재미가 있는 것", type: "adventure" },
      { text: "캐릭터 디자인이 확실히 눈을 사로잡는 것", type: "bishounen" },
      { text: "아무나 불러다 같이 봐도 되는 것", type: "family" },
    ],
  },
  {
    q: "지금 이 순간, 나를 가장 잘 표현하는 취향은?",
    choices: [
      { text: "최애 소식을 남들보다 1분이라도 먼저 안다", type: "idol" },
      { text: "어떤 상황이든 최적의 방법부터 떠올린다", type: "munchkin" },
      { text: "주변 분위기와 사람들의 감정을 잘 읽는다", type: "school" },
      { text: "길 가다 동물이 보이면 무조건 멈춘다", type: "animal" },
      { text: "잔잔한 것보다 강렬하고 어두운 것에 끌린다", type: "monster" },
    ],
  },
];

const RESULTS: Record<
  ResultType,
  {
    emoji: string;
    color: string;
    subtitle: string;
    name: string;
    description: string;
    traits: [string, string, string];
    animes: { title: string; note: string }[];
  }
> = {
  idol: {
    emoji: "🎤",
    color: "#fce7f3",
    subtitle: "아이돌형",
    name: "응원봉이 진짜 무기인 타입",
    description:
      "최애가 무대에 서는 순간 뇌에서 도파민이 과부하된다. 오시 생일은 외우는데 본인 생일은 까먹음. '현장에 있었어야 했는데'를 주 4회 이상 중얼거리며 산다. 이 작품에 아이돌 요소가 있냐 없냐가 시청 기준의 전부. 응원봉은 이미 세 개인데 왜인지 모름.",
    traits: ["오프닝 1절 통째로 암기", "굿즈 지름 전 '마지막이야' 선언", "현장 못 간 날 유튜브로 3회 대리 만족"],
    animes: [
      { title: "【推しの子】 오시노코", note: "아이돌 업계의 민낯을 파고드는 다크 판타지" },
      { title: "러브 라이브!", note: "스쿨 아이돌 입문서. 오프닝만 30번 들어도 됨" },
      { title: "BanG Dream!", note: "밴드 × 아이돌. 연주 씬에서 심장 두근거림 보장" },
    ],
  },
  munchkin: {
    emoji: "💥",
    color: "#fef3c7",
    subtitle: "먼치킨형",
    name: "주인공이 1화에 약하면 내 시간이 없는 타입",
    description:
      "주인공이 1화에서 얻어맞으면 0.3초 안에 창을 닫는다. 스킬 설명 나오면 DPS 계산부터 함. 적이 나타났을 때 드는 감정은 걱정이 아니라 '이거 얼마나 걸리냐'임. 레벨 제한 없는 성장물이 이상적인 애니관. 최종 보스가 쓰러진 뒤 주인공이 더 강해질 여지가 있는지 확인하고 잠든다.",
    traits: ["1화에서 스펙 판단 완료", "적 등장 = 클리어 타이머 시작", "최종화 후 후일담 스펙 검색"],
    animes: [
      { title: "원펀맨 (One Punch Man)", note: "1화부터 무쌍. 적이 나오면 끝남. 이게 바로 정석" },
      { title: "오버로드 (Overlord)", note: "주인공이 이미 만렙. 걱정할 일이 없어서 오히려 편함" },
      { title: "나 혼자만 레벨업", note: "성장 그래프가 수직 상승. 스펙 오르는 맛으로 봄" },
    ],
  },
  school: {
    emoji: "📚",
    color: "#dbeafe",
    subtitle: "학원물형",
    name: "교복 없으면 청춘도 없는 타입",
    description:
      "모든 갈등은 교실→복도→체육관 창고 순으로 해결된다는 걸 이미 알고 있다. 전학생이 등장하면 심장이 먼저 반응한다. 우산 하나로 둘이 쓰는 씬에서 먹고 마시던 걸 내려놓는다. '어, 너도 이 학교야?' 소리 들을 때마다 당하는데 또 당함. 옥상은 왜 항상 잠겨 있지 않은 건지 궁금하지 않음.",
    traits: ["전학생 등장 시 자동 집중", "우산 씬 = 영상 멈춤 필수", "옥상 개방 여부에 의심 없음"],
    animes: [
      { title: "카구야님은 고백받고 싶어", note: "두뇌전 러브코미디. 누가 먼저 고백하는지 두 시즌 걸림" },
      { title: "청춘 돼지는 바니걸 선배의 꿈을 꾸지 않는다", note: "감성 + 청춘 + 설렘. 제목이 전부 설명함" },
      { title: "5등분의 신부", note: "5명 중 누가 신부인지 알면서도 끝까지 보게 만드는 마력" },
    ],
  },
  animal: {
    emoji: "🐾",
    color: "#dcfce7",
    subtitle: "동물형",
    name: "고양이 한 마리면 명작 인증되는 타입",
    description:
      "마스코트 캐릭터 없는 작품은 뭔가 불안하다. 고양이귀 달린 캐릭터가 나오는 순간 뇌가 멈춘다. 메인 스토리보다 동물 에피소드 내용을 더 잘 기억함. 귀여운 게 필살기를 써도 진심으로 감동받는다. 동물 조력자가 희생되는 씬에서 주인공보다 더 많이 운다.",
    traits: ["마스코트 = 최애 확정 루트", "고양이귀 캐릭터에 무방비", "동물 에피소드 5회 이상 재시청"],
    animes: [
      { title: "던전밥 (Delicious in Dungeon)", note: "던전 속 몬스터를 요리해 먹음. 생명체 사랑이 느껴짐" },
      { title: "비스타즈 (Beastars)", note: "초식과 육식이 공존하는 세계의 청춘물. 생각보다 진지함" },
      { title: "포켓몬스터", note: "설명 필요 없음. 당신이 이미 알고 있음" },
    ],
  },
  monster: {
    emoji: "💀",
    color: "#fee2e2",
    subtitle: "괴물형",
    name: "피가 안 나오면 아직 진짜 싸움 아닌 타입",
    description:
      "1화가 평화로우면 '폭풍 전 고요'로 해석하고 기다린다. 보스 디자인이 못생길수록 호감도 올라감. 주인공이 반쯤 괴물화되는 씬에서 혼자 박수 친다. 잔인도 낮은 작품은 마음속에서 '주니어용'으로 분류. 각성할 때 BGM 볼륨은 반드시 올려야 직성이 풀린다.",
    traits: ["1화 평화 = 2화 학살 예고로 해석", "보스 못생길수록 기대감 상승", "각성 씬에서 혼자 흥분"],
    animes: [
      { title: "진격의 거인 (Attack on Titan)", note: "1화 10분에 세계관 전부 뒤집음. 이후 삶이 달라짐" },
      { title: "주술회전 (Jujutsu Kaisen)", note: "저주 × 배틀. 작화와 연출이 극장판 수준" },
      { title: "도쿄구울 (Tokyo Ghoul)", note: "인간과 괴물 사이에서 흔들리는 주인공. 각성 씬 레전드" },
    ],
  },
  sports: {
    emoji: "⚽",
    color: "#ecfccb",
    subtitle: "체육형",
    name: "보고 나서 운동복 질렀다가 안 입는 타입",
    description:
      "시합 직전 BGM 한 소절만 들려도 심박수가 올라간다. 이건 스포입니다. 주인공이 땀 흘리며 한계를 넘는 장면에서 자기도 모르게 주먹을 쥔다. 합숙 에피소드 보고 실제로 합숙 계획 세웠다가 안 감. 부상당한 선수가 복귀하는 씬은 어떤 스포츠물이든 반드시 운다.",
    traits: ["시합 BGM = 심박수 120", "합숙 계획 세우고 취소 경력 다수", "부상 복귀 씬 100% 눈물 보장"],
    animes: [
      { title: "하이큐!! (Haikyuu!!)", note: "배구물의 정점. 보고 나서 배구공 사고 싶어짐" },
      { title: "블루록 (Blue Lock)", note: "에고이즘으로 승부하는 축구물. 주인공이 나쁜 놈인데 응원됨" },
      { title: "쿠로코의 농구", note: "현실 불가능한 기술들의 향연. 그게 매력" },
    ],
  },
  adventure: {
    emoji: "🗺️",
    color: "#fef9c3",
    subtitle: "탐험여행형",
    name: "지도에 '미지의 영역' 없으면 불안한 타입",
    description:
      "세계관 지도가 나오면 일단 확대해서 구석구석 읽는다. 이세계 전이 직후 첫 마을 씬이 제일 설레고 제일 오래 기억에 남음. 던전 탐험 BGM은 명상 플리 대신 쓴다. '저 너머에 뭐가 있을까'를 생각하다 잠 못 든 전적 있음. 지도에 표시 안 된 지역이 등장하면 입꼬리가 올라간다.",
    traits: ["세계관 지도 정주행 필수", "미지 영역 등장 시 자동 흥분", "던전 BGM으로 집중 모드 입장"],
    animes: [
      { title: "프리렌: 장례식의 뒤에서", note: "마왕 쓰러뜨린 이후의 이야기. 여행의 끝이 더 여운 있음" },
      { title: "메이드 인 어비스 (Made in Abyss)", note: "귀여운 그림체 + 지하 심연 탐험. 조합이 무섭도록 잘 맞음" },
      { title: "던전밥 (Delicious in Dungeon)", note: "던전을 탐험하며 몬스터를 요리함. 진짜로" },
    ],
  },
  bishounen: {
    emoji: "✨",
    color: "#ede9fe",
    subtitle: "미소년미소녀형",
    name: "작화가 8할이고 나머지 2할도 작화인 타입",
    description:
      "1화 오프닝 컷 하나로 시청 여부를 결정한다. 좋아하는 캐릭터 눈 색깔, 머리카락 색깔, 성우 이름은 당연히 외움. 작붕이 발생하면 그 에피소드만 1점 깎는다. 악역이라도 비주얼이 좋으면 응원 가능. 캐릭터 생일에 SNS 올리는 걸 연례 행사로 취급함.",
    traits: ["오프닝 1컷으로 입덕 판정", "작붕 발생 시 해당 화 감점 처리", "잘생긴 악역도 응원 가능"],
    animes: [
      { title: "바이올렛 에버가든", note: "한 컷 한 컷이 배경화면. 작화에 감사함을 느끼게 되는 작품" },
      { title: "귀멸의 칼날 (Demon Slayer)", note: "전투 작화가 극장판 수준. 눈이 호강함" },
      { title: "흑집사 (Black Butler)", note: "비주얼 미친 집사와 도련님. 캐릭터 디자인만으로 입덕 가능" },
    ],
  },
  family: {
    emoji: "🏠",
    color: "#ffedd5",
    subtitle: "가족형",
    name: "전원 생존 아니면 며칠 밥 못 먹는 타입",
    description:
      "부모님이랑 같이 봐도 되는 작품이 진짜 명작이다. 캐릭터들끼리 사이좋은 장면만 나와도 행복 게이지가 찬다. 복선 없이 갑자기 캐릭터가 죽으면 일상에 지장이 생긴다. 훈훈한 식사 씬은 반드시 한 번 더 본다. '이 팀 영원히 이러면 안 되나'를 시즌 내내 생각함.",
    traits: ["식사 씬 = 힐링 = 재시청", "갑작스러운 캐릭터 사망 시 일상 붕괴", "전원 생존 엔딩만이 진짜 엔딩"],
    animes: [
      { title: "클라나드 (CLANNAD)", note: "이 작품 보고 안 운 사람 없음. 가족의 의미를 다시 생각하게 됨" },
      { title: "원피스 (One Piece)", note: "나카마(동료)가 곧 가족. 재결합 씬마다 울게 설계됨" },
      { title: "도라에몽 (Doraemon)", note: "부모님이랑 같이 봐도 되는 유일무이한 작품. 클래식" },
    ],
  },
};

const EMPTY_SCORES: Record<ResultType, number> = {
  idol: 0,
  munchkin: 0,
  school: 0,
  animal: 0,
  monster: 0,
  sports: 0,
  adventure: 0,
  bishounen: 0,
  family: 0,
};

function getTopResult(scores: Record<ResultType, number>): ResultType {
  return (Object.entries(scores) as [ResultType, number][]).reduce(
    (best, [type, score]) => (score > scores[best] ? type : best),
    "idol" as ResultType,
  );
}

export default function OtakuTypePage() {
  const [phase, setPhase] = useState<"intro" | "quiz" | "result">("intro");
  const [currentQ, setCurrentQ] = useState(0);
  const [scores, setScores] = useState<Record<ResultType, number>>(EMPTY_SCORES);
  const [selected, setSelected] = useState<number | null>(null);

  const handleSelect = (index: number, type: ResultType) => {
    if (selected !== null) return;
    setSelected(index);
    setTimeout(() => {
      const next = { ...scores, [type]: scores[type] + 1 };
      setScores(next);
      if (currentQ + 1 >= QUESTIONS.length) {
        setPhase("result");
      } else {
        setCurrentQ((q) => q + 1);
        setSelected(null);
      }
    }, 350);
  };

  const reset = () => {
    setPhase("intro");
    setCurrentQ(0);
    setScores(EMPTY_SCORES);
    setSelected(null);
  };

  if (phase === "intro") {
    return (
      <main className="mx-auto flex max-w-xl flex-col gap-6 py-8">
        <div className="border border-dashed border-gray-500 bg-white p-6 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Otaku Type Test</p>
          <div className="mt-4 text-5xl">🦆</div>
          <h1 className="mt-3 text-2xl font-black text-gray-900">나는 어떤 오타쿠인가</h1>
          <p className="mt-3 text-sm leading-6 text-gray-600">
            10문항 · 5지선다 · 약 1분
            <br />
            당신의 진짜 오타쿠 성향을 정밀 분석합니다.
          </p>
          <p className="mt-1 text-xs text-gray-400">(전혀 정밀하지 않음)</p>
          <button
            onClick={() => setPhase("quiz")}
            className="mt-6 inline-flex w-full items-center justify-center border border-dashed border-gray-900 bg-gray-900 px-6 py-3 text-sm font-bold text-white hover:bg-gray-800"
          >
            테스트 시작하기 →
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {(Object.entries(RESULTS) as [ResultType, (typeof RESULTS)[ResultType]][]).map(
            ([, r]) => (
              <div
                key={r.subtitle}
                className="flex items-center gap-3 border border-dashed border-gray-200 bg-gray-50 px-4 py-2.5"
              >
                <span className="text-2xl">{r.emoji}</span>
                <div className="min-w-0">
                  <span className="block text-[10px] font-bold text-gray-400">{r.subtitle}</span>
                  <span className="block text-xs font-bold text-gray-700">{r.name}</span>
                </div>
              </div>
            ),
          )}
        </div>
      </main>
    );
  }

  if (phase === "result") {
    const topType = getTopResult(scores);
    const result = RESULTS[topType];

    return (
      <main className="mx-auto flex max-w-xl flex-col gap-6 py-8">
        <div className="overflow-hidden border border-dashed border-gray-500 bg-white">
          <div
            className="flex flex-col items-center justify-center gap-3 py-10"
            style={{ backgroundColor: result.color }}
          >
            <span style={{ fontSize: 72, lineHeight: 1 }}>{result.emoji}</span>
            <span className="border border-dashed border-gray-400 bg-white/70 px-3 py-0.5 text-[10px] font-bold uppercase tracking-widest text-gray-500">
              {result.subtitle}
            </span>
          </div>
          <div className="p-6">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Your Otaku Type</p>
            <div className="mt-3 text-center">
              <h2 className="text-xl font-black text-gray-900">{result.name}</h2>
            </div>
            <p className="mt-4 border-t border-dashed border-gray-200 pt-4 text-sm leading-7 text-gray-700">
              {result.description}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {result.traits.map((trait) => (
                <span
                  key={trait}
                  className="border border-dashed border-gray-300 bg-gray-50 px-2 py-1 text-xs font-bold text-gray-600"
                >
                  #{trait}
                </span>
              ))}
            </div>
            <div className="mt-5 border-t border-dashed border-gray-200 pt-4">
              <p className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-400">
                이런 애니 어때요?
              </p>
              <div className="flex flex-col gap-2">
                {result.animes.map((anime) => (
                  <div
                    key={anime.title}
                    className="border border-dashed border-gray-200 bg-gray-50 px-3 py-2.5"
                  >
                    <p className="text-xs font-black text-gray-900">{anime.title}</p>
                    <p className="mt-0.5 text-xs leading-5 text-gray-500">{anime.note}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={reset}
            className="flex-1 border border-dashed border-gray-500 bg-white px-4 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-50"
          >
            다시하기
          </button>
          <Link
            href="/play/oshi-card"
            className="flex-1 border border-dashed border-gray-900 bg-gray-900 px-4 py-2.5 text-center text-xs font-bold text-white hover:bg-gray-800"
          >
            오시 카드 만들기 →
          </Link>
        </div>
      </main>
    );
  }

  const question = QUESTIONS[currentQ];
  const progress = (currentQ / QUESTIONS.length) * 100;

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-5 py-8">
      <div className="flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden bg-gray-200">
          <div
            className="h-full bg-gray-900 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="shrink-0 text-xs font-bold tabular-nums text-gray-500">
          {currentQ + 1} / {QUESTIONS.length}
        </span>
      </div>

      <div key={`q-${currentQ}`} className="border border-dashed border-gray-500 bg-white p-5">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Q{currentQ + 1}</p>
        <h2 className="mt-2 text-lg font-black leading-7 text-gray-900">{question.q}</h2>
      </div>

      <div key={`c-${currentQ}`} className="flex flex-col gap-2">
        {question.choices.map((choice, index) => (
          <button
            key={index}
            onClick={() => handleSelect(index, choice.type)}
            disabled={selected !== null}
            className={`flex items-center gap-3 border border-dashed px-4 py-3 text-left text-sm font-medium transition-colors disabled:cursor-default ${
              selected === index
                ? "border-gray-900 bg-gray-900 text-white"
                : selected !== null
                  ? "border-gray-200 bg-gray-50 text-gray-400"
                  : "border-gray-400 bg-white text-gray-800 hover:border-gray-700 hover:bg-gray-50"
            }`}
          >
            <span
              className={`shrink-0 text-xs font-black ${selected === index ? "text-gray-300" : "text-gray-400"}`}
            >
              {LABELS[index]}
            </span>
            {choice.text}
          </button>
        ))}
      </div>
    </main>
  );
}
