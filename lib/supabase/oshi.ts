import { supabase } from "./client";
import {
  OshiPairDirection,
  OshiPairMember,
  OshiRegistration,
  OshiType,
} from "@/types/community";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

type OshiRow = OshiRegistration & { oshi_pair_members?: OshiPairMember[] | null };

function normalizeOshi(row: OshiRow): OshiRegistration {
  const { oshi_pair_members, ...rest } = row;
  let pair_members: OshiPairMember[] | undefined;
  if (Array.isArray(oshi_pair_members) && oshi_pair_members.length > 0) {
    pair_members = [...oshi_pair_members]
      .sort((a, b) => a.member_index - b.member_index)
      .map((m) => ({
        ...m,
        member_index: m.member_index as 1 | 2,
      }));
  }
  return {
    ...rest,
    affiliation: rest.affiliation ?? null,
    reference_work: rest.reference_work ?? null,
    pair_members,
  };
}

export function formatOshiPairLine(o: OshiRegistration): string | null {
  if (o.oshi_type !== "pair" || !o.pair_members?.length) return null;
  const sorted = [...o.pair_members].sort((a, b) => a.member_index - b.member_index);
  const a = sorted[0]?.character_title;
  const b = sorted[1]?.character_title;
  if (!a || !b) return null;
  return `${a} × ${b}`;
}

function formatOshiSecondaryLine(o: OshiRegistration): string | null {
  const bits: string[] = [];
  if (o.affiliation) bits.push(o.affiliation);
  if (o.reference_work) bits.push(o.reference_work);
  if (bits.length) return bits.join(" · ");
  return null;
}

/** 목록·카드용 첫 줄 (CP는 캐릭터 조합 우선) */
export function formatOshiPrimaryTitle(o: OshiRegistration): string {
  const pairLine = formatOshiPairLine(o);
  if (o.oshi_type === "pair" && pairLine) return pairLine;
  return o.title;
}

/** 목록·카드용 둘째 줄 */
export function formatOshiSubtitle(o: OshiRegistration): string | null {
  if (o.oshi_type === "pair") {
    return o.title.trim() ? `작품: ${o.title}` : null;
  }
  return formatOshiSecondaryLine(o);
}

export async function getOshiList(userId: string): Promise<OshiRegistration[]> {
  const { data, error } = await db
    .from("oshi_registrations")
    .select("*, oshi_pair_members(*)")
    .eq("user_id", userId)
    .order("rank", { ascending: true });

  if (error) {
    console.error("Error fetching oshi list:", error);
    return [];
  }
  return (data ?? []).map((r: OshiRow) => normalizeOshi(r));
}

export type UpsertOshiFields = {
  title: string;
  oshi_type: OshiType;
  image_url?: string;
  description?: string;
  is_public?: boolean;
  affiliation?: string | null;
  reference_work?: string | null;
  pair?: {
    charA: string;
    charB: string;
    direction: OshiPairDirection;
  } | null;
};

export async function upsertOshi(
  userId: string,
  rank: number,
  fields: UpsertOshiFields
): Promise<OshiRegistration> {
  const t = fields.oshi_type;
  let affiliation: string | null = null;
  let reference_work: string | null = null;

  if (t === "voice_actor" || t === "creator" || t === "idol_group") {
    affiliation = fields.affiliation?.trim() || null;
  }
  if (t === "voice_actor" || t === "creator") {
    reference_work = fields.reference_work?.trim() || null;
  }
  if (t === "pair") {
    affiliation = null;
    reference_work = null;
  }

  const { data, error } = await db
    .from("oshi_registrations")
    .upsert(
      {
        user_id: userId,
        rank,
        title: fields.title.trim(),
        oshi_type: fields.oshi_type,
        image_url: fields.image_url?.trim() || null,
        description: fields.description?.trim() || null,
        is_public: fields.is_public ?? true,
        affiliation,
        reference_work,
      },
      { onConflict: "user_id,rank" }
    )
    .select()
    .single();

  if (error) throw error;
  const oshiId = data.id as string;

  await db.from("oshi_pair_members").delete().eq("oshi_id", oshiId);

  if (t === "pair" && fields.pair) {
    const a = fields.pair.charA.trim();
    const b = fields.pair.charB.trim();
    const dir = fields.pair.direction;
    const { error: insErr } = await db.from("oshi_pair_members").insert([
      { oshi_id: oshiId, member_index: 1, character_title: a, direction: dir },
      { oshi_id: oshiId, member_index: 2, character_title: b, direction: null },
    ]);
    if (insErr) throw insErr;
  }

  const { data: full, error: loadErr } = await db
    .from("oshi_registrations")
    .select("*, oshi_pair_members(*)")
    .eq("id", oshiId)
    .single();
  if (loadErr) throw loadErr;
  return normalizeOshi(full as OshiRow);
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
