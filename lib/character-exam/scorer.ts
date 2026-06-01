import type {
  CharacterExamResultTemplate,
  ExamResult,
  QuestionOptionSnapshot,
  ScoringType,
  TagSignalItem,
} from '@/types/character-exam';

interface ScorerResponseItem {
  scoring_type: ScoringType;
  selected_option: QuestionOptionSnapshot;
}

export function calculateResult(
  responses: ScorerResponseItem[],
  resultTemplate: CharacterExamResultTemplate,
): ExamResult {
  let official_score = 0;
  let max_official_score = 0;
  const tagWeights: Record<string, number> = {};

  for (const r of responses) {
    if (r.scoring_type === 'answer_score') {
      official_score += r.selected_option.score;
      max_official_score += 10;
    }

    for (const { tag, weight } of (r.selected_option.tag_payload as TagSignalItem[]) ?? []) {
      tagWeights[tag] = (tagWeights[tag] ?? 0) + weight;
    }
  }

  const score =
    max_official_score > 0 ? Math.round((official_score / max_official_score) * 100) : 50;

  const range =
    resultTemplate.score_ranges.find((r) => score >= r.min && score <= r.max) ??
    resultTemplate.score_ranges[resultTemplate.score_ranges.length - 1];

  const topTags = Object.entries(tagWeights)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([tag]) => tag);

  let school_record_comment = '이 캐릭터에 대한 당신만의 해석이 있습니다.';
  if (resultTemplate.tag_combo_comments) {
    for (const combo of resultTemplate.tag_combo_comments) {
      if (combo.tags.length > 0 && combo.tags.every((t) => topTags.includes(t))) {
        school_record_comment = combo.comment;
        break;
      }
    }
  }

  return {
    score,
    max_score: 100,
    grade: range.grade,
    percentile: parsePercentile(range.percentile_label),
    official_score,
    interpretation_score: 0,
    tag_profile: tagWeights,
    top_tags: topTags,
    grade_title: range.title,
    grade_description: range.description,
    percentile_label: range.percentile_label,
    school_record_comment,
    share_copy: `${range.title} — ${score}점`,
  };
}

function parsePercentile(label: string): number {
  const match = label.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 100;
}
