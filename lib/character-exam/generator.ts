import { supabase } from '@/lib/supabase/client';
import type {
  CharacterExamTemplate,
  ExamTemplateCondition,
  GeneratedQuestion,
  QuestionMix,
  QuestionOptionSnapshot,
} from '@/types/character-exam';
import { DEFAULT_QUESTION_MIX } from './constants';

export interface CharacterData {
  id: string;
  name: string;
  work_title: string;
  tags: string[];
  genres: string[];
  related_character_name?: string;
  has_signature_dialogue?: boolean;
  spoiler_level?: number;
}

type TemplateRow = CharacterExamTemplate & {
  options: Array<{
    id: string;
    label: string;
    body: string;
    is_correct: boolean;
    score: number;
    tag_payload: Array<{ tag: string; weight: number }>;
    sort_order: number;
  }>;
};

export async function generateExamQuestions(
  character: CharacterData,
  mix: QuestionMix = DEFAULT_QUESTION_MIX,
  maxQuestions = 10,
): Promise<GeneratedQuestion[]> {
  const { data, error } = await supabase
    .from('character_exam_templates')
    .select('*, options:character_exam_template_options(*)')
    .eq('status', 'active')
    .order('weight', { ascending: false });

  if (error || !data) return [];

  const templates = data as TemplateRow[];
  const eligible = templates.filter((t) => checkCondition(t.condition_json as ExamTemplateCondition, character));

  const questions: GeneratedQuestion[] = [];
  const typeKeys = Object.keys(mix) as Array<keyof QuestionMix>;

  for (const type of typeKeys) {
    const count = mix[type] ?? 0;
    const pool = eligible.filter((t) => t.question_type === type);
    const picked = pickRandom(pool, count);

    for (const template of picked) {
      const sorted = [...(template.options ?? [])].sort((a, b) => a.sort_order - b.sort_order);
      questions.push({
        template_id: template.id,
        character_id: character.id,
        question_body: replaceVars(template.body, character),
        scoring_type: template.scoring_type,
        is_interpretation: template.is_interpretation,
        question_type: template.question_type,
        options_snapshot: sorted.map((opt): QuestionOptionSnapshot => ({
          id: opt.id,
          label: opt.label,
          body: replaceVars(opt.body, character),
          is_correct: opt.is_correct,
          score: opt.score,
          tag_payload: opt.tag_payload ?? [],
        })),
      });
    }
  }

  return shuffle(questions).slice(0, maxQuestions);
}

function checkCondition(cond: ExamTemplateCondition | null | undefined, char: CharacterData): boolean {
  if (!cond) return true;

  if (cond.require_genres && cond.require_genres.length > 0) {
    if (!char.genres.some((g) => cond.require_genres!.includes(g))) return false;
  }
  if (cond.require_tag_min && cond.require_tag_min > 0) {
    if (char.tags.length < cond.require_tag_min) return false;
  }
  if (cond.require_related_characters) {
    if (!char.related_character_name) return false;
  }
  if (cond.require_signature_dialogue) {
    if (!char.has_signature_dialogue) return false;
  }
  if (cond.max_spoiler_level !== undefined) {
    if ((char.spoiler_level ?? 0) > cond.max_spoiler_level) return false;
  }
  return true;
}

function replaceVars(text: string, char: CharacterData): string {
  return text
    .replace(/\{character_name\}/g, char.name)
    .replace(/\{work_title\}/g, char.work_title)
    .replace(/\{related_character_name\}/g, char.related_character_name ?? '관련 캐릭터')
    .replace(/\{genre\}/g, char.genres[0] ?? '해당 장르');
}

function pickRandom<T>(arr: T[], count: number): T[] {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, Math.min(count, arr.length));
}

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}
