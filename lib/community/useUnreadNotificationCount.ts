"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { useAuthUser } from "@/lib/supabase/useAuthUser";
import { supabase } from "@/lib/supabase/client";
import {
  getUnreadNotificationCount,
  getUnreadNotificationSummary,
  type UnreadNotificationSummary,
} from "@/lib/community/notifications";

const ACK_PREFIX = "10duck:notifications:notice-ack:v2:";

export function useUnreadNotificationCount(): number {
  const authUser = useAuthUser();
  const userId = authUser?.id ?? null;
  const channelId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    if (!userId) {
      setCount(0);
      return;
    }

    const refresh = async () => {
      const nextCount = await getUnreadNotificationCount(userId);
      if (!cancelled) setCount(nextCount);
    };

    void refresh();

    const channel = supabase
      .channel(`unread-notifications:${userId}:${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `receiver_id=eq.${userId}`,
        },
        () => {
          void refresh();
        },
      )
      .subscribe();

    const handleFocus = () => {
      void refresh();
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", handleFocus);
      supabase.removeChannel(channel);
    };
  }, [channelId, userId]);

  return count;
}

export type UnreadNotificationNotice = UnreadNotificationSummary & {
  acknowledged: boolean;
  shouldShowNotice: boolean;
  acknowledge: () => void;
};

export function useUnreadNotificationNotice(): UnreadNotificationNotice {
  const authUser = useAuthUser();
  const userId = authUser?.id ?? null;
  const channelId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [summary, setSummary] = useState<UnreadNotificationSummary>({
    count: 0,
    latestEventAt: null,
  });
  const [acknowledgedEventAt, setAcknowledgedEventAt] = useState<string | null>(null);

  useEffect(() => {
    if (!userId || typeof window === "undefined") {
      setAcknowledgedEventAt(null);
      return;
    }

    setAcknowledgedEventAt(window.localStorage.getItem(`${ACK_PREFIX}${userId}`));
  }, [userId]);

  useEffect(() => {
    let cancelled = false;

    if (!userId) {
      setSummary({ count: 0, latestEventAt: null });
      return;
    }

    const refresh = async () => {
      const nextSummary = await getUnreadNotificationSummary(userId);
      if (!cancelled) setSummary(nextSummary);
    };

    void refresh();

    const channel = supabase
      .channel(`unread-notification-notice:${userId}:${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `receiver_id=eq.${userId}`,
        },
        () => {
          void refresh();
        },
      )
      .subscribe();

    const handleFocus = () => {
      void refresh();
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", handleFocus);
      supabase.removeChannel(channel);
    };
  }, [channelId, userId]);

  const acknowledge = useCallback(() => {
    const noticeKey = summary.latestEventAt ?? (summary.count > 0 ? `count:${summary.count}` : null);
    if (!userId || !noticeKey || typeof window === "undefined") return;

    window.localStorage.setItem(`${ACK_PREFIX}${userId}`, noticeKey);
    setAcknowledgedEventAt(noticeKey);
  }, [summary.count, summary.latestEventAt, userId]);

  const noticeKey = summary.latestEventAt ?? (summary.count > 0 ? `count:${summary.count}` : null);
  const isCountFallbackKey = noticeKey?.startsWith("count:") ?? false;

  const acknowledged =
    summary.count <= 0 ||
    !noticeKey ||
    (acknowledgedEventAt !== null &&
      (isCountFallbackKey ? acknowledgedEventAt === noticeKey : acknowledgedEventAt >= noticeKey));

  return {
    ...summary,
    acknowledged,
    shouldShowNotice: summary.count > 0 && !acknowledged,
    acknowledge,
  };
}
