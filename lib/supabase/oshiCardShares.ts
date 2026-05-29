import { supabase } from "@/lib/supabase/client";

const BUCKET = "oshi-card-shares";
const SHARE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const MAX_OWNED_CARDS = 3;
const OWNED_CARD_EXPIRES_AT = "2099-12-31T23:59:59.999Z";

export type OshiCardShare = {
  id: string;
  owner_id: string | null;
  nickname: string | null;
  oshi: string | null;
  works: string[];
  grade: string;
  type_id: string;
  background_image_url: string | null;
  oshi_avatar_url: string | null;
  og_image_url: string | null;
  expires_at: string;
  created_at: string;
};

export type CreateOshiCardShareInput = {
  ownerId?: string | null;
  nickname: string;
  oshi: string;
  works: string[];
  grade: string;
  typeId: string;
  backgroundImageDataUrl?: string;
  oshiAvatarDataUrl?: string;
  ogImageDataUrl?: string;
};

export type UpdateOshiCardShareInput = Omit<CreateOshiCardShareInput, "ownerId">;

export function isPermanentOshiCardShare(share: OshiCardShare): boolean {
  return share.owner_id !== null;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, base64] = dataUrl.split(",");
  const mimeType = meta.match(/^data:([^;]+);base64$/)?.[1] ?? "image/png";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("이미지 압축 준비에 실패했습니다."));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mimeType, quality);
  });
}

async function compressDataUrl(
  dataUrl: string,
  kind: "background" | "avatar" | "og",
): Promise<{ blob: Blob; mimeType: string; ext: string }> {
  const sourceBlob = dataUrlToBlob(dataUrl);
  const image = await loadImageFromBlob(sourceBlob);
  const maxWidth = kind === "avatar" ? 126 : 734;
  const maxHeight = kind === "avatar" ? 126 : 1024;
  const ratio = Math.min(1, maxWidth / image.naturalWidth, maxHeight / image.naturalHeight);
  const width = Math.max(1, Math.round(image.naturalWidth * ratio));
  const height = Math.max(1, Math.round(image.naturalHeight * ratio));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("이미지 압축에 실패했습니다.");

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, 0, 0, width, height);

  if (kind === "og") {
    const jpeg = await canvasToBlob(canvas, "image/jpeg", 0.88);
    if (jpeg) return { blob: jpeg, mimeType: "image/jpeg", ext: "jpg" };
  }

  const webp = await canvasToBlob(canvas, "image/webp", kind === "background" ? 0.82 : 0.86);
  if (webp) return { blob: webp, mimeType: "image/webp", ext: "webp" };

  const jpeg = await canvasToBlob(canvas, "image/jpeg", kind === "background" ? 0.82 : 0.86);
  if (jpeg) return { blob: jpeg, mimeType: "image/jpeg", ext: "jpg" };

  return { blob: sourceBlob, mimeType: sourceBlob.type || "image/png", ext: "png" };
}

async function uploadDataUrl(shareId: string, kind: "background" | "avatar" | "og", dataUrl?: string) {
  if (!dataUrl) return null;
  if (!dataUrl.startsWith("data:")) return dataUrl;

  const { blob, mimeType, ext } = await compressDataUrl(dataUrl, kind);
  const path = `cards/${shareId}/${kind}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: mimeType,
    upsert: true,
  });

  if (error) throw error;

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(path);

  return publicUrl;
}

async function uploadShareImages(shareId: string, input: UpdateOshiCardShareInput) {
  return Promise.all([
    uploadDataUrl(shareId, "background", input.backgroundImageDataUrl),
    uploadDataUrl(shareId, "avatar", input.oshiAvatarDataUrl),
    uploadDataUrl(shareId, "og", input.ogImageDataUrl),
  ]);
}

export async function countOshiCardSharesForUser(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("oshi_card_shares")
    .select("*", { count: "exact", head: true })
    .eq("owner_id", userId);

  if (error) throw error;
  return count ?? 0;
}

export async function createOshiCardShare(input: CreateOshiCardShareInput): Promise<OshiCardShare> {
  if (input.ownerId) {
    const count = await countOshiCardSharesForUser(input.ownerId);
    if (count >= MAX_OWNED_CARDS) {
      throw new Error(`카드는 최대 ${MAX_OWNED_CARDS}장까지 저장할 수 있습니다. 기존 카드를 삭제한 뒤 다시 시도해 주세요.`);
    }
  }

  const id = crypto.randomUUID();
  const expiresAt = input.ownerId
    ? OWNED_CARD_EXPIRES_AT
    : new Date(Date.now() + SHARE_TTL_MS).toISOString();

  const [backgroundImageUrl, oshiAvatarUrl, ogImageUrl] = await uploadShareImages(id, input);

  const { data, error } = await supabase
    .from("oshi_card_shares")
    .insert({
      id,
      owner_id: input.ownerId ?? null,
      nickname: input.nickname.trim() || null,
      oshi: input.oshi.trim() || null,
      works: input.works.slice(0, 5),
      grade: input.grade,
      type_id: input.typeId,
      background_image_url: backgroundImageUrl,
      oshi_avatar_url: oshiAvatarUrl,
      og_image_url: ogImageUrl,
      expires_at: expiresAt,
    })
    .select()
    .single();

  if (error) throw error;
  return data as OshiCardShare;
}

export async function updateOshiCardShare(
  id: string,
  userId: string,
  input: UpdateOshiCardShareInput,
): Promise<OshiCardShare> {
  const [backgroundImageUrl, oshiAvatarUrl, ogImageUrl] = await uploadShareImages(id, input);

  const patch: Record<string, unknown> = {
    nickname: input.nickname.trim() || null,
    oshi: input.oshi.trim() || null,
    works: input.works.slice(0, 5),
    grade: input.grade,
    type_id: input.typeId,
  };

  if (backgroundImageUrl) patch.background_image_url = backgroundImageUrl;
  if (oshiAvatarUrl) patch.oshi_avatar_url = oshiAvatarUrl;
  if (ogImageUrl) patch.og_image_url = ogImageUrl;

  const { data, error } = await supabase
    .from("oshi_card_shares")
    .update(patch)
    .eq("id", id)
    .eq("owner_id", userId)
    .select()
    .single();

  if (error) throw error;
  return data as OshiCardShare;
}

export async function deleteOshiCardShare(id: string, userId: string): Promise<void> {
  const { error } = await supabase.from("oshi_card_shares").delete().eq("id", id).eq("owner_id", userId);
  if (error) throw error;
}

export async function fetchLatestOshiCardShareForUser(userId: string): Promise<OshiCardShare | null> {
  const shares = await fetchOshiCardSharesForUser(userId, 1);
  return shares[0] ?? null;
}

export async function fetchOshiCardSharesForUser(
  userId: string,
  limit = MAX_OWNED_CARDS,
): Promise<OshiCardShare[]> {
  const { data, error } = await supabase
    .from("oshi_card_shares")
    .select("*")
    .eq("owner_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data as OshiCardShare[]) ?? [];
}

export async function fetchOwnedOshiCardShareById(
  id: string,
  userId: string,
): Promise<OshiCardShare | null> {
  const { data, error } = await supabase
    .from("oshi_card_shares")
    .select("*")
    .eq("id", id)
    .eq("owner_id", userId)
    .maybeSingle();

  if (error) throw error;
  return (data as OshiCardShare | null) ?? null;
}

export async function fetchOshiCardShare(id: string): Promise<OshiCardShare | null> {
  const { data, error } = await supabase
    .from("oshi_card_shares")
    .select("*")
    .eq("id", id)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error) throw error;
  return (data as OshiCardShare | null) ?? null;
}
