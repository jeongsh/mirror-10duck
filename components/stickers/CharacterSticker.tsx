"use client";

import { useMemo } from "react";
import { useCharacterLibraryStore } from "@/store/useCharacterLibraryStore";
import type { StickerToken } from "@/types/community";

/**
 * 토큰 한 개를 시각화하는 캐릭터 스티커 컴포넌트.
 *
 * - 라이브러리에서 characterId 와 매칭되는 프로필을 찾아 썸네일/이름을 노출.
 * - 매칭 실패 시 "(스티커 없음)" 폴백 박스로 깨지지 않게 표시.
 * - 모바일/웹 공통 정렬 규칙: `inline-flex` + 고정 크기(72px) + `align-middle`.
 *   본문 텍스트와 같은 라인에 자연스럽게 흐르고, 줄바꿈 시 깨지지 않는다.
 */
type Size = "sm" | "md" | "lg";

const SIZE_TO_PX: Record<Size, number> = {
  sm: 48,
  md: 72,
  lg: 112,
};

interface Props {
  token: StickerToken;
  size?: Size;
  /** 스티커 위에 마우스를 올렸을 때 표시할 툴팁 라벨. */
  showLabel?: boolean;
}

const EMOTION_LABEL: Record<string, string> = {
  idle: "기본",
  happy: "기쁨",
  sad: "슬픔",
  angry: "화남",
  surprised: "놀람",
  shy: "부끄",
  love: "두근",
  wink: "윙크",
};

export default function CharacterSticker({ token, size = "md", showLabel = false }: Props) {
  const profile = useCharacterLibraryStore((s) =>
    s.profiles.find((p) => p.id === token.characterId) ?? null,
  );

  const px = SIZE_TO_PX[size];

  const emotionLabel = useMemo(() => EMOTION_LABEL[token.emotion] ?? token.emotion, [token.emotion]);

  if (!profile) {
    return (
      <span
        title={`스티커 없음 (${token.raw})`}
        className="inline-flex shrink-0 items-center justify-center border border-dashed border-gray-400 bg-gray-100 align-middle text-[10px] text-gray-500"
        style={{ width: px, height: px }}
      >
        ?
      </span>
    );
  }

  return (
    <span
      title={`${profile.name} · ${emotionLabel}`}
      className="relative inline-flex shrink-0 items-center justify-center overflow-hidden border border-dashed border-gray-400 bg-white align-middle"
      style={{ width: px, height: px }}
    >
      {profile.thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={profile.thumbnailUrl}
          alt={`${profile.name} ${emotionLabel}`}
          width={px}
          height={px}
          className="h-full w-full object-cover"
          draggable={false}
        />
      ) : (
        <span className="px-1 text-center text-[10px] font-bold text-gray-700">
          {profile.name}
        </span>
      )}
      <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/60 px-1 py-0.5 text-center text-[9px] font-bold uppercase tracking-wider text-white">
        {emotionLabel}
      </span>
      {showLabel ? (
        <span className="pointer-events-none absolute inset-x-0 -bottom-5 truncate text-center text-[10px] text-gray-500">
          {profile.name}
        </span>
      ) : null}
    </span>
  );
}
