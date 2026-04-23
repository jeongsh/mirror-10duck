# 🚀 오타쿠 커뮤니티 플랫폼 '씹덕' 프로젝트 플랜

## 📌 1. 프로젝트 개요 (Project Overview)
- **프로젝트 명:** 씹덕 (가칭)
- **핵심 가치:** 개인화된 캐릭터(Live2D) 상호작용과 서브컬처 커뮤니티의 융합, 그리고 C2C 창작 경제의 활성화.
- **최종 목표:** 사용자가 자신의 Live2D 캐릭터와 상호작용하며 커뮤니티 활동을 즐기고, 관련된 디지털 에셋을 거래할 수 있는 플랫폼 구축.
- **플랫폼 전략:** 웹(Next.js) 버전으로 MVP 우선 런칭 후, React Native(Expo)를 통한 모바일 네이티브 앱 확장.

---

## 🛠️ 2. 기술 스택 (Tech Stack)

### 2.1 프론트엔드 (웹 MVP)
- **Framework:** Next.js (App Router 구조 활용)
- **Language:** TypeScript (타입 안정성 및 유지보수성 확보)
- **Styling:** Tailwind CSS (빠른 UI 구현 및 일관된 디자인 시스템)
- **State Management:** Zustand (가볍고 직관적인 전역 상태 관리)

### 2.2 Live2D & 그래픽 처리
- **Rendering Engine:** PixiJS (WebGL 기반 2D 렌더링)
- **Live2D Integration:** `pixi-live2d-display` (React 환경에서의 Live2D 모델 제어 및 렌더링 최적화)

### 2.3 백엔드 & 데이터베이스 (BaaS)
- **Database & Auth:** Supabase (PostgreSQL 기반 DB, 사용자 인증, 실시간 데이터 구독)

---

## 📅 3. 단계별 개발 마일스톤 (Milestones & Checklists)

### 🚀 Phase 1: MVP 환경 세팅 및 기초 뼈대 구축 (완료)
초기 프로젝트 세팅 및 레이아웃, 상태 관리 구조를 확립하는 단계.

- [x] Next.js(App Router) + TypeScript + Tailwind CSS 프로젝트 생성
- [x] 필요 패키지 설치 완료 (Zustand, PixiJS, pixi-live2d-display, Supabase)
- [x] 디렉토리 구조 설계 (`components`, `store`, `lib`, `types` 등)
- [x] 전역 상태 관리 (Zustand) 세팅 (`useCharacterStore.ts` 등)
- [x] 전역 레이아웃 및 GNB(상단 네비게이션) 구성
- [x] 우측 하단 Live2D 캐릭터 Placeholder (컨테이너) 고정 배치

### 💬 Phase 2: 핵심 기능 MVP 개발 (현재 진행)
핵심 가치인 '캐릭터와의 상호작용'과 '커뮤니티 소통' 기능을 구현하는 단계.

#### 2.1 Live2D 시스템 연동
- [ ] PixiJS 기반 Live2D 모델 렌더링 로직 구현 (기본 모델 로드)
- [ ] 마우스 커서 시선 추적 (Eye-tracking) 및 클릭 상호작용 이벤트 구현
- [ ] 타이핑, 미활동(Idle), 접속 상태(로그인/로그아웃) 등 상황별 기본 애니메이션 연동
- [ ] 사이트 알림(댓글, 쪽지 등) 발생 시 캐릭터 리액션 및 말풍선 UI 연동

#### 2.2 커뮤니티 및 소셜 기능
- [ ] 사용자 인증 시스템 구현 (Supabase Auth 연동: 회원가입/로그인)
- [ ] 오타쿠 전용 커뮤니티 게시판 (CRUD 기능 및 카테고리 분류)
- [ ] 지시문(액션) 기반 1:1 롤플레잉 채팅 UI/UX 구현
- [ ] AI 프롬프트 연동을 통한 기본 페르소나 설정 및 대화 로직 구현
- [ ] (제타 벤치마킹) 캐릭터의 장기 기억(Long-term Memory) 시스템 기본 구조 설계


### ⚙️ Phase 3: v1.0 기능 고도화
사용자 경험을 강화하고 C2C 거래소의 기반을 다지는 단계.

- [ ] 웹 프리셋 에디터 UI 구현 (파라미터 슬라이더, 표정/모션 매핑)
- [ ] Live2D 커스텀 텍스처 스왑 기능 구현
- [ ] C2C 디자인/에셋 거래소 (크리에이터 스튜디오 & UI 구축)
  - [ ] 판매자(창작자)가 모델 업로드 시 드래그/줌으로 썸네일 및 기본 뷰(scale, x, y) 설정
  - [ ] DB 테이블(`characters`)에 `default_scale`, `default_x`, `default_y` 컬럼 추가 및 저장 연동
  - [ ] 구매자(사용자)가 모델 로드 시 DB의 기본 뷰 config를 `useCharacterStore`로 렌더링
- [ ] 사용자가 제작한 `.moc3` 모델 패키지 업로드 및 검증 로직 구현
- [ ] 캐릭터 다마고치 시스템 기본 요소(친밀도, 간단한 육성) 도입
- [ ] 안전 결제(에스크로) 프로세스 설계 및 초기 연동 테스트

### 🌟 Phase 4: v2.0 앱 확장 및 수익화 모델 구축
모바일 앱 출시 및 플랫폼 비즈니스 모델을 본격적으로 가동하는 단계.

- [ ] 유명 IP 콜라보레이션 스킨 시스템 프론트엔드 연동
- [ ] 앱 전환 검토 및 React Native (Expo) 프로젝트 이관 작업
- [ ] 모바일 환경에 맞춘 UI/UX 및 Live2D 렌더링 성능 최적화
- [ ] C2C 에스크로 결제 시스템 연동 완료 및 수수료 정산 자동화
- [ ] 캐릭터 마스크 씌우기 및 음성/영상 통화 기능(WebRTC 연동 등) R&D
- [ ] 3D 메타버스 가상 현실 세계 기획 구체화 및 초기 프로토타이핑