# 오타쿠 커뮤니티 플랫폼 '씹덕' 프로젝트 플랜

이 문서는 전체 방향을 빠르게 잡기 위한 허브다. 세부 기획은 도메인별 문서로 분리되어 있으니, 작업할 영역에 맞는 파일만 추가로 읽는다. AI에게 작업을 맡길 때도 `docs/plan.md` 전체만 반복해서 확장하지 말고, 아래 참조 지도를 따라 필요한 세부 문서를 열게 한다.

## 0. 문서 운영 원칙

- 플랜을 "MVP라서 간단히" 축소하지 않는다. 현재 구현 단계가 작더라도 최종 제품 맥락, 사용자 경험, 데이터 모델, 운영 정책, 예외 케이스를 함께 적는다.
- `docs/plan.md`는 짧은 인덱스 역할을 유지한다. 긴 설명은 `docs/plans/*.md`에 둔다.
- 새 기능을 한 줄 체크리스트로만 추가하지 않는다. 목적, 사용자 흐름, 화면 구성, 데이터/권한 영향, 완료 기준을 해당 도메인 문서에 함께 적는다.
- 기존 상세 내용을 요약 삭제하지 않는다. 정리가 필요하면 도메인 문서로 이동하고, 이 허브에는 링크만 남긴다.
- 커뮤니티 기본 기능을 누락하지 않는다. 게시판, 댓글, 대댓글, 추천/비추천, 개념글, 검색, 신고/차단, 알림, 프로필, 익명/닉네임 정책, 운영자 도구, 미디어 첨부는 핵심 범위로 본다.
- 코드 구현 현황과 플랜이 어긋나면 "현재 상태"와 "목표 상태"를 함께 기록한다. 이미 임시 구현된 기능은 "완료"로 뭉개지 말고, 제품 기준 대비 남은 일을 적는다.

## 1. 작업별 참조 지도

| 작업 영역 | 먼저 읽을 문서 | 함께 보면 좋은 문서 |
|-----------|----------------|---------------------|
| 전체 진행 현황, 완료/미완료 체크 | [checklist.md](./plans/checklist.md) | 관련 도메인 문서 |
| 게시판, 글 목록, 글 상세, 댓글, 대댓글, 추천, 개념글, 피드, 검색 | [community.md](./plans/community.md) | [data-model.md](./plans/data-model.md), [screen-acceptance.md](./plans/screen-acceptance.md) |
| 글쓰기, 본문 에디터, 이미지/영상 업로드, 스티커 삽입 | [editor-media-stickers.md](./plans/editor-media-stickers.md) | [data-model.md](./plans/data-model.md), [character-community.md](./plans/character-community.md) |
| DB 마이그레이션, Supabase 테이블, RLS, 집계 컬럼 | [data-model.md](./plans/data-model.md) | [DB_TABLES.md](./DB_TABLES.md), [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) |
| 신고, 차단, 운영자 도구, 알림, 레이트 리밋 | [moderation-notifications.md](./plans/moderation-notifications.md) | [data-model.md](./plans/data-model.md), [community.md](./plans/community.md) |
| 애니/만화/게임 작품 DB, 소개, 리뷰, 프리뷰, 평가, 뉴스 | [works-media.md](./plans/works-media.md) | [community.md](./plans/community.md), [data-model.md](./plans/data-model.md), [screen-acceptance.md](./plans/screen-acceptance.md) |
| Live2D, 캐릭터 리액션, 스티커 팩, 대표 캐릭터, 덕질 비서, 후순위 롤플레잉 | [character-community.md](./plans/character-community.md) | [LIVE2D_CHARACTER_GUIDE.md](./LIVE2D_CHARACTER_GUIDE.md), [ARCHITECTURE_OVERVIEW.md](./ARCHITECTURE_OVERVIEW.md) |
| 화면 완성도, 페이지별 완료 기준, UX 누락 점검 | [screen-acceptance.md](./plans/screen-acceptance.md) | 관련 도메인 문서 |

## 2. 프로젝트 개요

- **프로젝트 명:** 씹덕 (가칭)
- **제품 정체성:** 애니/만화/게임 작품을 소개, 프리뷰, 리뷰, 평가, 뉴스, 커뮤니티 글로 연결하는 서브컬처 작품 허브.
- **핵심 가치:** 사용자가 "무엇을 볼지/읽을지/플레이할지" 빠르게 결정할 수 있도록 작품 정보, 편집 콘텐츠, 유저 평가, 게시판 반응을 한 화면에 모은다.
- **Live2D의 역할:** 제품의 중심 기능이 아니라 커뮤니티 감정 표현, 리뷰/프리뷰 진행 보조, 알림/리액션 연출, 작품 큐레이션을 맡는 차별화 요소로 둔다. 일반 사용자에게 캐릭터 제작 부담을 전가하지 않고, 자유 챗봇보다 목적형 덕질 비서 경험을 우선한다.
- **최종 목표:** 애니/만화/게임 작품별 허브와 시즌/출시 프리뷰를 기반으로 검색 유입을 만들고, 리뷰/평가/뉴스/커뮤니티 활동을 통해 장기 체류와 수익화를 구축한다.
- **플랫폼 전략:** 웹 Next.js 버전에서 작품 탐색, 검색, 리뷰, 평가, 커뮤니티를 먼저 안정화하고, 알림/기록/추천이 검증된 뒤 모바일 앱으로 확장한다.

## 3. MVP 기준

이 프로젝트의 MVP는 "게시판에 글 몇 개 쓰는 데모"가 아니다. 최소한 커뮤니티로 느껴지는 기본 루프가 있어야 한다.

- 사용자는 애니/만화/게임 작품을 탐색하고, 작품 소개/프리뷰/리뷰/평가/뉴스 타임라인을 볼 수 있다.
- 작품 페이지에는 관련 게시글, 댓글 반응, 유저 평가, 추천 태그가 함께 보여야 한다.
- 사용자는 게시판을 탐색하고, 글을 쓰고, 댓글을 달고, 추천/리액션을 남길 수 있다.
- 글 목록에는 작성자 신원, 조회/댓글/추천 지표, 개념글 여부, 게시판 맥락이 보여야 한다.
- 사용자는 닉네임/프로필/캐릭터를 통해 자신을 구분할 수 있다.
- 운영자는 신고, 삭제, 숨김, 제재를 수행할 수 있어야 한다.
- 캐릭터는 우측 하단 장식에 머물지 않고 스티커, 리액션, 알림, 프로필과 연결되어야 한다.

## 4. 기술 스택과 현재 구조

- **Framework:** Next.js App Router
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **State Management:** Zustand
- **Database/Auth:** Supabase PostgreSQL, Supabase Auth
- **Live2D:** PixiJS, `pixi-live2d-display`
- **주요 페이지:** `/board`, `/board/[slug]`, `/board/[slug]/write`, `/board/[slug]/[id]`, `/feed`, `/feed/write`, `/profile`, `/library/[id]`
- **예정 주요 페이지:** `/works`, `/works/[slug]`, `/works/season`, `/works/releases`, `/reviews`, `/news`
- **현재 주요 테이블:** `boards`, `posts`, `follows_user`, `follows_board`, `characters`, `post_reactions`, `comments`
- **예정 주요 테이블:** `works`, `work_titles`, `work_reviews`, `work_ratings`, `work_news`, `work_releases`, `work_relations`

## 5. 단계별 마일스톤 요약

- **Phase 1. 프로젝트 기반 구축:** Next.js, TypeScript, Tailwind, Zustand, Supabase, 전역 Live2D 컨테이너, 기본 캐릭터 라이브러리 구축 완료.
- **Phase 2. 커뮤니티 기본 루프:** 게시판, 글, 댓글, 감정 리액션, 팔로우 피드, 크로스포스트는 1차 구현됨. 남은 핵심은 신원 뱃지, 추천/비추천, 조회/댓글 집계, 검색, 대댓글, 신고/운영, 알림, 에디터 미디어 업로드다.
- **Phase 3. 애니/만화/게임 작품 허브:** 작품 DB, 작품 페이지, 시즌 애니/신작 만화/게임 출시 프리뷰, 리뷰, 유저 평가, 뉴스 타임라인, 작품별 커뮤니티 연결.
- **Phase 4. 캐릭터 커뮤니티 고도화:** 스티커 관리, 대표 캐릭터 공개 프로필, 글/댓글 캐릭터 스냅샷, 커뮤니티 리액션 연출, 작품 알림/추천/리뷰 작성 보조. 캐릭터 제작/의상/표정 변경은 일반 사용자 핵심 루프가 아니라 운영자/크리에이터용 확장으로 둔다. 롤플레잉 채팅은 동료 니즈를 반영해 후순위 확장으로 남기되, 초기 제품 정체성으로 삼지 않는다.
- **Phase 5. 수익화와 제휴:** 광고, OTT/전자책/게임 스토어/굿즈 제휴 링크, 스폰서드 프리뷰 명시, 프리미엄 추천/알림/기록, 커뮤니티 부스팅.
- **Phase 6. 모바일 앱과 확장:** React Native Expo 검토, 모바일 커뮤니티 UX, 작품 알림/기록/추천, 푸시 알림, 이미지/카메라 업로드, WebRTC R&D.

세부 체크리스트는 [checklist.md](./plans/checklist.md)를 기준으로 갱신하고, 상세 의사결정은 작업 영역에 맞는 `docs/plans/*.md` 파일에 남긴다.

## 6. 당장 다음 작업 권장 순서

1. `profiles` 테이블과 신원 뱃지 모델을 먼저 확정한다.
2. 게시글 추천/비추천과 조회수/댓글 수 집계를 붙인다.
3. 게시판 목록과 글 목록의 정보 밀도를 커뮤니티답게 올린다.
4. 댓글 신고/삭제/대댓글을 구현한다.
5. 운영 최소 기능인 신고 큐와 숨김 처리를 만든다.
6. 에디터의 블록 콘텐츠 모델을 확정하고 이미지 업로드부터 붙인다.
7. 알림 테이블과 GNB 알림 카운트를 붙인 뒤 Live2D 말풍선과 연결한다.
8. `works` 도메인 문서를 기준으로 애니/만화/게임 작품 DB와 작품 상세 페이지의 최소 스키마를 설계한다.
9. 작품 상세에 연결될 리뷰/평가/뉴스 타임라인과 `posts.work_id` 연결 방식을 확정한다.

## 7. 일일 마감 로그

### 2026-04-24

- `README.md`에 온보딩 흐름과 퇴근 자동화 경로를 정리했다.
- `.cursor/rules/end-of-day-automation.mdc`를 추가해 `퇴근` 요청 시 문서/깃 마감 루틴을 자동 실행하도록 설정했다.
- 구조 문서 `docs/ARCHITECTURE_OVERVIEW.md`와 플랜 문서 운영 흐름을 맞추기 위한 기준을 점검했다.

### 2026-05-04

- 플랜 문서를 커뮤니티 중심의 상세 제품 기준서로 확장했다.
- 토큰 사용량을 줄이기 위해 `docs/plan.md`를 허브로 축소하고 세부 기획을 `docs/plans/` 아래 도메인별 문서로 분리했다.
