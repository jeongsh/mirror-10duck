export default function LeftSidebar() {
  return (
    <aside className="hidden w-[var(--layout-left-width)] shrink-0 lg:sticky lg:top-[calc(var(--layout-header-height)+var(--layout-main-pt))] lg:flex lg:flex-col lg:self-start lg:pt-6">
      <div className="flex h-[var(--layout-ad-height)] items-center justify-center border border-dashed border-gray-400 bg-gray-100/50 text-center text-xs text-gray-400">
        [Left
        <br />
        promo banner]
      </div>
    </aside>
  );
}
