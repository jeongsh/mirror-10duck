"use client";

import { usePathname } from "next/navigation";
import DailyLoginXp from "./DailyLoginXp";
import LeftSidebar from "./LeftSidebar";
import Live2DClientOnly from "./Live2DClientOnly";
import MainScrollArea from "./MainScrollArea";
import RightSidebar from "./RightSidebar";

const SHELL_CLASS = [
  "relative mx-auto w-full max-w-[var(--layout-max)] px-4",
  "min-[1920px]:pl-[var(--layout-gutter)] min-[1920px]:pr-0",
].join(" ");

const GRID_CLASS = [
  "grid grid-cols-1 items-stretch",
  "lg:grid-cols-[var(--layout-left-width)_minmax(0,1fr)_var(--layout-right-width)] lg:gap-x-[var(--layout-column-gap)]",
  "lg:h-[calc(100dvh-var(--layout-header-height))] lg:overflow-hidden",
  "min-[1920px]:grid-cols-[var(--layout-left-width)_var(--layout-main-width)_var(--layout-right-width)]",
].join(" ");

export default function MainLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/admin");
  const isAuth = pathname?.startsWith("/auth");
  const hideChrome = isAdmin || isAuth;

  return (
    <div className={hideChrome ? "relative w-full" : SHELL_CLASS} data-layout-chrome={hideChrome ? undefined : ""}>
      <DailyLoginXp />
      {hideChrome ? (
        children
      ) : (
        <div className={GRID_CLASS}>
          <LeftSidebar />
          <MainScrollArea
            className="min-h-0 min-w-0 w-full lg:h-full"
            mobileClassName="min-h-0 min-w-0 w-full pb-[500px]"
          >
            <div className="lg:pt-6 lg:pb-4 lg:pr-4">{children}</div>
          </MainScrollArea>
          <RightSidebar characterSlot={<Live2DClientOnly />} />
        </div>
      )}
    </div>
  );
}
