"use client";

import { useEffect } from "react";
import { useCharacterStore } from "@/store/useCharacterStore";

/**
 * 옷/파츠 토글 패널.
 *
 * - 각 OutfitGroup 은 선택지 그룹. 사용자가 하나를 선택하면 해당 옵션의 partIds 만
 *   opacity=1, 같은 그룹 내 다른 옵션의 partIds 는 opacity=0 으로 세팅.
 * - 여러 그룹(옷/머리/악세 등)이 있어도 서로 독립적으로 동작.
 */
export default function OutfitPanel() {
  const profile = useCharacterStore((s) => s.profile);
  const selectedOutfits = useCharacterStore((s) => s.selectedOutfits);
  const selectOutfit = useCharacterStore((s) => s.selectOutfit);
  const setPartOpacities = useCharacterStore((s) => s.setPartOpacities);

  // 선택된 옵션에 맞춰 partOpacity 를 동기화.
  useEffect(() => {
    if (!profile) return;
    const next: Record<string, number> = {};
    for (const group of profile.outfits) {
      const selected = selectedOutfits[group.id] ?? group.defaultPartId ?? group.parts[0]?.id;
      for (const opt of group.parts) {
        const visible = opt.id === selected ? 1 : 0;
        for (const pid of opt.partIds) next[pid] = visible;
      }
    }
    setPartOpacities(next);
  }, [profile, selectedOutfits, setPartOpacities]);

  if (!profile) return <Empty msg="먼저 캐릭터를 로드해주세요." />;
  if (profile.outfits.length === 0) {
    return <Empty msg="이 모델엔 파츠 토글 그룹이 정의되어 있지 않습니다." />;
  }

  return (
    <div className="space-y-3">
      {profile.outfits.map((group) => {
        const selected = selectedOutfits[group.id] ?? group.defaultPartId ?? group.parts[0]?.id;
        return (
          <div
            key={group.id}
            className="border border-dashed border-gray-400 bg-white/60 p-2 space-y-2"
          >
            <div className="text-[11px] tracking-widest uppercase text-gray-500">
              [{group.name}]
            </div>
            <div className="flex flex-wrap gap-2">
              {group.parts.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => selectOutfit(group.id, opt.id)}
                  className={
                    "border border-dashed px-2 py-1 text-[11px] tracking-widest uppercase " +
                    (opt.id === selected
                      ? "border-gray-900 bg-gray-300 text-gray-900"
                      : "border-gray-500 bg-white/70 text-gray-700")
                  }
                >
                  [{opt.label}]
                </button>
              ))}
            </div>
          </div>
        );
      })}
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
