"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

const NAV_ITEMS = [
  { href: "/", label: "홈" },
  { href: "/board", label: "채널" },
  { href: "/feed", label: "피드" },
];

export default function GlobalNavigation() {
  const pathname = usePathname();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const syncAuthState = async () => {
      const { data } = await supabase.auth.getUser();
      if (isMounted) {
        setIsLoggedIn(Boolean(data.user));
      }
    };

    syncAuthState();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(Boolean(session?.user));
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

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
        <Link
          href="/auth"
          className="ml-auto border border-dashed border-gray-500 bg-white px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-100"
        >
          {isLoggedIn ? "프로필 수정" : "로그인"}
        </Link>
      </div>
    </nav>
  );
}
