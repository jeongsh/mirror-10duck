import type { Editor } from "@tiptap/react";
import { supabase } from "@/lib/supabase/client";
import { uploadPostMediaAsset } from "@/lib/supabase/postMediaAssets";

export function getImageSize(file: File) {
  return new Promise<{ width: number; height: number }>((resolve) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
      URL.revokeObjectURL(objectUrl);
    };
    image.onerror = () => {
      resolve({ width: 0, height: 0 });
      URL.revokeObjectURL(objectUrl);
    };
    image.src = objectUrl;
  });
}

async function uploadDirectEditorImage(file: File): Promise<string> {
  const fileExt = file.name.split(".").pop() || "jpg";
  const filePath = `editor-images/${crypto.randomUUID()}.${fileExt}`;
  const { error } = await supabase.storage.from("post-assets").upload(filePath, file);

  if (error) throw error;

  const {
    data: { publicUrl },
  } = supabase.storage.from("post-assets").getPublicUrl(filePath);

  return publicUrl;
}

export async function uploadAndInsertEditorImage(params: {
  editor: Editor;
  file: File;
  userId?: string;
  moderateImages?: boolean;
}): Promise<void> {
  const { editor, file, userId, moderateImages = true } = params;
  if (!file.type.startsWith("image/")) {
    throw new Error("이미지 파일만 업로드할 수 있습니다.");
  }

  const imageSize = await getImageSize(file);
  const initialWidth = imageSize.width > 0 ? Math.min(imageSize.width, 760) : 760;
  const imageAttrs = {
    width: initialWidth,
    containerStyle: `width: ${initialWidth}px; height: auto; cursor: pointer; margin: 0.5rem auto;`,
    wrapperStyle: "display: flex; margin: 0;",
  };

  if (!moderateImages) {
    const publicUrl = await uploadDirectEditorImage(file);
    editor.chain().focus().setImage({
      src: publicUrl,
      ...imageAttrs,
    } as any).run();
    return;
  }

  const resolvedUserId = userId ?? (await supabase.auth.getUser()).data.user?.id;
  if (!resolvedUserId) {
    throw new Error("이미지를 업로드하려면 로그인이 필요합니다.");
  }

  const asset = await uploadPostMediaAsset({
    file,
    userId: resolvedUserId,
    source: "post_editor",
    width: imageSize.width,
    height: imageSize.height,
  });

  editor.chain().focus().setImage({
    src: asset.previewUrl,
    ...imageAttrs,
    mediaAssetId: asset.id,
    mediaStatus: asset.scanStatus,
    mediaBucket: asset.bucketId,
    mediaPath: asset.objectPath,
  } as any).run();
}
