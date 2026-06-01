---
name: project-character-exam
description: 캐릭터 중간고사 빌더 Phase 1 구현 현황 - DB 스키마, 어드민 빌더, 유저 시험 플레이
metadata:
  type: project
---

캐릭터 중간고사 빌더 Phase 1을 구현했다. 기획서: `docs/plans/character-exam-builder.md`

**Why:** 2000개 이상 캐릭터 DB를 바이럴 콘텐츠로 활용하고 팬덤 태그 데이터를 수집하기 위함.

**How to apply:** 신규 기능 추가 시 아래 파일 구조를 따른다.

## 구현된 파일 목록

| 파일 | 역할 |
|------|------|
| `db/migrations/character-exam-system.sql` | DB 테이블 + RLS 정책 마이그레이션 |
| `types/character-exam.ts` | TypeScript 타입 전체 |
| `lib/character-exam/constants.ts` | 라벨, DEFAULT_TAG_DICT, 변수 목록 |
| `lib/character-exam/generator.ts` | 캐릭터 데이터 + 템플릿 → 문항 생성 |
| `lib/character-exam/scorer.ts` | 응답 → 점수/등급/태그프로필 계산 |
| `app/admin/character-exams/page.tsx` | 시험 상품 목록 |
| `app/admin/character-exams/create/page.tsx` | 시험 상품 생성 |
| `app/admin/character-exams/[id]/page.tsx` | 시험 상품 편집 |
| `app/admin/character-exams/templates/page.tsx` | 문항 템플릿 목록 |
| `app/admin/character-exams/templates/create/page.tsx` | 템플릿 생성 (선택지+태그 매핑) |
| `app/admin/character-exams/templates/[id]/page.tsx` | 템플릿 편집 |
| `app/admin/character-exams/results/page.tsx` | 결과지 템플릿 CRUD |
| `app/admin/character-exams/rules/page.tsx` | 출제 규칙 CRUD |
| `app/admin/character-exams/simulator/page.tsx` | 캐릭터 선택 → 문항 미리보기 |
| `app/play/character-exam/page.tsx` | 공개 시험 허브 |
| `app/play/character-exam/[productId]/page.tsx` | 시험 완전 플로우 (인트로→퀴즈→결과) |

## DB 테이블

- `character_exam_products` — 시험 상품
- `character_exam_templates` — 문항 템플릿 (변수: {character_name}, {work_title}, {related_character_name}, {genre})
- `character_exam_template_options` — 선택지 + tag_payload JSONB
- `character_exam_rules` — 출제 규칙 (조건 + 문항 비율)
- `character_exam_result_templates` — 결과지 (점수 구간, 생활기록부 문구)
- `character_exam_sessions` — 유저 시험 세션
- `character_exam_questions` — 세션 내 문항 스냅샷
- `character_exam_responses` — 유저 응답 + tag_payload
- `character_tag_signals` — 캐릭터 태그 신호 집계 소스
- `user_preference_signals` — 유저 취향 신호
- `character_tag_candidates` — 태그 후보 (pending→approved)

## 남은 작업 (Phase 2)

- 공유 이미지 생성 (성적표 컨셉)
- 추천 규칙 빌더 및 시험 종료 후 추천 섹션
- 팬덤 평균 비교
- Phase 3: 태그 후보 검수 UI (`/admin/character-tags/candidates`)
- Phase 4: AI 문항 초안 생성
