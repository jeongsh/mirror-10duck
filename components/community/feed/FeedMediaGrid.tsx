"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";

interface FeedMediaGridProps {
  imageUrls: string[];
  onRemove?: (index: number) => void;
}

export default function FeedMediaGrid({ imageUrls, onRemove }: FeedMediaGridProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const images = imageUrls.slice(0, 4);

  useEffect(() => {
    if (activeIndex === null) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActiveIndex(null);
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [activeIndex]);

  if (images.length === 0) return null;

  const imageButton = (url: string, index: number, className = "") => (
    <div
      key={`${url}-${index}`}
      role="button"
      tabIndex={0}
      onClick={(event) => {
        event.stopPropagation();
        setActiveIndex(index);
      }}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        event.stopPropagation();
        setActiveIndex(index);
      }}
      className={`relative block overflow-hidden border border-dashed border-gray-400 bg-gray-50 ${className}`}
    >
      <img
        src={url}
        alt={`첨부 이미지 ${index + 1}`}
        className="h-full w-full object-cover"
      />
      {onRemove ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onRemove(index);
          }}
          className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center border border-dashed border-gray-500 bg-white/90 text-gray-800 hover:bg-gray-200"
          title="이미지 제거"
        >
          <X size={16} />
        </button>
      ) : null}
    </div>
  );

  return (
    <>
      <div className="mt-3 overflow-hidden border border-dashed border-gray-500 bg-white">
        {images.length === 1 ? (
          <div className="max-h-[520px]">
            {imageButton(images[0], 0, "h-full max-h-[520px] w-full")}
          </div>
        ) : null}

        {images.length === 2 ? (
          <div className="grid aspect-[16/9] grid-cols-2 gap-px bg-gray-500">
            {images.map((url, index) => imageButton(url, index, "h-full w-full border-0"))}
          </div>
        ) : null}

        {images.length === 3 ? (
          <div className="grid aspect-[16/9] grid-cols-2 gap-px bg-gray-500">
            {imageButton(images[0], 0, "h-full w-full border-0")}
            <div className="grid grid-rows-2 gap-px">
              {imageButton(images[1], 1, "h-full w-full border-0")}
              {imageButton(images[2], 2, "h-full w-full border-0")}
            </div>
          </div>
        ) : null}

        {images.length === 4 ? (
          <div className="grid aspect-[4/3] grid-cols-2 gap-px bg-gray-500">
            {images.map((url, index) => imageButton(url, index, "h-full w-full border-0"))}
          </div>
        ) : null}
      </div>

      {activeIndex !== null ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setActiveIndex(null)}
        >
          <div
            className="relative max-h-full max-w-5xl border border-dashed border-gray-500 bg-black"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setActiveIndex(null)}
              className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center border border-dashed border-gray-500 bg-white text-gray-900 hover:bg-gray-200"
              title="닫기"
            >
              <X size={18} />
            </button>
            <img
              src={images[activeIndex]}
              alt={`확대 이미지 ${activeIndex + 1}`}
              className="max-h-[88vh] max-w-[92vw] object-contain"
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
