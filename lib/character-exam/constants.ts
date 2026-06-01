import type { QuestionType, ExamType, ExamStatus, ScoringType, TemplateStatus } from '@/types/character-exam';

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  official_fact: '공식 설정형',
  situation_reaction: '상황 반응 추론형',
  dialogue: '대사 선택형',
  charm_point: '매력 포인트형',
  chemistry: '관계성/케미형',
  school_life_meme: '학교생활 밈형',
};

export const SCORING_TYPE_LABELS: Record<ScoringType, string> = {
  answer_score: '정답 점수',
  interpretation_score: '해석 점수',
  tag_signal: '태그 신호',
};

export const EXAM_STATUS_LABELS: Record<ExamStatus, string> = {
  draft: '초안',
  review: '검수 요청',
  approved: '승인',
  scheduled: '예약 공개',
  published: '공개',
  stopped: '중지',
};

export const EXAM_TYPE_LABELS: Record<ExamType, string> = {
  character_single: '캐릭터 단일',
  work_unit: '작품 단위',
  genre: '장르 단위',
  recommendation: '추천형',
};

export const TEMPLATE_STATUS_LABELS: Record<TemplateStatus, string> = {
  active: '활성',
  inactive: '비활성',
};

export const SPOILER_LEVEL_LABELS: Record<number, string> = {
  0: '스포 없음',
  1: '경미한 스포',
  2: '주요 스포',
};

export const DEFAULT_QUESTION_MIX = {
  official_fact: 2,
  situation_reaction: 3,
  dialogue: 1,
  charm_point: 2,
  chemistry: 1,
  school_life_meme: 1,
};

export const DEFAULT_TAG_DICT: string[] = [
  '무심다정', '감정표현서툼', '은근보호', '직진형', '솔직함', '관계중심',
  '능글형', '회피형', '내면갈등', '방어적', '고립형', '상처보유',
  '책임감', '리더십', '희생형', '냉철함', '열정형', '유머형',
  '츤데레', '데레데레', '쿨뷰티', '활발형', '내성형', '의지박약',
  '강한의지', '복수심', '순수형', '어른스러움', '철없음', '현실주의',
  '이상주의', '고집형', '융통성', '눈치형', '눈치없음', '관심종자',
];

export const TEMPLATE_VARIABLES = [
  { key: '{character_name}', desc: '캐릭터 이름' },
  { key: '{work_title}', desc: '작품 제목' },
  { key: '{related_character_name}', desc: '관련 캐릭터 이름' },
  { key: '{genre}', desc: '장르' },
];

export const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E'];
