"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect } from "react";
import LibraryManagerPanel from "@/components/character/LibraryManagerPanel";
import { MAO_PRO_PROFILE, PICHU_PROFILE } from "@/lib/live2d/defaultProfile";
import { useCharacterLibraryStore } from "@/store/useCharacterLibraryStore";

export default function CharacterManagePage() {
  const params = useParams<{ id: string }>();
  const profiles = useCharacterLibraryStore((s) => s.profiles);
  const register = useCharacterLibraryStore((s) => s.register);
  const targetId = decodeURIComponent(params.id);

  useEffect(() => {
    const hasPichu = profiles.some((p) => p.id === PICHU_PROFILE.id);
    const hasMao = profiles.some((p) => p.id === MAO_PRO_PROFILE.id);
    if (!hasPichu) register(PICHU_PROFILE);
    if (!hasMao) register(MAO_PRO_PROFILE);
  }, [profiles, register]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-4 p-6 text-gray-700">
      <div className="flex items-center justify-between border-2 border-dashed border-gray-500 bg-gray-200/60 p-4">
        <div className="text-[11px] tracking-[0.2em] uppercase text-gray-500">
          [캐릭터 통합 관리 페이지]
        </div>
        <Link
          href="/"
          className="border border-dashed border-gray-600 bg-white/80 px-3 py-1 text-[11px] tracking-widest uppercase"
        >
          [BACK]
        </Link>
      </div>
      <LibraryManagerPanel initialTargetId={targetId} />
    </main>
  );
}
