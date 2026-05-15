# 데이터 모델 확장 계획

이 문서는 DB 마이그레이션, Supabase 테이블, RLS, 집계 컬럼 작업을 할 때 참고한다. 현재 실제 DB 설명은 [../DB_TABLES.md](../DB_TABLES.md), 초기 SQL은 [../SUPABASE_SETUP.md](../SUPABASE_SETUP.md)를 함께 본다.

## 0. Supabase MCP로 원격 DB 반영

- Cursor **Supabase MCP**(`plugin-supabase-supabase`)를 켜 두고, 세션마다 필요하면 **`mcp_auth`** 로 인증한다.
- **DDL**(테이블·컬럼·인덱스·RLS·정책·함수)은 MCP **`apply_migration`** 을 우선한다. 인자 `name`은 `snake_case`, `query`에는 `docs/migrations/`에 적어 둔 SQL과 **동일 본문**을 넣어 Git 기록과 Supabase 마이그레이션 히스토리를 맞춘다.
- 임시 조회·소량 데이터 수정·검증은 **`execute_sql`** 을 써도 된다. 스키마 변경은 가능하면 항상 마이그레이션 파일 + `apply_migration`으로 남긴다.
- 로컬 **Supabase CLI**(`supabase db push` 등)를 쓰는 팀은 그 흐름으로 통일해도 되며, 이 저장소에서는 **원격 프로젝트 반영 시 MCP를 기본 권장**으로 둔다.

## 1. 현재 주요 테이블

- `boards`: 게시판/채널 메타데이터
- `posts`: 게시판 글과 피드 글을 통합 관리하는 하이브리드 테이블
- `follows_user`: 유저 팔로우
- `follows_board`: 게시판 팔로우
- `characters`: 유저별 캐릭터 프로필
- `post_reactions`: 게시글 감정 리액션
- `comments`: 댓글과 스티커-only 답글

## 2. 우선 추가 후보

- [ ] `profiles`: user_id, fixed_nickname, display_name, avatar_url, bio, representative_character_id, nickname_type
- [x] `post_votes`: post_id, user_id, vote_type, created_at (마이그레이션 `docs/migrations/2026-05-04-post-aggregates-and-votes.sql`)
- [ ] `comment_votes`: comment_id, user_id, vote_type, created_at
- [ ] `post_views`: post_id, viewer_user_id, viewer_hash, viewed_at
- [ ] `bookmarks`: user_id, post_id, created_at
- [ ] `reports`: reporter_id, target_type, target_id, reason, detail, status
- [ ] `blocks`: blocker_id, blocked_user_id, created_at
- [ ] `notifications`: user_id, actor_id, type, target_type, target_id, read_at
- [ ] `moderation_logs`: moderator_id, action, target_type, target_id, reason, created_at
- [ ] `post_media`: post_id, storage_key, media_type, width, height, duration, status
- [ ] `moderation_results`: target_type, target_id, image_sha256, image_phash, status, nsfw_score, minor_signal_score, risk_score, tags, matched_rules, model_version, policy_version, reviewed_by
- [ ] `moderation_queue`: target_type, target_id, moderation_result_id, priority, reason, status, assigned_to, due_at
- [ ] `blocked_image_hashes`: image_sha256, image_phash, reason, source_moderation_result_id, policy_version
- [ ] `stickers`: owner_user_id, character_id nullable, name, visibility, source_type, created_at
- [ ] `sticker_assets`: sticker_id, label, storage_key, width, height, source_type, created_at
- [ ] `board_moderators`: board_id, user_id, role, created_at
- [ ] `board_tabs`: board_id, key, label, sort_order
- [ ] `news_items`: category, title, slug, summary, body_json, thumbnail_url, hero_image_url, tags, author_id, editor_note, published_at, updated_at, status
- [ ] `content_items`: content_type, title, image_url, official_url, tags, status, last_checked_at
- [ ] `release_events`: content_item_id, event_type, starts_at, timezone, recurrence_rule, platform, episode_label, source_url, status
- [ ] `user_content_follows`: user_id, content_item_id, notify_enabled, created_at
- [ ] `user_calendar_events`: user_id, title, event_type, starts_at, timezone, note, linked_content_item_id
- [ ] `reminder_settings`: user_id, target_type, target_id, reminder_type, offset_minutes, enabled

## 3. 기존 테이블 보강 후보

- [ ] `posts.content_version`
- [ ] `posts.content_json`
- [ ] `posts.author_display_name`
- [ ] `posts.author_nickname_type`
- [ ] `posts.author_avatar_url`
- [ ] `posts.author_character_id`
- [x] `posts.comment_count`
- [x] `posts.view_count`
- [x] `posts.upvote_count`
- [x] `posts.downvote_count`
- [ ] `posts.status`
- [ ] `posts.board_tab`
- [ ] `posts.spoiler_level`
- [ ] `post_media.moderation_status`
- [ ] `post_media.moderation_result_id`
- [ ] `post_media.image_sha256`
- [ ] `post_media.image_phash`
- [ ] `comments.parent_comment_id`
- [ ] `comments.author_display_name`
- [ ] `comments.author_nickname_type`
- [ ] `comments.status`
- [ ] `boards.rules`
- [ ] `boards.allow_anonymous`
- [ ] `boards.allow_media`
- [ ] `boards.visibility`
- [ ] `boards.icon_url`
- [ ] `boards.banner_url`
- [ ] `boards.is_nsfw`
- [ ] `boards.requires_age_verification`

## 4. 집계와 정합성 원칙

- 조회수, 댓글 수, 추천 수처럼 목록에서 자주 쓰는 값은 집계 컬럼 또는 materialized view를 검토한다.
- 집계 컬럼을 둘 경우 insert/delete/update 트리거나 RPC로 정합성을 유지한다.
- 사용자가 삭제되어도 게시글 표시가 깨지지 않도록 작성 시점 닉네임/아바타/캐릭터 스냅샷을 보존한다.
- 캐릭터가 삭제되어도 과거 리액션/스티커가 깨지지 않도록 썸네일 또는 스티커 에셋 스냅샷을 보존한다.
- 스티커는 Live2D 캐릭터 표정 매핑과 별개다. 직접 등록/AI 생성으로 만들어진 `sticker_assets`가 커뮤니티 노출의 기준이고, 캐릭터는 출처 또는 참조 대상일 뿐 필수 연결 대상이 아니다.

## 5. RLS 원칙

- 공개 조회 가능한 커뮤니티 콘텐츠라도 숨김/삭제/제재 상태는 RLS 또는 쿼리 레이어에서 제외한다.
- 작성, 수정, 삭제는 작성자 본인 또는 운영자 권한으로 제한한다.
- 신고, 차단, 알림, 프로필 설정은 본인 데이터 접근을 기본으로 한다.
- 운영자 도구는 별도 role 또는 board moderator 테이블을 통해 권한을 확인한다.

## 6. 마이그레이션 원칙

- 기존 `content text`와 스티커 토큰 글은 계속 읽을 수 있어야 한다.
- 컬럼 추가는 가능한 `nullable` 또는 기본값을 두어 기존 행을 깨지 않게 한다.
- 데이터 백필이 필요한 경우 문서에 백필 조건과 롤백 방법을 남긴다.
- 마이그레이션 후 `docs/DB_TABLES.md`를 함께 업데이트한다.
