# 리텐션 — 연속 출석 Streak

## 1. 결론

씹덕 사용자가 "매일 한 번 들어와야 하는 이유"를 만든다. 핵심은 **연속 출석 일수(current_streak)** 단 한 가지 숫자다. 끊기면 0으로 리셋되므로 손실 회피 동기가 일관되게 작동하고, 누적이 올라갈수록 더 들어오기 쉬워진다.

이미 구축된 `daily_missions` / `user_mission_progress`의 출석 미션을 그대로 활용한다. Streak는 출석을 대체하지 않고 **상위 레이어**로 얹는다.

라우트:

- `/missions`에 Streak 카드 신규 추가
- `/profile`과 공개 프로필(`/user/[handle]`)에 연속 출석 배지/호칭 노출

## 2. 제품 목적

- 사용자가 매일 1회는 자동으로 사이트에 들어오게 만든다.
- 끊긴 다음 날의 "다시 시작" 회복 동기를 만든다 (이정표가 재진입 트리거).
- 누적 출석이 곧 자기 정체성이 되도록 호칭/배지로 시각화한다.

장기적으로는 Streak가 **시즌패스(Phase 10)**, **호칭/평판(experiments A8)**, **위클리 미션 확장**의 기반 신호로 쓰인다.

## 3. 사용자 흐름

### 3.1 출석 체크인

1. 로그인 후 첫 화면 진입 시 클라이언트가 `checkInStreak()`를 호출한다.
2. 서버는 `last_check_in_date`와 오늘 날짜(로컬 KST 기준 `YYYY-MM-DD`)를 비교한다.
3. 분기에 따라 카운터를 갱신한다 (4장 참고).
4. 갱신 결과를 응답으로 받고, **이정표 도달이면 보상 모달**을 띄운다.
5. 동일 일자 두 번째 호출부터는 멱등 (변경 없음).

기존 미션 시스템의 출석(`attendance`) 미션은 그대로 둔다. Streak 체크인이 호출되면 내부적으로 `bumpMissionProgress(userId, "attendance")`도 함께 실행해 미션 보드와 동기화한다.

### 3.2 끊김 처리

- `today - last_check_in_date == 1` → 연속, `current_streak += 1`
- `today - last_check_in_date == 0` → 오늘 이미 체크인, 무시
- `today - last_check_in_date >= 2` → 끊김, `current_streak = 1` 으로 재시작
- 끊긴 직후 첫 진입 시 안내 모달 표시: "어제 빠졌어요. 오늘부터 다시 시작!"

방어권(streak freeze) 아이템은 1차 범위 밖이다. `user_streaks.streak_freeze_count` 컬럼은 만들어 두되 사용 로직은 후속 작업으로 분리한다.

### 3.3 이정표 보상

| 일수 | 호칭 | 배지 | 희귀도 |
|------|------|------|--------|
| 3 | 사흘짜리 다짐 | `streak_3` | common |
| 7 | 일주일의 약속 | `streak_7` | common |
| 14 | 본방사수 14일 | `streak_14` | rare |
| 30 | 한 달 만근개근 | `streak_30` | rare |
| 50 | 안방 출퇴근러 | `streak_50` | epic |
| 100 | 100일 회차 정주행 | `streak_100` | epic |
| 365 | 1년차 고인물 | `streak_365` | legendary |

호칭은 사용자가 셀렉터로 장착/해제할 수 있다. 배지는 영구 보존되며 끊겨도 회수하지 않는다 (한 번 도달한 이정표는 자산이다).

### 3.4 UI

`/missions` 상단 카드:

```
┌──────────────────────────────────────────┐
│  연속 출석                                │
│                                          │
│       🔥  12  일째                        │
│                                          │
│  ●●●●●●●●●●●●○○                          │  ← 다음 이정표(14)까지 12/14
│  다음: 본방사수 14일 (D-2)               │
│  최장 기록: 27일                         │
└──────────────────────────────────────────┘
```

추가 노출 위치:

- `/profile` "오시 & 배지" 탭에 미니 위젯(현재 streak + 최장 streak)
- `/user/[handle]` 공개 프로필에 streak 배지(획득한 것만 그리드 표시)
- 닉네임 옆 작은 🔥N 칩 (선택, 사용자가 OFF 가능)

## 4. 데이터 모델

### 4.1 신규 테이블

```sql
-- user_streaks: 사용자별 연속 출석 상태
create table public.user_streaks (
  user_id              uuid primary key references auth.users(id) on delete cascade,
  current_streak       int not null default 0,
  longest_streak       int not null default 0,
  last_check_in_date   date,                       -- KST 기준 YYYY-MM-DD
  total_check_ins      int not null default 0,
  streak_freeze_count  int not null default 0,    -- 후속 작업용 (현재 미사용)
  updated_at           timestamptz not null default now()
);

create index user_streaks_current_idx on public.user_streaks (current_streak desc);
create index user_streaks_longest_idx on public.user_streaks (longest_streak desc);
```

배지는 기존 `badges` / `user_badges` 테이블을 그대로 쓴다. 호칭은 별도 테이블 없이 `badges.id`를 그대로 호칭 키로 사용한다 (A8 호칭/평판 실험이 채택되면 분리한다).

### 4.2 배지 시드 (badges 테이블 insert)

```sql
insert into public.badges (id, name, description, icon, rarity, condition_type, condition_value) values
  ('streak_3',   '사흘짜리 다짐',     '연속 출석 3일 달성',   '🔥', 'common',    'streak_days', 3),
  ('streak_7',   '일주일의 약속',     '연속 출석 7일 달성',   '🔥', 'common',    'streak_days', 7),
  ('streak_14',  '본방사수 14일',     '연속 출석 14일 달성',  '🔥', 'rare',      'streak_days', 14),
  ('streak_30',  '한 달 만근개근',    '연속 출석 30일 달성',  '🔥', 'rare',      'streak_days', 30),
  ('streak_50',  '안방 출퇴근러',     '연속 출석 50일 달성',  '🔥', 'epic',      'streak_days', 50),
  ('streak_100', '100일 회차 정주행', '연속 출석 100일 달성', '🔥', 'epic',      'streak_days', 100),
  ('streak_365', '1년차 고인물',      '연속 출석 365일 달성', '🔥', 'legendary', 'streak_days', 365)
on conflict (id) do nothing;
```

`condition_type = 'streak_days'`는 신규다. 기존 배지 체크 로직(`checkAndGrantBadges`)에 streak_days 분기를 추가한다.

### 4.3 RLS

```sql
alter table public.user_streaks enable row level security;

create policy user_streaks_select_public
  on public.user_streaks for select
  using (true);  -- 공개 프로필에서 다른 유저 streak 노출

create policy user_streaks_insert_self
  on public.user_streaks for insert
  with check (auth.uid() = user_id);

create policy user_streaks_update_self
  on public.user_streaks for update
  using (auth.uid() = user_id);
```

읽기는 전체 공개(공개 프로필에서 노출), 쓰기는 본인만.

## 5. 핵심 로직

### 5.1 체크인 함수 (Postgres RPC)

```sql
create or replace function public.check_in_streak()
returns table (
  current_streak int,
  longest_streak int,
  last_check_in_date date,
  total_check_ins int,
  milestone_reached int        -- 이번 호출로 달성한 이정표 (없으면 NULL)
)
language plpgsql
security definer
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_existing public.user_streaks;
  v_milestone int := null;
begin
  if v_user_id is null then
    raise exception 'auth required';
  end if;

  select * into v_existing from public.user_streaks where user_id = v_user_id;

  if v_existing is null then
    insert into public.user_streaks (user_id, current_streak, longest_streak, last_check_in_date, total_check_ins)
    values (v_user_id, 1, 1, v_today, 1);
    v_milestone := 1;  -- 첫 체크인도 이정표 후보로 본다
  elsif v_existing.last_check_in_date = v_today then
    -- 오늘 이미 체크인, 변경 없음
    null;
  elsif v_existing.last_check_in_date = v_today - 1 then
    -- 연속
    update public.user_streaks
      set current_streak = v_existing.current_streak + 1,
          longest_streak = greatest(v_existing.longest_streak, v_existing.current_streak + 1),
          last_check_in_date = v_today,
          total_check_ins = v_existing.total_check_ins + 1,
          updated_at = now()
      where user_id = v_user_id;
    v_milestone := v_existing.current_streak + 1;
  else
    -- 끊김, 1일로 재시작
    update public.user_streaks
      set current_streak = 1,
          last_check_in_date = v_today,
          total_check_ins = v_existing.total_check_ins + 1,
          updated_at = now()
      where user_id = v_user_id;
    v_milestone := 1;
  end if;

  return query
    select s.current_streak, s.longest_streak, s.last_check_in_date, s.total_check_ins, v_milestone
    from public.user_streaks s where s.user_id = v_user_id;
end;
$$;

grant execute on function public.check_in_streak() to authenticated;
```

타임존은 KST(Asia/Seoul) 고정. UTC 자정 기준이면 한국 사용자에게 직관과 어긋난다.

### 5.2 클라이언트 훅

```ts
// lib/community/streak.ts
export type StreakCheckInResult = {
  currentStreak: number;
  longestStreak: number;
  lastCheckInDate: string | null;
  totalCheckIns: number;
  milestoneReached: number | null;   // 이번 호출에서 새로 도달한 일수 (있으면 보상 트리거)
};

export async function checkInStreak(): Promise<StreakCheckInResult | null>;
export async function fetchStreak(userId: string): Promise<StreakState | null>;
```

호출 위치:

- `useAuthUser` 훅에서 인증 확인 후 1회 호출 (앱 부팅 시)
- 세션당 1회 가드 (sessionStorage 키 `streak_checked_in_YYYY-MM-DD`)
- 호출 후 `milestoneReached`가 `MILESTONES` 배열에 포함되면 보상 모달 띄움

`bumpMissionProgress(userId, "attendance")`도 같은 함수 안에서 함께 호출해 미션 보드 동기화.

### 5.3 배지 자동 지급

`checkAndGrantBadges(userId)`에 streak 분기 추가:

```ts
// 기존 패턴
const STREAK_MILESTONES: Array<{ days: number; badgeId: string }> = [
  { days: 3,   badgeId: "streak_3" },
  { days: 7,   badgeId: "streak_7" },
  { days: 14,  badgeId: "streak_14" },
  { days: 30,  badgeId: "streak_30" },
  { days: 50,  badgeId: "streak_50" },
  { days: 100, badgeId: "streak_100" },
  { days: 365, badgeId: "streak_365" },
];

// streak가 임계값 이상이면 미획득 배지를 모두 지급
```

이정표 도달 모달은 클라이언트에서 띄우되, 실제 배지 row insert는 RPC 또는 동일 함수 안에서 처리. 클라이언트 임의 호출로 인한 어뷰징을 막기 위해 배지 insert도 SQL 함수(`grant_streak_badges()`)로 감싼다.

## 6. 어뷰징 방지

| 위험 | 대응 |
|------|------|
| 클라이언트 임의 호출로 streak 증가 | RPC `check_in_streak()`만 노출, 컬럼 직접 update 금지 (RLS update 정책에서 streak 컬럼 변경은 service_role만 허용하는 게 이상적이나 1차에는 RPC 강제 권고로 둔다) |
| 미래 날짜로 시계 조작 | 서버 측 `now() at time zone 'Asia/Seoul'` 사용으로 차단 |
| 멀티 계정 출석 | 1차에서는 막지 않는다 (가입 자체에 어뷰징 방지가 별도로 있어야 함, 어뷰징 방지 자동화 B3 의존) |
| 봇 자동 출석 | 1차에서는 막지 않는다. 위클리/시즌패스 단계에서 캡차/디바이스 핑거프린트 도입 검토 |

## 7. 비로그인 사용자

Streak는 로그인 사용자 전용 기능이다. 비로그인 상태에서는 `/missions`에서 미션 카드 위에 "로그인하고 연속 출석을 시작해보세요" 안내 카드만 보여준다.

이 안내 카드는 자체로 약한 가입 전환 도구가 된다 ("12일째 연속 출석" 같은 가짜 미리보기 + CTA).

## 8. 화면 완료 기준

### `/missions`

- [ ] 페이지 최상단에 Streak 카드(현재 일수, 최장 기록, 다음 이정표까지의 진행)
- [ ] 로그인 시 자동 체크인 호출, 세션당 1회 가드
- [ ] 이정표 도달 시 보상 모달(획득 배지/호칭 + 공유 CTA)
- [ ] 끊긴 다음 첫 진입 시 회복 안내 모달

### `/profile`

- [ ] "오시 & 배지" 탭에 streak 미니 위젯
- [ ] 획득한 streak 배지를 기존 배지 그리드에 자연스럽게 노출

### `/user/[handle]`

- [ ] 공개 프로필 헤더에 현재 streak 칩 노출 (사용자 설정으로 숨김 가능)
- [ ] 획득 streak 배지 그리드 노출

### 보상 모달

- [ ] 배지 일러스트(이모지) + 호칭 텍스트 + "공유하기" 버튼
- [ ] 공유 이미지에 streak 일수, 호칭, 닉네임 포함
- [ ] 모달 닫기 시 다시 안 뜨도록 `seen_streak_milestones` 로컬 저장

## 9. 성공 기준

도입 후 4주 측정:

- DAU/MAU 비율 ≥ 20% (도입 전 대비 5%p 이상 상승)
- 7일 이상 streak 보유 유저 비율 ≥ 15%
- 이정표 도달 후 7일 유지 비율 ≥ 60% (사흘 보너스 받고 끊기지 않는 비율)
- 끊긴 다음 날 재진입률 ≥ 30%
- streak 배지 공유 발생 ≥ 5% (이정표 도달자 기준)

## 10. 구현 우선순위

### 1차 (이번 작업)

1. `db/2026-MM-DD-user-streaks.sql` 마이그레이션 작성 + 적용 (Supabase MCP `apply_migration`)
2. `check_in_streak()` RPC + RLS 정책
3. 배지 7종 시드 + `condition_type = 'streak_days'` 처리 추가
4. `lib/community/streak.ts` 클라이언트 헬퍼
5. `/missions` 상단 Streak 카드
6. 로그인 부팅 시 자동 체크인 (`useAuthUser` 훅 연동)
7. 이정표 보상 모달
8. 프로필/공개 프로필 streak 배지 노출

### 2차 (후속 분리)

- 닉네임 옆 🔥 칩 노출 + 사용자 설정 ON/OFF
- 끊김 방어권(streak freeze) 발행/사용 로직
- 위클리 미션 (`weekly_missions` 테이블 신규)
- 시즌패스 연동 (Phase 10)
- 친구 streak 랭킹 (시즌 한정)

## 11. 다른 문서와의 연결

- [oshi-badges.md](./oshi-badges.md): 배지 시스템을 재사용한다. 채택 후 초기 배지 목록에 streak 7종을 합산한다.
- [moderation-notifications.md](./moderation-notifications.md): 이정표 도달 알림은 별도 type 추가하지 않고 기존 `SYSTEM` 알림에 묶는다. 끊김 다음 날 재진입 유도 푸시는 알림 다이제스트(B9) 채택 후 묶음으로 보낸다.
- [otaku-experiments.md](./otaku-experiments.md) A8 호칭/평판: streak 호칭은 A8이 정식 채택되면 `user_titles`로 이관한다. 그 전까지는 `badges.id`를 호칭 키로 임시 사용.
- [planner-brief.md](../planner-brief.md): 리텐션 섹션 갱신 시 streak를 핵심 일일 루프로 등록.
