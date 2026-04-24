"use client";

import { useCharacterStore } from "@/store/useCharacterStore";

/**
 * 실시간 파라미터 모핑 패널.
 *
 * - 각 슬라이더는 profile.morphSliders 에 정의된 파라미터 1개를 조작.
 * - profile.parameterPresets 는 한 번에 여러 값을 적용하는 "캐릭터성 프리셋"
 *   (츤데레/얀데레/키라키라 등).
 */
export default function MorphPanel() {
  const profile = useCharacterStore((s) => s.profile);
  const morphValues = useCharacterStore((s) => s.morphValues);
  const setMorphValue = useCharacterStore((s) => s.setMorphValue);
  const resetMorphs = useCharacterStore((s) => s.resetMorphs);

  if (!profile) {
    return <EmptyState msg="먼저 캐릭터를 로드해주세요." />;
  }
  if (profile.morphSliders.length === 0) {
    return <EmptyState msg="이 모델은 모핑 슬라이더가 정의되어 있지 않습니다." />;
  }

  const applyPreset = (presetId: string) => {
    const preset = profile.parameterPresets.find((p) => p.id === presetId);
    if (!preset) return;
    for (const v of preset.values) {
      setMorphValue(v.paramId, v.value);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] tracking-widest text-gray-500 uppercase">
          [프리셋]
        </span>
        {profile.parameterPresets.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => applyPreset(p.id)}
            title={p.description}
            className="border border-dashed border-pink-600 bg-pink-50 px-2 py-1 text-[11px] tracking-widest uppercase text-pink-900 hover:bg-pink-100"
          >
            [{p.name}]
          </button>
        ))}
        <button
          type="button"
          onClick={resetMorphs}
          className="border border-dashed border-gray-600 bg-white/70 px-2 py-1 text-[11px] tracking-widest uppercase text-gray-700"
        >
          [RESET]
        </button>
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {profile.morphSliders.map((s) => {
          const val = morphValues[s.paramId] ?? s.defaultValue;
          return (
            <label
              key={s.paramId}
              className="border border-dashed border-gray-400 bg-white/60 p-2 text-xs"
            >
              <div className="mb-1 flex items-center justify-between">
                <span className="tracking-wider">{s.label}</span>
                <span className="font-mono text-[10px] text-gray-500">
                  {val.toFixed(2)} ({s.paramId})
                </span>
              </div>
              <input
                type="range"
                min={s.min}
                max={s.max}
                step={(s.max - s.min) / 100}
                value={val}
                onChange={(e) =>
                  setMorphValue(s.paramId, parseFloat(e.target.value))
                }
                className="w-full"
              />
              <div className="flex justify-between text-[10px] text-gray-400">
                <span>{s.min}</span>
                <span>{s.max}</span>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function EmptyState({ msg }: { msg: string }) {
  return (
    <div className="border border-dashed border-gray-400 bg-white/40 p-3 text-xs text-gray-500">
      {msg}
    </div>
  );
}
