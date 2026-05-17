"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { getUnreadNotificationCount } from "@/lib/community/notifications";
import { useAuthUser } from "@/lib/supabase/useAuthUser";

const NAV_ITEMS = [
  { href: "/", label: "홈", matchPrefix: null },
  { href: "/board", label: "채널", matchPrefix: null },
  { href: "/feed", label: "피드", matchPrefix: null },
  { href: "/news", label: "소식", matchPrefix: null },
  { href: "/season/current", label: "이번 분기 신작", matchPrefix: "/season" },
  { href: "/calendar", label: "캘린더", matchPrefix: null },
];

export default function GlobalNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const authUser = useAuthUser();
  const [unreadCount, setUnreadCount] = useState(0);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMenu]);

  const userId = authUser?.id ?? null;
  const nickname = useMemo(() => {
    const value = authUser?.user_metadata?.nickname;
    return typeof value === "string" && value.trim() ? value : null;
  }, [authUser?.user_metadata?.nickname]);

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
    <nav className="sticky top-0 z-40 border-b border-dashed border-gray-500 bg-white/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-2 px-4 py-3">
        <span className="border border-dashed border-gray-500 bg-gray-100 px-2 py-1 text-xs font-bold">
          SSIBDUK
        </span>
        <div className="flex flex-1 flex-wrap items-center gap-2">
          {NAV_ITEMS.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.matchPrefix
                ? pathname.startsWith(item.matchPrefix)
                : item.href !== "/" && pathname.startsWith(item.href));

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
