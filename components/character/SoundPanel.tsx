"use client";

import { useRef } from "react";
import { useCharacterLibraryStore } from "@/store/useCharacterLibraryStore";
import { useCharacterStore } from "@/store/useCharacterStore";
import {
  ALL_ACTIONS,
  ALL_EMOTIONS,
  type CharacterActionKey,
  type CharacterEmotion,
  type CharacterProfile,
} from "@/types/character";

/**
 * 감정/액션별 보이스/SFX 업로드 패널.
 *
 * 크리에이터가 감정 1개 / 액션 1개 당 오디오 파일 하나를 할당.
 * 업로드 시 ObjectURL 을 만들어 profile.sounds 에 저장.
 * 재생 자체는 Live2DWrapper 가 감정/액션 발동 시 URL 을 Audio 로 변환해 플레이.
 */
export default function SoundPanel() {
  const profile = useCharacterStore((s) => s.profile);
  const setProfile = useCharacterStore((s) => s.setProfile);
  const updateLib = useCharacterLibraryStore((s) => s.updateProfile);

  if (!profile) {
    return <Empty msg="먼저 캐릭터를 로드해주세요." />;
  }

  const attachEmotion = (emotion: CharacterEmotion, url: string | undefined) => {
    const nextSounds = {
      ...profile.sounds,
      emotions: { ...profile.sounds.emotions, [emotion]: url },
    };
    const next: CharacterProfile = { ...profile, sounds: nextSounds };
    setProfile(next);
    updateLib(profile.id, { sounds: nextSounds });
  };
  const attachAction = (action: CharacterActionKey, url: string | undefined) => {
    const nextSounds = {
      ...profile.sounds,
      actions: { ...profile.sounds.actions, [action]: url },
    };
    const next: CharacterProfile = { ...profile, sounds: nextSounds };
    setProfile(next);
    updateLib(profile.id, { sounds: nextSounds });
  };

  return (
    <div className="space-y-4">
      <Group title="감정 보이스">
        {ALL_EMOTIONS.map((e) => (
          <AudioRow
            key={e}
            label={e}
            current={profile.sounds.emotions[e]}
            onAttach={(u) => attachEmotion(e, u)}
            onClear={() => attachEmotion(e, undefined)}
          />
        ))}
      </Group>
      <Group title="액션 SFX / 대사">
        {ALL_ACTIONS.map((a) => (
          <AudioRow
            key={a}
            label={a}
            current={profile.sounds.actions[a]}
            onAttach={(u) => attachAction(a, u)}
            onClear={() => attachAction(a, undefined)}
          />
        ))}
      </Group>
      <div className="text-[10px] text-gray-500">
        * 업로드된 오디오는 현재 세션에서만 유효합니다. 새로고침 시 재업로드 필요.
      </div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-dashed border-gray-400 bg-white/60 p-2 space-y-2">
      <div className="text-[11px] tracking-widest uppercase text-gray-500">[{title}]</div>
      <div className="grid grid-cols-1 gap-1">{children}</div>
    </div>
  );
}

function AudioRow({
  label,
  current,
  onAttach,
  onClear,
}: {
  label: string;
  current: string | undefined;
  onAttach: (url: string) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    onAttach(url);
  };
  const test = () => {
    if (!current) return;
    const a = new Audio(current);
    void a.play();
  };
  return (
    <div className="flex items-center gap-2 border-b border-dashed border-gray-300 py-1 last:border-b-0">
      <div className="w-28 text-[11px] font-mono uppercase tracking-widest text-gray-600">
        {label}
      </div>
      <div className="flex-1 truncate text-[10px] font-mono text-gray-500">
        {current ? current.slice(0, 40) + "..." : "(없음)"}
      </div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="border border-dashed border-gray-600 bg-white/80 px-2 py-0.5 text-[10px] tracking-widest uppercase"
      >
        [LOAD]
      </button>
      <button
        type="button"
        onClick={test}
        disabled={!current}
        className="border border-dashed border-gray-600 bg-white/80 px-2 py-0.5 text-[10px] tracking-widest uppercase disabled:opacity-40"
      >
        [PLAY]
      </button>
      <button
        type="button"
        onClick={onClear}
        disabled={!current}
        className="border border-dashed border-red-500 bg-red-50 px-2 py-0.5 text-[10px] tracking-widest uppercase text-red-700 disabled:opacity-40"
      >
        [X]
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="audio/*"
        onChange={pick}
        className="hidden"
      />
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
