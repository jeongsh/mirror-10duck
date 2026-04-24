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

4) 업로드 API 설계 팁
- 서버에서도 동일 검증 규칙(확장자/용량/시그니처) 재검증 권장
- 업로드 직후 분석 결과(표정 수, 모션 수, warning 목록)를 응답하면 프론트 UX가 좋아짐

---

## 6) 현재 상태 요약 (백엔드 기준)

- 지금은 캐릭터 라이브러리와 업로드 결과가 **프론트 메모리 상태**입니다.
- 백엔드가 들어오면 `CharacterProfile`을 기준으로 DB/스토리지로 이관하면 됩니다.
- 특히 "대사/사운드/매핑/defaultView"는 이미 구조화되어 있어 API 스키마로 옮기기 쉽습니다.

