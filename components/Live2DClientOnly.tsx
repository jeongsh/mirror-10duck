"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { useAuthUser } from "@/lib/supabase/useAuthUser";
import { useCharacterLibraryStore } from "@/store/useCharacterLibraryStore";
import { useCharacterStore } from "@/store/useCharacterStore";
import { listCharacterProfiles } from "@/lib/supabase/characters";
import {
  BASE_PROFILES,
  mergeProfiles,
  resolvePreferredProfile,
} from "@/lib/live2d/profileSync";

/**
 * Live2DWrapper 는 window, WebGL, Live2DCubismCore 전역에 의존하므로
 * SSR 중에 번들 import 되면 안 된다.
 * Next.js 16 부터 `ssr: false` 는 Client Component 안에서만 허용되므로
 * 이 래퍼를 경유해서 동적 import 한다.
 */
const Live2DWrapper = dynamic(() => import("./Live2DWrapper"), {
  ssr: false,
  loading: () => (
    <div className="fixed bottom-0 right-0 z-50 border-2 border-dashed border-gray-500 bg-gray-200/60 p-4 text-[11px] tracking-widest text-gray-500 uppercase">
      [Live2D 영역 · 로딩 중...]
    </div>
  ),
});

export default function Live2DClientOnly() {
  const authUser = useAuthUser();
  
  const setProfiles = useCharacterLibraryStore((s) => s.setProfiles);
  const setActive = useCharacterLibraryStore((s) => s.setActive);
  const activeId = useCharacterLibraryStore((s) => s.activeId);
  const profile = useCharacterStore((s) => s.profile);
  const setProfile = useCharacterStore((s) => s.setProfile);

  // 전역 초기화: 로그인 상태에 따라 라이브러리 동기화 + 활성 캐릭터 복원
  // CharacterControls 가 홈에만 있기 때문에, 홈이 아닌 곳에서 새로고침 시에도
  // 캐릭터가 로드되도록 여기서도 동기화를 수행한다.
  useEffect(() => {
    if (authUser === undefined) return;

    if (!authUser) {
      setProfiles([]);
      setActive(null);
      setProfile(null);
      return;
    }

    void (async () => {
      const savedProfiles = await listCharacterProfiles();
      const allProfiles = mergeProfiles(BASE_PROFILES, savedProfiles);
      
      // 스토어 업데이트
      setProfiles(allProfiles);

      const preferredId =
        typeof authUser.user_metadata?.activeCharacterId === "string"
          ? (authUser.user_metadata.activeCharacterId as string)
          : undefined;
      
      const preferredProfile = resolvePreferredProfile(allProfiles, preferredId);
      if (!preferredProfile) return;

      // 이미 설정된 상태면 중복 호출 방지
      if (activeId !== preferredProfile.id) {
        setActive(preferredProfile.id);
      }
      if (profile?.id !== preferredProfile.id) {
        setProfile(preferredProfile);
      }
    })();
    // authUser 가 확정된 시점에 1회만 실행 (내부 상태 변화로 인한 루프 방지)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser]);

  if (!authUser) return null;
  
  return <Live2DWrapper />;
}
