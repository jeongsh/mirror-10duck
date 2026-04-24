"use client";

import { useCharacterLibraryStore } from "@/store/useCharacterLibraryStore";
import { useCharacterStore } from "@/store/useCharacterStore";

/**
 * 등록된 캐릭터 목록 + 활성 캐릭터 선택 UI.
 */
export default function CharacterLibraryPanel() {
  const profiles = useCharacterLibraryStore((s) => s.profiles);
  const activeId = useCharacterLibraryStore((s) => s.activeId);
  const setActive = useCharacterLibraryStore((s) => s.setActive);
  const unregister = useCharacterLibraryStore((s) => s.unregister);
  const setProfile = useCharacterStore((s) => s.setProfile);

  const loadCharacter = (id: string) => {
    const p = profiles.find((p) => p.id === id);
    if (!p) return;
    setActive(id);
    setProfile(p);
  };

  const unloadAll = () => {
    setActive(null);
    setProfile(null);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] tracking-widest uppercase text-gray-500">
          [라이브러리 · {profiles.length} 개]
        </span>
        <button
          type="button"
          onClick={unloadAll}
          className="border border-dashed border-gray-600 bg-white/70 px-2 py-1 text-[10px] tracking-widest uppercase text-gray-700"
        >
          [UNLOAD]
        </button>
      </div>

      {profiles.length === 0 && (
        <div className="border border-dashed border-gray-400 bg-white/40 p-3 text-xs text-gray-500">
          등록된 캐릭터가 없습니다.
        </div>
      )}

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {profiles.map((p) => {
          const isActive = activeId === p.id;
          return (
            <div
              key={p.id}
              className={
                "border border-dashed p-2 text-xs space-y-1 " +
                (isActive
                  ? "border-green-700 bg-green-50"
                  : "border-gray-500 bg-white/60")
              }
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold">{p.name}</span>
                {p.isBuiltIn && (
                  <span className="border border-dashed border-gray-500 bg-white/70 px-1 text-[10px] tracking-widest uppercase text-gray-600">
                    BUILT-IN
                  </span>
                )}
              </div>
              {p.description && (
                <div className="line-clamp-2 text-[11px] text-gray-600">
                  {p.description}
                </div>
              )}
              <div className="flex items-center gap-1 text-[10px] font-mono text-gray-500">
                <span>exp: {Object.values(p.expressionMap).filter(Boolean).length}</span>
                <span>·</span>
                <span>motions: {Object.values(p.motionMap).filter(Boolean).length}</span>
                <span>·</span>
                <span>outfits: {p.outfits.length}</span>
              </div>
              <div className="flex gap-1 pt-1">
                <button
                  type="button"
                  onClick={() => loadCharacter(p.id)}
                  disabled={isActive}
                  className="border border-dashed border-gray-600 bg-white/80 px-2 py-0.5 text-[10px] tracking-widest uppercase disabled:opacity-40"
                >
                  [{isActive ? "ACTIVE" : "LOAD"}]
                </button>
                {!p.isBuiltIn && (
                  <button
                    type="button"
                    onClick={() => unregister(p.id)}
                    className="border border-dashed border-red-500 bg-red-50 px-2 py-0.5 text-[10px] tracking-widest uppercase text-red-700"
                  >
                    [DELETE]
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
