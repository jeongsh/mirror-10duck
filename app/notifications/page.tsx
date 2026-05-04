"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { markAllAsRead } from "@/lib/community/notifications";
import { useAuthUser } from "@/lib/supabase/useAuthUser";

type NotificationRow = {
  id: string;
  created_at: string;
  type: string;
  title: string;
  content: string;
  link_url: string | null;
  is_read: boolean;
};

export default function NotificationsPage() {
  const authUser = useAuthUser();
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const userId = authUser?.id ?? null;

  const fetchNotifications = useCallback(async () => {
    if (authUser === undefined) return;

    if (!userId) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data } = await supabase
      .from("notifications")
      .select("id, created_at, type, title, content, link_url, is_read")
      .eq("receiver_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    setNotifications((data as NotificationRow[] | null) ?? []);
    setLoading(false);
  }, [authUser, userId]);

  useEffect(() => {
    void fetchNotifications();
  }, [fetchNotifications]);

  const readAll = async () => {
    if (!userId) return;
    await markAllAsRead(userId);
    await fetchNotifications();
  };

  return (
    <main className="flex w-full flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3 border border-dashed border-gray-500 bg-white/70 p-4">
        <div>
          <h1 className="text-xl font-bold">알림</h1>
          <p className="text-sm text-gray-600">최근 알림을 확인합니다.</p>
        </div>
        <button
          type="button"
          onClick={readAll}
          disabled={!userId || notifications.every((item) => item.is_read)}
          className="border border-dashed border-gray-500 bg-white px-3 py-2 text-sm hover:bg-gray-100 disabled:opacity-50"
        >
          모두 읽음
        </button>
      </header>

      {!userId && authUser !== undefined ? (
        <section className="border border-dashed border-gray-500 bg-white/70 p-6 text-sm">
          로그인하면 알림을 볼 수 있습니다.{" "}
          <Link href="/auth" className="underline">
            로그인
          </Link>
        </section>
      ) : loading ? (
        <section className="border border-dashed border-gray-500 bg-white/70 p-6 text-center text-sm text-gray-500">
          불러오는 중...
        </section>
      ) : notifications.length === 0 ? (
        <section className="border border-dashed border-gray-500 bg-white/70 p-6 text-center text-sm text-gray-500">
          새 알림이 없습니다.
        </section>
      ) : (
        <section className="flex flex-col border border-dashed border-gray-500 bg-white/70">
          {notifications.map((item) => {
            const content = (
              <article className="flex flex-col gap-1 border-b border-dashed border-gray-300 p-4 last:border-b-0">
                <div className="flex flex-wrap items-center gap-2">
                  {!item.is_read && (
                    <span className="h-2 w-2 rounded-full bg-red-500" aria-label="읽지 않음" />
                  )}
                  <h2 className="font-bold">{item.title}</h2>
                  <span className="text-[10px] uppercase tracking-widest text-gray-400">
                    {item.type}
                  </span>
                  <time className="ml-auto text-[11px] text-gray-500">
                    {new Date(item.created_at).toLocaleString("ko-KR")}
                  </time>
                </div>
                <p className="text-sm text-gray-600">{item.content}</p>
              </article>
            );

            return item.link_url ? (
              <Link key={item.id} href={item.link_url} className="block hover:bg-gray-50">
                {content}
              </Link>
            ) : (
              <div key={item.id}>{content}</div>
            );
          })}
        </section>
      )}
    </main>
  );
}
