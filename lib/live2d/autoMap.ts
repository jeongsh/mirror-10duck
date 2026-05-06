import type {
  CharacterActionKey,
  CharacterEmotion,
  MorphSlider,
  MotionRef,
  OutfitGroup,
  ParameterPreset,
} from "@/types/character";
import type { ModelPackageAnalysis } from "./modelPackage";

/**
 * 업로드된 모델을 분석한 결과로부터 "우리 서비스의 감정/액션 추상 키" 로의 매핑을
 * 베스트 에포트로 추정한다.
 *
 * 실패 시 null / 빈 값을 반환해 UI 에서 수동 매핑을 유도.
 *
 * 휴리스틱:
 *   - exp_XX, face_XX 등 이름에 수치가 있으면 인덱스 순으로 happy, sad, ...
 *   - 모션 그룹 "Idle" → action.idle
 *   - 그 외 첫 번째 그룹의 0/1/2/3 → tap_head, attention, tap_other, greet
 *   - hitArea 에 "Head" 키워드가 있으면 tap_head, Body/Chest/Torso 계열은 attention 으로 안전 매핑
 */
const EMOTION_ORDER: CharacterEmotion[] = [
  "idle",
  "happy",
  "sad",
  "angry",
  "surprised",
  "shy",
  "love",
  "wink",
];

export function guessExpressionMap(
  analysis: ModelPackageAnalysis
): Partial<Record<CharacterEmotion, string | null>> {
  const out: Partial<Record<CharacterEmotion, string | null>> = {};

  // 1) 이름 기반 키워드 매칭
  const byKeyword: Record<CharacterEmotion, RegExp> = {
    idle: /(idle|normal|default|neutral|\bexp_?0?1\b)/i,
    happy: /(happy|joy|smile|laugh|glad)/i,
    sad: /(sad|cry|tear|depress|down)/i,
    angry: /(angry|mad|rage|anger|annoyed)/i,
    surprised: /(surprise|shock|startle|gasp|wow)/i,
    shy: /(shy|blush|embarrass|timid)/i,
    love: /(love|heart|infatuate|crush)/i,
    wink: /(wink)/i,
  };

  for (const emo of EMOTION_ORDER) {
    const re = byKeyword[emo];
    const hit = analysis.expressions.find((e) => re.test(e.name));
    if (hit) out[emo] = hit.name;
  }

  // 2) 여전히 매칭 안 된 감정은 남은 exp 를 순서대로 할당
  const assigned = new Set(Object.values(out).filter(Boolean) as string[]);
  const remaining = analysis.expressions.map((e) => e.name).filter((n) => !assigned.has(n));
  for (const emo of EMOTION_ORDER) {
    if (out[emo]) continue;
    const next = remaining.shift();
    out[emo] = next ?? null;
  }

  return out;
}

export function guessMotionMap(
  analysis: ModelPackageAnalysis
): Partial<Record<CharacterActionKey, MotionRef | null>> {
  const out: Partial<Record<CharacterActionKey, MotionRef | null>> = {};
  const groups = new Map<string, number>(); // group → count
  for (const m of analysis.motions) {
    groups.set(m.group, (groups.get(m.group) ?? 0) + 1);
  }

  // Idle 그룹 → action.idle
  const idleGroup = [...groups.keys()].find((g) => /^idle$/i.test(g));
  if (idleGroup) out.idle = { group: idleGroup, index: 0 };

  // Tap* 이름이 있는 그룹
  const tapHeadGroup = [...groups.keys()].find((g) => /taphead|head/i.test(g));
  if (tapHeadGroup) out.tap_head = { group: tapHeadGroup, index: 0 };
  const tapBodyGroup = [...groups.keys()].find((g) => /tapbody|body/i.test(g));
  if (tapBodyGroup) out.attention = { group: tapBodyGroup, index: 0 };

  // 메인(큰) 그룹에서 인덱스로 채우기
  const [mainGroup] =
    [...groups.entries()].sort((a, b) => b[1] - a[1])[0] ?? [undefined];
  if (mainGroup !== undefined) {
    const fill = (
      key: CharacterActionKey,
      idx: number
    ) => {
      if (out[key]) return;
      const size = groups.get(mainGroup)!;
      if (idx < size) out[key] = { group: mainGroup, index: idx };
    };
    fill("tap_head", 0);
    fill("attention", 1);
    fill("tap_other", 2);
    fill("greet", 3);
    fill("typing", 4);
    fill("celebrate", 5);
    fill("special", 5);
  }
  return out;
}

export function guessHitAreaMap(analysis: ModelPackageAnalysis) {
  const result: { hitAreaId: string; action: CharacterActionKey }[] = [];
  for (const h of analysis.hitAreas) {
    if (/head/i.test(h.id) || /head/i.test(h.name)) {
      result.push({ hitAreaId: h.id, action: "tap_head" });
    } else if (/body|chest|torso/i.test(h.id) || /body|chest|torso/i.test(h.name)) {
      result.push({ hitAreaId: h.id, action: "attention" });
    } else {
      result.push({ hitAreaId: h.id, action: "tap_other" });
    }
  }
  return result;
}

/**
 * pose3.json 에서 발견한 파츠 그룹을 OutfitGroup 으로 변환.
 * 각 그룹 안의 파츠들은 "옵션" 이 된다 (radio-style 토글).
 */
export function guessOutfits(analysis: ModelPackageAnalysis): OutfitGroup[] {
  const byGroup = new Map<number, string[]>();
  for (const p of analysis.poseParts) {
    const arr = byGroup.get(p.groupIndex) ?? [];
    arr.push(p.id);
    byGroup.set(p.groupIndex, arr);
  }
  const groups: OutfitGroup[] = [];
  let i = 0;
  for (const [, ids] of byGroup) {
    if (ids.length < 2) continue; // 선택지가 하나면 의미 없음
    const parts = ids.map((id, idx) => ({
      id: `${id}-only`,
      label: `Option ${idx + 1} (${id})`,
      partIds: [id],
    }));
    groups.push({
      id: `group-${i}`,
      name: `파츠 그룹 ${i + 1}`,
      defaultPartId: parts[0]?.id,
      parts,
    });
    i++;
  }
  return groups;
}

/**
 * 흔히 조작할 만한 파라미터를 몇 개 뽑아서 슬라이더 리스트를 구성.
 * cdi3.json 이 없으면 빈 배열. UI 에서 수동 추가 가능하게.
 */
const COMMON_PARAM_HINTS: { test: RegExp; label: string; min: number; max: number }[] = [
  { test: /cheek|blush/i, label: "볼 홍조", min: 0, max: 1 },
  { test: /mouthform/i, label: "입꼬리", min: -1, max: 1 },
  { test: /mouthopeny/i, label: "입 벌림", min: 0, max: 1 },
  { test: /eyeleffect|eyeeffect/i, label: "눈 반짝임", min: 0, max: 1 },
  { test: /eyelsmile/i, label: "왼쪽 눈 웃음", min: 0, max: 1 },
  { test: /eyersmile/i, label: "오른쪽 눈 웃음", min: 0, max: 1 },
  { test: /browly/i, label: "왼쪽 눈썹 상하", min: -1, max: 1 },
  { test: /browry/i, label: "오른쪽 눈썹 상하", min: -1, max: 1 },
  { test: /busty|breast/i, label: "가슴 흔들림", min: -1, max: 1 },
  { test: /hairfront/i, label: "앞머리", min: -1, max: 1 },
  { test: /hairside/i, label: "옆머리", min: -1, max: 1 },
  { test: /hairback/i, label: "뒷머리", min: -1, max: 1 },
];

export function guessMorphSliders(analysis: ModelPackageAnalysis): MorphSlider[] {
  if (analysis.displayParams.length === 0) return [];
  const sliders: MorphSlider[] = [];
  const used = new Set<string>();
  for (const hint of COMMON_PARAM_HINTS) {
    const hit = analysis.displayParams.find((p) => hint.test.test(p.id));
    if (hit && !used.has(hit.id)) {
      used.add(hit.id);
      sliders.push({
        paramId: hit.id,
        label: hint.label,
        min: hint.min,
        max: hint.max,
        defaultValue: 0,
      });
    }
  }
  return sliders;
}

export function defaultPresets(sliders: MorphSlider[]): ParameterPreset[] {
  if (sliders.length === 0) return [];
  const byId = (id: string) => sliders.find((s) => s.paramId === id);
  const presets: ParameterPreset[] = [];
  if (byId("ParamCheek") || byId("ParamMouthForm")) {
    presets.push({
      id: "preset-tsundere",
      name: "츤데레",
      values: [
        ...(byId("ParamCheek") ? [{ paramId: "ParamCheek", value: 0.8 }] : []),
        ...(byId("ParamMouthForm") ? [{ paramId: "ParamMouthForm", value: -0.4 }] : []),
        ...(byId("ParamBrowLY") ? [{ paramId: "ParamBrowLY", value: -0.3 }] : []),
        ...(byId("ParamBrowRY") ? [{ paramId: "ParamBrowRY", value: -0.3 }] : []),
      ],
    });
  }
  if (byId("ParamEyeEffect")) {
    presets.push({
      id: "preset-kirakira",
      name: "키라키라",
      values: [
        { paramId: "ParamEyeEffect", value: 1 },
        ...(byId("ParamCheek") ? [{ paramId: "ParamCheek", value: 0.5 }] : []),
        ...(byId("ParamMouthForm") ? [{ paramId: "ParamMouthForm", value: 0.8 }] : []),
      ],
    });
  }
  presets.push({
    id: "preset-reset",
    name: "리셋",
    values: sliders.map((s) => ({ paramId: s.paramId, value: s.defaultValue })),
  });
  return presets;
}
