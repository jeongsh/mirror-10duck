"use client";

import { useEffect, useMemo, useState } from "react";
import { ModelHitAreasDevPanel } from "@/components/character/ModelHitAreasDevPanel";
import { loadLive2DModelInventory } from "@/lib/live2d/modelInventory";
import { useCharacterLibraryStore } from "@/store/useCharacterLibraryStore";
import { useCharacterStore } from "@/store/useCharacterStore";
import {
  ALL_ACTIONS,
  ALL_EMOTIONS,
  CHARACTER_SCENARIOS,
  type CharacterScenarioKey,
  type CharacterScenarioMapping,
  type CharacterActionKey,
  type CharacterEmotion,
  type CharacterProfile,
  type MotionRef,
} from "@/types/character";

function normalizeEditableAction(action: CharacterActionKey): CharacterActionKey {
  if (action === "tap_body") return "attention";
  return action;
}

interface MappingPanelProps {
  profile?: CharacterProfile;
  onPatch?: (patchData: Partial<CharacterProfile>) => void;
  onPreviewExpression?: (expressionId: string) => void;
  onPreviewMotion?: (motion: MotionRef) => void;
  onPreviewScenario?: (scenario: CharacterScenarioMapping, label: string) => void;
  highlightedHitAreaIds?: string[];
}

const ACTION_LABELS: Record<CharacterActionKey, string> = {
  tap_head: "머리 클릭",
  tap_body: "몸 클릭(호환)",
  tap_other: "기타 클릭",
  attention: "관심/호출",
  cheer: "응원",
  thinking: "생각 중",
  celebrate: "축하",
  idle: "기본",
  greet: "인사",
  typing: "작성 중",
  special: "특수",
};

/**
 * 현재 프로필의 표정/모션/히트 매핑을 사용자가 직접 수정하는 패널.
 *
 * Uploader 의 auto-map 이 틀리게 추정한 경우 여기서 바로잡는다.
 */
export default function MappingPanel({
  profile: profileProp,
  onPatch,
  onPreviewExpression,
  onPreviewMotion,
  onPreviewScenario,
  highlightedHitAreaIds = [],
}: MappingPanelProps = {}) {
  const activeProfile = useCharacterStore((s) => s.profile);
  const setProfile = useCharacterStore((s) => s.setProfile);
  const updateLib = useCharacterLibraryStore((s) => s.updateProfile);
  const profile = profileProp ?? activeProfile;
  const [inventoryError, setInventoryError] = useState<string | null>(null);
  const [inventory, setInventory] = useState<{
    expressions: string[];
    motions: MotionRef[];
    hitAreas: string[];
  }>({ expressions: [], motions: [], hitAreas: [] });

  useEffect(() => {
    if (!profile?.modelPath) return;
    let cancelled = false;

    setInventoryError(null);
    void loadLive2DModelInventory(profile.modelPath)
      .then((next) => {
        if (!cancelled) setInventory(next);
      })
      .catch((e) => {
        if (!cancelled) {
          setInventory({ expressions: [], motions: [], hitAreas: [] });
          setInventoryError(e instanceof Error ? e.message : String(e));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [profile?.id, profile?.modelPath]);

  if (!profile) {
    return <Empty msg="먼저 캐릭터를 로드해주세요." />;
  }

  const patch = (patchData: Partial<CharacterProfile>) => {
    if (onPatch) {
      onPatch(patchData);
      return;
    }
    const next: CharacterProfile = { ...profile, ...patchData };
    setProfile(next);
    updateLib(profile.id, patchData);
  };

  const allExpressionIds = useMemo(
    () =>
      Array.from(
        new Set([
          ...inventory.expressions,
          ...(Object.values(profile.expressionMap).filter(Boolean) as string[]),
        ])
      ),
    [inventory.expressions, profile.expressionMap]
  );

  const allMotionRefs: MotionRef[] = useMemo(
    () =>
      Array.from(
        new Set(
          [
            ...inventory.motions,
            ...Object.values(profile.motionMap).filter((m): m is MotionRef => !!m),
          ].map((m) => `${m.group}::${m.index}`)
        )
      ).map((key) => {
        const [group, index] = key.split("::");
        return { group, index: parseInt(index, 10) };
      }),
    [inventory.motions, profile.motionMap]
  );

  const editableHitAreaIds = useMemo(
    () =>
      Array.from(
        new Set([
          ...inventory.hitAreas,
          ...profile.hitAreaMap.map((mapping) => mapping.hitAreaId),
        ])
      ),
    [inventory.hitAreas, profile.hitAreaMap]
  );

  const getHitAreaAction = (hitAreaId: string): CharacterActionKey => {
    return normalizeEditableAction(
      profile.hitAreaMap.find((mapping) => mapping.hitAreaId === hitAreaId)?.action ?? "tap_other"
    );
  };

  const patchHitArea = (hitAreaId: string, action: CharacterActionKey) => {
    const normalizedAction = normalizeEditableAction(action);
    const existing = profile.hitAreaMap.find((mapping) => mapping.hitAreaId === hitAreaId);
    const next = existing
      ? profile.hitAreaMap.map((mapping) =>
          mapping.hitAreaId === hitAreaId ? { ...mapping, action: normalizedAction } : mapping
        )
      : [...profile.hitAreaMap, { hitAreaId, action: normalizedAction }];
    patch({ hitAreaMap: next });
  };

  const getScenario = (key: CharacterScenarioKey): CharacterScenarioMapping => {
    return profile.scenarioMap?.[key] ?? {};
  };

  const patchScenario = (
    key: CharacterScenarioKey,
    patchData: Partial<CharacterScenarioMapping>
  ) => {
    const current = getScenario(key);
    patch({
      scenarioMap: {
        ...(profile.scenarioMap ?? {}),
        [key]: { ...current, ...patchData },
      },
    });
  };

  const idleMotion = profile.motionMap.idle ?? allMotionRefs[0] ?? null;
  const resolveScenarioMotion = (motion: MotionRef | null | undefined): MotionRef | null =>
    motion ?? idleMotion;
  const scenarioMotionOptions = allMotionRefs;
  const highlightedHitAreas = new Set(highlightedHitAreaIds);

  return (
    <div className="space-y-4">
      {inventoryError && (
        <div className="border border-dashed border-amber-400 bg-amber-50 p-2 text-xs text-amber-800">
          모델 원본 목록을 읽지 못해 저장된 매핑 후보만 표시합니다. {inventoryError}
        </div>
      )}

      <div className="border border-dashed border-gray-400 bg-white/60 p-2 space-y-2">
        <div className="text-[11px] tracking-widest uppercase text-gray-500">
          [상황별 표정 + 액션]
        </div>
        {CHARACTER_SCENARIOS.map((scenario) => {
          const mapping = getScenario(scenario.key);
          const selectedExpression = mapping.expressionId ?? "";
          const selectedMotion = resolveScenarioMotion(mapping.motion);
          return (
          <div key={scenario.key} className="grid grid-cols-1 gap-2 border-b border-dashed border-gray-300 py-2 text-xs last:border-b-0 xl:grid-cols-[150px_minmax(0,1fr)_minmax(0,1fr)_auto] xl:items-center">
            <div>
              <div className="font-bold text-gray-800">{scenario.label}</div>
              <div className="text-[10px] leading-4 text-gray-500">{scenario.description}</div>
            </div>
            <select
              value={selectedExpression}
              onChange={(e) =>
                patchScenario(scenario.key, { expressionId: e.target.value || null })
              }
              className="flex-1 border border-dashed border-gray-500 bg-white/80 px-2 py-1 text-xs"
            >
              <option value="">표정 없음</option>
              {allExpressionIds.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
            <select
              value={selectedMotion ? `${selectedMotion.group}::${selectedMotion.index}` : ""}
              onChange={(e) => {
                const v = e.target.value;
                patchScenario(scenario.key, {
                  motion: { group: v.split("::")[0], index: parseInt(v.split("::")[1], 10) },
                });
              }}
              className="flex-1 border border-dashed border-gray-500 bg-white/80 px-2 py-1 text-xs"
            >
              {scenarioMotionOptions.map((motion) => (
                <option
                  key={`${motion.group}::${motion.index}`}
                  value={`${motion.group}::${motion.index}`}
                >
                  {motion.group || "(default)"} #{motion.index}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() =>
                onPreviewScenario?.(
                  {
                    expressionId: selectedExpression || null,
                    motion: selectedMotion,
                  },
                  scenario.label
                )
              }
              className="border border-dashed border-gray-500 bg-white px-2 py-1 text-[10px] tracking-widest disabled:opacity-40"
            >
              [미리보기]
            </button>
          </div>
          );
        })}
      </div>

      <details className="border border-dashed border-gray-400 bg-white/60 p-2">
        <summary className="cursor-pointer text-[11px] tracking-widest uppercase text-gray-500">
          [고급: 개별 표정/액션 매핑]
        </summary>
        <div className="mt-3 space-y-4">
          {/* 감정 → 표정 */}
          <div className="space-y-2">
            <div className="text-[11px] tracking-widest uppercase text-gray-500">
              [표정 키 → 표정 파일]
            </div>
            {ALL_EMOTIONS.map((emo) => {
              const selectedExpression = profile.expressionMap[emo] ?? "";
              return (
              <div key={emo} className="flex items-center gap-2 text-xs">
                <div className="w-20 tracking-widest uppercase text-gray-600">{emo}</div>
                <select
                  value={selectedExpression}
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
                <button
                  type="button"
                  disabled={!selectedExpression}
                  onClick={() => selectedExpression && onPreviewExpression?.(selectedExpression)}
                  className="border border-dashed border-gray-500 bg-white px-2 py-1 text-[10px] tracking-widest disabled:opacity-40"
                >
                  [보기]
                </button>
              </div>
              );
            })}
          </div>

          {/* 액션 → 모션 */}
          <div className="space-y-2">
        <div className="text-[11px] tracking-widest uppercase text-gray-500">
          [액션 키 → 모션 파일]
        </div>
        {ALL_ACTIONS.map((action) => {
          const selectedMotion = profile.motionMap[action];
          return (
          <div key={action} className="flex items-center gap-2 text-xs">
            <div className="w-24 tracking-widest uppercase text-gray-600">
              <div>{action}</div>
              <div className="font-sans text-[10px] tracking-normal text-gray-400">
                {ACTION_LABELS[action]}
              </div>
            </div>
            <select
              value={
                selectedMotion
                  ? `${selectedMotion.group}::${selectedMotion.index}`
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
            <button
              type="button"
              disabled={!selectedMotion}
              onClick={() => selectedMotion && onPreviewMotion?.(selectedMotion)}
              className="border border-dashed border-gray-500 bg-white px-2 py-1 text-[10px] tracking-widest disabled:opacity-40"
            >
              [재생]
            </button>
          </div>
          );
        })}
      </div>
        </div>
      </details>

      {/* 히트 영역 */}
      <div className="border border-dashed border-gray-400 bg-white/60 p-2 space-y-2">
        <ModelHitAreasDevPanel
          profileId={profile.id}
          modelPath={profile.modelPath}
          hitAreaMap={profile.hitAreaMap}
        />
        <div className="text-[11px] tracking-widest uppercase text-gray-500">
          [히트 영역 → 액션]
        </div>
        {editableHitAreaIds.length === 0 && (
          <div className="text-xs text-gray-500">
            등록된 히트 영역이 없습니다. 모델의 HitAreas 를 확인하세요.
          </div>
        )}
        <div className="text-[11px] text-gray-500">
          미리보기 캐릭터를 클릭하면 감지된 HitArea 행이 강조됩니다.
        </div>
        {editableHitAreaIds.map((hitAreaId) => {
          const action = getHitAreaAction(hitAreaId);
          const highlighted = highlightedHitAreas.has(hitAreaId);
          return (
          <div
            key={hitAreaId}
            className={
              "flex items-center gap-2 border border-dashed p-1 text-xs " +
              (highlighted
                ? "border-blue-500 bg-blue-50"
                : "border-transparent")
            }
          >
            <div className="w-32 font-mono tracking-wider text-gray-700">
              {hitAreaId}
            </div>
            <span className="text-gray-400">→</span>
            <select
              value={action}
              onChange={(e) => {
                patchHitArea(hitAreaId, e.target.value as CharacterActionKey);
              }}
              className="flex-1 border border-dashed border-gray-500 bg-white/80 px-2 py-1 text-xs"
            >
              {ALL_ACTIONS.map((a) => (
                <option key={a} value={a}>
                  {a} - {ACTION_LABELS[a]}
                </option>
              ))}
            </select>
          </div>
          );
        })}
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
