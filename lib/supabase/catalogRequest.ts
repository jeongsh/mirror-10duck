import { supabase } from "./client";
import type { CatalogEditChanges, CatalogRequestReason } from "@/lib/catalogRequest";
import type { OfficialOshiCharacter, OfficialWork, OfficialWorkCategory } from "@/types/official";
import {
  searchOshiAnalysisCharacters,
  searchOshiAnalysisWorks,
  type OshiAnalysisCharacter,
  type OshiAnalysisWork,
} from "./oshiAnalysis";

export type { OshiAnalysisWork };

export type CharacterAddRequestInput = {
  characterName: string;
  characterOriginalName?: string;
  characterNote?: string;
  workTitle: string;
  officialWorkId?: string | null;
  requestNewWork?: boolean;
  workCategory?: OfficialWorkCategory | null;
  sourceUrl?: string;
  reason: CatalogRequestReason;
  source?: string;
  requesterId?: string | null;
};

export type WorkAddRequestInput = {
  workTitle: string;
  originalTitle?: string;
  category: OfficialWorkCategory;
  sourceUrl?: string;
  reason: CatalogRequestReason;
  source?: string;
  requesterId?: string | null;
};

export type CatalogEditRequestInput = {
  targetType: "character" | "work";
  characterId?: string;
  workId?: string;
  changes: CatalogEditChanges;
  reason?: string;
  source?: string;
  requesterId?: string | null;
};

export async function submitCharacterAddRequest(
  input: CharacterAddRequestInput
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("character_add_requests")
    .insert({
      requester_id: input.requesterId ?? null,
      character_name: input.characterName.trim(),
      character_original_name: input.characterOriginalName?.trim() || null,
      character_note: input.characterNote?.trim() || null,
      work_title: input.workTitle.trim(),
      official_work_id: input.officialWorkId ?? null,
      request_new_work: input.requestNewWork ?? false,
      work_category: input.workCategory ?? null,
      source_url: input.sourceUrl?.trim() || null,
      reason: input.reason,
      source: input.source ?? null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[catalogRequest] character add error:", error.message);
    return { ok: false, message: error.message };
  }

  return { ok: true, id: data.id as string };
}

export type CharacterWithNewWorkRequestInput = {
  workTitle: string;
  workOriginalTitle?: string;
  workCategory: OfficialWorkCategory;
  workSourceUrl?: string;
  characterName: string;
  characterOriginalName?: string;
  characterNote?: string;
  characterSourceUrl?: string;
  reason: CatalogRequestReason;
  source?: string;
  requesterId?: string | null;
};

/** 작품·캐릭터를 각각 work_add_requests / character_add_requests에 접수 */
export async function submitCharacterWithNewWorkRequest(
  input: CharacterWithNewWorkRequestInput
): Promise<
  | { ok: true; workRequestId: string; characterRequestId: string }
  | { ok: false; message: string }
> {
  const workResult = await submitWorkAddRequest({
    workTitle: input.workTitle,
    originalTitle: input.workOriginalTitle,
    category: input.workCategory,
    sourceUrl: input.workSourceUrl,
    reason: "missing_character",
    source: input.source,
    requesterId: input.requesterId,
  });

  if (!workResult.ok) {
    return workResult;
  }

  const characterResult = await submitCharacterAddRequest({
    characterName: input.characterName,
    characterOriginalName: input.characterOriginalName,
    characterNote: input.characterNote,
    workTitle: input.workTitle,
    requestNewWork: true,
    workCategory: input.workCategory,
    sourceUrl: input.characterSourceUrl ?? input.workSourceUrl,
    reason: input.reason,
    source: input.source,
    requesterId: input.requesterId,
  });

  if (!characterResult.ok) {
    return characterResult;
  }

  return {
    ok: true,
    workRequestId: workResult.id,
    characterRequestId: characterResult.id,
  };
}

export async function submitWorkAddRequest(
  input: WorkAddRequestInput
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("work_add_requests")
    .insert({
      requester_id: input.requesterId ?? null,
      work_title: input.workTitle.trim(),
      original_title: input.originalTitle?.trim() || null,
      category: input.category,
      source_url: input.sourceUrl?.trim() || null,
      reason: input.reason,
      source: input.source ?? null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[catalogRequest] work add error:", error.message);
    return { ok: false, message: error.message };
  }

  return { ok: true, id: data.id as string };
}

export async function submitCatalogEditRequest(
  input: CatalogEditRequestInput
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("catalog_edit_requests")
    .insert({
      requester_id: input.requesterId ?? null,
      target_type: input.targetType,
      character_id: input.characterId ?? null,
      work_id: input.workId ?? null,
      changes: input.changes,
      reason: input.reason?.trim() || null,
      source: input.source ?? null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[catalogRequest] edit error:", error.message);
    return { ok: false, message: error.message };
  }

  return { ok: true, id: data.id as string };
}

export async function getCatalogCharacterForEdit(
  id: string
): Promise<OshiAnalysisCharacter | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("official_oshi_characters")
    .select(
      [
        "id",
        "work_id",
        "slug",
        "name",
        "original_name",
        "aliases",
        "gender",
        "positions",
        "tags",
        "meme_tags",
        "description",
        "profile_image_url",
        "status",
        "sort_order",
        "created_at",
        "updated_at",
        "official_works!inner(id, title, original_title, category, genres, cover_image_url)",
      ].join(", ")
    )
    .eq("id", id)
    .eq("status", "PUBLISHED")
    .maybeSingle();

  if (error) {
    console.error("[catalogRequest] character fetch error:", error.message);
    return null;
  }

  return (data as OshiAnalysisCharacter | null) ?? null;
}

export async function getCatalogWorkForEdit(id: string): Promise<OshiAnalysisWork | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("official_works")
    .select("id, title, original_title, category, genres, cover_image_url")
    .eq("id", id)
    .eq("status", "PUBLISHED")
    .maybeSingle();

  if (error) {
    console.error("[catalogRequest] work fetch error:", error.message);
    return null;
  }

  return (data as OshiAnalysisWork | null) ?? null;
}

export async function getFullWorkForEdit(id: string): Promise<OfficialWork | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("official_works")
    .select("*")
    .eq("id", id)
    .eq("status", "PUBLISHED")
    .maybeSingle();

  if (error) {
    console.error("[catalogRequest] full work fetch error:", error.message);
    return null;
  }

  return (data as OfficialWork | null) ?? null;
}

export async function getFullCharacterForEdit(
  id: string
): Promise<(OfficialOshiCharacter & { official_works: OfficialWork }) | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("official_oshi_characters")
    .select("*, official_works(*)")
    .eq("id", id)
    .eq("status", "PUBLISHED")
    .maybeSingle();

  if (error) {
    console.error("[catalogRequest] full character fetch error:", error.message);
    return null;
  }

  return data as (OfficialOshiCharacter & { official_works: OfficialWork }) | null;
}

export { searchOshiAnalysisWorks, searchOshiAnalysisCharacters };
