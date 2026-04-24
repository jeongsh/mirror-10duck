"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useCharacterLibraryStore } from "@/store/useCharacterLibraryStore";
import { useCharacterStore } from "@/store/useCharacterStore";
import {
  ALL_ACTIONS,
  ALL_EMOTIONS,
  type CharacterProfile,
} from "@/types/character";

function parseNumberOr(value: string, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
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
  const router = useRouter();
  const profiles = useCharacterLibraryStore((s) => s.profiles);
  const activeId = useCharacterLibraryStore((s) => s.activeId);
  const setActive = useCharacterLibraryStore((s) => s.setActive);
  const updateProfile = useCharacterLibraryStore((s) => s.updateProfile);

  const loadedProfile = useCharacterStore((s) => s.profile);
  const setLoadedProfile = useCharacterStore((s) => s.setProfile);
  const modelConfig = useCharacterStore((s) => s.modelConfig);
  const setModelConfig = useCharacterStore((s) => s.setModelConfig);

  const [targetId, setTargetId] = useState<string>("");

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

  const selectAndLoadCharacter = (id: string) => {
    setTargetId(id);
    const next = profiles.find((p) => p.id === id);
    if (!next) return;
    // 새 프로필을 활성화하면 기존 캐릭터는 자동으로 교체된다.
    setActive(id);
    setLoadedProfile(next);
    setModelConfig(next.defaultView);
    router.push(`/library/${encodeURIComponent(id)}`);
  };

  return (
    <div className="space-y-3">
      <div className="border border-dashed border-gray-400 bg-white/60 p-3">
        <div className="mb-2 text-[11px] tracking-widest uppercase text-gray-500">
          [통합 캐릭터 관리]
        </div>
        <select
          value={targetId}
          onChange={(e) => selectAndLoadCharacter(e.target.value)}
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

      <Section title="상황별 대사">
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

      <div className="border border-dashed border-amber-500 bg-amber-50 p-3 text-xs text-amber-800">
        고급 매핑(표정/모션/히트영역/모핑/의상/사운드)은 추후 전문가용 페이지에서 제공될 예정입니다.
      </div>
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
