"use client";

import { useState, useRef, useCallback } from "react";
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";

interface Props {
  imageSrc: string;
  aspect?: number;
  onConfirm: (blob: Blob) => void;
  onCancel: () => void;
}

async function getCroppedImg(image: HTMLImageElement, pixelCrop: PixelCrop): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
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

export default function CardImageCropModal({ imageSrc, aspect = 4, onConfirm, onCancel }: Props) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [applying, setApplying] = useState(false);

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = e.currentTarget;
    const initial = centerCrop(
      makeAspectCrop({ unit: "%", width: 90 }, aspect, naturalWidth, naturalHeight),
      naturalWidth,
      naturalHeight
    );
    setCrop(initial);
  }, [aspect]);

  const handleConfirm = async () => {
    if (!imgRef.current || !completedCrop) return;
    setApplying(true);
    try {
      const blob = await getCroppedImg(imgRef.current, completedCrop);
      onConfirm(blob);
    } catch {
      setApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl flex flex-col" style={{ maxHeight: "90vh" }}>
        {/* 헤더 */}
        <div className="px-4 py-3 border-b border-gray-200 shrink-0">
          <p className="text-sm font-bold text-gray-800">이미지 영역 선택</p>
          <p className="text-[11px] text-gray-400 mt-0.5">선택 박스를 드래그해 영역 이동 · 모서리를 드래그해 크기 조정</p>
        </div>

        {/* 이미지 영역 */}
        <div className="overflow-auto bg-gray-900 flex items-start justify-center p-4" style={{ flex: 1 }}>
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

        {/* 버튼 */}
        <div className="px-4 py-4 shrink-0 flex gap-2 justify-end border-t border-gray-200">
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
            className="bg-gray-900 text-white px-4 py-1.5 text-[11px] font-bold hover:bg-gray-700 disabled:opacity-50"
          >
            {applying ? "처리 중..." : "적용"}
          </button>
        </div>
      </div>
    </div>
  );
}
