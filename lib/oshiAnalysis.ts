import type { OshiAnalysisCharacter } from "@/lib/supabase/oshiAnalysis";
import type { OfficialCharacterPosition } from "@/types/official";

export type HexStat = {
  key: string;
  label: string;
  value: number; // 0-100, 50 = DB 평균 수준
};

export type SignatureTag = {
  tag: string;
  multiplier: number; // 평균 대비 배수 (lift)
};

export type OshiAnalysisResult = {
  typeName: string;
  summary: string;
  hexStats: HexStat[];
  signatureTags: SignatureTag[];
  confidence: number;
  confidenceLabel: string;
  selectedCount: number;
  taggedCount: number;
};

export function confidenceLabelFromScore(confidence: number): string {
  if (confidence >= 80) return "분석 신뢰도 높음";
  if (confidence >= 50) return "분석 신뢰도 보통";
  return "태그가 부족해서 대충 들켰습니다";
}

export function oshiAnalysisResultFromSaved(data: {
  result_title: string;
  result_summary: string;
  hex_stats: HexStat[];
  signature_tags: SignatureTag[];
  confidence: number;
  selected_count: number;
  tagged_count: number;
}): OshiAnalysisResult {
  return {
    typeName: data.result_title,
    summary: data.result_summary,
    hexStats: data.hex_stats,
    signatureTags: data.signature_tags,
    confidence: data.confidence,
    confidenceLabel: confidenceLabelFromScore(data.confidence),
    selectedCount: data.selected_count,
    taggedCount: data.tagged_count,
  };
}

/**
 * 전체 DB(약 1,714명) 기준으로 측정한 태그 보유 비율.
 * raw 빈도 점수는 모두 "성장형·다정" 같은 흔한 태그로 수렴하므로,
 * 이 baseline 대비 lift(쏠림 정도)로 취향을 판별한다.
 */
const TAG_BASELINE: Record<string, number> = {
  성장형: 0.68,
  다정: 0.555,
  밝음: 0.31,
  전투캐: 0.289,
  카리스마: 0.249,
  열혈: 0.242,
  노력파: 0.236,
  트라우마: 0.229,
  갭모에: 0.214,
  냉정: 0.211,
  서포터: 0.204,
  집착: 0.18,
  현실주의: 0.165,
  리더: 0.151,
  자기희생: 0.149,
  귀여움: 0.13,
  비극: 0.128,
  순애: 0.125,
  타락: 0.092,
  허세: 0.085,
  미스터리: 0.082,
  지능캐: 0.077,
  처연: 0.071,
  천재: 0.07,
  소심: 0.07,
  정의감: 0.069,
  전략가: 0.067,
  능글: 0.061,
  쿨데레: 0.058,
  먼치킨: 0.055,
  고독: 0.05,
  순수: 0.041,
  까칠: 0.04,
  이중생활: 0.037,
  츤데레: 0.036,
  재기: 0.034,
  무뚝뚝: 0.031,
  엄마미: 0.023,
  구원서사: 0.016,
  섹시함: 0.016,
  // meme_tags
  밈캐: 0.182,
  "세계관 최강자 후보": 0.039,
  "짤 생성기": 0.027,
  "죽을수록 인기 많음": 0.023,
  "얼굴은 천사 성격은 재앙": 0.004,
  "멘탈이 이미 박살남": 0.0035,
  "작가가 굴림": 0.0012,
};

const POSITION_BASELINE: Record<string, number> = {
  조력자: 0.603,
  주인공: 0.0998,
  빌런: 0.082,
  서브주인공: 0.064,
  라이벌: 0.058,
  히로인: 0.0455,
  마스코트: 0.0187,
  스승: 0.0175,
  최종보스: 0.0111,
  흑막: 0.0058,
};

const DEFAULT_BASELINE = 0.03;

type AxisMember =
  | { kind: "tag"; name: string }
  | { kind: "pos"; name: OfficialCharacterPosition };

type AxisDef = {
  key: string;
  label: string;
  members: AxisMember[];
};

const t = (name: string): AxisMember => ({ kind: "tag", name });
const p = (name: OfficialCharacterPosition): AxisMember => ({ kind: "pos", name });

const AXES: AxisDef[] = [
  {
    key: "pain",
    label: "피폐",
    members: [
      t("트라우마"),
      t("비극"),
      t("처연"),
      t("타락"),
      t("고독"),
      t("자기희생"),
      t("구원서사"),
      t("멘탈이 이미 박살남"),
      t("죽을수록 인기 많음"),
    ],
  },
  {
    key: "devotion",
    label: "순애",
    members: [t("순애"), t("다정"), t("서포터"), t("엄마미"), t("순수"), t("자기희생")],
  },
  {
    key: "brain",
    label: "두뇌",
    members: [
      t("지능캐"),
      t("전략가"),
      t("현실주의"),
      t("천재"),
      t("미스터리"),
      t("쿨데레"),
      t("냉정"),
    ],
  },
  {
    key: "power",
    label: "카리스마",
    members: [
      t("전투캐"),
      t("먼치킨"),
      t("카리스마"),
      t("열혈"),
      t("리더"),
      t("정의감"),
      t("세계관 최강자 후보"),
      p("주인공"),
    ],
  },
  {
    key: "chaos",
    label: "광기",
    members: [
      t("집착"),
      t("까칠"),
      t("허세"),
      t("타락"),
      t("짤 생성기"),
      p("빌런"),
      p("흑막"),
      p("최종보스"),
      p("라이벌"),
    ],
  },
  {
    key: "moe",
    label: "모에",
    members: [
      t("귀여움"),
      t("밝음"),
      t("갭모에"),
      t("능글"),
      t("소심"),
      t("밈캐"),
      p("마스코트"),
      p("히로인"),
    ],
  },
];

function baselineOf(member: AxisMember): number {
  if (member.kind === "pos") return POSITION_BASELINE[member.name] ?? DEFAULT_BASELINE;
  return TAG_BASELINE[member.name] ?? DEFAULT_BASELINE;
}

function tagBaseline(tag: string): number {
  return TAG_BASELINE[tag] ?? DEFAULT_BASELINE;
}

const AXIS_TITLE: Record<string, string> = {
  pain: "피폐 서사 수집가",
  devotion: "순애 과몰입러",
  brain: "두뇌파 편애러",
  power: "센 캐릭터 숭배자",
  chaos: "위험한 캐릭터 애호가",
  moe: "치명적 모에 수집가",
};

const AXIS_PREFIX: Record<string, string> = {
  pain: "상처 입은",
  devotion: "순정의",
  brain: "냉철한",
  power: "불타는",
  chaos: "광기의",
  moe: "귀여움에 약한",
};

const AXIS_PUNCHLINE: Record<string, string> = {
  pain: "겉으로는 멀쩡한 척하지만,\n한 번쯤 무너진 캐릭터만 보면 마음이 갑니다.",
  devotion: "한 사람만 바라보는 캐릭터에게\n끝까지 마음을 주는 타입입니다.",
  brain: "머리 좋고 판을 읽는 캐릭터한테\n자꾸만 끌리는 게 들켰습니다.",
  power: "강하고 압도적인 캐릭터 앞에서\n결국 무릎 꿇는 취향입니다.",
  chaos: "착한 캐릭터보다 위험한 캐릭터가\n더 매력 있다고 느끼는 사람입니다.",
  moe: "귀엽고 사랑스러운 캐릭터한테\n이성을 잃는 게 분명합니다.",
};

// ── 분석 로그 연출 ───────────────────────────────────────────────
// 선택한 최애들의 실제 태그/포지션에서 멘트를 뽑아, 분석 중인 척하는
// 미니게임식 로그를 만든다. 우열 평가가 아니라 장난식 폭로 톤을 유지한다.

const VILLAIN_POSITIONS: OfficialCharacterPosition[] = ["빌런", "흑막", "최종보스", "라이벌"];
const HEALER_TAGS = ["서포터", "엄마미", "순수", "다정", "힐러"];

const REPEAT_TEMPLATES: Array<(tag: string) => string> = [
  (tag) => `${tag} 태그 감지...`,
  (tag) => `${tag} 서사 반복 출현...`,
  (tag) => `${tag} 선호도 과다...`,
  (tag) => `${tag} 편애 패턴 확인...`,
];

const AXIS_LOG_CONCLUSION: Record<string, string> = {
  pain: "결론: 무너진 캐릭터에게 약함",
  devotion: "결론: 순애 회로 풀가동",
  brain: "결론: 머리 좋은 캐릭터에게 약함",
  power: "결론: 센 캐릭터 앞에서 무력화",
  chaos: "결론: 위험한 캐릭터에게 약함",
  moe: "결론: 귀여움에 이성 상실",
};

export function buildAnalysisLog(
  characters: OshiAnalysisCharacter[],
  result: OshiAnalysisResult,
): string[] {
  if (characters.length === 0) return ["분석할 최애가 없습니다..."];

  const lines: string[] = [];

  // 반복 등장 태그 집계
  const tagCount = new Map<string, number>();
  for (const c of characters) {
    for (const tag of [...(c.tags ?? []), ...(c.meme_tags ?? [])]) {
      tagCount.set(tag, (tagCount.get(tag) ?? 0) + 1);
    }
  }
  const repeated = [...tagCount.entries()]
    .filter(([, cnt]) => cnt >= 2)
    .sort((a, b) => b[1] - a[1]);

  repeated.slice(0, 3).forEach(([tag], i) => {
    lines.push(REPEAT_TEMPLATES[Math.min(i, REPEAT_TEMPLATES.length - 1)](tag));
  });

  // 반복 태그가 없으면 가장 흔한 단일 태그라도 언급
  if (lines.length === 0) {
    const top = [...tagCount.entries()].sort((a, b) => b[1] - a[1])[0];
    if (top) lines.push(`${top[0]} 태그 감지...`);
  }

  // 콤보 감지: 빌런인데 순애
  const hasVillainDevotion = characters.some((c) => {
    const isVillain = (c.positions ?? []).some((pos) => VILLAIN_POSITIONS.includes(pos));
    const isDevoted = (c.tags ?? []).some((tag) => tag === "순애" || tag === "다정");
    return isVillain && isDevoted;
  });
  if (hasVillainDevotion) lines.push("빌런인데 순애인 케이스 발견...");

  // 콤보 감지: 천재인데 멘탈 나감
  const hasGeniusPain = characters.some((c) => {
    const tags = new Set([...(c.tags ?? []), ...(c.meme_tags ?? [])]);
    const isGenius = tags.has("천재") || tags.has("지능캐") || tags.has("전략가");
    const isBroken =
      tags.has("트라우마") || tags.has("비극") || tags.has("멘탈이 이미 박살남");
    return isGenius && isBroken;
  });
  if (hasGeniusPain) lines.push("천재인데 멘탈 나간 케이스 발견...");

  // 부재 감지: 힐러 없음
  const healerTotal = [...tagCount.entries()]
    .filter(([tag]) => HEALER_TAGS.includes(tag))
    .reduce((sum, [, cnt]) => sum + cnt, 0);
  if (healerTotal === 0) lines.push("힐러 부재 확인...");

  // 결론 제외 최대 5줄
  const trimmed = lines.slice(0, 5);

  const dom = [...result.hexStats].sort((a, b) => b.value - a.value)[0];
  trimmed.push(AXIS_LOG_CONCLUSION[dom?.key ?? ""] ?? "결론: 취향이 뚜렷함");

  return trimmed;
}

// ── 속성 공명 ────────────────────────────────────────────────────

export type ResonanceItem = {
  tag: string;
  level: number; // 1–4
};

export type Resonance = {
  items: ResonanceItem[];
  alerts: string[];
};

const DEATH_FLAG_TAGS = new Set(["비극", "자기희생", "죽을수록 인기 많음", "처연", "고독"]);
const CHAOS_ALERT_TAGS = new Set(["집착", "타락", "허세", "짤 생성기"]);

export function buildResonance(characters: OshiAnalysisCharacter[]): Resonance {
  const n = characters.length;
  if (n === 0) return { items: [], alerts: [] };

  const tagCount = new Map<string, number>();
  for (const c of characters) {
    for (const tag of [...(c.tags ?? []), ...(c.meme_tags ?? [])]) {
      tagCount.set(tag, (tagCount.get(tag) ?? 0) + 1);
    }
  }

  const levelFor = (cnt: number): number => {
    const r = cnt / n;
    if (r >= 0.7) return 4;
    if (r >= 0.5) return 3;
    if (r >= 0.3) return 2;
    return 1;
  };

  const items: ResonanceItem[] = [...tagCount.entries()]
    .filter(([, cnt]) => cnt >= 2)
    .map(([tag, cnt]) => ({ tag, level: levelFor(cnt) }))
    .sort((a, b) => b.level - a.level)
    .slice(0, 4);

  const alerts: string[] = [];

  const deathHits = [...tagCount.entries()]
    .filter(([tag]) => DEATH_FLAG_TAGS.has(tag))
    .reduce((sum, [, cnt]) => sum + cnt, 0);
  if (deathHits >= 3) alerts.push("최애 사망 플래그 감지");

  const chaosHits = [...tagCount.entries()]
    .filter(([tag]) => CHAOS_ALERT_TAGS.has(tag))
    .reduce((sum, [, cnt]) => sum + cnt, 0);
  if (chaosHits >= 4) alerts.push("광기캐 위험 수치 초과");

  const villainCount = characters.filter((c) =>
    (c.positions ?? []).some((p) => ["빌런", "흑막", "최종보스"].includes(p)),
  ).length;
  if (villainCount >= 3) alerts.push("세계관 핵심 태그 과밀");

  const hasDevotionResonance = items.some(
    (i) => ["순애", "다정"].includes(i.tag) && i.level >= 2,
  );
  if (hasDevotionResonance) alerts.push("순애 회로 활성화");

  return { items, alerts };
}

// ── 최애 파티 판정 ────────────────────────────────────────────────

export type PartyRole = {
  role: string;
  value: string;
};

export type PartyJudgment = {
  roles: PartyRole[];
  verdict: string;
};

const VILLAIN_POS_SET = new Set<OfficialCharacterPosition>(["빌런", "흑막", "최종보스", "라이벌"]);
const HEALER_TAG_SET = new Set(["서포터", "엄마미", "힐러"]);
const PAIN_TAG_SET = new Set(["트라우마", "비극", "처연", "자기희생", "고독", "멘탈이 이미 박살남"]);
const DEVOTION_TAG_SET = new Set(["순애", "다정", "순수"]);

const DEALER_LABELS: Record<string, string> = {
  pain: "서사 파괴자",
  devotion: "감정형 공격수",
  brain: "심리전 딜러",
  power: "물리 제압형",
  chaos: "세계관 파괴자",
  moe: "치유형 딜러",
};

export function buildPartyJudgment(
  characters: OshiAnalysisCharacter[],
  result: OshiAnalysisResult,
): PartyJudgment {
  const n = characters.length;
  if (n === 0) return { roles: [], verdict: "" };

  const villainCount = characters.filter((c) =>
    (c.positions ?? []).some((p) => VILLAIN_POS_SET.has(p)),
  ).length;

  const painCount = characters.filter((c) =>
    [...(c.tags ?? []), ...(c.meme_tags ?? [])].some((t) => PAIN_TAG_SET.has(t)),
  ).length;

  const hasHealer = characters.some((c) => (c.tags ?? []).some((t) => HEALER_TAG_SET.has(t)));

  const hasDevotionBuff = characters.some((c) =>
    (c.tags ?? []).some((t) => DEVOTION_TAG_SET.has(t)),
  );

  const sortedAxes = [...result.hexStats].sort((a, b) => b.value - a.value);
  const dom = sortedAxes[0];
  const dealerLabel = DEALER_LABELS[dom?.key ?? ""] ?? "알 수 없음";

  const roles: PartyRole[] = [];
  roles.push({ role: "메인 딜러", value: dealerLabel });
  if (painCount >= 2) roles.push({ role: "탱커", value: "멘탈 이미 박살남" });
  roles.push({ role: "힐러", value: hasHealer ? "있음" : "없음" });
  if (hasDevotionBuff) roles.push({ role: "버퍼", value: "순애캐" });
  if (villainCount > 0) roles.push({ role: "위험 요소", value: `빌런 ${villainCount}명 포함` });

  let verdict: string;
  if (!hasHealer && painCount >= 3) {
    verdict = `힐러 없이 피폐 서사만 ${painCount}명입니다.`;
  } else if (villainCount >= 2 && !hasHealer) {
    verdict = `빌런이 ${villainCount}명인데 힐러가 없습니다.`;
  } else if (!hasHealer && villainCount > 0) {
    verdict = "빌런 포함, 힐러 없는 파티입니다.";
  } else if (!hasHealer) {
    verdict = "힐러 없이 전진하는 파티입니다.";
  } else if (painCount >= Math.ceil(n * 0.6)) {
    verdict = "강하지만 안정성이 의심됩니다.";
  } else {
    verdict = "균형은 몰라도 일단 강합니다.";
  }

  return { roles, verdict };
}

// ── 취향 위험도 게이지 ────────────────────────────────────────────

export type DangerGauge = {
  label: string;
  value: number; // 0–100
};

export function buildDangerGauges(
  characters: OshiAnalysisCharacter[],
  result: OshiAnalysisResult,
): DangerGauge[] {
  const n = characters.length;
  if (n === 0) return [];

  const hexMap = Object.fromEntries(result.hexStats.map((s) => [s.key, s.value]));
  const painVal = hexMap["pain"] ?? 50;
  const chaosVal = hexMap["chaos"] ?? 50;

  const normalcy = Math.max(0, Math.round(100 - (painVal + chaosVal) / 2));
  const painResist = painVal;

  const nonMainCount = characters.filter(
    (c) =>
      !(c.positions ?? []).includes("주인공") &&
      !(c.positions ?? []).includes("히로인") &&
      !(c.positions ?? []).includes("서브주인공"),
  ).length;
  const sideChar = Math.round((nonMainCount / n) * 100);

  const villainRatio =
    characters.filter((c) =>
      (c.positions ?? []).some((p) => ["빌런", "흑막", "최종보스"].includes(p)),
    ).length / n;
  const officialDistrust = Math.min(
    100,
    Math.round(chaosVal * 0.6 + villainRatio * 100 * 0.4),
  );

  return [
    { label: "피폐 내성", value: painResist },
    { label: "조연 집착", value: sideChar },
    { label: "공식 불신", value: officialDistrust },
    { label: "정상성", value: normalcy },
  ];
}

export function analyzeOshi(characters: OshiAnalysisCharacter[]): OshiAnalysisResult {
  const count = characters.length;
  if (count === 0) {
    return {
      typeName: "분석 불가",
      summary: "캐릭터를 선택해주세요.",
      hexStats: AXES.map((a) => ({ key: a.key, label: a.label, value: 0 })),
      signatureTags: [],
      confidence: 0,
      confidenceLabel: "분석 불가",
      selectedCount: 0,
      taggedCount: 0,
    };
  }

  // ── 캐릭터별 보유 항목 집합 준비 ──────────────────────────────
  const charTagSets = characters.map((c) => new Set(c.tags ?? []));
  const charMemeSets = characters.map((c) => new Set(c.meme_tags ?? []));
  const charPosSets = characters.map((c) => new Set(c.positions ?? []));

  const hasMember = (idx: number, m: AxisMember): boolean => {
    if (m.kind === "pos") return charPosSets[idx].has(m.name);
    return charTagSets[idx].has(m.name) || charMemeSets[idx].has(m.name);
  };

  // ── 6축 스탯 (lift 기반, 50 = 평균) ───────────────────────────
  const hexStats: HexStat[] = AXES.map((axis) => {
    let observedHits = 0;
    for (let i = 0; i < count; i++) {
      for (const m of axis.members) {
        if (hasMember(i, m)) observedHits += 1;
      }
    }
    const observedPerChar = observedHits / count;
    const expectedPerChar = axis.members.reduce((sum, m) => sum + baselineOf(m), 0);
    const lift = expectedPerChar > 0 ? observedPerChar / expectedPerChar : 0;
    const value = Math.round(Math.min(100, Math.max(6, lift * 50)));
    return { key: axis.key, label: axis.label, value };
  });

  // ── 시그니처 태그 (개별 태그 lift) ───────────────────────────
  const tagCount = new Map<string, number>();
  for (const c of characters) {
    for (const tag of [...(c.tags ?? []), ...(c.meme_tags ?? [])]) {
      tagCount.set(tag, (tagCount.get(tag) ?? 0) + 1);
    }
  }

  const signatureTags: SignatureTag[] = [...tagCount.entries()]
    .map(([tag, cnt]) => {
      const observed = cnt / count;
      const lift = observed / tagBaseline(tag);
      return { tag, multiplier: Math.round(lift * 10) / 10, support: cnt };
    })
    .filter((s) => s.support >= 2 && s.multiplier >= 1.3)
    .sort((a, b) => b.multiplier - a.multiplier)
    .slice(0, 4)
    .map(({ tag, multiplier }) => ({ tag, multiplier }));

  // ── 신뢰도 ────────────────────────────────────────────────────
  const taggedCount = characters.filter(
    (c) => (c.tags?.length ?? 0) > 0 || (c.meme_tags?.length ?? 0) > 0
  ).length;
  const base = count / 10;
  const tagCoverage = taggedCount / count;
  const confidence = Math.round((base * 0.4 + tagCoverage * 0.6) * 100);
  const confidenceLabel = confidenceLabelFromScore(confidence);

  // ── 유형명 / 한 줄 폭로 ──────────────────────────────────────
  const sortedAxes = [...hexStats].sort((a, b) => b.value - a.value);
  const dom = sortedAxes[0];
  const sub = sortedAxes[1];

  const baseTitle = AXIS_TITLE[dom.key] ?? "취향 분석가";
  const prefix = sub && sub.value >= 55 ? AXIS_PREFIX[sub.key] : "";
  const typeName = prefix ? `${prefix} ${baseTitle}` : baseTitle;
  const summary = AXIS_PUNCHLINE[dom.key] ?? "당신만의 취향이 분명히 드러납니다.";

  return {
    typeName,
    summary,
    hexStats,
    signatureTags,
    confidence,
    confidenceLabel,
    selectedCount: count,
    taggedCount,
  };
}
