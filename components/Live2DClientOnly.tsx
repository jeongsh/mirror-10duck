"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Script from "next/script";
import { usePathname } from "next/navigation";
import { getTrackingPreference } from "@/lib/supabase/characterPreferences";
import { useAuthUser } from "@/lib/supabase/useAuthUser";
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
    <div className="fixed bottom-0 right-0 z-50 border-2 border-dashed border-gray-500 bg-gray-200/60 p-4 text-[11px] tracking-widest text-gray-500 uppercase">
      [Live2D loading...]
    </div>
  ),
});

export default function Live2DClientOnly() {
  const pathname = usePathname();
  const authUser = useAuthUser();
  const [coreReady, setCoreReady] = useState(false);

  const setProfiles = useCharacterLibraryStore((s) => s.setProfiles);
  const setActive = useCharacterLibraryStore((s) => s.setActive);
  const setProfile = useCharacterStore((s) => s.setProfile);
  const setTracking = useCharacterStore((s) => s.setTracking);

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
      return;
    }

    void (async () => {
      const savedProfiles = await listCharacterProfiles();
      if (cancelled) return;

      const allProfiles = mergeProfiles(BASE_PROFILES, savedProfiles);
      setProfiles(allProfiles);

      const preferredId =
        typeof authUser.user_metadata?.activeCharacterId === "string"
          ? (authUser.user_metadata.activeCharacterId as string)
          : undefined;

      const preferredProfile = resolvePreferredProfile(allProfiles, preferredId);
      if (!preferredProfile) return;

      const libraryState = useCharacterLibraryStore.getState();
      const characterState = useCharacterStore.getState();

      if (libraryState.activeId !== preferredProfile.id) {
        setActive(preferredProfile.id);
      }
      if (characterState.profile?.id !== preferredProfile.id) {
        setProfile(preferredProfile);
      }
      setTracking(getTrackingPreference(authUser.user_metadata, preferredProfile.id, true));
    })();

    return () => {
      cancelled = true;
    };
  }, [authUser, setActive, setProfile, setProfiles, setTracking]);

  const isCharacterManagePage = pathname.startsWith("/library/");

  return (
    <>
      <Script
        src="/live2dcubismcore.min.js"
        strategy="afterInteractive"
        onLoad={() => setCoreReady(true)}
        onReady={() => setCoreReady(true)}
      />
      {authUser && !isCharacterManagePage && coreReady ? <Live2DWrapper /> : null}
    </>
  );
}
