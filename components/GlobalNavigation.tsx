"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { getUnreadNotificationCount } from "@/lib/community/notifications";
import { useAuthUser } from "@/lib/supabase/useAuthUser";
import { getProfile } from "@/lib/supabase/profiles";
import {
  CREATE_NAV_GROUPS,
  PRIMARY_NAV_ITEMS,
  isCreateNavActive,
  isNavItemActive,
} from "@/lib/navigation";

export default function GlobalNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const authUser = useAuthUser();
  const [unreadCount, setUnreadCount] = useState(0);
  const [showMenu, setShowMenu] = useState(false);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [profileNickname, setProfileNickname] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const createMenuRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    const syncLayoutMetrics = () => {
      const headerHeight = nav.offsetHeight;
      document.documentElement.style.setProperty(
        "--layout-header-height",
        `${headerHeight}px`,
      );
      document.documentElement.style.setProperty(
        "--layout-rnb-height",
        `${window.innerHeight - headerHeight}px`,
      );
    };

    syncLayoutMetrics();

    const observer = new ResizeObserver(syncLayoutMetrics);
    observer.observe(nav);

    window.addEventListener("resize", syncLayoutMetrics);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", syncLayoutMetrics);
    };
  }, []);

  useEffect(() => {
    if (!showMenu && !showCreateMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
      if (createMenuRef.current && !createMenuRef.current.contains(e.target as Node)) {
        setShowCreateMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMenu, showCreateMenu]);

  const userId = authUser?.id ?? null;
  const nickname = useMemo(() => profileNickname, [profileNickname]);

  useEffect(() => {
    let cancelled = false;
    setProfileNickname(null);

    if (!userId) {
      return () => {
        cancelled = true;
      };
    }

    void getProfile(userId).then((profile) => {
      if (cancelled) return;
      const value = profile?.nickname?.trim() || profile?.display_name?.trim() || null;
      setProfileNickname(value);
    });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    let isMounted = true;
    setUnreadCount(0);

    if (!userId) {
      return () => {
        isMounted = false;
      };
    }

    getUnreadNotificationCount(userId).then((count) => {
      if (isMounted) setUnreadCount(count);
    });

    const notificationSubscription = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `receiver_id=eq.${userId}`,
        },
        () => {
          if (isMounted) setUnreadCount((prev) => prev + 1);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `receiver_id=eq.${userId}`,
        },
        () => {
          getUnreadNotificationCount(userId).then((count) => {
            if (isMounted) setUnreadCount(count);
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "notifications",
          filter: `receiver_id=eq.${userId}`,
        },
        () => {
          getUnreadNotificationCount(userId).then((count) => {
            if (isMounted) setUnreadCount(count);
          });
        },
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(notificationSubscription);
    };
  }, [pathname, userId]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setShowMenu(false);
    router.push("/");
  };

  return (
    <nav
      ref={navRef}
      className="sticky top-0 z-40 border-b border-dashed border-gray-500 bg-white/85 backdrop-blur"
    >
      <div className="mx-auto flex w-full max-w-[var(--layout-max)] flex-wrap items-center gap-2 px-4 py-3 min-[1920px]:pl-[var(--layout-gutter)] min-[1920px]:pr-8">
        <span className="border border-dashed border-gray-500 bg-gray-100 px-2 py-1 text-xs font-bold">
          SSIBDUK
        </span>
        <div className="flex flex-1 flex-wrap items-center gap-2">
          {PRIMARY_NAV_ITEMS.map((item) => {
            const isActive = isNavItemActive(pathname, item);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`border border-dashed px-3 py-1.5 text-sm transition-colors ${
                  isActive
                    ? "border-gray-600 bg-gray-300 text-gray-900"
                    : "border-gray-500 bg-white text-gray-700 hover:bg-gray-100"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
          <div className="relative" ref={createMenuRef}>
            <button
              type="button"
              onClick={() => setShowCreateMenu((prev) => !prev)}
              className={`border border-dashed px-3 py-1.5 text-sm transition-colors ${
                isCreateNavActive(pathname)
                  ? "border-gray-600 bg-gray-300 text-gray-900"
                  : "border-gray-500 bg-white text-gray-700 hover:bg-gray-100"
              }`}
            >
              바이럴
            </button>
            {showCreateMenu && (
              <div className="fixed left-4 right-4 top-14 z-50 mt-1 grid gap-3 border border-dashed border-gray-500 bg-white p-3 shadow-lg sm:absolute sm:left-0 sm:right-auto sm:top-auto sm:w-[min(92vw,680px)] sm:grid-cols-3">
                {CREATE_NAV_GROUPS.map((group) => (
                  <div key={group.label} className="min-w-0">
                    <p className="mb-2 border-b border-dashed border-gray-300 pb-1 text-xs font-bold text-gray-500">
                      {group.label}
                    </p>
                    <div className="flex flex-col gap-1">
                      {group.items.map((item) => (
                        <Link
                          key={item.href}
                          href={item.status === "planned" ? "/play" : item.href}
                          onClick={() => setShowCreateMenu(false)}
                          className="block border border-transparent px-2 py-1.5 text-sm text-gray-700 hover:border-dashed hover:border-gray-300 hover:bg-gray-100"
                        >
                          <span className="flex items-center gap-2 font-semibold">
                            {item.label}
                            {item.status === "planned" ? (
                              <span className="border border-dashed border-gray-300 px-1 text-[10px] font-bold text-gray-400">
                                예정
                              </span>
                            ) : null}
                          </span>
                          {item.description ? (
                            <span className="mt-0.5 block text-xs leading-snug text-gray-500">
                              {item.description}
                            </span>
                          ) : null}
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {authUser && (
            <Link
              href="/notifications"
              className={`relative border border-dashed border-gray-500 bg-white p-1.5 transition-colors hover:bg-gray-100 ${
                unreadCount > 0 ? "border-red-400 text-red-600" : "text-gray-500"
              }`}
              title="알림"
            >
              <span className="text-lg leading-none">!</span>
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Link>
          )}
          {authUser ? (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="border border-dashed border-gray-500 bg-white px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-100"
              >
                {nickname || "프로필"}
              </button>
              {showMenu && (
                <div className="absolute right-0 mt-1 w-44 border border-dashed border-gray-500 bg-white shadow-lg z-50">
                  <Link
                    href="/profile"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 border-b border-dashed border-gray-300"
                    onClick={() => setShowMenu(false)}
                  >
                    프로필 설정
                  </Link>
                  <Link
                    href="/profile/level"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 border-b border-dashed border-gray-300"
                    onClick={() => setShowMenu(false)}
                  >
                    레벨 & 경험치
                  </Link>
                  <Link
                    href="/profile?tab=profile"
                    className="block border-b border-dashed border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    onClick={() => setShowMenu(false)}
                  >
                    관심작 설정
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    로그아웃
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/auth"
              className="border border-dashed border-gray-500 bg-white px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-100"
            >
              로그인
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
