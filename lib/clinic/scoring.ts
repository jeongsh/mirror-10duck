import type {
  AnimeCandidate,
  Axis,
  ClinicSharePayload,
  Diagnosis,
  Prescription,
  PrescriptionCategory,
  RetryAction,
} from "./types";
import { TAG_AXIS, TAG_COPY, EFFECT_COPY, DOSAGE_COPY, SIDE_COPY } from "./tagData";

export { LOADING_LINES } from "./tagData";

export function initialScores(): Record<Axis, number> {
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

export function addAxes(
  target: Record<Axis, number>,
  axes: Partial<Record<Axis, number>>,
  multiplier = 1,
) {
  Object.entries(axes).forEach(([axis, value]) => {
    target[axis as Axis] += (value ?? 0) * multiplier;
  });
}

function getTopAxes(scores: Record<Axis, number>) {
  return (Object.entries(scores) as Array<[Axis, number]>).sort((a, b) => b[1] - a[1]).slice(0, 3);
}

export function getDiagnosis(scores: Record<Axis, number>, allergies: string[]): Diagnosis {
  const [top, second] = getTopAxes(scores);
  const axis = top?.[0] ?? "heal";

  if (allergies.length >= 4) {
    return {
      name: "입덕 초기 안전처방형",
      summary: "좋아하는 것보다 싫은 것을 피해야 만족도가 올라갑니다.",
      opinion:
        "알레르기 검사에서 여러 지뢰 성분이 확인되었습니다. 현재는 강한 약효보다 추천 실패를 줄이는 처방이 먼저입니다.",
    };
  }

  if (axis === "character" && (second?.[0] === "relationship" || second?.[0] === "after")) {
    return {
      name: "처연캐 재발성 감염",
      summary: "혼자 버티는 캐릭터에게 반복적으로 반응합니다.",
      opinion:
        "웃고 있지만 속은 이미 너덜너덜한 인물, 또는 혼자 다 짊어지는 강자에게 먼저 감기는 경향이 있습니다. 이번 처방에도 위험 인물이 포함될 수 있습니다.",
    };
  }

  if (axis === "battle" && (scores.relationship ?? 0) > 80) {
    return {
      name: "라이벌 인정중독",
      summary: "싸우다가 인정하는 순간에 심박이 상승합니다.",
      opinion:
        "OST와 각성 연출뿐 아니라, 라이벌 인정과 팀 성장 카타르시스에도 강하게 반응합니다.",
    };
  }

  const map: Record<Axis, Diagnosis> = {
    heal: {
      name: "현실도피성 개그 결핍",
      summary: "뇌를 잠시 퇴근시킬 처방이 필요합니다.",
      opinion:
        "복잡한 세계관이나 무거운 서사보다 즉각적인 웃음과 캐릭터 케미가 필요한 상태입니다.",
    },
    light: {
      name: "저자극 회복 필요형",
      summary: "큰 사건 없이 웃는 애들이 필요한 상태입니다.",
      opinion:
        "현재는 감정선을 깊게 찌르는 작품보다 부담 없이 회복되는 작품이 더 적합합니다.",
    },
    after: {
      name: "후유증 결핍 증후군",
      summary: "가볍게 보려다 며칠 생각나는 작품이 필요한 상태입니다.",
      opinion:
        "무난한 작품만 복용해 감정선 반응이 둔해진 상태입니다. 지금은 보고 나서 잠깐 멍해지는 작품이 필요합니다.",
    },
    battle: {
      name: "배틀뽕 금단증상",
      summary: "가슴이 웅장해지는 장면 섭취량이 부족합니다.",
      opinion: "OST, 각성, 작화 폭발, 동료의 외침에 대한 반응성이 높게 나타납니다.",
    },
    character: {
      name: "최애 의존성 과몰입",
      summary: "추천작보다 위험 인물을 먼저 찾는 상태입니다.",
      opinion:
        "작품 전체를 보기 전에 캐릭터 한 명에게 먼저 감기는 경향이 있습니다. 이번 처방에도 위험 인물이 포함되어 있을 수 있습니다.",
    },
    relationship: {
      name: "관계성 중독 의심",
      summary: "서로를 구원하는 관계에 반복적으로 무너집니다.",
      opinion:
        "개별 장르보다 인물 사이의 변화, 인정, 구원에 더 빠르게 반응하는 상태입니다.",
    },
    world: {
      name: "세계관 분석 과다증",
      summary: "작품을 보는 게 아니라 설정집을 뜯어먹는 중입니다.",
      opinion: "캐릭터보다 조직도, 설정, 권력 구조가 먼저 눈에 들어오는 상태입니다.",
    },
    mystery: {
      name: "떡밥 추적 과각성",
      summary: "엔딩 후에도 혼자 해석을 계속합니다.",
      opinion:
        "대사 하나를 그냥 넘기지 못하고, 작품이 끝난 뒤에도 뇌가 자체적으로 2차 진료를 시작합니다.",
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
      (allergy === "설명만 많은 세계관" &&
        candidate.tags.some((tag) => ["SF", "정치극", "판타지"].includes(tag))) ||
      (allergy === "너무 잔인한 장면" &&
        candidate.tags.some((tag) => ["잔인함", "디스토피아"].includes(tag)));

    if (hit) {
      penalty += strict ? 80 : 34;
      warnings.push(allergy);
    }
  });

  return { penalty, warnings };
}

const PRESCRIPTION_SLOTS: Prescription["slot"][] = ["1차 처방", "2차 처방", "3차 처방"];

// 같은 계열(클러스터) 작품이 1·2·3차에 몰리지 않도록, 태그를 큰 묶음으로 분류한다.
const TAG_CLUSTER: Record<string, string> = {
  로맨스: "romance",
  학원: "romance",
  캐릭터성: "character",
  아이돌: "character",
  사제관계: "relationship",
  유사가족: "relationship",
  구원서사: "relationship",
  라이벌: "relationship",
  스포츠: "battle",
  액션: "battle",
  이능력: "battle",
  판타지: "world",
  정치극: "world",
  디스토피아: "world",
  SF: "world",
  추리: "mystery",
  미스터리: "mystery",
  후유증: "after",
  감정선: "after",
  일상: "healing",
  코미디: "healing",
  음악: "healing",
  성장: "growth",
  잔인함: "world",
};

function getClusters(candidate: AnimeCandidate): Set<string> {
  const set = new Set<string>();
  for (const tag of candidate.tags) {
    const cluster = TAG_CLUSTER[tag];
    if (cluster) set.add(cluster);
  }
  return set;
}

type RankedCandidate = {
  candidate: AnimeCandidate;
  score: number;
  warnings: string[];
  matchedTags: string[];
};

// 점수 가중 랜덤 추출. 점수가 높을수록 뽑힐 확률이 높지만, 매번 1등만 나오지 않고
// 상위권 안에서 회전한다. (weight는 양수로 보정)
function weightedSample(pool: Array<{ item: RankedCandidate; weight: number }>): number {
  const total = pool.reduce((sum, p) => sum + p.weight, 0);
  if (total <= 0) return 0;
  let r = Math.random() * total;
  for (let i = 0; i < pool.length; i += 1) {
    r -= pool[i].weight;
    if (r <= 0) return i;
  }
  return pool.length - 1;
}

// "몇 개만 돌아가며 나오는" 문제 해결: 상위 점수만 자르지 않고,
// 점수 상위권(shortlist)에서 점수 가중 랜덤으로 3개를 뽑는다.
// 이미 뽑힌 작품과 같은 계열(클러스터)이면 가중치를 크게 낮춰 다양성도 확보한다.
function pickDiversePrescriptions(ranked: RankedCandidate[], count = 3): RankedCandidate[] {
  if (ranked.length <= count) return ranked.slice(0, count);

  // 관련성 있는 상위권만 후보로 둔다(최소 12개, 최대 전체의 절반). 너무 동떨어진 작품은 제외.
  const shortlistSize = Math.min(ranked.length, Math.max(12, Math.ceil(ranked.length * 0.5)));
  const shortlist = ranked.slice(0, shortlistSize);

  const baseScore = shortlist[shortlist.length - 1]?.score ?? 0;
  const picked: RankedCandidate[] = [];
  const usedClusters = new Map<string, number>();
  const pool = [...shortlist];

  while (picked.length < count && pool.length > 0) {
    const weighted = pool.map((item) => {
      // 점수를 양수 가중치로 변환(최하위 후보 기준 + 완만한 가산).
      let weight = item.score - baseScore + 60;
      if (weight < 1) weight = 1;

      // 이미 뽑힌 작품과 겹치는 클러스터마다 가중치를 60%씩 깎아 같은 계열 반복을 억제.
      let overlap = 0;
      for (const cluster of getClusters(item.candidate)) overlap += usedClusters.get(cluster) ?? 0;
      weight *= Math.pow(0.4, overlap);

      return { item, weight };
    });

    const idx = weightedSample(weighted);
    const [chosen] = pool.splice(idx, 1);
    picked.push(chosen);
    for (const cluster of getClusters(chosen.candidate)) {
      usedClusters.set(cluster, (usedClusters.get(cluster) ?? 0) + 1);
    }
  }

  // 처방 슬롯 순서는 점수 높은 순으로 다시 정렬해 1차가 가장 강한 매칭이 되도록.
  return picked.sort((a, b) => b.score - a.score);
}

export function buildPrescriptions(
  candidates: AnimeCandidate[],
  scores: Record<Axis, number>,
  allergies: string[],
  answers: Record<string, string>,
  retry?: RetryAction,
): Prescription[] {
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

  const ranked = candidates
    .map((candidate) => {
      let tagScore = 0;
      const matchedTags: string[] = [];

      candidate.tags.forEach((tag) => {
        const tagAxes = TAG_AXIS[tag] ?? {};
        const before = tagScore;
        Object.entries(tagAxes).forEach(([axis, weight]) => {
          tagScore += (adjustedScores[axis as Axis] ?? 0) * (weight ?? 0);
        });
        if (tagScore > before) matchedTags.push(tag);
      });

      // 태그(장르)가 많을수록 단순 합이 커져 다장르 작품이 무조건 상위를 독점하던 문제를
      // sqrt 정규화로 완화한다. 적합도가 높은 작품은 여전히 상위지만 "장르 개수빨"은 줄어든다.
      const weightedTagCount = matchedTags.length;
      let score = weightedTagCount > 0 ? tagScore / Math.sqrt(weightedTagCount) : 0;

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
    })
    .sort((a, b) => b.score - a.score);

  const selected = pickDiversePrescriptions(ranked, 3);

  return selected.map((item, index): Prescription => {
    const hasWarning = item.warnings.length > 0;
    const category: PrescriptionCategory =
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
      slot: PRESCRIPTION_SLOTS[index] ?? "3차 처방",
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

export function getAvoidText(allergies: string[]) {
  if (allergies.length === 0) {
    return "특별한 금지약은 확인되지 않았습니다. 다만 검색창에 캐릭터 이름을 입력하는 행동은 모든 처방에서 주의가 필요합니다.";
  }

  const primary = allergies.slice(0, 3).join(", ");
  return `${primary} 성분은 이번 처방에서 강하게 감량했습니다. 유명작이라도 지뢰 성분이 강하면 우선 제외합니다.`;
}

export function getBannedWarnings(allergies: string[]): Array<{ type: "금지약" | "주의약"; text: string }> {
  if (!allergies.length) return [];
  return allergies.slice(0, 4).map((item) => ({
    type: allergies.length >= 4 ? "금지약" : "주의약",
    text: `${item} 성분 — 이번 처방 후보에서 우선 감량했습니다.`,
  }));
}

export function getImmersionScore(scores: Record<Axis, number>, allergies: string[]) {
  const total = Object.values(scores).reduce((sum, value) => sum + Math.max(0, value), 0);
  // 문진+과목 합계(~130~320)를 38~88 구간으로 매핑. 예전 Math.max(42, total/6)는 대부분 42로 고정되는 문제가 있었다.
  const normalized = Math.round(((total - 100) / 220) * 50 + 38);
  const allergyBoost = allergies.length * 2;
  return Math.min(98, Math.max(32, normalized + allergyBoost));
}

export function isDepartmentId(value: string | undefined): value is ClinicSharePayload["departmentId"] {
  return value === "heal" || value === "after" || value === "battle" || value === "oshi" || value === "safe";
}

export function isRetryAction(value: string | undefined): value is RetryAction {
  return value === "lighter" || value === "stronger" || value === "oshi" || value === "safe";
}

export function encodeClinicPayload(payload: ClinicSharePayload) {
  const json = JSON.stringify(payload);
  return btoa(encodeURIComponent(json))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function decodeClinicPayload(value: string): ClinicSharePayload | null {
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const parsed = JSON.parse(decodeURIComponent(atob(padded))) as Partial<
      ClinicSharePayload & { liked?: string | string[]; disliked?: string | string[] }
    >;

    if (!isDepartmentId(parsed.departmentId)) return null;

    const toList = (v: string | string[] | undefined) => {
      if (Array.isArray(v)) return v.filter((x) => typeof x === "string");
      if (typeof v === "string" && v.trim()) {
        return v.split(/[,，]/).map((s) => s.trim()).filter(Boolean).slice(0, 3);
      }
      return [];
    };

    return {
      departmentId: parsed.departmentId,
      answers: parsed.answers && typeof parsed.answers === "object" ? parsed.answers : {},
      allergies: Array.isArray(parsed.allergies)
        ? parsed.allergies.filter((item): item is string => typeof item === "string")
        : [],
      liked: toList(parsed.liked),
      disliked: toList(parsed.disliked),
      retry: isRetryAction(parsed.retry) ? parsed.retry : undefined,
    };
  } catch {
    return null;
  }
}

export function applyLikedDislikedToScores(
  scores: Record<Axis, number>,
  candidates: AnimeCandidate[],
  liked: string[],
  disliked: string[],
) {
  const next = { ...scores };
  const likedText = liked.join(" ").toLowerCase();
  const dislikedText = disliked.join(" ").toLowerCase();

  candidates.forEach((candidate) => {
    const title = candidate.title.toLowerCase();
    if (liked.some((t) => title.includes(t.toLowerCase()) || t.toLowerCase().includes(title))) {
      candidate.tags.forEach((tag) => addAxes(next, TAG_AXIS[tag] ?? {}, 0.35));
    }
    if (disliked.some((t) => title.includes(t.toLowerCase()) || t.toLowerCase().includes(title))) {
      candidate.tags.forEach((tag) => addAxes(next, TAG_AXIS[tag] ?? {}, -0.18));
    }
  });

  if (likedText) {
    candidates.forEach((candidate) => {
      if (likedText.includes(candidate.title.toLowerCase())) {
        candidate.tags.forEach((tag) => addAxes(next, TAG_AXIS[tag] ?? {}, 0.35));
      }
    });
  }
  if (dislikedText) {
    candidates.forEach((candidate) => {
      if (dislikedText.includes(candidate.title.toLowerCase())) {
        candidate.tags.forEach((tag) => addAxes(next, TAG_AXIS[tag] ?? {}, -0.18));
      }
    });
  }

  return next;
}
