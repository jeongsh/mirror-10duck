import { supabase } from "@/lib/supabase/client";

export const POST_MEDIA_QUARANTINE_BUCKET = "post-media-quarantine";

export type PostMediaUploadSource = "post_editor" | "feed_composer" | "comment_editor";

export type UploadedPostMediaAsset = {
  id: string;
  bucketId: string;
  objectPath: string;
  previewUrl: string;
  scanStatus: "pending";
};

export type PostMediaScanResult = {
  id: string;
  scanStatus: "approved" | "rejected" | "needs_review";
  riskLevel: "safe" | "low" | "medium" | "high" | "blocked";
  reason: string | null;
};

const MAX_IMAGE_MB = 20;
const MAX_IMAGE_BYTES = MAX_IMAGE_MB * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

export function getPostMediaErrorMessage(error: unknown, fallback = "이미지 처리에 실패했습니다."): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    if (typeof record.message === "string" && record.message.trim()) return record.message;
    if (typeof record.error === "string" && record.error.trim()) return record.error;
    if (typeof record.details === "string" && record.details.trim()) return record.details;
  }
  if (typeof error === "string" && error.trim()) return error;
  return fallback;
}

function getExtension(file: File): string {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/gif") return "gif";
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]+$/.test(fromName)) return fromName;
  return "jpg";
}

const COMPRESS_MAX_DIMENSION = 1920;
const COMPRESS_QUALITY = 0.85;

async function compressImageFile(
  file: File,
): Promise<{ file: File; width: number; height: number }> {
  // GIF은 애니메이션이 깨지므로 원본 그대로
  if (file.type === "image/gif") {
    return { file, width: 0, height: 0 };
  }

  const bitmap = await createImageBitmap(file);
  const origW = bitmap.width;
  const origH = bitmap.height;

  const scale = Math.min(1, COMPRESS_MAX_DIMENSION / Math.max(origW, origH));
  const targetW = Math.round(origW * scale);
  const targetH = Math.round(origH * scale);

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, targetW, targetH);
  bitmap.close();

  const toBlob = (type: string) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, COMPRESS_QUALITY));

  let blob = await toBlob("image/webp");
  let outType = "image/webp";
  let ext = "webp";

  if (!blob || blob.size === 0) {
    blob = await toBlob("image/jpeg");
    outType = "image/jpeg";
    ext = "jpg";
  }

  if (!blob) throw new Error("이미지 압축에 실패했습니다.");

  // 리사이즈 없이 압축 결과가 더 크면 원본 사용 (단, 형식은 변환)
  const useCompressed = scale < 1 || blob.size < file.size;
  if (!useCompressed) {
    return { file, width: origW, height: origH };
  }

  const baseName = file.name.replace(/\.[^.]+$/, "");
  const compressedFile = new File([blob], `${baseName}.${ext}`, { type: outType });
  return { file: compressedFile, width: targetW, height: targetH };
}

export function validatePostImageFile(file: File): void {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error("PNG, JPG, WEBP, GIF 이미지만 업로드할 수 있습니다.");
  }
  if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
    throw new Error(`이미지는 ${MAX_IMAGE_MB}MB 이하만 업로드할 수 있습니다.`);
  }
}

export async function uploadPostMediaAsset(params: {
  file: File;
  userId: string;
  source: PostMediaUploadSource;
  width?: number;
  height?: number;
}): Promise<UploadedPostMediaAsset> {
  const { userId, source } = params;
  if (!userId) throw new Error("이미지를 업로드하려면 로그인이 필요합니다.");
  validatePostImageFile(params.file);

  const { file, width, height } = await compressImageFile(params.file).then((result) => ({
    file: result.file,
    width: result.width || params.width,
    height: result.height || params.height,
  }));

  const objectPath = `${userId}/${crypto.randomUUID()}.${getExtension(file)}`;

  const { error: uploadError } = await supabase.storage
    .from(POST_MEDIA_QUARANTINE_BUCKET)
    .upload(objectPath, file, { contentType: file.type, upsert: false });

  if (uploadError) throw new Error(getPostMediaErrorMessage(uploadError, "이미지 업로드에 실패했습니다."));

  const { data: row, error: insertError } = await supabase
    .from("post_media_assets")
    .insert({
      uploaded_by: userId,
      bucket_id: POST_MEDIA_QUARANTINE_BUCKET,
      object_path: objectPath,
      source,
      original_name: params.file.name,
      mime_type: file.type,
      size_bytes: file.size,
      width: width && width > 0 ? Math.round(width) : null,
      height: height && height > 0 ? Math.round(height) : null,
      scan_status: "pending",
      risk_level: "unknown",
    })
    .select("id, bucket_id, object_path")
    .single();

  if (insertError) {
    await supabase.storage.from(POST_MEDIA_QUARANTINE_BUCKET).remove([objectPath]);
    throw new Error(getPostMediaErrorMessage(insertError, "이미지 검역 정보를 저장하지 못했습니다."));
  }

  const { data: signed, error: signedError } = await supabase.storage
    .from(POST_MEDIA_QUARANTINE_BUCKET)
    .createSignedUrl(objectPath, 60 * 60);

  if (signedError) throw new Error(getPostMediaErrorMessage(signedError, "이미지 미리보기를 만들지 못했습니다."));

  return {
    id: row.id as string,
    bucketId: row.bucket_id as string,
    objectPath: row.object_path as string,
    previewUrl: signed.signedUrl,
    scanStatus: "pending",
  };
}

export function extractPostMediaAssetIds(content: string): string[] {
  const ids = new Set<string>();
  const pendingPattern = /!image_pending\[([0-9a-f-]{36})\]/gi;
  let match: RegExpExecArray | null;

  while ((match = pendingPattern.exec(content)) !== null) {
    ids.add(match[1]);
  }

  try {
    const json = JSON.parse(content);
    collectPostMediaAssetIds(json, ids);
  } catch {
    // Non-JSON legacy body.
  }

  return Array.from(ids);
}

function collectPostMediaAssetIds(value: unknown, ids: Set<string>): void {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item) => collectPostMediaAssetIds(item, ids));
    return;
  }

  const record = value as Record<string, unknown>;
  const attrs = record.attrs;
  if (attrs && typeof attrs === "object") {
    const mediaAssetId = (attrs as Record<string, unknown>).mediaAssetId;
    if (typeof mediaAssetId === "string" && /^[0-9a-f-]{36}$/i.test(mediaAssetId)) {
      ids.add(mediaAssetId);
    }
  }

  Object.values(record).forEach((item) => collectPostMediaAssetIds(item, ids));
}

export async function attachPostMediaAssetsToPost(content: string, postId: string): Promise<PostMediaScanResult[]> {
  const ids = extractPostMediaAssetIds(content);
  if (ids.length === 0) return [];

  const { error } = await supabase
    .from("post_media_assets")
    .update({ attached_post_id: postId, updated_at: new Date().toISOString() })
    .in("id", ids);

  if (error) throw error;

  return scanAttachedPostMediaAssets(ids);
}

export async function scanAttachedPostMediaAssets(assetIds: string[]): Promise<PostMediaScanResult[]> {
  const ids = Array.from(new Set(assetIds)).filter((id) => /^[0-9a-f-]{36}$/i.test(id));
  if (ids.length === 0) return [];

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return [];

  const response = await fetch("/api/post-media/scan", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ assetIds: ids }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error ?? "이미지 안전 검사를 실행하지 못했습니다.");
  }

  const body = await response.json().catch(() => null) as { processed?: PostMediaScanResult[] } | null;
  const processed = body?.processed ?? [];
  const blocked = processed.find((item) =>
    item.scanStatus === "rejected" ||
    item.scanStatus === "needs_review" ||
    item.riskLevel === "high" ||
    item.riskLevel === "blocked"
  );
  if (blocked) {
    throw new Error(blocked.reason ?? "너무 부적절한 이미지가 포함되어 게시글을 작성할 수 없습니다.");
  }

  return processed;
}
