# 오시 등록 & 배지 시스템

이 문서는 오시(推し) 등록과 활동 배지 기능의 설계 기준이다. 두 기능은 독립적으로도 동작하지만 배지의 일부가 오시 등록 행동을 조건으로 사용하므로 같은 문서에서 다룬다.

## 1. 오시 등록

### 목적과 사용자 흐름

오타쿠 정체성의 핵심은 "무엇을 좋아하는가"다. 현재 프로필은 닉네임과 아바타만 있어 서로를 구분하는 수단이 없다. 오시 등록은 프로필에 "내 최애 작품/캐릭터"를 공개해 팔로우 이유를 만들고, 같은 오시를 가진 유저 간 연결 고리를 만드는 기능이다.

**사용자 흐름:**
1. `/profile` → "오시 & 배지" 탭 진입
2. [오시 등록] 버튼 클릭 → 폼에서 이름, 타입, 이미지 URL, 한 줄 설명 입력
3. 최대 5개 등록, 1번이 메인 오시(프로필 상단 강조)
4. 등록 즉시 배지 조건 자동 확인 → 조건 충족 시 배지 지급
5. 내 프로필 공개 페이지(미구현, Phase 3)에서 다른 유저가 내 오시 목록을 볼 수 있음

### 데이터 모델

```sql
-- oshi_registrations: 사용자가 등록한 최애 목록
create table public.oshi_registrations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  rank        smallint not null check (rank between 1 and 5),  -- 1 = 메인 오시
  title       text not null,        -- 작품/캐릭터 이름 (자유 입력)
  oshi_type   text not null check (oshi_type in ('anime','manga','game','character','other')),
  image_url   text,                 -- 커버 이미지 (선택)
  description text,                 -- 한 줄 설명 (선택, max 100자)
  is_public   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, rank)
);
```

### 제약

- 유저당 최대 5개 (rank 1~5)
- title 최대 50자, description 최대 100자
- image_url 은 외부 링크 허용 (Phase 3에서 업로드로 전환 검토)
- rank 변경(순서 바꾸기)은 허용

---

## 2. 배지 시스템

### 목적

배지는 "이 사람이 어떤 활동을 해왔는가"를 한눈에 보여주는 프로필 장식이다. 포인트·레벨이 아닌 이정표 수집 방식으로, 수집 욕구는 자극하되 점수 인플레이션은 없다.

### 데이터 모델

```sql
-- badges: 전체 배지 정의 (운영자가 관리)
create table public.badges (
  id             text primary key,   -- 'first_oshi', 'hot_post_author', ...
  name           text not null,      -- 표시 이름 (한국어)
  description    text not null,      -- 획득 조건 설명
  icon           text not null,      -- 이모지 또는 이미지 키
  rarity         text not null check (rarity in ('common','rare','epic','legendary')),
  condition_type text not null,      -- 'oshi_count', 'post_count', 'hot_post', ...
  condition_value integer not null default 1,
  created_at     timestamptz not null default now()
);

-- user_badges: 유저가 획득한 배지 이력
create table public.user_badges (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  badge_id   text not null references public.badges(id),
  earned_at  timestamptz not null default now(),
  unique (user_id, badge_id)
);
```

### 초기 배지 목록

| badge_id | 이름 | 조건 | 희귀도 |
|----------|------|------|--------|
| `first_oshi` | 입덕 완료 | 오시 첫 등록 | common |
| `oshi_trio` | 삼각편대 | 오시 3개 등록 | common |
| `oshi_max` | 덕후의 증명 | 오시 5개 등록 | rare |
| `first_post` | 첫 발자국 | 게시글 첫 작성 | common |
| `first_comment` | 첫 마디 | 댓글 첫 작성 | common |
| `hot_post_author` | 개념글 달성 | 내 글 개념글 등극 1회 | rare |
| `hot_post_3` | 개념글 3회 | 내 글 개념글 등극 3회 | epic |
| `follow_start` | 인연의 시작 | 팔로우 5명 이상 | common |
| `early_bird` | 초기 멤버 | 가입 후 1주일 이내 오시 등록 | rare |

### 배지 지급 시점

배지 지급은 클라이언트에서 직접 API를 호출해 부여한다. Supabase Edge Function이 없으므로 초기에는 아래 행동 직후 프론트에서 `checkAndGrantBadges(userId)` RPC를 호출하는 방식으로 구현한다.

- 오시 등록/삭제 후
- 게시글 작성 후 (Phase 2 완료 시 연동)
- 댓글 작성 후 (Phase 2 완료 시 연동)
- 개념글 등극 알림 수신 후 (알림 훅 연동 시)

### RLS

- `badges`: 전체 공개 읽기
- `user_badges`: 본인만 write, 읽기는 전체 공개 (다른 유저 프로필에서도 배지 목록 노출)
- `oshi_registrations`: 본인만 write, `is_public=true` 인 행은 전체 읽기

---

## 3. 프로필 탭 구성

"오시 & 배지" 탭을 `/profile`에 추가한다.

### 탭 레이아웃

```
[ 오시 등록 ]                                    [ 내 배지 ]
──────────────────────────────────────────────
  #1 메인 오시 (강조 카드)                        ★ 획득: 3 / 9
  [이미지] 작품명                                  [배지1] [배지2] [배지3]
  타입 · 한 줄 설명                                [미획득] [미획득] ...
  [편집] [삭제]
  
  #2 ~ #5 (소형 카드)
  [+ 오시 추가]
```

### 오시 등록 폼

- title: text input (max 50)
- oshi_type: select (애니/만화/게임/캐릭터/기타)
- image_url: text input (URL)
- description: textarea (max 100)
- is_public: checkbox

---

## 4. 완료 기준

- [ ] `oshi_registrations`, `badges`, `user_badges` 테이블 생성 및 RLS 적용
- [ ] 초기 배지 9종 seed 데이터 삽입
- [ ] `lib/supabase/oshi.ts`: CRUD 함수
- [ ] `lib/supabase/badges.ts`: 조회 + `checkAndGrantBadges` 함수
- [ ] `/profile` → "오시 & 배지" 탭 UI 구현
- [ ] 오시 등록/삭제 후 배지 자동 체크 연동
- [ ] `types/community.ts` 타입 추가

## 5. 미래 확장

- 오시 등록 기반 "같은 오시 팔로워 추천" (Phase 3)
- 오시 게시판 자동 팔로우 제안 (뉴스/신작 캘린더와 연동)
- 특정 배지 보유자 전용 게시판/말머리 (수익화 연계)
- 시즌 한정 배지: 이번 시즌 개근, 신작 첫 감상 등 (캘린더 연동)
- 배지 공개 프로필 표시 (Phase 3)
