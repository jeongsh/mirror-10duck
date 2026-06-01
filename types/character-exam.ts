export type ExamType = 'character_single' | 'work_unit' | 'genre' | 'recommendation';
export type ExamStatus = 'draft' | 'review' | 'approved' | 'scheduled' | 'published' | 'stopped';
export type QuestionType =
  | 'official_fact'
  | 'situation_reaction'
  | 'dialogue'
  | 'charm_point'
  | 'chemistry'
  | 'school_life_meme';
export type ScoringType = 'answer_score' | 'interpretation_score' | 'tag_signal';
export type TemplateStatus = 'active' | 'inactive';
export type TagCandidateStatus = 'pending' | 'approved' | 'rejected';

export interface TagSignalItem {
  tag: string;
  weight: number;
}

// ── 시험 상품 ────────────────────────────────────────────────
export interface CharacterExamProduct {
  id: string;
  title: string;
  description: string | null;
  exam_type: ExamType;
  question_count: number;
  time_limit_seconds: number | null;
  spoiler_level: number;
  result_template_id: string | null;
  status: ExamStatus;
  use_recommendation: boolean;
  created_by: string | null;
  updated_by: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

// ── 문항 템플릿 ───────────────────────────────────────────────
export interface CharacterExamTemplate {
  id: string;
  question_type: QuestionType;
  body: string;
  scoring_type: ScoringType;
  is_interpretation: boolean;
  spoiler_level: number;
  weight: number;
  condition_json: ExamTemplateCondition;
  status: TemplateStatus;
  created_at: string;
  updated_at: string;
  options?: CharacterExamTemplateOption[];
}

export interface ExamTemplateCondition {
  require_genres?: string[];
  require_tag_min?: number;
  require_related_characters?: boolean;
  require_signature_dialogue?: boolean;
  max_spoiler_level?: number;
}

export interface CharacterExamTemplateOption {
  id: string;
  template_id: string;
  label: string;
  body: string;
  is_correct: boolean;
  score: number;
  tag_payload: TagSignalItem[];
  sort_order: number;
  created_at: string;
}

// ── 출제 규칙 ────────────────────────────────────────────────
export interface CharacterExamRule {
  id: string;
  product_id: string | null;
  name: string;
  condition_json: ExamRuleCondition;
  question_mix_json: QuestionMix;
  priority: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface ExamRuleCondition {
  genres?: string[];
  tag_min_count?: number;
  has_related_characters?: boolean;
  max_spoiler_level?: number;
}

export interface QuestionMix {
  official_fact?: number;
  situation_reaction?: number;
  dialogue?: number;
  charm_point?: number;
  chemistry?: number;
  school_life_meme?: number;
}

// ── 결과지 템플릿 ──────────────────────────────────────────────
export interface CharacterExamResultTemplate {
  id: string;
  name: string;
  score_ranges: ScoreRange[];
  grade_labels: GradeLabel[];
  tag_combo_comments: TagComboComment[];
  created_at: string;
  updated_at: string;
}

export interface ScoreRange {
  min: number;
  max: number;
  grade: string;
  title: string;
  description: string;
  percentile_label: string;
}

export interface GradeLabel {
  grade: string;
  label: string;
}

export interface TagComboComment {
  tags: string[];
  comment: string;
}

// ── 세션 / 응답 ───────────────────────────────────────────────
export interface CharacterExamSession {
  id: string;
  user_id: string | null;
  product_id: string | null;
  character_id: string | null;
  work_id: string | null;
  started_at: string;
  completed_at: string | null;
  score: number | null;
  grade: string | null;
  percentile: number | null;
  result_snapshot: ExamResult | null;
}

export interface CharacterExamQuestion {
  id: string;
  session_id: string;
  template_id: string | null;
  character_id: string | null;
  question_body: string;
  options_snapshot: QuestionOptionSnapshot[];
  sort_order: number;
}

export interface QuestionOptionSnapshot {
  id: string;
  label: string;
  body: string;
  is_correct: boolean;
  score: number;
  tag_payload: TagSignalItem[];
}

export interface CharacterExamResponse {
  id: string;
  session_id: string;
  question_id: string;
  option_id: string | null;
  response_time_ms: number | null;
  score_delta: number;
  tag_payload: TagSignalItem[];
}

// ── 생성된 문항 (generator 반환값) ────────────────────────────
export interface GeneratedQuestion {
  template_id: string;
  character_id: string;
  question_body: string;
  scoring_type: ScoringType;
  is_interpretation: boolean;
  question_type: QuestionType;
  options_snapshot: QuestionOptionSnapshot[];
}

// ── 결과 ─────────────────────────────────────────────────────
export interface ExamResult {
  score: number;
  max_score: number;
  grade: string;
  percentile: number;
  official_score: number;
  interpretation_score: number;
  tag_profile: Record<string, number>;
  top_tags: string[];
  grade_title: string;
  grade_description: string;
  percentile_label: string;
  school_record_comment: string;
  share_copy: string;
}

// ── 태그 신호 / 후보 ───────────────────────────────────────────
export interface CharacterTagSignal {
  id: string;
  character_id: string;
  tag: string;
  source: string;
  weight: number;
  session_id: string | null;
  response_id: string | null;
  created_at: string;
}

export interface CharacterTagCandidate {
  id: string;
  character_id: string;
  tag: string;
  signal_count: number;
  signal_ratio: number | null;
  status: TagCandidateStatus;
  created_at: string;
  updated_at: string;
}
