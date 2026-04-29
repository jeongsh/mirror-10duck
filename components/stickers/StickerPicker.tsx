"use client";

import { useEffect, useRef, useState } from "react";
import { useCharacterLibraryStore } from "@/store/useCharacterLibraryStore";
import { ALL_EMOTIONS, type CharacterEmotion } from "@/types/character";
import { buildStickerToken } from "@/lib/stickers/token";
import CharacterSticker from "./CharacterSticker";

/**
 * 본문/댓글 에디터 옆에 붙여서 사용하는 스티커 피커.
 *
 * - "스티커 삽입" 버튼을 누르면 팝오버가 열린다.
 * - 라이브러리에 등록된 캐릭터 목록과 8종 감정 그리드를 보여준다.
 * - 셀을 누르면 `:sticker/{characterId}/{emotion}:` 토큰을 콜백으로 전달한다.
 *
 * 외부 클릭/ESC 로 닫히도록 처리하여 모바일/웹 모두에서 자연스럽게 동작.
 */
interface Props {
  onInsert: (token: string) => void;
  /** 버튼 라벨 커스터마이즈. */
  label?: string;
  className?: string;
}

export default function StickerPicker({ onInsert, label = "스티커 삽입", className }: Props) {
  const profiles = useCharacterLibraryStore((s) => s.profiles);
  const activeId = useCharacterLibraryStore((s) => s.activeId);
  const [open, setOpen] = useState(false);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onClickOutside = (event: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (selectedCharacterId) return;
    const initial = activeId && profiles.some((p) => p.id === activeId) ? activeId : profiles[0]?.id ?? null;
    setSelectedCharacterId(initial);
  }, [open, profiles, activeId, selectedCharacterId]);

  const handleInsert = (characterId: string, emotion: CharacterEmotion) => {
    onInsert(buildStickerToken(characterId, emotion));
    setOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative inline-block ${className ?? ""}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="border border-dashed border-gray-500 bg-white px-3 py-2 text-sm hover:bg-gray-100"
      >
        🎨 {label}
      </button>

      {open ? (
        <div className="absolute left-0 z-30 mt-2 w-[320px] max-w-[80vw] border border-dashed border-gray-500 bg-white p-3 shadow-lg sm:w-[380px]">
          {profiles.length === 0 ? (
            <p className="p-4 text-center text-xs text-gray-500">
              라이브러리에 등록된 캐릭터가 없습니다. 프로필 → 캐릭터 관리에서 먼저 등록해 주세요.
            </p>
          ) : (
            <>
              <div className="mb-3">
                <label className="text-[11px] font-bold uppercase tracking-widest text-gray-500">
                  캐릭터
                </label>
                <select
                  value={selectedCharacterId ?? ""}
                  onChange={(e) => setSelectedCharacterId(e.target.value)}
                  className="mt-1 w-full border border-dashed border-gray-400 bg-white px-2 py-1 text-sm"
                >
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {ALL_EMOTIONS.map((emotion) => (
                  <button
                    key={emotion}
                    type="button"
                    onClick={() => selectedCharacterId && handleInsert(selectedCharacterId, emotion)}
                    disabled={!selectedCharacterId}
                    className="flex flex-col items-center gap-1 border border-dashed border-gray-300 bg-gray-50 p-1 hover:border-gray-700 hover:bg-white disabled:opacity-50"
                  >
                    {selectedCharacterId ? (
                      <CharacterSticker
                        token={{
                          characterId: selectedCharacterId,
                          emotion,
                          raw: buildStickerToken(selectedCharacterId, emotion),
                        }}
                        size="sm"
                      />
                    ) : (
                      <span className="inline-block h-12 w-12 border border-dashed border-gray-300 bg-white" />
                    )}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-[10px] text-gray-400">
                선택한 셀이 본문 커서 위치에 토큰으로 삽입됩니다.
              </p>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
