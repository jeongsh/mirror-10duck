"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Script from "next/script";
import { usePathname } from "next/navigation";
import { getTrackingPreference, getPreferredCharacterId } from "@/lib/supabase/characterPreferences";
import { getLive2DEnabledPreference } from "@/lib/supabase/characterPreferences";
import { useAuthUser } from "@/lib/supabase/useAuthUser";
import { supabase } from "@/lib/supabase/client";
import { useCharacterLibraryStore } from "@/store/useCharacterLibraryStore";
import { useCharacterStore } from "@/store/useCharacterStore";
import { listCharacterProfiles } from "@/lib/supabase/characters";
import {
  BASE_PROFILES,
  mergeProfiles,
  resolvePreferredProfile,
} from "@/lib/live2d/profileSync";

const Live2DWrapper = dynamic(() => import("./Live2DWrapper"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[420px] w-[var(--layout-live2d-width)] items-end justify-center border-2 border-dashed border-gray-500 bg-gray-200/60 text-[11px] tracking-widest text-gray-500 uppercase">
      [Live2D loading...]
    </div>
  ),
});

export default function Live2DClientOnly() {
  return <Live2DClientOnlyEnabled />;
}

function Live2DClientOnlyEnabled() {
  const pathname = usePathname();
  const authUser = useAuthUser();
  const [coreReady, setCoreReady] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  const setProfiles = useCharacterLibraryStore((s) => s.setProfiles);
  const setActive = useCharacterLibraryStore((s) => s.setActive);
  const setProfile = useCharacterStore((s) => s.setProfile);
  const setTracking = useCharacterStore((s) => s.setTracking);
  const setLive2DEnabled = useCharacterStore((s) => s.setLive2DEnabled);
  const isLive2DEnabled = useCharacterStore((s) => s.isLive2DEnabled);

  useEffect(() => {
    if (typeof window !== "undefined" && window.Live2DCubismCore) {
      setCoreReady(true);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (authUser === undefined) return;

    if (!authUser) {
      setProfiles([]);
      setActive(null);
      setProfile(null);
      setTracking(true);
      setLive2DEnabled(getLive2DEnabledPreference(null, true));
      setIsInitializing(false);
      return;
    }

    void (async () => {
      // DB에서 최신 auth metadata 가져오기 (캐시 아닌 최신 값)
      const { data: { user: freshUser }, error: authError } = await supabase.auth.getUser();
      if (cancelled || authError) return;
      
      const savedProfiles = await listCharacterProfiles();
      if (cancelled) return;

      const allProfiles = mergeProfiles(BASE_PROFILES, savedProfiles);
      setProfiles(allProfiles);

      // freshUser의 최신 metadata 사용
      const preferredId = getPreferredCharacterId(freshUser?.user_metadata);
      const preferredProfile = resolvePreferredProfile(allProfiles, preferredId);
      setLive2DEnabled(getLive2DEnabledPreference(freshUser?.user_metadata, true));
      if (!preferredProfile) {
        setIsInitializing(false);
        return;
      }

      const libraryState = useCharacterLibraryStore.getState();
      const characterState = useCharacterStore.getState();
      const hasSelectedCharacter =
        libraryState.activeId !== null || characterState.profile !== null;

      // 페이지 새로고침 시 로컬 스토어가 비어 있으면 회원 설정으로 복원.
      if (!hasSelectedCharacter) {
        if (libraryState.activeId !== preferredProfile.id) {
          setActive(preferredProfile.id);
        }
        if (characterState.profile?.id !== preferredProfile.id) {
          setProfile(preferredProfile);
        }
      }

      setTracking(getTrackingPreference(freshUser?.user_metadata, preferredProfile.id, true));
      setIsInitializing(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [authUser, setActive, setLive2DEnabled, setProfile, setProfiles, setTracking]);

  const isCharacterManagePage = pathname.startsWith("/library/");
  const isFortunePage = pathname.startsWith("/play/fortune");
  const suppressGlobalLive2D = isCharacterManagePage || isFortunePage;

  return (
    <>
      <Script
        src="/live2dcubismcore.min.js"
        strategy="afterInteractive"
        onLoad={() => setCoreReady(true)}
        onReady={() => setCoreReady(true)}
      />
      {authUser && !suppressGlobalLive2D && coreReady && isLive2DEnabled ? (
        <Live2DWrapper />
      ) : null}
    </>
  );
}
