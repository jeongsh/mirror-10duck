# 10duck 온보딩 가이드

친구가 합류해서 바로 개발을 시작할 수 있도록, 이 프로젝트에서 **꼭 확인해야 할 것**만 정리한 문서입니다.

## 1. 프로젝트 소개

- 프로젝트명: `ssibduk` (서브컬처 커뮤니티 + Live2D 캐릭터 인터랙션)
- 스택: Next.js(App Router), TypeScript, Tailwind, Zustand, PixiJS, Live2D
- 현재 상태: MVP 검증 단계 (캐릭터 렌더링/라이브러리/업로드 중심)

## 2. 반드시 먼저 읽을 문서

1. `docs/plan.md`
- 제품 목표, 문서 참조 지도, 현재 진행 범위를 확인

2. `docs/plans/checklist.md`
- Phase별 완료/미완료 상태를 확인

3. `docs/ARCHITECTURE_OVERVIEW.md`
- 페이지/컴포넌트/스토어/업로드 파이프라인 역할 파악

4. `docs/LIVE2D_CHARACTER_GUIDE.md`
- Live2D/캐릭터 시스템이 실제로 어떤 흐름과 구조로 동작하는지 빠르게 파악

> 새 기능 작업 전 `docs/plan.md`의 참조 지도를 먼저 보고, 작업 영역에 맞는 `docs/plans/*.md`만 추가로 읽습니다. 작업 후 변경점이 생기면 체크리스트와 해당 도메인 문서를 같이 갱신하는 것을 기본 규칙으로 합니다.

## 3. 협업 시 꼭 지킬 것

- 캐릭터 관련 수정 시:
  - `types/character.ts` 타입 영향 먼저 확인
  - `store` 상태 변경 영향 확인
  - `docs/ARCHITECTURE_OVERVIEW.md` 업데이트 필요 여부 확인
- 문서 위치는 `docs/`를 기준으로 유지
- 의미 없는 대규모 포맷 변경은 피하고, 변경 이유가 분명한 커밋만 남기기

## 4. "퇴근" 자동화(문서 마감 + git)

### Cursor 사용 시
- 규칙 파일: `.cursor/rules/end-of-day-automation.mdc`
- `퇴근` 요청 시 다음을 수행하도록 설정됨:
  - `docs/plan.md` 일일 마감 로그 업데이트
  - `docs/plans/checklist.md` 진행 상태 업데이트
  - 관련 `docs/plans/*.md` 세부 기획 업데이트
  - `docs/ARCHITECTURE_OVERVIEW.md` 업데이트
  - `docs/DB_TABLES.md` 업데이트
  - 실제 변경된 문서만 커밋 + 푸시

### Antigravity 사용 시
- 워크플로: `.agent/workflows/퇴근.md`
- 룰: `.agents/rules/퇴근-자동화.md`
- `/퇴근` 실행 또는 `퇴근` 요청으로 동일한 마감 루틴 수행 가능

---

문의/인수인계는 우선 `docs/plan.md`의 참조 지도와 `docs/plans/checklist.md`의 현재 페이즈 기준으로 진행합니다.
