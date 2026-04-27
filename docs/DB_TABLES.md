# DB 테이블 정리 (Supabase / PostgreSQL)

이 문서는 현재 `Phase 2.2` 구현 기준으로 실제 사용 중인 DB 구조를 정리합니다.

## 1) `auth.users` (Supabase 관리 테이블)

Supabase Auth가 자동으로 관리하는 사용자 테이블입니다.  
직접 컬럼을 임의 수정하기보다, 인증 SDK와 메타데이터 업데이트로 다루는 것을 기본으로 합니다.

- 주요 용도
  - 회원가입/로그인 계정 저장
  - `public.posts.author_id` 참조 대상
  - `user_metadata.activeCharacterId`에 사용자 선호 Live2D 모델 ID 저장

---

## 2) `public.boards` (게시판/채널 메타데이터)

독립된 카테고리(채널)를 관리하는 테이블입니다.

### 컬럼
- `id` `uuid` PK, 기본값 `gen_random_uuid()`
- `slug` `text` UNIQUE NOT NULL (URL 경로용, 예: 'general')
- `name` `text` NOT NULL (게시판 이름, 예: '일반 갤러리')
- `description` `text` (게시판 설명)
- `created_at` `timestamptz` 기본값 `now()`

---

## 3) `public.posts` (커뮤니티 게시글 및 피드)

게시판 글과 피드 타임라인 글을 통합 관리하는 하이브리드 테이블입니다.

### 컬럼
- `id` `uuid` PK, 기본값 `gen_random_uuid()`
- `created_at` `timestamptz` NOT NULL, 기본값 `now()`
- `author_id` `uuid` NOT NULL, `auth.users(id)` FK
- `author_email` `text` NOT NULL
- `board_id` `uuid` NULL, `boards(id)` FK (피드 전용 글일 경우 NULL)
- `title` `text` NULL (게시판 글은 필수, 피드 글은 생략)
- `content` `text` NOT NULL
- `source_type` `text` NOT NULL, 기본값 'BOARD' ('BOARD' 또는 'FEED')
- `origin_post_id` `uuid` NULL, `posts(id)` FK (크로스포스트 시 원본 스냅샷 추적)
- `is_hot` `boolean` 기본값 `false` (개념글 여부)
- `hot_promoted_at` `timestamptz` NULL (개념글 등극 시간)
*참고: 과거 사용되던 `category` 컬럼은 폐기(비활성화)되었습니다.*

### RLS 정책
- `select`: 누구나 조회 가능
- `insert`: 인증 사용자만 가능, `auth.uid() = author_id` 조건
- `update`: 작성자 본인만 가능
- `delete`: 작성자 본인만 가능

---

## 4) `public.follows_user` (유저 팔로우)

피드 타임라인 구성을 위한 유저 간 팔로우 관계 테이블입니다.

### 컬럼
- `follower_id` `uuid` NOT NULL, `auth.users(id)` FK
- `following_id` `uuid` NOT NULL, `auth.users(id)` FK
- `created_at` `timestamptz` 기본값 `now()`

### 인덱스/키
- Primary Key: `(follower_id, following_id)`

---

## 5) `public.follows_board` (게시판 팔로우)

특정 게시판을 팔로우(구독)하여 개념글을 피드로 받아보기 위한 테이블입니다.

### 컬럼
- `user_id` `uuid` NOT NULL, `auth.users(id)` FK
- `board_id` `uuid` NOT NULL, `boards(id)` FK
- `created_at` `timestamptz` 기본값 `now()`

### 인덱스/키
- Primary Key: `(user_id, board_id)`

---

## 6) `public.characters` (유저별 캐릭터 프로필)

캐릭터 라이브러리 관리(이름/소개/기본 뷰/매핑/대사 등) 저장용 테이블입니다.

### 컬럼
- `id` `uuid` PK, 기본값 `gen_random_uuid()`
- `created_at` `timestamptz` NOT NULL, 기본값 `now()`
- `updated_at` `timestamptz` NOT NULL, 기본값 `now()` (trigger로 갱신)
- `user_id` `uuid` NOT NULL, `auth.users(id)` FK
- `character_id` `text` NOT NULL (앱의 `CharacterProfile.id`)
- `profile_json` `jsonb` NOT NULL (`CharacterProfile` 전체 스냅샷)

### 인덱스/키
- Primary Key: `id`
- Unique Key: `(user_id, character_id)`
- Index: `idx_characters_user_id`

### RLS 정책
- `select`: 로그인 사용자 본인 데이터만 조회 가능
- `insert/update/delete`: 본인 데이터만 수정 가능

---

## 7) 추후 확장 후보 테이블

향후 `Phase 2.3+`에서 분리 권장:
- `profiles` 또는 `user_profiles`: 닉네임, 아바타, 소개 등 사용자 공개 프로필
- `comments`: 댓글 CRUD
- `post_reactions`: 리액션(좋아요 2.0) 집계
- `stickers`, `sticker_assets`: 스티커 메타/파일 매핑
- `character_assets`: 업로드 모델 파일(Zip/Texture/모션) 스토리지 메타

---

## 8) 참고 문서
- `docs/SUPABASE_SETUP.md`: 초기 SQL + RLS 설정
- `docs/plan.md`: 전체 단계별 개발 계획

---

## 일일 변경 확인 (2026-04-27)

- 신규 테이블 추가: 변경 없음
- 신규/수정 컬럼: 변경 없음
- RLS 정책 변경: 변경 없음
- 관계(FK/PK/인덱스) 변경: 변경 없음
