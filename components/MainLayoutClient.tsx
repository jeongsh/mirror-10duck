"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getLayoutChromeMode } from "@/lib/layoutChrome";
import DailyLoginXp from "./DailyLoginXp";
import LeftSidebar from "./LeftSidebar";
import Live2DClientOnly from "./Live2DClientOnly";
import RightSidebar from "./RightSidebar";
import ViralLayoutClient from "./ViralLayoutClient";

const SHELL_CLASS = [
  "relative mx-auto w-full max-w-[var(--layout-max)] px-4",
  "min-[1920px]:pl-[var(--layout-gutter)] min-[1920px]:pr-0",
].join(" ");

const GRID_CLASS = [
  "grid grid-cols-1 items-start",
  "lg:grid-cols-[var(--layout-left-width)_minmax(0,1fr)_var(--layout-right-width)] lg:gap-x-[var(--layout-column-gap)]",
  "min-[1920px]:grid-cols-[var(--layout-left-width)_var(--layout-main-width)_var(--layout-right-width)]",
].join(" ");

const LG_MEDIA = "(min-width: 1024px)";

export default function MainLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const layoutMode = getLayoutChromeMode(pathname);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(LG_MEDIA);
    const sync = () => setIsDesktop(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  if (layoutMode === "none") {
    return (
      <div className="relative w-full">
        <DailyLoginXp />
        {children}
      </div>
    );
  }

  if (layoutMode === "viral") {
    return <ViralLayoutClient>{children}</ViralLayoutClient>;
  }

  return (
    <div className={SHELL_CLASS} data-layout-chrome="">
      <DailyLoginXp />
      <div className={GRID_CLASS}>
        <LeftSidebar />
        <div className="min-w-0 w-full pb-24 lg:pb-4">
          <div className="lg:pt-6 lg:pb-4 lg:pr-4">{children}</div>
        </div>
        {isDesktop ? <RightSidebar characterSlot={<Live2DClientOnly variant="desktop" />} /> : null}
      </div>
      {!isDesktop ? <Live2DClientOnly variant="mobile" /> : null}
    </div>
  );
}
