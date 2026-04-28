import FollowedBoardsSnb from "@/components/FollowedBoardsSnb";

export default function RightSidebar() {
  return (
    <aside className="w-full lg:w-72 shrink-0 flex flex-col gap-4 sticky top-20 self-start z-10">
      {/* 확대된 광고 / 배너 영역 */}
      <div className="h-[500px] border border-dashed border-gray-500 bg-gray-100 flex items-center justify-center">
        <span className="text-xs tracking-widest text-gray-400 uppercase">Advertisement</span>
      </div>

      {/* 내 팔로우 채널 */}
      <FollowedBoardsSnb />
    </aside>
  );
}
