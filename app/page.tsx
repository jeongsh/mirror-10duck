import HomeContent from "@/components/HomeContent";

export default function HomePage() {
  // `app/layout.tsx`에 이미 `max-w-7xl` 및 `FollowedBoardsSnb`(좌측) 가 존재하므로,
  // 여기서는 남은 영역(min-w-0 flex-1)을 채우는 HomeContent(메인+우측사이드바 2단 구조)를 마운트합니다.
  return <HomeContent />;
}
