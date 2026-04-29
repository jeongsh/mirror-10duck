"use client";

import { useMemo } from "react";
import { splitContentSegments } from "@/lib/stickers/token";
import CharacterSticker from "./CharacterSticker";

/**
 * 본문 문자열을 텍스트와 캐릭터 스티커가 섞인 React 노드로 렌더링한다.
 *
 * - 텍스트 부분은 `whitespace-pre-wrap` 으로 줄바꿈 보존.
 * - 스티커 토큰은 `CharacterSticker` 로 치환.
 * - 한 단락 안에 텍스트와 스티커가 섞여도 라인 정렬이 깨지지 않도록 inline 으로 흐른다.
 */
interface Props {
  content: string;
  className?: string;
}

export default function RichContent({ content, className }: Props) {
  const segments = useMemo(() => splitContentSegments(content), [content]);

  return (
    <div className={`whitespace-pre-wrap break-words text-sm leading-7 text-gray-800 ${className ?? ""}`}>
      {segments.map((seg, idx) => {
        if (seg.type === "text") {
          return <span key={idx}>{seg.value}</span>;
        }
        return (
          <span key={idx} className="mx-1 inline-block align-middle">
            <CharacterSticker token={seg.token} size="md" />
          </span>
        );
      })}
    </div>
  );
}
