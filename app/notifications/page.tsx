"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  deleteNotification,
  deleteReadNotifications,
  fetchNotifications,
  markAllAsRead,
  markNotificationAsRead,
  type NotificationRow,
} from "@/lib/community/notifications";
import { useUnreadNotificationNotice } from "@/lib/community/useUnreadNotificationCount";
import { useAuthUser } from "@/lib/supabase/useAuthUser";

const TYPE_LABEL: Record<NotificationRow["type"], string> = {
  COMMENT: "댓글",
  REPLY: "답글",
  REACTION: "리액션",
  FOLLOW: "팔로우",
  MENTION: "멘션",
  HOT_PROMOTED: "인기글",
  SYSTEM: "시스템",
  RELEASE: "신작",
};

function formatExpiresAt(value: string | null) {
  if (!value) return "만료 없음";

  const expiresAt = new Date(value);
  const diffMs = expiresAt.getTime() - Date.now();
  const diffDays = Math.ceil(diffMs / (24 * 60 * 60 * 1000));

  if (diffDays <= 0) return "곧 만료";
  if (diffDays === 1) return "1일 후 만료";
  return `${diffDays}일 후 만료`;
}

export default function NotificationsPage() {
  const authUser = useAuthUser();
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const userId = authUser?.id ?? null;
  const unreadNotice = useUnreadNotificationNotice();
  const unreadNoticeCount = unreadNotice.count;
  const acknowledgeUnreadNotice = unreadNotice.acknowledge;

  const refresh = useCallback(async () => {
    if (authUser === undefined) return;

    if (!userId) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setNotifications(await fetchNotifications(userId));
    setLoading(false);
  }, [authUser, userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!userId || loading || unreadNoticeCount <= 0) return;
    acknowledgeUnreadNotice();
  }, [acknowledgeUnreadNotice, loading, unreadNoticeCount, userId]);

  const readAll = async () => {
    if (!userId) return;
    await markAllAsRead(userId);
    await refresh();
  };

  const readOne = async (notificationId: string) => {
    if (!userId) return;
    setNotifications((prev) =>
      prev.map((item) =>
        item.id === notificationId
          ? { ...item, is_read: true, read_at: new Date().toISOString() }
          : item,
      ),
    );
    await markNotificationAsRead(notificationId, userId);
  };

  const removeOne = async (notificationId: string) => {
    if (!userId) return;
    setNotifications((prev) => prev.filter((item) => item.id !== notificationId));
    await deleteNotification(notificationId, userId);
  };

  const removeRead = async () => {
    if (!userId) return;
    if (!window.confirm("읽은 알림을 모두 삭제할까요?")) return;

    setNotifications((prev) => prev.filter((item) => !item.is_read));
    await deleteReadNotifications(userId);
    await refresh();
  };

  return (
    <main className="flex w-full flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3 border border-dashed border-gray-500 bg-white/70 p-4">
        <div>
          <h1 className="text-xl font-bold">알림</h1>
          <p className="text-sm text-gray-600">
            댓글, 답글, 리액션과 팔로우 소식을 확인합니다. 기본 보관 기간은 30일입니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={readAll}
            disabled={!userId || notifications.every((item) => item.is_read)}
            className="border border-dashed border-gray-500 bg-white px-3 py-2 text-sm hover:bg-gray-100 disabled:opacity-50"
          >
            모두 읽음
          </button>
          <button
            type="button"
            onClick={removeRead}
            disabled={!userId || notifications.every((item) => !item.is_read)}
            className="border border-dashed border-red-400 bg-red-50 px-3 py-2 text-sm text-red-700 hover:bg-red-100 disabled:opacity-50"
          >
            읽은 알림 삭제
          </button>
        </div>
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
            const body = (
              <article className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  {!item.is_read && (
                    <span className="h-2 w-2 rounded-full bg-red-500" aria-label="읽지 않음" />
                  )}
                  <h2 className="font-bold">{item.title}</h2>
                  <span className="border border-dashed border-gray-300 px-1.5 py-0.5 text-[10px] font-bold text-gray-500">
                    {TYPE_LABEL[item.type] ?? item.type}
                  </span>
                  <time className="ml-auto text-[11px] text-gray-500">
                    {new Date(item.created_at).toLocaleString("ko-KR")}
                  </time>
                </div>
                <p className="text-sm text-gray-600">{item.content}</p>
                <span className="text-[11px] text-gray-400">
                  {formatExpiresAt(item.expires_at)}
                </span>
              </article>
            );

            return (
              <div
                key={item.id}
                className="grid grid-cols-[1fr_auto] gap-2 border-b border-dashed border-gray-300 p-4 last:border-b-0 hover:bg-gray-50"
              >
                {item.link_url ? (
                  <Link href={item.link_url} onClick={() => void readOne(item.id)} className="min-w-0">
                    {body}
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => void readOne(item.id)}
                    className="min-w-0 text-left"
                  >
                    {body}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void removeOne(item.id)}
                  className="self-start border border-dashed border-gray-400 bg-white px-2 py-1 text-[11px] text-gray-500 hover:border-red-400 hover:text-red-600"
                >
                  삭제
                </button>
              </div>
            );
          })}
        </section>
      )}
    </main>
  );
}
