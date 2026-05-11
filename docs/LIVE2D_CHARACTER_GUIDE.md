# Live2D/캐릭터 백엔드 연동 정리

백엔드 개발자가 바로 API/DB를 설계할 수 있도록, 이 문서는 아래 3가지를 중심으로 정리합니다.

- 사용 라이브러리/엔진 버전
- 캐릭터 데이터 스키마 + 현재 내장 캐릭터 실데이터
- 업로드 처리 규칙(검증, 자동 매핑, 저장 시 고려사항)

## 1) 현재 사용 버전

기준 파일: `package.json`

- Next.js: `^16.2.4`
- React: `^19.2.5`
- PixiJS: `^8.18.1`
- Live2D 렌더러: `@naari3/pixi-live2d-display@^1.2.5`
- Zustand: `^5.0.12`
- ZIP 파서: `jszip@^3.10.1`

참고:
- Live2D 코어 스크립트(`live2dcubismcore.min.js`)는 `app/layout.tsx`에서 로드해 사용합니다.
- 실제 모델 로더는 `Live2DModel.from(modelPath)` 형태로 동작합니다.

---

## 2) 캐릭터 데이터 스키마(백엔드 저장 단위)

기준 타입: `types/character.ts` 의 `CharacterProfile`

핵심 필드:
- `id`: 캐릭터 고유 ID
- `name`: 캐릭터 이름
- `description`: 캐릭터 소개
- `modelPath`: model3.json 접근 경로(현재는 blob 또는 정적 경로)
- `thumbnailUrl?`: 썸네일 URL(옵션)
- `expressionMap`: 감정 키(`idle/happy/sad/...`) -> exp3 ID
- `motionMap`: 액션 키(`tap_head/tap_body/...`) -> `{ group, index }`
- `scenarioMap`: 상황 키(`login/logout/notification/...`) -> `{ expressionId, motion }`
- `hitAreaMap`: 히트영역 ID -> 액션 키
- `outfits`: 파츠 토글 그룹
- `morphSliders`: 실시간 조절 파라미터 목록
- `parameterPresets`: 파라미터 프리셋 목록
- `sounds`: 감정/액션별 사운드 URL
- `dialogues`: 감정/액션별 대사 배열
- `defaultView`: 기본 뷰 설정 `{ scale, x, y }`
- `blobUrls`: 런타임 URL revoke용 목록(현재 프론트 메모리용)
- `isBuiltIn`: 내장 캐릭터 여부
- `createdAt`: 생성 시각(epoch ms)

감정 세트 운영 기준:
- `ALL_EMOTIONS` 8종은 내부 호환/고급 매핑 후보입니다.
- 제품 표면에서 우선 노출하는 기본 감정은 `idle/happy/sad/surprised/angry` 입니다.
- `shy/love/wink`는 선택 감정이며, 크리에이터나 업로드 모델이 반드시 대응해야 하는 필수 슬롯이 아닙니다.
- 런타임에서 지원하지 않는 감정을 요청하면 `happy` 또는 `idle` 같은 가까운 기본 감정으로 폴백합니다.
- 스티커는 Live2D 표정 지원 여부와 분리된 별도 에셋입니다. 사용자가 직접 등록하거나 AI 생성 플로우로 만든 스티커만 커뮤니티 피커에 노출합니다.

상황별 매핑 운영 기준:
- 관리 화면의 기본 매핑은 감정/액션을 따로 등록하지 않고, `CHARACTER_SCENARIOS`에 정의된 상황별로 표정과 모션을 한 번에 고릅니다.
- 현재 기본 상황은 로그인, 로그아웃, 알림 공통, 글쓰기 중, 기본 복귀입니다.
- 댓글/답글/리액션/팔로우/시스템 알림은 말풍선 텍스트와 추후 사운드는 분리하되, Live2D 모션은 `notification` 공통 매핑을 사용합니다.
- 캐릭터가 처음 등록되거나 예전 저장 데이터에 `scenarioMap`이 없으면 `expressionMap`/`motionMap` 기반 추천 매핑을 자동으로 채웁니다.
- 모델에 맞는 표정이나 모션이 없으면 비워둘 수 있고, 런타임은 기존 `idle`/기본 상태로 폴백합니다.
- 개별 `expressionMap`/`motionMap`은 호환성과 세밀 조정을 위한 고급 설정으로 유지합니다.

백엔드에서 특히 중요한 부분:
- `dialogues`는 `string[]` 배열이라 다국어/버전 관리 테이블 분리를 고려하는 게 좋습니다.
- `modelPath`, `sounds.*`, `thumbnailUrl`은 결국 스토리지 URL로 귀결됩니다.
- `blobUrls`는 현재 프론트 임시 메모리용 필드라 서버 영속화 대상에서는 제외해도 됩니다.

---

## 3) 현재 내장 캐릭터 데이터

기준 파일: `lib/live2d/defaultProfile.ts`

### A. `builtin-pichu` (피츄)
- 이름/소개: `피츄`, "가볍게 사용할 수 있는 기본 내장 캐릭터"
- 모델: `/live2d/Pichu/Pichu.model3.json`
- 기본 뷰: `scale=0.22`, `x=-63`, `y=15`
- 감정 표정 매핑:
  - `happy=Happy`, `sad=Sad`, `angry=Angry`, `surprised=Shock`
  - `idle/shy/love/wink`는 `null`(미사용)
- 모션/히트영역/의상/모핑:
  - `motionMap` 비어있음
  - `hitAreaMap` 비어있음
  - `outfits`, `morphSliders`, `parameterPresets` 비어있음
- 대사:
  - 감정: happy/sad/angry/surprised 일부만 존재
  - 액션: `greet`, `typing`만 존재

### B. `builtin-mao-pro` (마오쨩 샘플)
- 이름/소개: `마오쨩 (샘플)`, Cubism 샘플 기반
- 모델: `/live2d/mao_pro/mao_pro.model3.json`
- 기본 뷰: `scale=0.09`, `x=-96`, `y=-55`
- 감정 표정 매핑:
  - `idle=exp_01`, `happy=exp_02`, ..., `wink=exp_08` (8개 감정 모두 존재)
- 모션 매핑:
  - `idle -> Idle:0`
  - `tap_head/tap_body/tap_other/greet/special/typing`도 각각 group/index로 매핑됨
- 히트영역:
  - `HitAreaHead -> tap_head`
  - `HitAreaBody -> tap_body`
- 의상/파츠:
  - `arms` 그룹(기본/왼팔/오른팔/양팔) 파츠 토글 구성
- 모핑/프리셋:
  - 볼홍조/눈웃음/입꼬리/입벌림/눈썹/가슴 등 슬라이더 정의
  - `츤데레`, `얀데레`, `키라키라`, `리셋` 프리셋 포함
- 대사:
  - 감정별 대사 세트 존재
  - 액션별 대사 세트 존재

---

## 4) 업로드 처리 흐름 (현재 프론트 구현)

기준 파일:
- `components/character/CharacterUploader.tsx`
- `lib/live2d/modelPackage.ts`
- `lib/live2d/autoMap.ts`

처리 순서:
1. ZIP 업로드
- `installModelFromZip(file)` 실행

2. ZIP 검증/분석
- `*.model3.json` 필수(여러 개면 실패)
- `model3.json`이 참조한 파일만 채택(불필요 파일 버림)
- 확장자 화이트리스트 검사
  - 허용: `.json`, `.moc3`, `.png`, `.wav`, `.mp3`, `.ogg`, `.m4a`
- 용량 제한 검사
  - ZIP 총량: 80MB
  - moc3: 15MB
  - 텍스처 1개: 16MB
  - 텍스처 개수: 8개
  - 표정 64개, 모션 256개 제한
- 파일 시그니처 검사
  - moc3: `"MOC3"` 매직 검사
  - png: PNG 헤더 검사

3. 로딩 가능 포맷으로 재작성
- 참조 경로를 blob/data URL로 치환
- 최종 `modelUrl`(재작성된 model3.json URL) 생성

4. 자동 매핑(`autoMap`)
- expression/motion/hitArea/outfit/morph/preset을 휴리스틱으로 추정
- UI에서 이름/소개를 입력받아 `CharacterProfile` 생성

5. 라이브러리 등록
- 현재는 Zustand store에만 등록(영속화 없음)
- 새로고침 시 업로드 캐릭터는 사라짐

---

## 5) 백엔드 구현 시 바로 필요한 포인트

1) 영속화 대상
- `CharacterProfile` 본문(단, `blobUrls` 제외 권장)
- 모델 파일 원본(또는 재작성 결과) + 텍스처/오디오 파일
- 캐릭터별 권한(소유자, 공개 범위, 수정 권한)

2) 권장 저장 구조(개념)
- `characters` (메타 + 매핑 JSON)
- `character_assets` (model/texture/audio/thumbnail 파일 메타)
- `character_dialogues` (필요 시 분리: locale, emotion/action, line)

3) 프론트와 API 계약 시 주의
- `expressionMap`은 `null` 허용 필드가 있어야 함
- `motionMap`/`hitAreaMap`은 모델별 편차가 커서 유효성 검사 완화 필요
- `defaultView`는 사용자별 저장(개인화)과 캐릭터 기본값 저장을 분리할지 결정 필요
- 관리 화면의 매핑 UI는 `model3.json`을 다시 읽어 실제 Expressions/Motions/HitAreas 후보만 선택지로 보여준다. DB에는 최종 `scenarioMap`/고급 매핑만 저장하고, 후보 목록은 모델 파일에서 재구성한다.
- 매핑 UI는 파일명만 보고 판단하지 않도록 상황 `[미리보기]`, 고급 표정 `[보기]`, 고급 모션 `[재생]`, 미리보기 클릭 기반 HitArea 로그를 제공한다.
- 대사는 전역 기본 반응과 페이지별 입장 대사를 분리한다. 캐릭터 관리 화면에는 핵심 감정/액션의 기본 반응만 두고, 페이지별 대사는 별도 프리셋 편집으로 확장한다.

4) 업로드 API 설계 팁
- 서버에서도 동일 검증 규칙(확장자/용량/시그니처) 재검증 권장
- 업로드 직후 분석 결과(표정 수, 모션 수, warning 목록)를 응답하면 프론트 UX가 좋아짐

---

## 6) 현재 상태 요약 (백엔드 기준)

- 지금은 캐릭터 라이브러리와 업로드 결과가 **프론트 메모리 상태**입니다.
- 백엔드가 들어오면 `CharacterProfile`을 기준으로 DB/스토리지로 이관하면 됩니다.
- 특히 "대사/사운드/매핑/defaultView"는 이미 구조화되어 있어 API 스키마로 옮기기 쉽습니다.

