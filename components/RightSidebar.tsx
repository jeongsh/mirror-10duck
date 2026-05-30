type RightSidebarProps = {
  characterSlot?: React.ReactNode;
};

function CharacterMessageCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-gray-400 bg-white/80 px-3 py-2 text-sm text-gray-600 shadow-sm backdrop-blur-sm">
      {children}
    </div>
  );
}

export default function RightSidebar({ characterSlot }: RightSidebarProps) {
  return (
    <aside
      className={[
        "z-10 shrink-0",
        "fixed bottom-0 right-0 w-[min(var(--layout-right-width),calc(100vw-1rem))]",
        "md:top-[var(--layout-header-height)] md:bottom-0 md:h-auto",
        "lg:static lg:h-full lg:min-h-0 lg:w-[var(--layout-right-width)]",
      ].join(" ")}
      aria-label="[Character zone]"
    >
      <div className="relative flex h-full min-h-[480px] flex-col overflow-hidden border border-dashed border-gray-400 bg-gray-100/40 md:min-h-0">
        {/* 배경 장식 placeholder */}
        <div className="pointer-events-none absolute inset-0 opacity-40" aria-hidden>
          <div className="absolute left-6 top-8 h-2 w-2 rounded-full bg-gray-300" />
          <div className="absolute right-10 top-16 h-1.5 w-1.5 rounded-full bg-gray-300" />
          <div className="absolute left-12 top-24 h-1 w-1 rounded-full bg-gray-300" />
          <div className="absolute inset-x-4 top-32 h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent" />
        </div>

        {/* 상단 메시지 카드 */}
        <div className="relative z-10 flex flex-col gap-3 p-8">
          <CharacterMessageCard>오늘 뭐할까요?</CharacterMessageCard>
          <CharacterMessageCard>이번 분기 투표 중</CharacterMessageCard>
        </div>

        {/* Live2D — 항상 하단 고정 */}
        <div className="relative z-10 mt-auto flex w-full justify-center">
          <div className="w-[var(--layout-live2d-width)] shrink-0">
            {characterSlot ?? (
              <div className="flex h-[420px] items-end justify-center pb-2 text-[10px] tracking-widest text-gray-400 uppercase">
                [Live2D]
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
