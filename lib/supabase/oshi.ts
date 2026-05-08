import { supabase } from "./client";
import { OshiRegistration, OshiType } from "@/types/community";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export async function getOshiList(userId: string): Promise<OshiRegistration[]> {
  const { data, error } = await db
    .from("oshi_registrations")
    .select("*")
    .eq("user_id", userId)
    .order("rank", { ascending: true });

  if (error) {
    console.error("Error fetching oshi list:", error);
    return [];
  }
  return data ?? [];
}

export async function upsertOshi(
  userId: string,
  rank: number,
  fields: { title: string; oshi_type: OshiType; image_url?: string; description?: string; is_public?: boolean }
): Promise<OshiRegistration> {
  const { data, error } = await db
    .from("oshi_registrations")
    .upsert(
      { user_id: userId, rank, ...fields },
      { onConflict: "user_id,rank" }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteOshi(userId: string, oshiId: string): Promise<void> {
  const { error } = await db
    .from("oshi_registrations")
    .delete()
    .eq("id", oshiId)
    .eq("user_id", userId);

  if (error) throw error;
}

export async function reorderOshi(userId: string, orderedIds: string[]): Promise<void> {
  const updates = orderedIds.map((id, idx) =>
    db
      .from("oshi_registrations")
      .update({ rank: idx + 1 })
      .eq("id", id)
      .eq("user_id", userId)
  );
  await Promise.all(updates);
}
