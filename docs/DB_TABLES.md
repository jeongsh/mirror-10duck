# DB 테이블 정리 (Supabase / PostgreSQL)

이 문서는 현재 `Phase 2.3` 구현 기준으로 실제 사용 중인 DB 구조를 정리합니다.

## 1) `auth.users` (Supabase 관리 테이블)

Supabase Auth가 자동으로 관리하는 사용자 테이블입니다.  
직접 컬럼을 임의 수정하기보다, 인증 SDK와 메타데이터 업데이트로 다루는 것을 기본으로 합니다.

- 주요 용도
  - 회원가입/로그인 계정 저장
  - `public.posts.author_id` 참조 대상
  - `user_metadata.activeCharacterId`에 사용자 선호 Live2D 모델 ID 저장
  - **참고**: 실제 공개 프로필 정보는 `public.profiles`에서 관리함.

---

## 2) `public.boards` (게시판/채널 메타데이터)

독립된 카테고리(채널)를 관리하는 테이블입니다.

### 컬럼
- `id` `uuid` PK, 기본값 `gen_random_uuid()`
- `slug` `text` UNIQUE NOT NULL (URL 경로용, 예: 'general')
- `name` `text` NOT NULL (게시판 이름, 예: '일반 갤러리')
- `description` `text` (게시판 설명)
- `category` `text` NOT NULL, 기본값 `'general'` — 게시판 분류. 허용값: `general`, `anime`, `game`, `hobby`, `life`, `media`, `other` (앱 라벨은 `lib/community/boardCategories.ts` 참고). 인덱스 `boards_category_idx`.
- `created_at` `timestamptz` 기본값 `now()`
- `hot_threshold` `integer` NOT NULL (개념글 피드 노출 추천 수 기준)
- `allow_anonymous` `boolean` NOT NULL
- `allow_media` `boolean` NOT NULL
- `is_nsfw` `boolean` NOT NULL
- `sort_order` `integer` NOT NULL 기본값 `0` — 같은 `category` 안에서 채널 목록 정렬. 인덱스 `(category, sort_order)` (`docs/migrations/2026-05-13-board-display-order.sql`)
- `tag_policy` `jsonb` NOT NULL 기본값 `{}` — 실험 A3 통합 태그용 게시판별 정책(허용 종류·최소 개수 등). MCP 마이그레이션 `experiment_a3_tag_system`, 파일 `docs/migrations/2026-05-13_experiment_a3_tag_system.sql`

마이그레이션: `docs/migrations/2026-05-12-boards-category.sql` (category 등), `docs/migrations/2026-05-13-board-display-order.sql` (sort_order·`board_category_order`)

### RLS 정책
- `select`: 누구나 (`using (true)`)
- `insert` / `update` / `delete`: `public.is_admin()` (`profiles.role = 'ADMIN'`)
- 마이그레이션: `docs/migrations/2026-05-12-boards-rls-admin.sql`

---

## 2-1) `public.board_category_order` (채널 목록에서 카테고리 블록 순서)

- `category` `text` PK — `boards.category` 와 동일 허용 집합
- `position` `integer` NOT NULL — 오름차순으로 앞에 올수록 먼저 표시
- RLS: 전역 `select`, `insert`/`update`/`delete` 는 `public.is_admin()` 인 경우만
- 마이그레이션: `docs/migrations/2026-05-13-board-display-order.sql`

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
- `view_count` `integer` NOT NULL 기본값 `0` (조회수; `increment_post_view` RPC로 증가)
- `comment_count` `integer` NOT NULL 기본값 `0` (댓글 수; `comments` 트리거로 유지)
- `upvote_count` `integer` NOT NULL 기본값 `0` (추천 수; `post_votes` 트리거로 유지)
- `downvote_count` `integer` NOT NULL 기본값 `0` (비추천 수; `post_votes` 트리거로 유지)
- `profiles` (Virtual Join 대상) → `author_id`를 통한 `public.profiles(user_id)` FK 참조
- `status` `text` NOT NULL, 기본값 `NORMAL` (관리자 숨김 등 `HIDDEN`)
*참고: 과거 사용되던 `category` 컬럼은 폐기(비활성화)되었습니다.*

### 크로스포스트 정합성 (`db/2026-05-11-crosspost-dedup-propagate.sql`)
- 부분 유니크 인덱스: `source_type = FEED`일 때 `(origin_post_id, author_id)` 중복 불가(같은 원본을 피드에 두 번 공유 불가).
- 부분 유니크 인덱스: `source_type = BOARD`이고 `origin_post_id`가 있을 때 `(origin_post_id, board_id, author_id)` 중복 불가.
- 트리거: 원본 글 `status`가 `HIDDEN`으로 바뀌면 `origin_post_id` 체인으로 이어지는 모든 파생 글도 `HIDDEN`.
- 트리거: 원본 글 삭제 전에 `origin_post_id = 삭제 대상 id`인 글들의 `origin_post_id`를 `NULL`로 정리(FK 때문에 삭제가 막히지 않도록).

마이그레이션: `docs/migrations/2026-05-04-post-aggregates-and-votes.sql`

### RLS 정책
- `select`: 누구나 조회 가능
- `insert`: 인증 사용자만 가능, `auth.uid() = author_id` 조건
- `update`: 작성자 본인만 가능
- `delete`: 작성자 본인만 가능

---

## 3-1) 통합 태그 (실험 A3, `experiment_a3_tag_system`)

말머리·주제 태그를 공통 모델로 묶는 실험 트랙이다. **게시판 글쓰기·목록에는 태그 UI를 두지 않고** 말머리로 분류한다. `post_tags` 등은 검색 별칭·캐릭터·CP·교차 검색 등 후속 기능에서 활용할 수 있다.

### `public.tag_kind` (ENUM)

`work`, `character`, `pair`, `spoiler`, `content_warning`, `genre`, `meta`

### `public.tags`

- `id` `uuid` PK
- `slug` `text` UNIQUE NOT NULL
- `kind` `tag_kind` NOT NULL
- `parent_tag_id` `uuid` NULL → `tags(id)`
- `display_name` `text` NOT NULL
- `official` `boolean` NOT NULL DEFAULT false
- `created_by` `uuid` NULL → `auth.users(id)`
- `created_at` `timestamptz` NOT NULL DEFAULT now()

RLS: 전역 조회; 일반 사용자는 비공식 태그만 본인 소유로 생성·수정·삭제; 공식 태그·전역 편집은 `public.is_admin()` (`profiles.role`).

### `public.tag_aliases`

- `id` `uuid` PK
- `tag_id` `uuid` NOT NULL → `tags(id)` ON DELETE CASCADE
- `alias` `text` NOT NULL
- `lang` `text` NOT NULL (`ko`/`ja`/`en`/`romaji`), UNIQUE `(tag_id, alias, lang)`

RLS: 전역 조회; 삽입·수정·삭제는 관리자 또는 해당 비공식 태그 소유자.

### `public.post_tags`

- `post_id` `uuid` NOT NULL → `posts(id)` ON DELETE CASCADE
- `tag_id` `uuid` NOT NULL → `tags(id)` ON DELETE CASCADE
- `weight` `real` NOT NULL DEFAULT 1
- `created_at` `timestamptz` NOT NULL DEFAULT now()
- PK `(post_id, tag_id)`

RLS: 전역 조회; 글 작성자(`posts.author_id = auth.uid()`) 또는 관리자만 행 삽입·수정·삭제. **익명 글**은 클라이언트에서 태그를 붙이지 않음(작성자 ID 없음으로 RLS 불가).

### `public.is_admin()` / `public.jwt_is_admin()`

로그인 사용자의 `profiles.role`이 `ADMIN`인지 여부. `jwt_is_admin()`은 동일 로직으로 위임(레거시 정책 호환). 앱 `lib/supabase/admin.ts`·`useIsAdmin()`과 동일 기준.

마이그레이션 파일: `docs/migrations/2026-05-13_experiment_a3_tag_system.sql` (동일 본문 `db/experiment/a3-tag-system.sql`).

---

## 4) `public.post_votes` (게시글 추천/비추천)

글당 사용자 1표(`up` / `down`). 집계 컬럼은 `posts` 트리거로 동기화한다.

### 컬럼
- `id` `uuid` PK, 기본값 `gen_random_uuid()`
- `post_id` `uuid` NOT NULL, `posts(id)` FK ON DELETE CASCADE
- `user_id` `uuid` NOT NULL, `auth.users(id)` FK ON DELETE CASCADE
- `vote_type` `text` NOT NULL, CHECK IN (`'up'`, `'down'`)
- `created_at` `timestamptz` NOT NULL, 기본값 `now()`

### 인덱스/키
- Unique: `(post_id, user_id)`
- Index: `post_id`

### RLS 정책
- `select`: 누구나 조회 가능
- `insert` / `update` / `delete`: 본인 행만 (`auth.uid() = user_id`)

### RPC
- `increment_post_view(pid uuid)`: 조회수 +1 (SECURITY DEFINER, `anon`·`authenticated` 실행 허용)

---

## 5) `public.follows_user` (유저 팔로우)

피드 타임라인 구성을 위한 유저 간 팔로우 관계 테이블입니다.

### 컬럼
- `follower_id` `uuid` NOT NULL, `auth.users(id)` FK
- `following_id` `uuid` NOT NULL, `auth.users(id)` FK
- `created_at` `timestamptz` 기본값 `now()`

### 인덱스/키
- Primary Key: `(follower_id, following_id)`

---

## 6) `public.follows_board` (게시판 팔로우)

특정 게시판을 팔로우(구독)하여 개념글을 피드로 받아보기 위한 테이블입니다.

### 컬럼
- `user_id` `uuid` NOT NULL, `auth.users(id)` FK
- `board_id` `uuid` NOT NULL, `boards(id)` FK
- `created_at` `timestamptz` 기본값 `now()`

### 인덱스/키
- Primary Key: `(user_id, board_id)`

---

## 7) `public.characters` (유저별 캐릭터 프로필)

캐릭터 라이브러리 관리(이름/소개/기본 뷰/매핑/대사 등) 저장용 테이블입니다.

### 컬럼
- `id` `uuid` PK, 기본값 `gen_random_uuid()`
- `created_at` `timestamptz` NOT NULL, 기본값 `now()`
- `updated_at` `timestamptz` NOT NULL, 기본값 `now()` (trigger로 갱신)
- `user_id` `uuid` NOT NULL, `auth.users(id)` FK (연결된 `public.profiles(user_id)`)
- `character_id` `text` NOT NULL (앱의 `CharacterProfile.id`)
- `profile_json` `jsonb` NOT NULL (`CharacterProfile` 전체 스냅샷. `scenarioMap`은 상황별 표정+모션 매핑의 기준이고, `expressionMap`/`motionMap`은 고급/호환 매핑으로 유지)

### 인덱스/키
- Primary Key: `id`
- Unique Key: `(user_id, character_id)`
- Index: `idx_characters_user_id`

### RLS 정책
- `select`: 로그인 사용자 본인 데이터만 조회 가능
- `insert/update/delete`: 본인 데이터만 수정 가능

---

## 8) `public.post_reactions` (감정 리액션)

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

## 9) `public.comments` (댓글 + 스티커 답글)

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

## 10) `public.profiles` (사용자 프로필)

계정 정보(`auth.users`)와 별개로 커뮤니티에서 활동할 때 보여지는 사용자 신원 정보를 관리합니다.

### 컬럼
- `user_id` `uuid` PK, `auth.users(id)` FK
- `nickname` `text` (닉네임)
- `avatar_url` `text` (아바타 이미지 URL)
- `bio` `text` (자기소개)
- `nickname_type` `text` NOT NULL 기본값 'NORMAL' ('NORMAL' | 'FIXED')
- `role` `text` NOT NULL 기본값 `'USER'` (`'USER'` | `'ADMIN'`) — 관리자 권한 단일 기준
- `updated_at` `timestamptz` 기본값 `now()`

### 트리거
- `on_auth_user_created`: `auth.users`에 신규 행 삽입 시 자동으로 기본 프로필 생성.

---

## 11) 추후 확장 후보 테이블

향후 `Phase 3+`에서 분리/추가 권장:
- `stickers`, `sticker_assets`: 직접 등록/AI 생성 스티커 메타와 파일 매핑. Live2D 캐릭터 표정 지원 여부와 분리해 관리
- `character_assets`: 업로드 모델 파일(Zip/Texture/모션) 스토리지 메타

---

## 12) 참고 문서
- `docs/SUPABASE_SETUP.md`: 초기 SQL + RLS 설정
- `docs/plan.md`: 전체 플랜 허브 및 문서 참조 지도
- `docs/plans/checklist.md`: 단계별 완료/미완료 체크리스트
- `docs/plans/data-model.md`: 추후 DB 확장 계획
