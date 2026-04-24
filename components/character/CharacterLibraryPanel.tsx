"use client";

import { useState } from "react";
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
  const updateProfile = useCharacterLibraryStore((s) => s.updateProfile);
  const setProfile = useCharacterStore((s) => s.setProfile);
  const modelConfig = useCharacterStore((s) => s.modelConfig);
  const setModelConfig = useCharacterStore((s) => s.setModelConfig);
  const [draftView, setDraftView] = useState<
    Record<string, { scale: string; x: string; y: string }>
  >({});

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

  const getDraft = (id: string, fallback: { scale: number; x: number; y: number }) =>
    draftView[id] ?? {
      scale: String(fallback.scale),
      x: String(fallback.x),
      y: String(fallback.y),
    };

  const updateDraft = (
    id: string,
    key: "scale" | "x" | "y",
    value: string,
    fallback: { scale: number; x: number; y: number }
  ) => {
    const prev = getDraft(id, fallback);
    setDraftView((s) => ({
      ...s,
      [id]: { ...prev, [key]: value },
    }));
  };

  const saveDefaultViewFromDraft = (id: string, fallback: { scale: number; x: number; y: number }) => {
    const draft = getDraft(id, fallback);
    const next = {
      scale: Number(draft.scale),
      x: Number(draft.x),
      y: Number(draft.y),
    };
    if (!Number.isFinite(next.scale) || !Number.isFinite(next.x) || !Number.isFinite(next.y)) return;

    updateProfile(id, { defaultView: next });
    const target = profiles.find((p) => p.id === id);
    if (!target) return;

    if (activeId === id) {
      const patched = { ...target, defaultView: next };
      setProfile(patched);
      setModelConfig(next);
    }
  };

  const saveCurrentAsDefault = (id: string) => {
    if (!modelConfig) return;
    updateProfile(id, { defaultView: modelConfig });
    setDraftView((s) => ({
      ...s,
      [id]: {
        scale: String(modelConfig.scale),
        x: String(modelConfig.x),
        y: String(modelConfig.y),
      },
    }));
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
              <div className="mt-2 border-t border-dashed border-gray-300 pt-2">
                <div className="mb-1 text-[10px] tracking-widest uppercase text-gray-500">
                  [기본 위치/스케일]
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <label className="flex flex-col gap-0.5 text-[10px] text-gray-600">
                    scale
                    <input
                      type="number"
                      step="0.01"
                      value={getDraft(p.id, p.defaultView).scale}
                      onChange={(e) => updateDraft(p.id, "scale", e.target.value, p.defaultView)}
                      className="border border-dashed border-gray-400 bg-white/80 px-1 py-0.5 text-[11px]"
                    />
                  </label>
                  <label className="flex flex-col gap-0.5 text-[10px] text-gray-600">
                    x
                    <input
                      type="number"
                      step="1"
                      value={getDraft(p.id, p.defaultView).x}
                      onChange={(e) => updateDraft(p.id, "x", e.target.value, p.defaultView)}
                      className="border border-dashed border-gray-400 bg-white/80 px-1 py-0.5 text-[11px]"
                    />
                  </label>
                  <label className="flex flex-col gap-0.5 text-[10px] text-gray-600">
                    y
                    <input
                      type="number"
                      step="1"
                      value={getDraft(p.id, p.defaultView).y}
                      onChange={(e) => updateDraft(p.id, "y", e.target.value, p.defaultView)}
                      className="border border-dashed border-gray-400 bg-white/80 px-1 py-0.5 text-[11px]"
                    />
                  </label>
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={() => saveDefaultViewFromDraft(p.id, p.defaultView)}
                    className="border border-dashed border-gray-600 bg-white/80 px-2 py-0.5 text-[10px] tracking-widest uppercase"
                  >
                    [기본값 저장]
                  </button>
                  <button
                    type="button"
                    onClick={() => saveCurrentAsDefault(p.id)}
                    disabled={!modelConfig || activeId !== p.id}
                    className="border border-dashed border-blue-500 bg-blue-50 px-2 py-0.5 text-[10px] tracking-widest uppercase text-blue-700 disabled:opacity-40"
                  >
                    [현재상태 저장]
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
