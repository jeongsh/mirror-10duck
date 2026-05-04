import { supabase } from "@/lib/supabase/client";
import type { CharacterProfile } from "@/types/character";

type CharacterProfileRow = {
  character_id: string;
  profile_json: CharacterProfile;
};

function isPersistableProfile(profile: CharacterProfile): boolean {
  // object URL 기반 업로드 모델은 세션 휘발성이므로 DB에 저장해도 복원이 불가능하다.
  return !profile.modelPath.startsWith("blob:");
}

export async function listCharacterProfiles(): Promise<CharacterProfile[]> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) return [];

  const { data, error } = await supabase
    .from("characters")
    .select("character_id, profile_json")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("[characters] list error:", error.message);
    return [];
  }

  return ((data ?? []) as CharacterProfileRow[])
    .map((row) => row.profile_json)
    .filter(Boolean);
}

export async function upsertCharacterProfile(profile: CharacterProfile): Promise<void> {
  if (!isPersistableProfile(profile)) return;

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) return;

  const payload = {
    user_id: user.id,
    character_id: profile.id,
    profile_json: {
      ...profile,
      blobUrls: [],
    },
  };

  const { error } = await supabase
    .from("characters")
    .upsert(payload, { onConflict: "user_id,character_id" });

  if (error) {
    console.error("[characters] upsert error:", error.message);
  }
}

export async function deleteCharacterProfileById(characterId: string): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) return;

  const { error } = await supabase
    .from("characters")
    .delete()
    .eq("user_id", user.id)
    .eq("character_id", characterId);

  if (error) {
    console.error("[characters] delete error:", error.message);
  }
}
