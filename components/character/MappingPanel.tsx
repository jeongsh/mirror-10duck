"use client";

import { useCharacterLibraryStore } from "@/store/useCharacterLibraryStore";
import { useCharacterStore } from "@/store/useCharacterStore";
import {
  ALL_ACTIONS,
  ALL_EMOTIONS,
  type CharacterActionKey,
  type CharacterEmotion,
  type CharacterProfile,
  type MotionRef,
} from "@/types/character";

function normalizeEditableAction(action: CharacterActionKey): CharacterActionKey {
  if (action === "tap_body") return "attention";
  return action;
}

/**
 * 현재 프로필의 표정/모션/히트 매핑을 사용자가 직접 수정하는 패널.
 *
 * Uploader 의 auto-map 이 틀리게 추정한 경우 여기서 바로잡는다.
 */
export default function MappingPanel() {
  const profile = useCharacterStore((s) => s.profile);
  const setProfile = useCharacterStore((s) => s.setProfile);
  const updateLib = useCharacterLibraryStore((s) => s.updateProfile);

  if (!profile) {
    return <Empty msg="먼저 캐릭터를 로드해주세요." />;
  }

  const patch = (patchData: Partial<CharacterProfile>) => {
    const next: CharacterProfile = { ...profile, ...patchData };
    setProfile(next);
    updateLib(profile.id, patchData);
  };

  // 모델에 실제로 존재하는 표정/모션/히트 목록을 수집.
  // (내장 캐릭터면 하드코딩된 리스트, 업로드면 expressionMap 의 값들에서 역산)
  const allExpressionIds = Array.from(
    new Set([
      ...Object.values(profile.expressionMap).filter(Boolean) as string[],
    ])
  );

  const allMotionRefs: MotionRef[] = Array.from(
    new Set(
      Object.values(profile.motionMap)
        .filter((m): m is MotionRef => !!m)
        .map((m) => `${m.group}::${m.index}`)
    )
  ).map((key) => {
    const [group, index] = key.split("::");
    return { group, index: parseInt(index, 10) };
  });

  return (
    <div className="space-y-4">
      {/* 감정 → 표정 */}
      <div className="border border-dashed border-gray-400 bg-white/60 p-2 space-y-2">
        <div className="text-[11px] tracking-widest uppercase text-gray-500">
          [감정 → 표정 매핑]
        </div>
        {ALL_EMOTIONS.map((emo) => (
          <div key={emo} className="flex items-center gap-2 text-xs">
            <div className="w-20 tracking-widest uppercase text-gray-600">{emo}</div>
            <select
              value={profile.expressionMap[emo] ?? ""}
              onChange={(e) =>
                patch({
                  expressionMap: {
                    ...profile.expressionMap,
                    [emo]: e.target.value || null,
                  },
                })
              }
              className="flex-1 border border-dashed border-gray-500 bg-white/80 px-2 py-1 text-xs"
            >
              <option value="">(없음)</option>
              {allExpressionIds.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {/* 액션 → 모션 */}
      <div className="border border-dashed border-gray-400 bg-white/60 p-2 space-y-2">
        <div className="text-[11px] tracking-widest uppercase text-gray-500">
          [액션 → 모션 매핑]
        </div>
        {ALL_ACTIONS.map((action) => (
          <div key={action} className="flex items-center gap-2 text-xs">
            <div className="w-20 tracking-widest uppercase text-gray-600">{action}</div>
            <select
              value={
                profile.motionMap[action]
                  ? `${profile.motionMap[action]!.group}::${profile.motionMap[action]!.index}`
                  : ""
              }
              onChange={(e) => {
                const v = e.target.value;
                const nextRef: MotionRef | null = v
                  ? { group: v.split("::")[0], index: parseInt(v.split("::")[1], 10) }
                  : null;
                patch({
                  motionMap: { ...profile.motionMap, [action]: nextRef },
                });
              }}
              className="flex-1 border border-dashed border-gray-500 bg-white/80 px-2 py-1 text-xs"
            >
              <option value="">(없음)</option>
              {allMotionRefs.map((r) => (
                <option
                  key={`${r.group}::${r.index}`}
                  value={`${r.group}::${r.index}`}
                >
                  {r.group || "(default)"} #{r.index}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {/* 히트 영역 */}
      <div className="border border-dashed border-gray-400 bg-white/60 p-2 space-y-2">
        <div className="text-[11px] tracking-widest uppercase text-gray-500">
          [히트 영역 → 액션]
        </div>
        {profile.hitAreaMap.length === 0 && (
          <div className="text-xs text-gray-500">
            등록된 히트 영역이 없습니다. 모델의 HitAreas 를 확인하세요.
          </div>
        )}
        {profile.hitAreaMap.map((mapping, idx) => (
          <div key={idx} className="flex items-center gap-2 text-xs">
            <div className="w-32 font-mono tracking-wider text-gray-700">
              {mapping.hitAreaId}
            </div>
            <span className="text-gray-400">→</span>
            <select
              value={normalizeEditableAction(mapping.action)}
              onChange={(e) => {
                const next = [...profile.hitAreaMap];
                next[idx] = { ...mapping, action: e.target.value as CharacterActionKey };
                patch({ hitAreaMap: next });
              }}
              className="flex-1 border border-dashed border-gray-500 bg-white/80 px-2 py-1 text-xs"
            >
              {ALL_ACTIONS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}

// 타입이 쓰이는 것을 lint 가 알 수 있게
void ALL_EMOTIONS;
void ALL_ACTIONS;
// (CharacterEmotion 은 위에서 사용됨)
export type _EmotionBrand = CharacterEmotion;

function Empty({ msg }: { msg: string }) {
  return (
    <div className="border border-dashed border-gray-400 bg-white/40 p-3 text-xs text-gray-500">
      {msg}
    </div>
  );
}
