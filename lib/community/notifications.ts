import { supabase } from "@/lib/supabase/client";

export type NotificationType = 'COMMENT' | 'REPLY' | 'REACTION' | 'FOLLOW' | 'HOT_PROMOTED' | 'SYSTEM';

interface CreateNotificationParams {
  receiverId: string;
  senderId?: string;
  type: NotificationType;
  title: string;
  content: string;
  linkUrl: string;
}

/**
 * 알림을 생성합니다.
 * (추후 DB 트리거나 Edge Function으로 옮기는 것이 좋으나, 현재는 클라이언트에서 호출)
 */
export async function createNotification({
  receiverId,
  senderId,
  type,
  title,
  content,
  linkUrl
}: CreateNotificationParams) {
  if (receiverId === senderId) return; // 본인 알림은 무시

  const { error } = await supabase.from("notifications").insert({
    receiver_id: receiverId,
    sender_id: senderId,
    type,
    title,
    content,
    link_url: linkUrl
  });

  if (error) {
    console.error("Failed to create notification:", error);
  }
}

/**
 * 읽지 않은 알림 수를 가져옵니다.
 */
export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("receiver_id", userId)
    .eq("is_read", false);
  
  if (error) return 0;
  return count ?? 0;
}

/**
 * 모든 알림을 읽음 처리합니다.
 */
export async function markAllAsRead(userId: string) {
  await supabase
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("receiver_id", userId)
    .eq("is_read", false);
}
