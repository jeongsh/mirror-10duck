import { supabase } from "@/lib/supabase/client";

const BUCKET = "oshi-card-shares";
const SHARE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

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

export async function createOshiCardShare(input: CreateOshiCardShareInput): Promise<OshiCardShare> {
  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SHARE_TTL_MS).toISOString();

  const [backgroundImageUrl, oshiAvatarUrl, ogImageUrl] = await Promise.all([
    uploadDataUrl(id, "background", input.backgroundImageDataUrl),
    uploadDataUrl(id, "avatar", input.oshiAvatarDataUrl),
    uploadDataUrl(id, "og", input.ogImageDataUrl),
  ]);

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

export async function fetchLatestOshiCardShareForUser(userId: string): Promise<OshiCardShare | null> {
  const { data, error } = await supabase
    .from("oshi_card_shares")
    .select("*")
    .eq("owner_id", userId)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
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
