# DB 테이블 정리 (Supabase / PostgreSQL)

이 문서는 현재 `Phase 2.3` 구현 기준으로 실제 사용 중인 DB 구조를 정리합니다.

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

## 7) `public.post_reactions` (감정 리액션)

Phase 2.3 캐릭터-커뮤니티 연결의 "좋아요 2.0" 데이터입니다.

### 컬럼
- `id` `uuid` PK, 기본값 `gen_random_uuid()`
- `post_id` `uuid` NOT NULL, `posts(id)` FK ON DELETE CASCADE
- `user_id` `uuid` NOT NULL, `auth.users(id)` FK ON DELETE CASCADE
- `reaction_type` `text` NOT NULL  
  CHECK IN (`'happy'`, `'empathy'`, `'surprise'`, `'sad'`, `'funny'`, `'cheer'`)
- `character_id` `text` NULL (반응 시점의 활성 `CharacterProfile.id` 스냅샷)
- `character_thumbnail_url` `text` NULL (썸네일 URL 스냅샷)
- `created_at` `timestamptz` NOT NULL, 기본값 `now()`

### 인덱스/키
- Primary Key: `id`
- Unique Key: `(post_id, user_id)`  
  → **한 글당 한 사용자 1리액션** 정책. 같은 종류 재클릭=해제, 다른 종류 클릭=교체.
  (정책 전환 마이그레이션: `docs/migrations/2026-04-29-phase23-reactions-single-per-user.sql`)
- Index: `idx_post_reactions_post_id`

### RLS 정책
- `select`: 누구나 조회 가능
- `insert`: 인증 사용자만 가능, `auth.uid() = user_id`
- `delete`: 본인 리액션만 삭제 가능 (`auth.uid() = user_id`)
- `update`: 비활성화 (변경 대신 삭제 후 재삽입으로 처리)

---

## 8) `public.comments` (댓글 + 스티커 답글)

Phase 2.3 캐릭터-커뮤니티 연결의 댓글 시스템입니다.  
`content` 또는 `sticker_token` 중 하나만 채워지는 "양립형" 구조입니다.

### 컬럼
- `id` `uuid` PK, 기본값 `gen_random_uuid()`
- `post_id` `uuid` NOT NULL, `posts(id)` FK ON DELETE CASCADE
- `author_id` `uuid` NOT NULL, `auth.users(id)` FK ON DELETE CASCADE
- `author_email` `text` NOT NULL
- `content` `text` NULL (텍스트 댓글; 본문에 `:sticker/...:` 토큰 임베드 가능)
- `sticker_token` `text` NULL (스티커 답글 모드, 스티커 토큰 1개)
- `created_at` `timestamptz` NOT NULL, 기본값 `now()`
- CHECK: `(content is not null) or (sticker_token is not null)` (둘 다 NULL 금지)

### 인덱스/키
- Primary Key: `id`
- Index: `idx_comments_post_id` (`post_id`, `created_at`)

### RLS 정책
- `select`: 누구나 조회 가능
- `insert`: 인증 사용자만 가능, `auth.uid() = author_id`
- `update`: 작성자 본인만 가능 (현재 UI에서는 비노출)
- `delete`: 작성자 본인만 가능

---

## 9) 추후 확장 후보 테이블

향후 `Phase 3+`에서 분리/추가 권장:
- `profiles` 또는 `user_profiles`: 닉네임, 아바타, 소개 등 사용자 공개 프로필
- `stickers`, `sticker_assets`: 스티커 메타/파일 매핑 (현재는 라이브러리 캐릭터를 그대로 스티커 소스로 활용)
- `character_assets`: 업로드 모델 파일(Zip/Texture/모션) 스토리지 메타

---

## 10) 참고 문서
- `docs/SUPABASE_SETUP.md`: 초기 SQL + RLS 설정
- `docs/plan.md`: 전체 플랜 허브 및 문서 참조 지도
- `docs/plans/checklist.md`: 단계별 완료/미완료 체크리스트
- `docs/plans/data-model.md`: 추후 DB 확장 계획
