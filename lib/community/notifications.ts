import { supabase } from "@/lib/supabase/client";

export type NotificationType =
  | "COMMENT"
  | "REPLY"
  | "REACTION"
  | "FOLLOW"
  | "MENTION"
  | "HOT_PROMOTED"
  | "SYSTEM"
  | "RELEASE";

export const LIVE2D_NOTIFICATION_TYPES: ReadonlySet<NotificationType> = new Set<NotificationType>([
  "COMMENT",
  "REPLY",
  "REACTION",
  "FOLLOW",
  "MENTION",
  "HOT_PROMOTED",
  "SYSTEM",
  "RELEASE",
]);

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
  group_key: string | null;
  aggregate_count: number;
  last_event_at: string | null;
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
  groupKey?: string | null;
};

const NOTIFICATION_SELECT_COLUMNS =
  "id, created_at, receiver_id, sender_id, type, title, content, link_url, is_read, read_at, expires_at, group_key, aggregate_count, last_event_at";

const NOTIFICATION_LEGACY_COLUMNS =
  "id, created_at, receiver_id, sender_id, type, title, content, link_url, is_read, read_at";

const NOTIFICATION_GROUP_WINDOW_MS = 60 * 60 * 1000;

export type UserNotificationSettings = {
  notifications_enabled: boolean;
  live2d_bubble_enabled: boolean;
};

const DEFAULT_NOTIFICATION_SETTINGS: UserNotificationSettings = {
  notifications_enabled: true,
  live2d_bubble_enabled: true,
};

function isExpiresAtSchemaError(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  const message = error.message?.toLowerCase() ?? "";
  return error.code === "PGRST204" || error.code === "42703" || message.includes("expires_at");
}

function isAggregateSchemaError(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  const message = error.message?.toLowerCase() ?? "";
  return (
    error.code === "PGRST204" ||
    error.code === "42703" ||
    message.includes("group_key") ||
    message.includes("aggregate_count") ||
    message.includes("last_event_at")
  );
}

function normalizeRow(row: Record<string, unknown>): NotificationRow {
  return {
    id: row.id as string,
    created_at: row.created_at as string,
    receiver_id: row.receiver_id as string,
    sender_id: (row.sender_id as string | null) ?? null,
    type: row.type as NotificationType,
    title: (row.title as string) ?? "",
    content: (row.content as string) ?? "",
    link_url: (row.link_url as string | null) ?? null,
    is_read: Boolean(row.is_read),
    read_at: (row.read_at as string | null) ?? null,
    expires_at: (row.expires_at as string | null) ?? null,
    group_key: (row.group_key as string | null) ?? null,
    aggregate_count: typeof row.aggregate_count === "number" ? row.aggregate_count : 1,
    last_event_at: (row.last_event_at as string | null) ?? null,
  };
}

export async function fetchUserNotificationSettings(
  userId: string,
): Promise<UserNotificationSettings> {
  if (!userId) return DEFAULT_NOTIFICATION_SETTINGS;

  const { data, error } = await supabase
    .from("user_notification_settings")
    .select("notifications_enabled, live2d_bubble_enabled")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.warn("[notifications] fetch settings failed:", error.message);
    return DEFAULT_NOTIFICATION_SETTINGS;
  }

  if (!data) return DEFAULT_NOTIFICATION_SETTINGS;

  return {
    notifications_enabled: data.notifications_enabled ?? true,
    live2d_bubble_enabled: data.live2d_bubble_enabled ?? true,
  };
}

export async function upsertUserNotificationSettings(
  userId: string,
  patch: Partial<UserNotificationSettings>,
): Promise<UserNotificationSettings> {
  if (!userId) return DEFAULT_NOTIFICATION_SETTINGS;

  const previous = await fetchUserNotificationSettings(userId);
  const next: UserNotificationSettings = { ...previous, ...patch };

  const { error } = await supabase
    .from("user_notification_settings")
    .upsert(
      {
        user_id: userId,
        notifications_enabled: next.notifications_enabled,
        live2d_bubble_enabled: next.live2d_bubble_enabled,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

  if (error) {
    console.error("[notifications] upsert settings failed:", error.message);
    return previous;
  }

  return next;
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
  groupKey = null,
}: CreateNotificationParams): Promise<{ ok: boolean; error?: string }> {
  if (!receiverId || receiverId === senderId) return { ok: true };

  const settings = await fetchUserNotificationSettings(receiverId);
  if (!settings.notifications_enabled) return { ok: true };

  const resolvedExpiresAt =
    expiresAt === undefined
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
      : expiresAt;

  if (groupKey) {
    const merged = await mergeIntoExistingGroup({
      receiverId,
      groupKey,
      title,
      content,
      linkUrl,
      expiresAt: resolvedExpiresAt,
    });
    if (merged) return { ok: true };
  }

  const row = {
    receiver_id: receiverId,
    sender_id: senderId,
    type,
    title,
    content,
    link_url: linkUrl,
    expires_at: resolvedExpiresAt,
    group_key: groupKey,
    aggregate_count: 1,
    last_event_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("notifications").insert(row);

  if (isAggregateSchemaError(error)) {
    const { group_key: _gk, aggregate_count: _ac, last_event_at: _le, ...legacyAggregate } = row;
    const { error: legacyError } = await supabase.from("notifications").insert(legacyAggregate);
    if (!legacyError) return { ok: true };
    if (isExpiresAtSchemaError(legacyError)) {
      const { expires_at: _expiresAt, ...legacyRow } = legacyAggregate;
      const { error: legacyRowError } = await supabase.from("notifications").insert(legacyRow);
      if (!legacyRowError) return { ok: true };
      console.error("[notifications] create failed:", legacyRowError.message);
      return { ok: false, error: legacyRowError.message };
    }
    console.error("[notifications] create failed:", legacyError.message);
    return { ok: false, error: legacyError.message };
  }

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

async function mergeIntoExistingGroup(params: {
  receiverId: string;
  groupKey: string;
  title: string;
  content: string;
  linkUrl: string | null;
  expiresAt: string | null;
}): Promise<boolean> {
  const windowStart = new Date(Date.now() - NOTIFICATION_GROUP_WINDOW_MS).toISOString();

  const { data, error } = await supabase
    .from("notifications")
    .select("id, aggregate_count, last_event_at")
    .eq("receiver_id", params.receiverId)
    .eq("group_key", params.groupKey)
    .eq("is_read", false)
    .gte("last_event_at", windowStart)
    .order("last_event_at", { ascending: false })
    .limit(1);

  if (error) {
    if (isAggregateSchemaError(error)) return false;
    console.warn("[notifications] merge lookup failed:", error.message);
    return false;
  }

  const head = data?.[0] as { id: string; aggregate_count: number | null } | undefined;
  if (!head) return false;

  const nextCount = (head.aggregate_count ?? 1) + 1;
  const { error: updateError } = await supabase
    .from("notifications")
    .update({
      title: params.title,
      content: params.content,
      link_url: params.linkUrl,
      aggregate_count: nextCount,
      last_event_at: new Date().toISOString(),
      expires_at: params.expiresAt,
    })
    .eq("id", head.id);

  if (updateError) {
    console.warn("[notifications] merge update failed:", updateError.message);
    return false;
  }

  return true;
}

export function buildGroupKey(parts: Array<string | null | undefined>): string {
  return parts.filter((part): part is string => Boolean(part)).join(":");
}

export async function fetchNotifications(userId: string, limit = 50): Promise<NotificationRow[]> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("notifications")
    .select(NOTIFICATION_SELECT_COLUMNS)
    .eq("receiver_id", userId)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (isAggregateSchemaError(error)) {
    const { data: legacyData, error: legacyError } = await supabase
      .from("notifications")
      .select(NOTIFICATION_LEGACY_COLUMNS)
      .eq("receiver_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (legacyError) {
      console.error("[notifications] fetch failed:", legacyError.message);
      return [];
    }

    return (legacyData ?? []).map((item) => normalizeRow(item as Record<string, unknown>));
  }

  if (isExpiresAtSchemaError(error)) {
    const { data: legacyData, error: legacyError } = await supabase
      .from("notifications")
      .select(NOTIFICATION_LEGACY_COLUMNS)
      .eq("receiver_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (legacyError) {
      console.error("[notifications] fetch failed:", legacyError.message);
      return [];
    }

    return (legacyData ?? []).map((item) => normalizeRow(item as Record<string, unknown>));
  }

  if (error) {
    console.error("[notifications] fetch failed:", error.message);
    return [];
  }

  return (data ?? []).map((item) => normalizeRow(item as Record<string, unknown>));
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
