export type DepartmentId = "heal" | "after" | "battle" | "oshi" | "safe";
export type Step = "intro" | "department" | "questions" | "loading" | "result";
export type RetryAction = "lighter" | "stronger" | "oshi" | "safe";

export type Axis =
  | "heal"
  | "after"
  | "battle"
  | "character"
  | "relationship"
  | "world"
  | "mystery"
  | "light";

export type Question = {
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

export type AnimeCandidate = {
  title: string;
  tags: string[];
  length: "short" | "medium" | "long";
  complete: boolean;
  intro: "fast" | "slow" | "medium";
  riskTags: string[];
  reason: string;
  coverImageUrl?: string | null;
};

export type PrescriptionCategory = "즉효약" | "장기복용약" | "응급처방" | "고위험 고효능";

export type Prescription = {
  slot: "1차 처방" | "2차 처방" | "3차 처방";
  title: string;
  category: PrescriptionCategory;
  effect: string;
  dosage: string;
  sideEffect: string;
  matchedTags: string[];
  warning?: string;
};

export type Diagnosis = {
  name: string;
  summary: string;
  opinion: string;
};

export type ClinicSharePayload = {
  departmentId: DepartmentId;
  answers: Record<string, string>;
  allergies: string[];
  liked: string[];
  disliked: string[];
  retry?: RetryAction;
  prescriptions?: Prescription[];
};

export type ClinicCopyResult = {
  opinion: string;
  shareSummary: string;
  prescriptions: Array<{
    title: string;
    effect: string;
    dosage: string;
    sideEffect: string;
  }>;
  warnings: Array<{ type: "금지약" | "주의약"; text: string }>;
};

export type DepartmentInfo = {
  id: DepartmentId;
  name: string;
  button: string;
  summary: string;
  direction: string;
  expected: string;
  axes: Partial<Record<Axis, number>>;
};
