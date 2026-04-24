"use client";

import { useEffect, useMemo, useState } from "react";
import { useCharacterLibraryStore } from "@/store/useCharacterLibraryStore";
import { useCharacterStore } from "@/store/useCharacterStore";
import {
  ALL_ACTIONS,
  ALL_EMOTIONS,
  type CharacterActionKey,
  type CharacterEmotion,
  type CharacterProfile,
  type MorphSlider,
  type OutfitGroup,
  type ParameterPreset,
} from "@/types/character";

function parseNumberOr(value: string, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parseJson<T>(text: string, fallback: T): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

function linesToArray(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function arrayToLines(lines: string[] | undefined): string {
  return (lines ?? []).join("\n");
}

export default function LibraryManagerPanel({ initialTargetId }: { initialTargetId?: string }) {
  const profiles = useCharacterLibraryStore((s) => s.profiles);
  const activeId = useCharacterLibraryStore((s) => s.activeId);
  const updateProfile = useCharacterLibraryStore((s) => s.updateProfile);

  const loadedProfile = useCharacterStore((s) => s.profile);
  const setLoadedProfile = useCharacterStore((s) => s.setProfile);
  const modelConfig = useCharacterStore((s) => s.modelConfig);
  const setModelConfig = useCharacterStore((s) => s.setModelConfig);

  const [targetId, setTargetId] = useState<string>("");
  const [outfitsJson, setOutfitsJson] = useState("");
  const [presetsJson, setPresetsJson] = useState("");

  useEffect(() => {
    if (initialTargetId) {
      setTargetId(initialTargetId);
      return;
    }
    if (!targetId && activeId) {
      setTargetId(activeId);
      return;
    }
    if (!targetId && profiles.length > 0) {
      setTargetId(profiles[0].id);
    }
  }, [activeId, profiles, targetId, initialTargetId]);

  const target = useMemo(
    () => profiles.find((p) => p.id === targetId) ?? null,
    [profiles, targetId]
  );

  useEffect(() => {
    if (!target) return;
    setOutfitsJson(JSON.stringify(target.outfits, null, 2));
    setPresetsJson(JSON.stringify(target.parameterPresets, null, 2));
  }, [target]);

  if (profiles.length === 0) {
    return <Empty msg="등록된 캐릭터가 없습니다. 먼저 업로드 또는 기본 캐릭터를 로드하세요." />;
  }

  if (!target) {
    return <Empty msg="관리할 캐릭터를 선택해주세요." />;
  }

  const patchTarget = (patch: Partial<CharacterProfile>) => {
    updateProfile(target.id, patch);
    if (activeId === target.id && loadedProfile) {
      const next = { ...loadedProfile, ...patch };
      setLoadedProfile(next);
      if (patch.defaultView) setModelConfig(patch.defaultView);
    }
  };

  const updateEmotionMap = (emotion: CharacterEmotion, value: string) => {
    patchTarget({
      expressionMap: {
        ...target.expressionMap,
        [emotion]: value.trim() ? value.trim() : null,
      },
    });
  };

  const updateMotionMap = (action: CharacterActionKey, patch: { group?: string; index?: string }) => {
    const prev = target.motionMap[action];
    const nextGroup = patch.group ?? prev?.group ?? "";
    const nextIndexText = patch.index ?? String(prev?.index ?? 0);
    const nextIndex = parseNumberOr(nextIndexText, prev?.index ?? 0);
    patchTarget({
      motionMap: {
        ...target.motionMap,
        [action]: { group: nextGroup, index: nextIndex },
      },
    });
  };

  const removeMotionMap = (action: CharacterActionKey) => {
    patchTarget({
      motionMap: {
        ...target.motionMap,
        [action]: null,
      },
    });
  };

  const updateHitArea = (idx: number, patch: { hitAreaId?: string; action?: CharacterActionKey }) => {
    const next = [...target.hitAreaMap];
    next[idx] = {
      ...next[idx],
      ...patch,
    };
    patchTarget({ hitAreaMap: next });
  };

  const removeHitArea = (idx: number) => {
    patchTarget({ hitAreaMap: target.hitAreaMap.filter((_, i) => i !== idx) });
  };

  const addHitArea = () => {
    patchTarget({
      hitAreaMap: [...target.hitAreaMap, { hitAreaId: "HitAreaNew", action: "tap_other" }],
    });
  };

  const updateMorphSlider = (idx: number, patch: Partial<MorphSlider>) => {
    const next = [...target.morphSliders];
    next[idx] = { ...next[idx], ...patch };
    patchTarget({ morphSliders: next });
  };

  const removeMorphSlider = (idx: number) => {
    patchTarget({ morphSliders: target.morphSliders.filter((_, i) => i !== idx) });
  };

  const addMorphSlider = () => {
    patchTarget({
      morphSliders: [
        ...target.morphSliders,
        { paramId: "ParamNew", label: "새 슬라이더", min: 0, max: 1, defaultValue: 0 },
      ],
    });
  };

  return (
    <div className="space-y-3">
      <div className="border border-dashed border-gray-400 bg-white/60 p-3">
        <div className="mb-2 text-[11px] tracking-widest uppercase text-gray-500">
          [통합 캐릭터 관리]
        </div>
        <select
          value={targetId}
          onChange={(e) => setTargetId(e.target.value)}
          className="w-full border border-dashed border-gray-500 bg-white/80 px-2 py-1 text-xs"
        >
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.id})
            </option>
          ))}
        </select>
      </div>

      <Section title="기본 정보 / 기본 위치">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <label className="text-xs text-gray-700">
            이름
            <input
              value={target.name}
              onChange={(e) => patchTarget({ name: e.target.value })}
              className="mt-1 w-full border border-dashed border-gray-500 bg-white/80 px-2 py-1"
            />
          </label>
          <label className="text-xs text-gray-700">
            소개
            <input
              value={target.description ?? ""}
              onChange={(e) => patchTarget({ description: e.target.value || undefined })}
              className="mt-1 w-full border border-dashed border-gray-500 bg-white/80 px-2 py-1"
            />
          </label>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {(["scale", "x", "y"] as const).map((key) => (
            <label key={key} className="text-xs text-gray-700">
              {key}
              <input
                type="number"
                step={key === "scale" ? "0.01" : "1"}
                value={target.defaultView[key]}
                onChange={(e) =>
                  patchTarget({
                    defaultView: {
                      ...target.defaultView,
                      [key]: parseNumberOr(e.target.value, target.defaultView[key]),
                    },
                  })
                }
                className="mt-1 w-full border border-dashed border-gray-500 bg-white/80 px-2 py-1"
              />
            </label>
          ))}
        </div>
        <button
          type="button"
          disabled={!modelConfig || activeId !== target.id}
          onClick={() => {
            if (!modelConfig) return;
            patchTarget({ defaultView: modelConfig });
          }}
          className="border border-dashed border-blue-500 bg-blue-50 px-2 py-1 text-[11px] tracking-widest uppercase text-blue-700 disabled:opacity-40"
        >
          [현재 캔버스 위치/스케일 저장]
        </button>
      </Section>

      <Section title="감정/액션 매핑">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <div className="space-y-1">
            <div className="text-[11px] tracking-widest uppercase text-gray-500">[감정 → 표정 ID]</div>
            {ALL_EMOTIONS.map((emotion) => (
              <label key={emotion} className="flex items-center gap-2 text-xs">
                <span className="w-24 font-mono">{emotion}</span>
                <input
                  value={target.expressionMap[emotion] ?? ""}
                  onChange={(e) => updateEmotionMap(emotion, e.target.value)}
                  placeholder="exp id or empty"
                  className="flex-1 border border-dashed border-gray-500 bg-white/80 px-2 py-1"
                />
              </label>
            ))}
          </div>
          <div className="space-y-1">
            <div className="text-[11px] tracking-widest uppercase text-gray-500">[액션 → 모션]</div>
            {ALL_ACTIONS.map((action) => (
              <div key={action} className="flex items-center gap-1 text-xs">
                <span className="w-24 font-mono">{action}</span>
                <input
                  value={target.motionMap[action]?.group ?? ""}
                  onChange={(e) => updateMotionMap(action, { group: e.target.value })}
                  placeholder="group"
                  className="w-24 border border-dashed border-gray-500 bg-white/80 px-2 py-1"
                />
                <input
                  type="number"
                  value={target.motionMap[action]?.index ?? 0}
                  onChange={(e) => updateMotionMap(action, { index: e.target.value })}
                  placeholder="index"
                  className="w-16 border border-dashed border-gray-500 bg-white/80 px-2 py-1"
                />
                <button
                  type="button"
                  onClick={() => removeMotionMap(action)}
                  className="border border-dashed border-red-500 bg-red-50 px-2 py-1 text-[10px] uppercase text-red-700"
                >
                  X
                </button>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section title="히트 영역 / 모핑">
        <div className="space-y-2">
          <div className="text-[11px] tracking-widest uppercase text-gray-500">[히트 영역 → 액션]</div>
          {target.hitAreaMap.map((item, idx) => (
            <div key={`${item.hitAreaId}-${idx}`} className="flex items-center gap-1 text-xs">
              <input
                value={item.hitAreaId}
                onChange={(e) => updateHitArea(idx, { hitAreaId: e.target.value })}
                className="w-44 border border-dashed border-gray-500 bg-white/80 px-2 py-1"
              />
              <select
                value={item.action}
                onChange={(e) => updateHitArea(idx, { action: e.target.value as CharacterActionKey })}
                className="border border-dashed border-gray-500 bg-white/80 px-2 py-1"
              >
                {ALL_ACTIONS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => removeHitArea(idx)}
                className="border border-dashed border-red-500 bg-red-50 px-2 py-1 text-[10px] uppercase text-red-700"
              >
                X
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addHitArea}
            className="border border-dashed border-gray-600 bg-white/80 px-2 py-1 text-[10px] tracking-widest uppercase"
          >
            [히트영역 추가]
          </button>
        </div>

        <div className="space-y-2">
          <div className="text-[11px] tracking-widest uppercase text-gray-500">[모핑 슬라이더]</div>
          {target.morphSliders.map((slider, idx) => (
            <div key={`${slider.paramId}-${idx}`} className="grid grid-cols-12 gap-1 text-xs">
              <input
                value={slider.paramId}
                onChange={(e) => updateMorphSlider(idx, { paramId: e.target.value })}
                className="col-span-3 border border-dashed border-gray-500 bg-white/80 px-2 py-1"
              />
              <input
                value={slider.label}
                onChange={(e) => updateMorphSlider(idx, { label: e.target.value })}
                className="col-span-3 border border-dashed border-gray-500 bg-white/80 px-2 py-1"
              />
              <input
                type="number"
                value={slider.min}
                onChange={(e) => updateMorphSlider(idx, { min: parseNumberOr(e.target.value, slider.min) })}
                className="col-span-2 border border-dashed border-gray-500 bg-white/80 px-2 py-1"
              />
              <input
                type="number"
                value={slider.max}
                onChange={(e) => updateMorphSlider(idx, { max: parseNumberOr(e.target.value, slider.max) })}
                className="col-span-2 border border-dashed border-gray-500 bg-white/80 px-2 py-1"
              />
              <div className="col-span-2 flex gap-1">
                <input
                  type="number"
                  value={slider.defaultValue}
                  onChange={(e) =>
                    updateMorphSlider(idx, {
                      defaultValue: parseNumberOr(e.target.value, slider.defaultValue),
                    })
                  }
                  className="w-full border border-dashed border-gray-500 bg-white/80 px-2 py-1"
                />
                <button
                  type="button"
                  onClick={() => removeMorphSlider(idx)}
                  className="border border-dashed border-red-500 bg-red-50 px-2 py-1 text-[10px] uppercase text-red-700"
                >
                  X
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={addMorphSlider}
            className="border border-dashed border-gray-600 bg-white/80 px-2 py-1 text-[10px] tracking-widest uppercase"
          >
            [모핑 추가]
          </button>
        </div>
      </Section>

      <Section title="의상/파츠 & 프리셋 (JSON)">
        <label className="block space-y-1 text-xs">
          <span className="text-[11px] tracking-widest uppercase text-gray-500">outfits JSON</span>
          <textarea
            value={outfitsJson}
            onChange={(e) => setOutfitsJson(e.target.value)}
            rows={8}
            className="w-full border border-dashed border-gray-500 bg-white/80 px-2 py-1 font-mono text-[11px]"
          />
          <button
            type="button"
            onClick={() => patchTarget({ outfits: parseJson<OutfitGroup[]>(outfitsJson, target.outfits) })}
            className="border border-dashed border-gray-600 bg-white/80 px-2 py-1 text-[10px] tracking-widest uppercase"
          >
            [outfits 반영]
          </button>
        </label>
        <label className="block space-y-1 text-xs">
          <span className="text-[11px] tracking-widest uppercase text-gray-500">parameterPresets JSON</span>
          <textarea
            value={presetsJson}
            onChange={(e) => setPresetsJson(e.target.value)}
            rows={8}
            className="w-full border border-dashed border-gray-500 bg-white/80 px-2 py-1 font-mono text-[11px]"
          />
          <button
            type="button"
            onClick={() =>
              patchTarget({
                parameterPresets: parseJson<ParameterPreset[]>(presetsJson, target.parameterPresets),
              })
            }
            className="border border-dashed border-gray-600 bg-white/80 px-2 py-1 text-[10px] tracking-widest uppercase"
          >
            [프리셋 반영]
          </button>
        </label>
      </Section>

      <Section title="사운드 URL / 캐릭터별 대사">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <div className="text-[11px] tracking-widest uppercase text-gray-500">[감정 사운드 URL]</div>
            {ALL_EMOTIONS.map((emotion) => (
              <label key={emotion} className="flex items-center gap-2 text-xs">
                <span className="w-20 font-mono">{emotion}</span>
                <input
                  value={target.sounds.emotions[emotion] ?? ""}
                  onChange={(e) =>
                    patchTarget({
                      sounds: {
                        ...target.sounds,
                        emotions: {
                          ...target.sounds.emotions,
                          [emotion]: e.target.value || undefined,
                        },
                      },
                    })
                  }
                  placeholder="https://... or blob:..."
                  className="flex-1 border border-dashed border-gray-500 bg-white/80 px-2 py-1"
                />
              </label>
            ))}
          </div>
          <div className="space-y-1">
            <div className="text-[11px] tracking-widest uppercase text-gray-500">[액션 사운드 URL]</div>
            {ALL_ACTIONS.map((action) => (
              <label key={action} className="flex items-center gap-2 text-xs">
                <span className="w-20 font-mono">{action}</span>
                <input
                  value={target.sounds.actions[action] ?? ""}
                  onChange={(e) =>
                    patchTarget({
                      sounds: {
                        ...target.sounds,
                        actions: {
                          ...target.sounds.actions,
                          [action]: e.target.value || undefined,
                        },
                      },
                    })
                  }
                  placeholder="https://... or blob:..."
                  className="flex-1 border border-dashed border-gray-500 bg-white/80 px-2 py-1"
                />
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <div className="text-[11px] tracking-widest uppercase text-gray-500">
              [감정별 대사 (줄바꿈 = 1개 대사)]
            </div>
            {ALL_EMOTIONS.map((emotion) => (
              <label key={emotion} className="block text-xs">
                <span className="mb-1 block font-mono">{emotion}</span>
                <textarea
                  value={arrayToLines(target.dialogues.emotions[emotion])}
                  onChange={(e) =>
                    patchTarget({
                      dialogues: {
                        ...target.dialogues,
                        emotions: {
                          ...target.dialogues.emotions,
                          [emotion]: linesToArray(e.target.value),
                        },
                      },
                    })
                  }
                  rows={3}
                  className="w-full border border-dashed border-gray-500 bg-white/80 px-2 py-1"
                />
              </label>
            ))}
          </div>
          <div className="space-y-2">
            <div className="text-[11px] tracking-widest uppercase text-gray-500">
              [액션별 대사 (줄바꿈 = 1개 대사)]
            </div>
            {ALL_ACTIONS.map((action) => (
              <label key={action} className="block text-xs">
                <span className="mb-1 block font-mono">{action}</span>
                <textarea
                  value={arrayToLines(target.dialogues.actions[action])}
                  onChange={(e) =>
                    patchTarget({
                      dialogues: {
                        ...target.dialogues,
                        actions: {
                          ...target.dialogues.actions,
                          [action]: linesToArray(e.target.value),
                        },
                      },
                    })
                  }
                  rows={3}
                  className="w-full border border-dashed border-gray-500 bg-white/80 px-2 py-1"
                />
              </label>
            ))}
          </div>
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2 border border-dashed border-gray-400 bg-white/60 p-3">
      <div className="text-[11px] tracking-widest uppercase text-gray-500">[{title}]</div>
      {children}
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return (
    <div className="border border-dashed border-gray-400 bg-white/40 p-3 text-xs text-gray-500">
      {msg}
    </div>
  );
}
