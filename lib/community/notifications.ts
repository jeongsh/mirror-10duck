import { supabase } from "@/lib/supabase/client";

export type NotificationType =
  | "COMMENT"
  | "REPLY"
  | "REACTION"
  | "FOLLOW"
  | "HOT_PROMOTED"
  | "SYSTEM";

export type NotificationRow = {
  id: string;
  created_at: string;
  receiver_id: string;
  sender_id: string | null;
  type: NotificationType;
  title: string;
  content: string;
  link_url: string | null;
  is_read: boolean;
  read_at: string | null;
};

type CreateNotificationParams = {
  receiverId: string;
  senderId?: string | null;
  type: NotificationType;
  title: string;
  content: string;
  linkUrl?: string | null;
};

export async function createNotification({
  receiverId,
  senderId = null,
  type,
  title,
  content,
  linkUrl = null,
}: CreateNotificationParams): Promise<{ ok: boolean; error?: string }> {
  if (!receiverId || receiverId === senderId) return { ok: true };

  const { error } = await supabase.from("notifications").insert({
    receiver_id: receiverId,
    sender_id: senderId,
    type,
    title,
    content,
    link_url: linkUrl,
  });

  if (error) {
    console.error("[notifications] create failed:", error.message);
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

export async function fetchNotifications(userId: string, limit = 50): Promise<NotificationRow[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("id, created_at, receiver_id, sender_id, type, title, content, link_url, is_read, read_at")
    .eq("receiver_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[notifications] fetch failed:", error.message);
    return [];
  }

  return (data ?? []) as NotificationRow[];
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("receiver_id", userId)
    .eq("is_read", false);

  if (error) {
    console.error("[notifications] unread count failed:", error.message);
    return 0;
  }

  return count ?? 0;
}

export async function markNotificationAsRead(notificationId: string, userId: string) {
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("receiver_id", userId);

  if (error) console.error("[notifications] mark read failed:", error.message);
}

export async function markAllAsRead(userId: string) {
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("receiver_id", userId)
    .eq("is_read", false);

  if (error) console.error("[notifications] mark all read failed:", error.message);
}
