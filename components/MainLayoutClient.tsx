"use client";

import { usePathname } from "next/navigation";
import RightSidebar from "./RightSidebar";
import DailyLoginXp from "./DailyLoginXp";

export default function MainLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/admin");
  const isAuth = pathname?.startsWith("/auth");
  const hideChrome = isAdmin || isAuth;

  const shellClassName = hideChrome
    ? "relative w-full"
    : "relative mx-auto w-full max-w-7xl px-4 pt-6 pb-4";

  return (
    <div className={shellClassName}>
      <DailyLoginXp />
      {!hideChrome && (
        <div className="sticky top-20 z-10 hidden h-0 w-0 2xl:block">
          <aside className="absolute right-[calc(100%+20px)] top-0 flex h-[600px] w-[200px] flex-col items-center justify-center border border-dashed border-gray-400 bg-gray-100/50 text-center text-xs text-gray-400">
            [Left
            <br />
            promo banner]
          </aside>
        </div>
      )}
      <div className="flex flex-col items-start gap-6 lg:flex-row">
        <div className="min-w-0 flex-1 w-full">{children}</div>
        {!hideChrome && <RightSidebar />}
      </div>
    </div>
  );
}
