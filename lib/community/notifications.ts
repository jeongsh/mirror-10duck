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
  expires_at: string | null;
};

type CreateNotificationParams = {
  receiverId: string;
  senderId?: string | null;
  type: NotificationType;
  title: string;
  content: string;
  linkUrl?: string | null;
  expiresAt?: string | null;
  expiresInDays?: number;
};

function isExpiresAtSchemaError(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  const message = error.message?.toLowerCase() ?? "";
  return error.code === "PGRST204" || error.code === "42703" || message.includes("expires_at");
}

export async function createNotification({
  receiverId,
  senderId = null,
  type,
  title,
  content,
  linkUrl = null,
  expiresAt,
  expiresInDays = 30,
}: CreateNotificationParams): Promise<{ ok: boolean; error?: string }> {
  if (!receiverId || receiverId === senderId) return { ok: true };

  const resolvedExpiresAt =
    expiresAt === undefined
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
      : expiresAt;

  const row = {
    receiver_id: receiverId,
    sender_id: senderId,
    type,
    title,
    content,
    link_url: linkUrl,
    expires_at: resolvedExpiresAt,
  };

  const { error } = await supabase.from("notifications").insert(row);

  if (isExpiresAtSchemaError(error)) {
    const { expires_at: _expiresAt, ...legacyRow } = row;
    const { error: legacyError } = await supabase.from("notifications").insert(legacyRow);

    if (!legacyError) return { ok: true };

    console.error("[notifications] create failed:", legacyError.message);
    return { ok: false, error: legacyError.message };
  }

  if (error) {
    console.error("[notifications] create failed:", error.message);
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

export async function fetchNotifications(userId: string, limit = 50): Promise<NotificationRow[]> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("notifications")
    .select(
      "id, created_at, receiver_id, sender_id, type, title, content, link_url, is_read, read_at, expires_at",
    )
    .eq("receiver_id", userId)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (isExpiresAtSchemaError(error)) {
    const { data: legacyData, error: legacyError } = await supabase
      .from("notifications")
      .select("id, created_at, receiver_id, sender_id, type, title, content, link_url, is_read, read_at")
      .eq("receiver_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (legacyError) {
      console.error("[notifications] fetch failed:", legacyError.message);
      return [];
    }

    return ((legacyData ?? []) as Omit<NotificationRow, "expires_at">[]).map((item) => ({
      ...item,
      expires_at: null,
    }));
  }

  if (error) {
    console.error("[notifications] fetch failed:", error.message);
    return [];
  }

  return (data ?? []) as NotificationRow[];
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const now = new Date().toISOString();
  const { count, error } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("receiver_id", userId)
    .eq("is_read", false)
    .or(`expires_at.is.null,expires_at.gt.${now}`);

  if (isExpiresAtSchemaError(error)) {
    const { count: legacyCount, error: legacyError } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("receiver_id", userId)
      .eq("is_read", false);

    if (legacyError) {
      console.error("[notifications] unread count failed:", legacyError.message);
      return 0;
    }

    return legacyCount ?? 0;
  }

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

export async function deleteNotification(notificationId: string, userId: string) {
  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("id", notificationId)
    .eq("receiver_id", userId);

  if (error) console.error("[notifications] delete failed:", error.message);
}

export async function deleteReadNotifications(userId: string) {
  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("receiver_id", userId)
    .eq("is_read", true);

  if (error) console.error("[notifications] delete read failed:", error.message);
}
