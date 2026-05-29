import { supabase } from "@/lib/supabase/client";
import type { HexStat, SignatureTag } from "@/lib/oshiAnalysis";
import type { OshiAnalysisResult } from "@/lib/oshiAnalysis";

export type OshiAnalysisResultRow = {
  id: string;
  user_id: string;
  result_title: string;
  result_summary: string;
  selected_character_ids: string[];
  hex_stats: HexStat[];
  signature_tags: SignatureTag[];
  confidence: number;
  selected_count: number;
  tagged_count: number;
  expires_at: string;
  created_at: string;
};

const MAX_SAVED = 5;

export async function saveOshiAnalysisResult(
  userId: string,
  result: OshiAnalysisResult,
  characterIds: string[],
): Promise<void> {
  const { error } = await supabase.from("oshi_analysis_results").insert({
    user_id: userId,
    result_title: result.typeName,
    result_summary: result.summary,
    selected_character_ids: characterIds,
    hex_stats: result.hexStats,
    signature_tags: result.signatureTags,
    confidence: result.confidence,
    selected_count: result.selectedCount,
    tagged_count: result.taggedCount,
  });

  if (error) throw error;

  const { data: rows, error: listError } = await supabase
    .from("oshi_analysis_results")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (listError) throw listError;

  const toDelete = (rows ?? []).slice(MAX_SAVED).map((row) => row.id);
  if (toDelete.length === 0) return;

  const { error: deleteError } = await supabase
    .from("oshi_analysis_results")
    .delete()
    .in("id", toDelete);

  if (deleteError) throw deleteError;
}

export async function fetchLatestOshiAnalysisResult(
  userId: string,
): Promise<OshiAnalysisResultRow | null> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("oshi_analysis_results")
    .select("*")
    .eq("user_id", userId)
    .gt("expires_at", now)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data as OshiAnalysisResultRow | null) ?? null;
}

export async function fetchOshiAnalysisResultById(
  resultId: string,
): Promise<OshiAnalysisResultRow | null> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("oshi_analysis_results")
    .select("*")
    .eq("id", resultId)
    .gt("expires_at", now)
    .maybeSingle();

  if (error) throw error;
  return (data as OshiAnalysisResultRow | null) ?? null;
}
