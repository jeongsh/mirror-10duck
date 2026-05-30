export default function LeftSidebar() {
  return (
    <aside className="hidden w-[var(--layout-left-width)] shrink-0 lg:flex lg:flex-col lg:pt-6">
      <div className="flex h-[min(720px,calc(100dvh-var(--layout-header-height)-1.5rem))] items-center justify-center border border-dashed border-gray-400 bg-gray-100/50 text-center text-xs text-gray-400">
        [Left
        <br />
        promo banner]
      </div>
    </aside>
  );
}
