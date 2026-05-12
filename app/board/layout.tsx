import BoardRecentChannelsBar from "@/components/board/BoardRecentChannelsBar";

export default function BoardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex w-full flex-col gap-4">
      <BoardRecentChannelsBar />
      {children}
    </div>
  );
}
