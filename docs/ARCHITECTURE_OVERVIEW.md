# 10duck 구조/역할 가이드

이 문서는 팀원이 빠르게 프로젝트를 파악할 수 있도록, 페이지/컴포넌트/상태 관리 코드의 역할을 정리한 온보딩 문서입니다.

## 1) 프로젝트 한 줄 요약

- Next.js(App Router) 기반 웹 앱
- 우측 하단에 Live2D 캐릭터를 항상 렌더링
- 캐릭터 라이브러리(내장 + 업로드)와 편집 기능 제공
- 상태 관리는 Zustand 스토어 2개(`character`, `characterLibrary`)로 분리

## 2) 페이지 역할

### `app/layout.tsx`
- 전역 레이아웃입니다.
- `live2dcubismcore.min.js`를 `beforeInteractive`로 로드해 Live2D 코어를 먼저 준비합니다.
- 모든 페이지 하단에 `Live2DClientOnly`를 붙여 캐릭터 렌더러가 전역으로 존재하게 합니다.

### `app/page.tsx`
- 메인 홈(와이어프레임) 페이지입니다.
- 상단 GNB, 사이드바, 게시판 더미 리스트 UI를 표시합니다.
- 중간에 `CharacterControls`를 넣어 캐릭터 제어/라이브러리/업로드를 테스트할 수 있게 합니다.

### `app/library/[id]/page.tsx`
- 특정 캐릭터를 통합 관리하는 상세 페이지입니다.
- URL 파라미터 `id`를 읽어 `LibraryManagerPanel`에 전달합니다.
- 진입 시 내장 캐릭터(`PICHU_PROFILE`, `MAO_PRO_PROFILE`)가 라이브러리에 없으면 자동 등록합니다.

## 3) 핵심 컴포넌트 역할

### `components/Live2DClientOnly.tsx`
- SSR에서 안전하게 동작하도록 `Live2DWrapper`를 동적 import(`ssr: false`)하는 래퍼입니다.
- 로딩 중 플레이스홀더 UI를 보여줍니다.

### `components/Live2DWrapper.tsx`
- 실제 Live2D 렌더링 엔진(Pixi + live2d-display)입니다.
- 역할:
  - Pixi `Application` 1회 생성/해제
  - `modelPath` 변경 시 모델 스왑 로딩
  - 감정 -> 표정/사운드/대사 동기화
  - 히트영역 클릭 -> 액션 모션 실행
  - 파츠 opacity 반영(의상 토글)
  - 모핑 파라미터 매 프레임 적용
  - 트래킹 ON/OFF 제어
  - 드래그/휠로 위치/스케일 변경 후 `modelConfig`에 저장

### `components/CharacterControls.tsx`
- 홈에서 쓰는 캐릭터 제어 진입점 패널입니다.
- 최초 마운트 시 내장 캐릭터를 라이브러리에 등록하고 기본 캐릭터를 활성화합니다.
- 탭으로 3개 패널을 전환합니다:
  - `basic`: 감정, 트래킹, 알림 테스트
  - `library`: 라이브러리 목록/로드/삭제
  - `upload`: ZIP 업로드 및 등록

## 4) 캐릭터 관련 하위 패널

### `components/character/CharacterLibraryPanel.tsx`
- 등록된 캐릭터 목록을 보여주고 활성 캐릭터를 선택/언로드합니다.
- 캐릭터별 수정 페이지(`/library/[id]`)로 이동 버튼을 제공합니다.

### `components/character/CharacterUploader.tsx`
- Live2D ZIP 업로드 패널입니다.
- `installModelFromZip`으로 분석/검증 후 자동 매핑(`autoMap`)을 적용해 `CharacterProfile`을 생성합니다.
- 등록 즉시 라이브러리에 추가하고 활성 캐릭터로 로드합니다.

### `components/character/LibraryManagerPanel.tsx`
- 캐릭터 상세 관리 패널입니다.
- 현재는 아래 항목 중심으로 수정 가능:
  - 기본 정보(name/description)
  - 기본 뷰(scale/x/y)
  - 감정별/액션별 대사
- 활성 캐릭터일 때 캔버스의 현재 위치/스케일을 `defaultView`로 저장할 수 있습니다.

### `components/character/MappingPanel.tsx`
- 감정->표정, 액션->모션, 히트영역->액션 매핑을 수동 보정하는 패널입니다.
- 자동 매핑 결과가 맞지 않을 때 수정용으로 사용합니다.

### `components/character/MorphPanel.tsx`
- 캐릭터 파라미터 모핑 슬라이더 패널입니다.
- 프리셋(여러 파라미터 일괄 적용)과 리셋 기능을 제공합니다.

### `components/character/OutfitPanel.tsx`
- 의상/파츠 선택 패널입니다.
- 선택된 옵션에 따라 관련 파츠 opacity를 1/0으로 동기화합니다.

### `components/character/SoundPanel.tsx`
- 감정/액션별 오디오를 연결하는 패널입니다.
- 파일 업로드 시 Object URL을 저장하고 테스트 재생/삭제를 지원합니다.
- 현재 세션 메모리 기반이라 새로고침 시 재업로드가 필요합니다.

## 5) 상태 관리(Zustand)

### `store/useCharacterStore.ts` (현재 활성 캐릭터 런타임 상태)
- 단일 활성 캐릭터의 실행 상태를 가집니다.
- 주요 상태:
  - `profile`, `modelPath`
  - `isLoading`, `isReady`, `error`
  - `emotion`, `isTracking`, `message`
  - `modelConfig`(scale/x/y)
  - `partOpacities`, `selectedOutfits`, `morphValues`
- `setProfile` 시 기본 outfit/morph 값을 자동 초기화합니다.

### `store/useCharacterLibraryStore.ts` (캐릭터 라이브러리 상태)
- 등록된 캐릭터 목록(`profiles`)과 현재 활성 id(`activeId`)를 관리합니다.
- `register`, `unregister`, `updateProfile`, `setActive`를 제공합니다.
- 비내장 캐릭터 삭제 시 `blobUrls`를 `URL.revokeObjectURL`로 정리합니다.

## 6) 도메인 타입/데이터 소스

### `types/character.ts`
- 캐릭터 도메인의 기준 타입 정의 파일입니다.
- 핵심 타입: `CharacterProfile`, `MotionRef`, `OutfitGroup`, `MorphSlider`, `SoundMap`, `DialogueMap` 등.

### `lib/live2d/defaultProfile.ts`
- 내장 캐릭터 프로필 정의입니다.
- 현재 `PICHU_PROFILE`, `MAO_PRO_PROFILE` 2개를 제공합니다.

## 7) 업로드/자동 매핑 로직

### `lib/live2d/modelPackage.ts`
- ZIP 파싱 + 보안/형식 검증 + 설치를 담당합니다.
- 핵심 정책:
  - `*.model3.json`을 기준으로 참조 리소스만 사용
  - 허용 확장자/크기 제한 검증
  - `moc3` 헤더 매직 검사
  - URL 재작성 후 `Live2DModel.from()` 가능한 `modelUrl` 생성

### `lib/live2d/autoMap.ts`
- 업로드 모델 분석 결과를 서비스 추상 키에 자동 매핑합니다.
- 표정/모션/히트영역/의상/모핑 슬라이더/프리셋을 휴리스틱 기반으로 추정합니다.

## 8) 화면 동작 흐름(요약)

1. 앱 시작 -> `layout`에서 Live2D 코어 로드 + `Live2DClientOnly` 마운트
2. `CharacterControls`에서 내장 프로필 등록/활성화
3. `useCharacterStore.profile.modelPath` 기준으로 `Live2DWrapper`가 모델 로드
4. 유저 입력(감정/의상/모핑/클릭) -> 스토어 업데이트
5. `Live2DWrapper`가 스토어 변화를 읽어 표정/모션/파츠/사운드/대사 반영

---

필요하면 다음 단계로, 이 문서를 기반으로 "신규 캐릭터 추가 체크리스트"와 "디버깅 체크리스트"도 분리해서 추가할 수 있습니다.

## 최근 변경 메모 (2026-04-24)

- 온보딩 문서(`README.md`)를 기준으로 `docs/plan.md`와 본 구조 문서를 먼저 확인하는 협업 루틴을 명시했다.
- `퇴근` 키워드 기반 일일 마감 자동화 규칙을 추가해 문서 업데이트와 Git 마감 절차를 표준화했다.
- 아키텍처 문서는 역할 중심 요약을 유지하고, 당일 변경사항을 하단 메모로 누적 기록하는 방식으로 운영한다.

## 최근 변경 메모 (2026-04-27)

- 캐릭터 도메인 UI를 `components/character` 하위로 모으는 방향으로 패널 책임을 재정렬했다.
- 캐릭터 상세 관리 라우트(`app/library/[id]`)와 프로필 페이지 작업이 병행되면서 페이지-패널 연결 구조가 확장됐다.
- 캐릭터 런타임/라이브러리 상태를 스토어 단위로 분리해 이후 동기화/영속화 확장 기반을 보강했다.
