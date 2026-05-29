import { normalizeOfficialSlug } from "@/lib/official/catalog";
import { supabase } from "@/lib/supabase/client";

const BUCKET = "post-assets";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function extensionForImage(file: File) {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/jpeg") return "jpg";
  return null;
}

export async function uploadOfficialCatalogImage(
  scope: "works" | "oshi",
  ownerSlug: string,
  file: File,
) {
  const ext = extensionForImage(file);
  if (!ext) {
    throw new Error("PNG, JPG, WEBP 이미지만 업로드할 수 있습니다.");
  }

  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("이미지는 5MB 이하만 업로드할 수 있습니다.");
  }

  const safeOwner = normalizeOfficialSlug(ownerSlug) || "draft";
  const path = `official-catalog/${scope}/${safeOwner}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: true,
  });

  if (error) {
    throw new Error(`이미지 업로드 실패: ${error.message}`);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(path);

  return publicUrl;
}

const CATALOG_REQUEST_MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function extensionForCatalogRequestImage(file: File) {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/jpeg") return "jpg";
  return null;
}

export async function uploadCatalogRequestCharacterImage(characterId: string, file: File) {
  const ext = extensionForCatalogRequestImage(file);
  if (!ext) {
    throw new Error("PNG, JPG, WEBP 이미지만 업로드할 수 있습니다.");
  }
  if (file.size > CATALOG_REQUEST_MAX_IMAGE_BYTES) {
    throw new Error("이미지는 5MB 이하만 업로드할 수 있습니다.");
  }

  const path = `catalog-requests/character/${characterId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });

  if (error) {
    throw new Error(`이미지 업로드 실패: ${error.message}`);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(path);

  return publicUrl;
}
