import { supabase } from "@/lib/supabase/client";

export type OtakuTypeTestVersion = "v1" | "v2";

export type OtakuTypeResultRow = {
  user_id: string;
  test_version: OtakuTypeTestVersion;
  result_code: string;
  result_title: string;
  result_badge: string | null;
  tier_name: string | null;
  scores: Record<string, unknown>;
  updated_at: string;
  created_at: string;
};

export type SaveOtakuTypeResultInput = {
  testVersion: OtakuTypeTestVersion;
  resultCode: string;
  resultTitle: string;
  resultBadge?: string;
  tierName?: string;
  scores: Record<string, unknown>;
};

export async function upsertOtakuTypeResult(
  userId: string,
  input: SaveOtakuTypeResultInput,
): Promise<void> {
  const { error } = await supabase.from("otaku_type_results").upsert(
    {
      user_id: userId,
      test_version: input.testVersion,
      result_code: input.resultCode,
      result_title: input.resultTitle,
      result_badge: input.resultBadge ?? null,
      tier_name: input.tierName ?? null,
      scores: input.scores,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,test_version" },
  );

  if (error) throw error;
}

export async function fetchOtakuTypeResults(userId: string): Promise<OtakuTypeResultRow[]> {
  const { data, error } = await supabase
    .from("otaku_type_results")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data as OtakuTypeResultRow[]) ?? [];
}

export async function fetchOtakuTypeResult(
  userId: string,
  testVersion: OtakuTypeTestVersion,
): Promise<OtakuTypeResultRow | null> {
  const { data, error } = await supabase
    .from("otaku_type_results")
    .select("*")
    .eq("user_id", userId)
    .eq("test_version", testVersion)
    .maybeSingle();

  if (error) throw error;
  return (data as OtakuTypeResultRow | null) ?? null;
}
