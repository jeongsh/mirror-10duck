너는 지금부터 서브컬처 오타쿠 커뮤니티 플랫폼 '씹덕'의 프론트엔드 핵심 개발자야. 향후 React Native(Expo)로 모바일 앱을 확장할 계획을 가지고 있기 때문에, 웹 MVP는 Next.js 환경에서 견고하고 확장성 있게 구축할 거야. 

지금은 기능 구현보다는 완벽한 '초기 환경 세팅'과 '전역 레이아웃 뼈대'를 잡는 것에 집중해 줘. 아래의 기술 스택과 요구사항을 바탕으로 프로젝트를 세팅하고 필요한 파일들을 생성해.

[기술 스택]
- Framework: Next.js (App Router 사용)
- Language: TypeScript
- Styling: Tailwind CSS
- State Management: Zustand
- Live2D Rendering: pixi.js, pixi-live2d-display
- BaaS (준비): @supabase/supabase-js

[작업 지시 사항]
1. 최신 Next.js 프로젝트 설정 및 패키지 설치:
   - TypeScript, Tailwind CSS, App Router를 포함하여 세팅해 줘.
   - Zustand, pixi.js, pixi-live2d-display, supabase-js 패키지를 설치해 줘.

2. 폴더 구조 설계:
   - 향후 확장을 고려하여 깔끔한 디렉토리 구조를 잡아 줘. (예: `components/`, `store/`, `lib/`, `types/` 등)

3. 전역 상태 관리 (Zustand) 셋업:
   - `store/useCharacterStore.ts` 파일을 생성해 줘.
   - 우측 하단에 상주할 Live2D 캐릭터의 상태(isVisible, currentEmotion, intimacyLevel 등)를 관리하는 기본 스토어를 작성해 줘.

4. 전역 레이아웃 및 Live2D 래퍼 컴포넌트 생성:
   - `components/Live2DWrapper.tsx` 파일을 만들고, 일단은 우측 하단에 고정(fixed, bottom, right)되는 빈 컨테이너(Placeholder) 형태로 만들어 줘. (PixiJS 렌더링 로직은 나중에 짤 거니까 UI 위치만 잡아줘).
   - 이 컴포넌트가 Zustand 스토어의 상태를 구독하도록 연결해 줘.
   - `app/layout.tsx`를 수정해서 사이트의 GNB(상단 네비게이션 바) 뼈대와 생성한 `Live2DWrapper`가 모든 페이지에 렌더링되도록 배치해 줘.

5. 메인 페이지 기본 UI:
   - `app/page.tsx`에 이 웹사이트의 정체성을 보여주는 간단한 환영 문구와, 추후 커뮤니티 게시판이 들어갈 임시 레이아웃(Grid 또는 Flexbox) 박스를 그려 줘.

작업을 시작하고, 파일 생성이 완료되면 나에게 어떤 구조로 세팅했는지 브리핑해 줘.