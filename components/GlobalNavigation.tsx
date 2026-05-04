"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { getUnreadNotificationCount } from "@/lib/community/notifications";

const NAV_ITEMS = [
  { href: "/", label: "홈" },
  { href: "/board", label: "채널" },
  { href: "/feed", label: "피드" },
];

export default function GlobalNavigation() {
  const pathname = usePathname();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [nickname, setNickname] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const syncAuthState = async () => {
      const { data } = await supabase.auth.getUser();
      if (isMounted) {
        const user = data.user;
        setIsLoggedIn(Boolean(user));
        setUserId(user?.id || null);
        setNickname(user?.user_metadata?.nickname || null);
        
        if (user) {
          const count = await getUnreadNotificationCount(user.id);
          setUnreadCount(count);
        }
      }
    };

    syncAuthState();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isMounted) {
        const user = session?.user;
        setIsLoggedIn(Boolean(user));
        setUserId(user?.id || null);
        setNickname(user?.user_metadata?.nickname || null);
        
        if (user) {
          getUnreadNotificationCount(user.id).then(setUnreadCount);
        } else {
          setUnreadCount(0);
        }
      }
    });

    // 실시간 알림 구독
    const notificationSubscription = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
        },
        (payload) => {
          if (isMounted && userId && payload.new.receiver_id === userId) {
            setUnreadCount(prev => prev + 1);
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
      supabase.removeChannel(notificationSubscription);
    };
  }, [userId]);

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
              (item.href !== "/" && pathname.startsWith(item.href));

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
          {isLoggedIn && (
            <Link 
              href="/notifications" 
              className={`relative border border-dashed border-gray-500 bg-white p-1.5 transition-colors hover:bg-gray-100 ${unreadCount > 0 ? "text-red-600 border-red-400" : "text-gray-500"}`}
              title="알림"
            >
              <span className="text-lg leading-none">🔔</span>
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Link>
          )}
          <Link
            href={isLoggedIn ? "/profile" : "/auth"}
            className="border border-dashed border-gray-500 bg-white px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-100"
          >
            {isLoggedIn ? (nickname || "프로필") : "로그인"}
          </Link>
        </div>
      </div>
    </nav>
  );
}
