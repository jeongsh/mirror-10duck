import type { ClinicCopyResult, Diagnosis, Prescription } from "./types";
import { pickShareSummary } from "./tagData";
import { getAvoidText, getBannedWarnings } from "./scoring";

export function buildTemplateCopy(
  diagnosis: Diagnosis,
  prescriptions: Prescription[],
  allergies: string[],
  immersionScore: number,
): ClinicCopyResult {
  return {
    opinion: diagnosis.opinion,
    shareSummary: pickShareSummary(diagnosis.name, immersionScore),
    prescriptions: prescriptions.map((p) => ({
      title: p.title,
      effect: p.effect,
      dosage: p.dosage,
      sideEffect: p.sideEffect,
    })),
    warnings: [
      ...getBannedWarnings(allergies),
      {
        type: "주의약",
        text: getAvoidText(allergies),
      },
    ],
  };
}

export function mergeCopyIntoPrescriptions(
  prescriptions: Prescription[],
  copy: ClinicCopyResult | null,
): Prescription[] {
  if (!copy) return prescriptions;
  return prescriptions.map((p) => {
    const ai = copy.prescriptions.find((c) => c.title === p.title);
    if (!ai) return p;
    return {
      ...p,
      effect: ai.effect || p.effect,
      dosage: ai.dosage || p.dosage,
      sideEffect: ai.sideEffect || p.sideEffect,
    };
  });
}

type Warning = ClinicCopyResult["warnings"][number];

export function mergeWarnings(base: Warning[], extra: Warning[] = []): Warning[] {
  const seen = new Set(base.map((w) => w.text.trim()));
  const merged = [...base];
  for (const w of extra) {
    const text = w?.text?.trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    merged.push({ type: w.type === "금지약" ? "금지약" : "주의약", text });
  }
  return merged;
}

// AI는 진단 소견·공유 한 줄만 보강한다. 처방 상세·경고는 항상 템플릿(규칙 기반)을 유지한다.
export function enrichCopyWithAi(
  template: ClinicCopyResult,
  ai: ClinicCopyResult | null,
): ClinicCopyResult {
  if (!ai) return template;
  return {
    opinion: ai.opinion?.trim() ? ai.opinion : template.opinion,
    shareSummary: ai.shareSummary?.trim() ? ai.shareSummary : template.shareSummary,
    prescriptions: template.prescriptions,
    warnings: template.warnings,
  };
}
