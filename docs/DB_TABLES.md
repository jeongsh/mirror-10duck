# DB 테이블 정리 (Supabase / PostgreSQL)

이 문서는 현재 `Phase 2.2` 구현 기준으로 실제 사용 중인 DB 구조를 정리합니다.

## 1) `auth.users` (Supabase 관리 테이블)

Supabase Auth가 자동으로 관리하는 사용자 테이블입니다.  
직접 컬럼을 임의 수정하기보다, 인증 SDK와 메타데이터 업데이트로 다루는 것을 기본으로 합니다.

- 주요 용도
  - 회원가입/로그인 계정 저장
  - `public.posts.author_id` 참조 대상
  - `user_metadata.activeCharacterId`에 사용자 선호 Live2D 모델 ID 저장

- 현재 앱에서 사용하는 필드
  - `id` (UUID)
  - `email`
  - `user_metadata.activeCharacterId` (선택 모델 ID, 예: `pichu`)

---

## 2) `public.posts` (커뮤니티 게시글)

커뮤니티 게시판 CRUD용 테이블입니다.

### 컬럼

- `id` `uuid` PK, 기본값 `gen_random_uuid()`
- `created_at` `timestamptz` NOT NULL, 기본값 `now()`
- `title` `text` NOT NULL
- `content` `text` NOT NULL
- `category` `text` NOT NULL
- `author_id` `uuid` NOT NULL, `auth.users(id)` FK
- `author_email` `text` NOT NULL

### 인덱스/키

- Primary Key: `id`
- Foreign Key: `author_id -> auth.users(id)`

### RLS 정책

- `select`: 누구나 조회 가능
- `insert`: 인증 사용자만 가능, `auth.uid() = author_id` 조건
- `update`: 작성자 본인만 가능
- `delete`: 작성자 본인만 가능

---

## 3) 현재 카테고리 값

앱 코드(`types/community.ts`) 기준 카테고리:

- `일반`
- `캐릭터`
- `잡담`
- `굿즈`
- `질문`
- `공지`

`category`는 현재 `text`로 저장되며, 앱 레벨에서 허용값을 제한합니다.

---

## 4) `public.characters` (유저별 캐릭터 프로필)

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
- `insert`: 로그인 사용자 본인 데이터만 생성 가능 (`auth.uid() = user_id`)
- `update`: 로그인 사용자 본인 데이터만 수정 가능
- `delete`: 로그인 사용자 본인 데이터만 삭제 가능

---

## 5) 추후 확장 후보 테이블

향후 `Phase 2.3+`에서 분리 권장:

- `profiles` 또는 `user_profiles`: 닉네임, 아바타, 소개 등 사용자 공개 프로필
- `comments`: 댓글 CRUD
- `post_reactions`: 리액션(좋아요 2.0) 집계
- `stickers`, `sticker_assets`: 스티커 메타/파일 매핑
- `character_assets`: 업로드 모델 파일(Zip/Texture/모션) 스토리지 메타

---

## 6) 참고 문서

- `docs/SUPABASE_SETUP.md`: 초기 SQL + RLS 설정
- `docs/plan.md`: 전체 단계별 개발 계획
