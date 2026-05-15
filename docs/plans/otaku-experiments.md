# 오타쿠 커뮤니티 실험 플랜

이 문서는 "오타쿠적 결"과 "커뮤니티 기능"을 강화하기 위해 검토 중인 기능들의 통합 허브다. 각 항목은 **별도 브랜치로 시도하고 쓸 만하면 머지**하는 실험 트랙으로 운영한다. 정식 도메인 문서(`docs/plans/community.md` 등)에 편입되기 전 단계의 후보군이다.

세부 진행 상태는 별도 체크리스트 파일로 분리하지 않고, 실제 진행이 시작된 항목만 [checklist.md](./checklist.md)와 관련 도메인 문서에 반영한다.

## 0. 운영 원칙

- **브랜치 단위 실험:** 항목 한 개당 한 브랜치를 판다. 브랜치명은 `experiment/<id>-<slug>` 규칙(예: `experiment/a3-tag-system`).
- **머지 결정 기준 명시:** 모든 항목에 "채택 결정 기준"과 "폐기 시 처리"가 있어야 한다. 결정 없이 브랜치를 방치하지 않는다.
- **DB 변경은 가역적으로:** 마이그레이션은 `db/experiment/<id>-*.sql` 디렉토리에 분리하고, 폐기 시 down 스크립트로 되돌릴 수 있게 작성한다. 본 마이그레이션 폴더(`db/`)에는 채택된 뒤에만 옮긴다.
- **기능 플래그 권장:** 가능하면 환경변수 또는 `feature_flags` 테이블로 토글한다. 머지하더라도 즉시 노출하지 않을 수 있게 둔다.
- **문서 동기화:** 채택되면 이 문서의 해당 항목을 "채택됨"으로 표시하고, 정식 도메인 문서로 내용을 이전한 뒤 본 문서에는 링크만 남긴다. 폐기되면 "폐기됨"으로 표시하고 이유를 1~3줄 적는다 (다시 시도할 후세를 위해).
- **순서:** Phase 2 마무리 중이므로 Phase 2 우선군(아래 7장)을 먼저 돌린다.

## 1. 항목별 참조 지도

| ID | 제목 | 그룹 | 우선순위 | 브랜치명 | 의존 |
|----|------|------|----------|----------|------|
| A1 | 쿠르(분기) 라인업 | 오타쿠 정체성 | P2 | `experiment/a1-cours-lineup` | A3 |
| A2 | 오시 타입 확장 (성우/스튜디오/CP) | 오타쿠 정체성 | P2 | `experiment/a2-oshi-types` | A3 |
| A3 | 통합 태그 시스템 | 오타쿠 정체성 | P1 | `experiment/a3-tag-system` | - |
| A4 | 스포일러 표시 (작성자 자율 태그/말머리) | 오타쿠 정체성 | P1 | `experiment/a4-spoiler-tag` | - (A3 또는 기존 말머리) |
| A5 | 2차 창작 게시판/갤러리 뷰 | 오타쿠 정체성 | P2 | `experiment/a5-fan-content` | A3, B5 |
| A6 | 동인 행사/굿즈 일정 | 오타쿠 정체성 | P3 | `experiment/a6-events-doujin` | A3 |
| A7 | 작품명 동의어 매핑 | 오타쿠 정체성 | P2 | `experiment/a7-title-aliases` | A3 |
| A8 | 호칭/레벨/평판 | 오타쿠 정체성 | P3 | `experiment/a8-reputation` | - |
| A9 | 오타쿠 자기소개 카드 | 오타쿠 정체성 | P2 | `experiment/a9-intro-card` | - |
| A10 | 스티커 차트/공식 큐레이션 팩 | 오타쿠 정체성 | P3 | `experiment/a10-sticker-chart` | A3 |
| B1 | 개념글 다층 (실/일/주/월/HOF) | 커뮤니티 | P1 | `experiment/b1-hot-tiers` | - |
| B2 | 사용자 게시판 신청·매니저 | 커뮤니티 | P3 | `experiment/b2-user-boards` | - |
| B3 | 어뷰징 방지 자동화 | 커뮤니티 | P1 | `experiment/b3-anti-abuse` | - |
| B4 | 검색 깊이/필터/저장 검색 | 커뮤니티 | P2 | `experiment/b4-search-deep` | A3 |
| B5 | 시리즈/연재 묶기 | 커뮤니티 | P2 | `experiment/b5-series` | - |
| B6 | 인용 답글(쿠팅) | 커뮤니티 | P1 | `experiment/b6-quote-reply` | - |
| B7 | DM/쪽지 (정책 위주) | 커뮤니티 | P3 | `experiment/b7-dm-policy` | - |
| B8 | 스크랩 컬렉션/폴더 | 커뮤니티 | P2 | `experiment/b8-collections` | - |
| B9 | 알림 채널·다이제스트 | 커뮤니티 | P3 | `experiment/b9-digest` | - |
| B10 | SEO/OG 미리보기 | 커뮤니티 | P3 | `experiment/b10-og` | - |
| B11 | 운영 인사이트 대시보드 | 커뮤니티 | P3 | `experiment/b11-ops-insight` | B2 권장 |
| B12 | 다크 모드/접근성/NSFW 안전 모드 | 커뮤니티 | P3 | `experiment/b12-a11y` | - |

우선순위 정의: **P1**=Phase 2 안에 시도, **P2**=Phase 3 초입, **P3**=Phase 3 후반~Phase 4.

---

## 2. A. 오타쿠 정체성 강화 실험

### A1. 쿠르(분기) 라인업

- **가설:** 오타쿠는 일정 단위로 "월"이 아니라 "쿠르(1·4·7·10월 시작)"로 사고한다. 분기 라인업 화면이 있으면 신작 진입과 분기 회고형 커뮤니티 활동이 살아난다.
- **사용자 흐름:** `/season/2026-summer` → 신작 그리드 → 카드별 [관심/△/×] → 분기 시작 주 라인업 투표 → 종료 주 회고 토픽 자동 개설.
- **데이터:** `release_items.cours text` 추가(`2026-Q3` 포맷), `season_lineup_votes(user_id, release_item_id, intent in ('watch','maybe','skip'))`.
- **화면:** 분기 그리드(요일 그룹 또는 장르 그룹 토글), 분기 회고 자동 토픽, GNB "이번 분기" 진입.
- **브랜치:** `experiment/a1-cours-lineup`
- **채택 기준:** 분기 그리드 1회 노출 후 14일 안에 관심 등록 액션 200건 이상 또는 분기 라인업 페이지 재방문률 ≥ 30%.
- **폐기 시:** `release_items.cours` 컬럼은 남기되 화면만 비공개. 컬럼 자체는 캘린더 정렬에 활용 여지.

### A2. 오시 타입 확장 (성우/스튜디오/CP)

- **가설:** 오시는 작품·캐릭터만이 아니다. 성우/감독·스튜디오/CP(커플링)/아이돌 그룹도 핵심 오시 대상이다.
- **데이터:** `oshi_registrations.oshi_type` enum 확장: `voice_actor`, `creator`, `pair`, `idol_group`. CP는 `oshi_pair_members(oshi_id, member_index, character_title, direction in ('a_to_b','b_to_a','reversible','unknown'))` 보조 테이블.
- **화면:** 오시 등록 폼에서 타입 선택 시 입력 칸이 달라진다(성우=이름·소속·대표 출연작, CP=두 캐릭터+방향성·작품).
- **브랜치:** `experiment/a2-oshi-types`
- **채택 기준:** 확장 타입 등록이 전체 오시 등록의 ≥ 20%를 차지한다.
- **폐기 시:** 확장 타입은 `other`로 다운그레이드, 컬럼 그대로 둔다(데이터 손실 방지).

### A3. 통합 태그 시스템 — 최우선

- **게시판과의 역할 분담:** 채널·작품별 게시판에서는 주제가 게시판에 고정되므로 **게시판 글쓰기 UI에는 태그를 두지 않고 말머리로 분류**한다. 통합 태그 DB(`tags`, `post_tags`, `tag_aliases`)는 **검색 별칭·캐릭터·CP·교차 검색** 등 게시판 단위를 넘는 축에 쓴다.
- **가설:** 말머리·주제 태그·스티커 라벨·관심 태그가 표준 없이 흩어져 있어, 작품/캐릭터/CP/스포일러 분류가 일관되지 않다. 이 한 축이 정리되어야 검색·갤러리·분기 라인업·자기소개 카드 모두 자연스러워진다.
- **데이터:**
  - `tags(id, slug, kind in ('work','character','pair','spoiler','content_warning','genre','meta'), parent_tag_id, display_name, official boolean, created_by, created_at)`
  - `tag_aliases(tag_id, alias, lang in ('ko','ja','en','romaji'))`
  - `post_tags(post_id, tag_id, weight)`
  - 게시판별 허용/필수 태그 정책은 `boards`에 `tag_policy jsonb` 또는 `board_tag_rules` 별도 테이블.
- **화면:** 글쓰기 태그 입력에 자동완성(별칭/초성), 작품 태그 클릭 시 그 작품 전체 글 목록, 스포일러/주의 태그는 색·아이콘 구분.
- **브랜치:** `experiment/a3-tag-system`
- **채택 기준:** 출시 후 4주 안에 태그 부착 글 비율 ≥ 60%, 태그 클릭 → 게시글 이동 전환 ≥ 8%.
- **폐기 시:** `tags`/`post_tags`는 보존, 자동완성만 끈다. 다른 실험들이 의존하므로 폐기보다 단순화로 끝낼 가능성 높음.

### A4. 스포일러 표시 (작성자 자율 태그/말머리)

- **범위 결정:** 초기 단계에서는 **작성자가 글을 쓸 때 직접 태그 또는 말머리로 스포일러를 표시**하는 단순한 방식만 도입한다. 회차 단위 자동 마스킹·본문 인라인 블러·"n화까지 본 사람만" 같은 복잡한 정책은 도입하지 않는다(필요해지면 후속 실험으로 분리).
- **가설:** 작성자가 스포일러 태그/말머리를 달기만 해도 목록·상세에서 시각적으로 구분되어 미표기 신고가 줄고, 신작 토론 진입 부담이 낮아진다.
- **데이터:** 별도 컬럼 추가 없음. **기존 말머리** 또는 **A3 통합 태그** 둘 중 하나에 `스포일러` 항목을 추가한다(A3가 채택되면 태그로, 아니면 말머리로). 추가 enum/JSON 필드 없음.
- **사용자 흐름:** 글쓰기 폼에서 "스포일러 포함" 체크 또는 `[스포]` 말머리 선택 → 저장 시 자동으로 해당 태그/말머리가 붙는다.
- **화면:**
  - 목록 카드: 제목 옆 `스포` 칩, 썸네일 흐리게(blur), 본문 미리보기 숨김
  - 상세 진입 시: 상단에 짧은 "스포일러 주의" 안내 1줄 (닫기 가능)
  - 게시판 정책: 신작 토론 게시판 등은 "스포일러 표기 권장/강제" boolean 옵션만 (`boards.spoiler_required boolean default false`)
- **에디터:** 신규 마크·블록 추가 없음. 체크박스 또는 말머리 선택 UI만.
- **신고 사유:** "스포일러 미표기" 추가.
- **브랜치:** `experiment/a4-spoiler-tag`
- **채택 기준:** 신작 토론 게시판에서 스포일러 태그/말머리 사용률 ≥ 50%, 미표기 신고 빈도 도입 전 대비 감소.
- **폐기 시:** 태그/말머리는 그대로 남기고, 목록 시각 표시(흐리게·칩)만 끈다.

### A5. 2차 창작 게시판/갤러리 뷰

- **가설:** 팬아트·SS·MMD·AMV는 글 목록형 UI에 잘 맞지 않는다. 갤러리(썸네일 그리드) 뷰와 작품/CP 태그 필수화가 있으면 2차 창작 생태가 모인다.
- **데이터:** `boards.layout text`(`list|gallery|hybrid`), `posts.creative_kind text|null`(`fanart|fanfic|mmd|amv|cosplay|collab`), 작품·CP 태그 필수 정책(A3 의존).
- **화면:** `/board/[slug]` 레이아웃 분기. 갤러리 뷰는 정사각 썸네일·작품 태그·작성자·CP·반응 수만 표시. 글 상세는 공통.
- **에디터:** 작성 시 작품·캐릭터·CP 태그 필수 검증, AI 생성 표시(`generation: ai|human|mixed`).
- **브랜치:** `experiment/a5-fan-content`
- **채택 기준:** 갤러리 뷰 게시판에서 글 작성률이 텍스트 목록 시절 대비 ≥ 1.5배, 작품 태그 부착률 ≥ 90%.
- **폐기 시:** `boards.layout` 컬럼은 남기고 갤러리 뷰는 비공개. `creative_kind`는 통계용으로 유지.

### A6. 동인 행사/굿즈 일정

- **가설:** 코미케·AGF·서코·원더페스·굿즈 발매일도 오타쿠 일정의 핵심이다. 캘린더가 방영/연재/출시에만 있으면 일정 화면이 절반만 채워진다.
- **데이터:** `release_events.event_type`에 `event_doujin`, `event_expo`, `goods_release`, `preorder_open` 추가. `event_doujin`은 `venue`, `booth_count`, `applicant_url` 보조 컬럼.
- **화면:** 캘린더 필터에 "행사/굿즈" 추가, 행사별 후기 게시판 자동 연결, 부스 정보는 사용자 제보 큐(승인제).
- **브랜치:** `experiment/a6-events-doujin`
- **채택 기준:** 첫 대형 행사 1회 사이클(2주 전~1주 후) 동안 행사 일정 알림 구독자 ≥ 100명, 후기 게시판 글 ≥ 30개.
- **폐기 시:** 일정 데이터는 보존, 별도 화면만 숨김.

### A7. 작품명 동의어 매핑

- **가설:** "러브라이브 / ラブライブ / LoveLive / 엘라" 매핑이 없으면 검색·태그·관심 등록이 다 따로 논다. A3 안에 포함되지만 별도 실험으로 끊는다(데이터 시드 비용이 크고 별칭은 운영 작업이라 가역성 확보).
- **데이터:** `tag_aliases`(A3 정의)에 시드 작업. `release_items.canonical_tag_id` 연결.
- **화면:** 검색·태그 자동완성·관심 등록에서 별칭 매핑 동작.
- **시드 전략:** 초기에는 운영자 수동 시드 + 사용자 별칭 제안 큐.
- **브랜치:** `experiment/a7-title-aliases`
- **채택 기준:** 상위 100개 작품에 한국어/일본어/영어 별칭이 최소 1개씩 매핑되어 있고, 별칭 검색 적중률 ≥ 90%.
- **폐기 시:** 시드 데이터는 보존, 자동완성 후처리만 끈다.

### A8. 호칭/레벨/평판

- **가설:** 배지(9종)만으로는 "활동 누적의 시각화"가 부족하다. 호칭은 디시·아카 정서의 핵심이고, 평판은 운영 위임의 전 단계다.
- **데이터:** `user_levels(user_id, level int, xp bigint, season text|null)`, `user_titles(user_id, title_id text, equipped boolean)`, `titles(id, name, source in ('badge','level','season','event'), rarity, display_color)`.
- **XP 산정:** 글/댓글 단순 누적이 아니라 **정확한 태그 사용·스포일러 정확 표기·개념글 등극·매니저 활동** 가중. 어뷰징 방지를 위해 일일 상한과 신고당하면 가중 감점.
- **화면:** 닉 옆 호칭(선택), 프로필 호칭 선택 화면, 시즌 호칭(분기 단위 갱신).
- **자조적 호칭 옵션:** "고인물", "현질러", "본방사수러" 등 오타쿠 톤 호칭 셀렉터.
- **브랜치:** `experiment/a8-reputation`
- **채택 기준:** 호칭 장착 사용자 비율 ≥ 30%, 평판 가중 추천 도입 후 신고 처리 시간 단축 측정 가능.
- **폐기 시:** XP 컬럼은 유지, 가중치만 0으로 둔다. 호칭은 표시 끈다.

### A9. 오타쿠 자기소개 카드

- **가설:** 프로필이 "닉 + 오시 5개"만 있으면 정체성 표현이 부족하다. 입덕작·인생 작품·명대사·현재 분기 시청작·취향 경고로 구성된 자기소개 카드가 있으면 팔로우와 첫인상이 강해진다.
- **데이터:** `user_intro_cards(user_id, layout_version, fields jsonb, public boolean, updated_at)`. fields는 `entry_work`, `top_3_works`, `top_quote`, `top_ost`, `current_cours_titles[]`, `favorite_genres[]`, `nsfw_consume`, `nsfw_create`.
- **화면:** `/profile` "오시 & 배지" 옆 "자기소개" 탭. 카드 캡처/공유(트위터·디스코드용 OG 이미지) 액션. Live2D가 "같이 만들래?" 유도.
- **브랜치:** `experiment/a9-intro-card`
- **채택 기준:** 가입 30일 이내 사용자의 자기소개 카드 작성률 ≥ 25%, 카드 캡처 공유 액션 발생 ≥ 5%.
- **폐기 시:** 데이터는 보존, 프로필 노출만 끈다.

### A10. 스티커 차트/공식 큐레이션 팩

- **가설:** 스티커가 개인 캐릭터에 갇혀 있으면 디시콘 문화처럼 "유행 짤"이 안 생긴다. 인기 스티커 차트·공식 큐레이션 팩·태그 검색이 있어야 공용 짤 문화로 확장된다.
- **데이터:** `sticker_assets.tag_ids[]`(A3 연결), `sticker_usage_daily(sticker_id, used_at_date, used_count)` 집계, `sticker_packs(id, kind in ('official','user'), curator_id|null, public boolean)`.
- **화면:** 스티커 피커에 "차트(일/주/월)" 탭, 공식 팩 우선 노출, 댓글에서 쓴 스티커 → 내 라이브러리에 한 탭으로 저장.
- **브랜치:** `experiment/a10-sticker-chart`
- **채택 기준:** 차트 도입 후 스티커 댓글/리액션 사용량 ≥ 1.5배, 공식 팩 다운로드 누적 ≥ 1000회.
- **폐기 시:** 집계는 유지, 차트 화면만 비공개.

---

## 3. B. 커뮤니티 기능 강화 실험

### B1. 개념글 다층 (실/일/주/월/HOF) — 최우선

- **가설:** 현재 개념글은 단층 `is_hot`이라 회전과 보존이 같이 안 된다. 실시간/일간/주간/월간/명예의 전당 다층은 커뮤니티 활성과 자산 보존을 동시에 만든다.
- **데이터:** `posts.hot_tier text|null`(`realtime|daily|weekly|monthly|hof`), `posts.hot_score_daily/weekly/monthly numeric` 또는 별도 집계 테이블 `post_hot_snapshots(post_id, tier, snapshot_at, score)`.
- **산정:** 실시간=24h 추천량, 일간=00시 마감 후 확정, 주간/월간은 주말/월말 배치, HOF는 월간에서 운영자 수동 승격.
- **화면:** `/hot/realtime`, `/hot/daily`, `/hof`, 게시판별 명예의 전당 탭.
- **브랜치:** `experiment/b1-hot-tiers`
- **채택 기준:** HOF/주간 페이지 도입 후 비실시간 페이지 PV 비중 ≥ 15%, 글 작성자에게 "주간 개념글 등극" 알림 클릭률 ≥ 30%.
- **폐기 시:** `hot_tier` 컬럼은 보존, 화면만 비공개. 기존 `is_hot`은 그대로.

### B2. 사용자 게시판 신청·매니저

- **가설:** 운영자가 모든 게시판을 만들면 롱테일 작품·취향이 다 죽는다. 디시 마갤·아카 채널처럼 사용자 신청제와 매니저 권한이 있어야 모인다.
- **데이터:** `board_requests(id, requester_id, title, slug_proposed, reason, expected_activity, applicant_managers[], status, decided_by, decided_at)`, `board_managers(board_id, user_id, role in ('manager','assistant'), granted_at)`. 게시판 미달 시 `boards.archived_at`.
- **권한 매트릭스:**

| 액션 | 글로벌 관리자 | 게시판 매니저 | 일반 |
|------|---------------|---------------|------|
| 게시판 규칙 편집 | O | O | X |
| 글/댓글 숨김 | O | 자기 게시판만 | X |
| 사용자 정지 | O(전역) | 자기 게시판 한정 | X |
| 매니저 위임 | O | X | X |
| 운영 로그 열람 | O | 자기 게시판만 | X |

- **화면:** "게시판 신청" 폼, 운영자 승인 큐, 매니저 전용 게시판 도구.
- **브랜치:** `experiment/b2-user-boards`
- **채택 기준:** 신청 게시판 중 30일 활성도 미달 비율 ≤ 50%(보관 흐름이 잘 도는지). 매니저 자발 운영 액션 ≥ 1/주.
- **폐기 시:** 신청 큐만 끄고 매니저 권한은 운영자가 수동 위임.

### B3. 어뷰징 방지 자동화 — 최우선

- **가설:** 도배·정치 폭격·신규 가입 봇은 출시 직후 1순위 사고다. 레이트 리밋만으로는 부족하고 가입 후 N일 제한·캡차·도메인 블랙리스트·디바이스 핑거프린트가 함께 가야 한다.
- **데이터:**
  - `account_trust(user_id, score int, computed_at)` — 가입일·이메일 도메인·디바이스·신고 이력으로 산정
  - `signup_rules(min_age_hours_to_post, min_age_hours_to_comment, first_post_review_required boolean)`
  - `email_domain_blocklist(domain)`, `device_fingerprints(user_id, hash, first_seen, last_seen)`
  - `spam_patterns(pattern_kind, payload, action)`
- **검사 흐름:** 글쓰기/댓글/신고/회원가입에 `trust_check` 미들웨어. 의심 시 캡차 강제, 임계 미달 시 운영자 큐 진입.
- **브랜치:** `experiment/b3-anti-abuse`
- **채택 기준:** 자동 차단 정확도(false positive) ≤ 5%, 신규 가입 후 24h 내 도배 사고 ≥ 80% 감소.
- **폐기 시:** 데이터는 보존, 자동 강제만 끈다(분석 자산으로 유지).

### B4. 검색 깊이/필터/저장 검색

- **가설:** 검색 결과에 태그·기간·작성자·추천 임계·스포일러 안전 모드 필터가 없으면 사용자는 외부 구글 검색을 쓴다. 저장 검색은 알림 채널과 묶여 재방문을 만든다.
- **데이터:** `saved_searches(user_id, name, query_json, notify boolean, last_notified_at)`. 검색 인덱스는 Postgres FTS + trigram + 별칭(A7).
- **화면:** 고급 필터 패널, 검색 결과 카드에 게시판·태그 칩, "이 검색 저장" 액션.
- **브랜치:** `experiment/b4-search-deep`
- **채택 기준:** 검색 → 글 클릭 전환 ≥ 12%, 저장 검색 사용자 ≥ 5% (관심 유저 한정).
- **폐기 시:** 고급 필터는 유지, 저장 검색 알림만 끈다.

### B5. 시리즈/연재 묶기

- **가설:** SS·리뷰·정보 시리즈는 시리즈 단위로 묶고 회차로 보는 UX가 표준이다. 시리즈 구독은 알림 빈도가 낮고 정확해서 재방문을 만든다.
- **데이터:** `post_series(id, owner_id, board_id, title, summary, is_finished, public)`, `posts.series_id`, `posts.series_episode`. `series_subscriptions(user_id, series_id, notify_on_new boolean)`.
- **화면:** 글쓰기 시 시리즈 선택/생성, 시리즈 페이지(회차 목록·구독·완결 표시), 글 하단 "다음 화/이전 화".
- **브랜치:** `experiment/b5-series`
- **채택 기준:** SS·창작 게시판 글 중 시리즈 묶음 비율 ≥ 40%, 시리즈 구독자의 다음 화 클릭 ≥ 50%.
- **폐기 시:** 컬럼·테이블은 유지, 시리즈 화면만 비공개.

### B6. 인용 답글(쿠팅) — 최우선

- **가설:** 대댓글이 1단계만 있어도 윗 글/댓글 인용 블록이 있으면 토론 흐름이 안 끊긴다. 원본 삭제 대비 인용 스냅샷이 필요하다.
- **데이터:** 본문/댓글 블록에 `{ type: "quote_post" | "quote_comment", refId, snapshot: { author, text_excerpt, created_at }, link }`.
- **에디터:** "인용" 버튼 → 글 ID 또는 댓글 영구 링크 붙여넣기 → 스냅샷 자동 생성.
- **렌더:** 인용 블록 클릭 시 원본 위치로 이동. 원본 삭제 시 "원본 삭제됨"으로 표시하되 스냅샷 본문 일부는 유지(인용 책임은 원본 작성자에게 있으므로 정책 문서화 필요).
- **브랜치:** `experiment/b6-quote-reply`
- **채택 기준:** 인용 블록 사용 댓글이 댓글 전체의 ≥ 8%, 인용 블록 클릭률 ≥ 20%.
- **폐기 시:** 인용 블록 렌더러는 유지(레거시), 에디터 버튼만 끈다.

### B7. DM/쪽지 (정책 위주)

- **가설:** 쪽지는 어뷰징·그루밍 위험 1순위. 차라리 "초기에는 안 한다"라도 정책을 명시한다.
- **데이터(설계만):** `direct_messages`, `dm_threads`, `dm_restrictions(account_age_min, trust_min, media_allowed)`.
- **정책 초안:**
  - Phase 4 후순위
  - 미성년자/연령 불명 계정에 대한 쪽지 차단
  - 신규 가입자 미디어 첨부 쪽지 금지
  - 대화 보존 7일(신고 시 추가 보존), 신고 사유에 "그루밍 의심" 추가
- **브랜치:** `experiment/b7-dm-policy` — **이 실험은 코드보다 정책 문서가 산출물**이다. 코드 머지는 없을 수 있음.
- **채택 기준:** 정책 문서 리뷰 통과 + 운영자 동의.
- **폐기 시:** 별도 정책 문서로 남기고 구현은 보류.

### B8. 스크랩 컬렉션/폴더

- **가설:** 스크랩이 단순 카운트면 "이번 분기 정리·팬아트 모음" 같은 분류 동기가 안 생긴다. 컬렉션은 프로필 자산이 되고 A9 자기소개 카드와 연결된다.
- **데이터:** `user_collections(id, user_id, name, cover_post_id|null, public, sort_order)`, `collection_items(collection_id, post_id, note, added_at, sort_order)`.
- **화면:** 스크랩 시 컬렉션 선택/생성, 프로필 공개 컬렉션 탭.
- **브랜치:** `experiment/b8-collections`
- **채택 기준:** 스크랩 사용자 중 컬렉션 1개 이상 사용 ≥ 30%, 공개 컬렉션 PV 발생.
- **폐기 시:** 데이터는 보존, 화면 비공개.

### B9. 알림 채널·다이제스트

- **가설:** 알림 이벤트 목록만 풍부하고 "수신 채널/빈도"가 없으면 알림 피로로 끄는 사용자가 많아진다. 다이제스트는 1통으로 묶어 보낸다.
- **데이터:** `notification_preferences(user_id, channel in ('inapp','email','push'), event_kind, enabled, digest in ('immediate','daily','weekly'))`.
- **화면:** 알림 설정에서 이벤트별 채널·다이제스트 조합 선택. 다이제스트 본문은 Live2D 브리핑과 같은 톤 가이드.
- **브랜치:** `experiment/b9-digest`
- **채택 기준:** 다이제스트 도입 후 알림 전체 끄기 비율 감소, 다이제스트 클릭률 ≥ 일반 알림과 동등 이상.
- **폐기 시:** 즉시 알림만 유지.

### B10. SEO/OG 미리보기

- **가설:** 트위터·디스코드 외부 공유가 유입의 큰 축이라 OG 메타데이터 일관성이 트래픽에 직접 영향을 준다.
- **데이터:** OG 이미지 동적 생성 라우트(`/api/og?postId=…`), `posts`의 첫 이미지/대표 이미지 결정 규칙, 게시판/작품 단위 OG.
- **브랜치:** `experiment/b10-og`
- **채택 기준:** 외부 공유 클릭 유입 ≥ 1.3배 (Vercel Analytics 또는 Supabase 로그 기준).
- **폐기 시:** OG 라우트는 유지(거의 무비용), 정책만 단순화.

### B11. 운영 인사이트 대시보드

- **가설:** B2 매니저 흐름이 들어오기 전에 게시판별 활성도·신고 백로그·자동 차단 정확도 대시보드가 있어야 의사결정이 된다.
- **데이터:** 기존 `moderation_logs` + 집계 뷰. `daily_board_stats`, `daily_signup_stats`, `daily_report_stats`.
- **화면:** `/admin/insight` 그래프·표. 매니저는 자기 게시판만.
- **브랜치:** `experiment/b11-ops-insight`
- **채택 기준:** 운영자가 주 1회 이상 사용, 운영 의사결정 회의에서 대시보드 캡처 인용.
- **폐기 시:** 집계는 유지, 화면만 비공개.

### B12. 다크 모드/접근성/NSFW 안전 모드

- **가설:** 야간 사용 비중 큰 오타쿠 정서·장문 SS 읽기·NSFW 회피 등 접근성 옵션은 정착률에 직접 영향을 준다.
- **데이터:** `user_preferences(user_id, theme, font_scale, line_height, nsfw_safe_mode, keyword_mute[])`.
- **화면:** 다크 모드 토글(GNB), NSFW 안전 모드(썸네일 블러 강도·키워드 차단), 키보드 단축키(J/K/R/X).
- **브랜치:** `experiment/b12-a11y`
- **채택 기준:** 다크 모드 채택 ≥ 60%, NSFW 안전 모드 사용자 발생, 키보드 단축키 사용 헤비 유저 발생.
- **폐기 시:** 각 항목 단위로 끈다. 다크 모드·폰트는 거의 항상 채택될 안전 후보.

---

## 4. C. 기존 문서 보강 사항 (실험과 함께 갱신할 부분)

각 실험이 채택되면 아래 정식 문서에 내용을 흡수한다.

| 채택 시 흡수 대상 | 흡수해야 할 항목 |
|------------------|------------------|
| `plan.md` 2장 | 제품 정체성 문구를 "쿠르·오시 타입 확장·2차 창작·동인 행사·디시콘 문화" 포함으로 갱신 (A1·A2·A5·A6·A10 채택 후) |
| `community.md` 4장 | 댓글 인용 답글·댓글 추천/비추천 정책 확정 (B6 채택 후) |
| `community.md` 5장 | 개념글 다층 (B1 채택 후) |
| `community.md` 7장 | 검색 필터·별칭·저장 검색 (A7·B4 채택 후) |
| `community.md` 8장 | 호칭 표시 (A8 채택 후) |
| `community.md` 새 장 | 사용자 게시판 신청·매니저 권한 매트릭스 (B2 채택 후) |
| `character-community.md` 7장 | 스포일러 가드 — 작성자가 단 태그/말머리 기반 짧은 경고 (A4 채택 후) |
| `oshi-badges.md` 1장 | oshi_type 확장 (A2 채택 후) |
| `oshi-badges.md` 배지 목록 | 활동 다양성/품질 배지 추가 (A8과 묶음) |
| `oshi-badges.md` 새 장 | 자기소개 카드 (A9 채택 후) |
| `news-release-calendar.md` 2장 | 분기(쿠르) 라인업 화면 (A1 채택 후) |
| `news-release-calendar.md` 4장 | 신작 방영 종료/완결 상태 (A1·A5 회고와 묶음) |
| `news-release-calendar.md` 새 장 | 동인 행사/굿즈 일정 (A6 채택 후) |
| `editor-media-stickers.md` 6장 | 스티커 차트·공식 팩 (A10 채택 후) |
| `editor-media-stickers.md` 새 장 | 인용 블록 (B6 채택 후), 스포일러 인라인 블록 (A4 채택 후) |
| `moderation-notifications.md` 4장 | 권한 매트릭스 (B2 채택 후) |
| `moderation-notifications.md` 새 장 | 어뷰징 방지 자동화 (B3 채택 후), DM 정책 (B7 채택 후) |
| `moderation-notifications.md` 6장 | 알림 채널·다이제스트 (B9 채택 후) |
| `screen-acceptance.md` | 분기 라인업·검색 결과·시리즈·컬렉션·자기소개 카드·갤러리 뷰 화면 (각 실험 채택 후) |
| `data-model.md` | 신규 테이블·컬럼·enum 항목 (모든 채택 실험) |

---

## 5. 우선순위 그룹 정리

### P1 — 지금 Phase 2 안에 시도

- A3 통합 태그 시스템 (다른 모든 오타쿠 기능의 근간)
- A4 스포일러 표시 (작성자 태그/말머리, 단순 범위)
- B1 개념글 다층 (구조 비용이 늦을수록 큼)
- B3 어뷰징 방지 (출시 직전이 가장 위험)
- B6 인용 답글 (에디터 확장 묶음)

### P2 — Phase 3 초입 (덕질 허브 고도화와 함께)

- A1 쿠르 라인업 (캘린더 묶음)
- A2 오시 타입 확장 (오시·배지 묶음)
- A5 2차 창작 (게시판 분류·갤러리)
- A7 작품명 동의어 매핑
- A9 자기소개 카드
- B4 검색 깊이
- B5 시리즈/연재
- B8 스크랩 컬렉션

### P3 — Phase 3 후반~Phase 4

- A6 동인 행사·굿즈
- A8 호칭/평판
- A10 스티커 차트
- B2 사용자 게시판 신청
- B7 DM 정책
- B9 알림 다이제스트
- B10 SEO/OG
- B11 운영 대시보드
- B12 접근성

---

## 6. 실험 사이클 권장 흐름

1. 항목 한 개를 고르고 브랜치를 만든 뒤, `docs/plans/checklist.md`와 관련 도메인 문서에 착수 사실을 남긴다.
2. `experiment/<id>-<slug>` 브랜치를 판다.
3. 마이그레이션은 `db/experiment/<id>-*.sql`에 둔다.
4. 가능하면 기능 플래그(`feature_flags`) 뒤로 숨긴다.
5. 미리보기에서 자신 + 동료 1~2명이 사용한다.
6. "채택 기준"과 대조한다. 모호하면 14일 사용 데이터까지 기다린다.
7. **채택:** 본 문서에 "채택됨 · 날짜"로 표시 → 정식 도메인 문서로 내용 이전 → `db/`로 마이그레이션 이동 → main 머지 → 본 문서 항목은 한 줄 링크만 남긴다.
8. **폐기:** 본 문서에 "폐기됨 · 날짜 · 이유"로 표시 → 브랜치 삭제 또는 `archive/experiment/<id>` 태그로 보존 → 추후 재시도 후세를 위해 폐기 이유 1~3줄 명시.
