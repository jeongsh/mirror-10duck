"use client";

import { useCallback, useRef, useState } from "react";
import ReactCrop, { Crop, PixelCrop, centerCrop, convertToPixelCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";

interface Props {
  imageSrc: string;
  aspect?: number;
  title?: string;
  description?: string;
  outputSize?: {
    width: number;
    height: number;
  };
  onConfirm: (blob: Blob) => void;
  onCancel: () => void;
}

async function getCroppedImg(
  image: HTMLImageElement,
  pixelCrop: PixelCrop,
  outputSize?: { width: number; height: number }
): Promise<Blob> {
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  const sourceX = pixelCrop.x * scaleX;
  const sourceY = pixelCrop.y * scaleY;
  const sourceWidth = pixelCrop.width * scaleX;
  const sourceHeight = pixelCrop.height * scaleY;
  const targetWidth = outputSize?.width ?? Math.round(sourceWidth);
  const targetHeight = outputSize?.height ?? Math.round(sourceHeight);

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context unavailable");

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    targetWidth,
    targetHeight
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas to Blob failed"));
      },
      "image/jpeg",
      0.92
    );
  });
}

export default function CardImageCropModal({
  imageSrc,
  aspect = 4,
  title = "이미지 영역 선택",
  description = "선택 박스를 드래그해 영역을 이동하고, 모서리를 드래그해 크기를 조정하세요.",
  outputSize,
  onConfirm,
  onCancel,
}: Props) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [applying, setApplying] = useState(false);

  const onImageLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const { naturalWidth, naturalHeight } = e.currentTarget;
      const initial = centerCrop(
        makeAspectCrop({ unit: "%", width: 90 }, aspect, naturalWidth, naturalHeight),
        naturalWidth,
        naturalHeight
      );
      setCrop(initial);
      setCompletedCrop(convertToPixelCrop(initial, naturalWidth, naturalHeight));
    },
    [aspect]
  );

  const handleConfirm = async () => {
    if (!imgRef.current || !completedCrop) return;
    setApplying(true);
    try {
      const blob = await getCroppedImg(imgRef.current, completedCrop, outputSize);
      onConfirm(blob);
    } catch {
      setApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4">
      <div
        className="flex w-full max-w-2xl flex-col border border-dashed border-gray-500 bg-white shadow-xl"
        style={{ maxHeight: "90vh" }}
      >
        <div className="shrink-0 border-b border-gray-200 px-4 py-3">
          <p className="text-sm font-bold text-gray-800">{title}</p>
          <p className="mt-0.5 text-[11px] text-gray-400">
            {description}
            {outputSize ? ` 저장 크기: ${outputSize.width}x${outputSize.height}px` : ""}
          </p>
        </div>

        <div className="flex flex-1 items-start justify-center overflow-auto bg-gray-900 p-4">
          <ReactCrop
            crop={crop}
            onChange={(_, pct) => setCrop(pct)}
            onComplete={(c) => setCompletedCrop(c)}
            aspect={aspect}
            keepSelection
          >
            <img
              ref={imgRef}
              src={imageSrc}
              onLoad={onImageLoad}
              alt="crop"
              style={{ maxWidth: "100%", display: "block" }}
            />
          </ReactCrop>
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-gray-200 px-4 py-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={applying}
            className="border border-dashed border-gray-400 px-4 py-1.5 text-[11px] font-bold text-gray-600 hover:bg-gray-100 disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={applying || !completedCrop}
            className="bg-gray-900 px-4 py-1.5 text-[11px] font-bold text-white hover:bg-gray-700 disabled:opacity-50"
          >
            {applying ? "처리 중..." : "적용"}
          </button>
        </div>
      </div>
    </div>
  );
}
