"use client";

import { OverlayScrollbarsComponent } from "overlayscrollbars-react";
import type { OverlayScrollbarsComponentRef } from "overlayscrollbars-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const LG_MEDIA = "(min-width: 1024px)";

const SCROLLBAR_OPTIONS = {
  scrollbars: {
    theme: "os-theme-layout-main",
    autoHide: "never" as const,
    autoHideDelay: 900,
    autoHideSuspend: true,
  },
  overflow: {
    x: "hidden" as const,
  },
};

type MainScrollAreaProps = {
  children: React.ReactNode;
  className?: string;
  mobileClassName?: string;
};

export default function MainScrollArea({
  children,
  className,
  mobileClassName,
}: MainScrollAreaProps) {
  const pathname = usePathname();
  const osRef = useRef<OverlayScrollbarsComponentRef>(null);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(LG_MEDIA);
    const sync = () => setIsDesktop(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    osRef.current?.osInstance()?.update(true);
  }, [pathname]);

  if (!isDesktop) {
    return <div className={mobileClassName ?? className}>{children}</div>;
  }

  return (
    <OverlayScrollbarsComponent
      ref={osRef}
      element="div"
      className={className}
      options={SCROLLBAR_OPTIONS}
      defer
    >
      {children}
    </OverlayScrollbarsComponent>
  );
}
