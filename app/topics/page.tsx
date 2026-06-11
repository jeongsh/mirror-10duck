import TopicFeedClient from "@/components/topics/TopicFeedClient";

export const dynamic = "force-dynamic";

export default function TopicsPage() {
  return (
    <main className="flex w-full flex-col gap-4">
      <header className="border border-dashed border-gray-500 bg-white/80 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-500">
          Today topics
        </p>
        <h1 className="mt-1 text-2xl font-black text-gray-950">오늘의 떡밥</h1>
        <p className="mt-2 text-sm leading-6 text-gray-600">
          뉴스를 길게 읽는 곳이 아니라, 오늘 반응할 덕질거리를 모아보는 공간입니다.
        </p>
      </header>

      <TopicFeedClient />
    </main>
  );
}
