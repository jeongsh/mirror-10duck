"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import Live2DCubismCoreScript from "./Live2DCubismCoreScript";
import { getTrackingPreference, getPreferredCharacterId } from "@/lib/supabase/characterPreferences";
import {
  getLive2DEnabledPreference,
  saveLive2DEnabledPreference,
} from "@/lib/supabase/characterPreferences";
import { useAuthUser } from "@/lib/supabase/useAuthUser";
import { supabase } from "@/lib/supabase/client";
import { useCharacterLibraryStore } from "@/store/useCharacterLibraryStore";
import { useCharacterStore } from "@/store/useCharacterStore";
import { listCharacterProfiles } from "@/lib/supabase/characters";
import { MAO_PRO_PROFILE } from "@/lib/live2d/defaultProfile";
import {
  BASE_PROFILES,
  mergeProfiles,
  resolvePreferredProfile,
} from "@/lib/live2d/profileSync";
import {
  useUnreadNotificationNotice,
} from "@/lib/community/useUnreadNotificationCount";

type Live2DClientOnlyProps = {
  variant?: "desktop" | "mobile";
};

const Live2DWrapper = dynamic(() => import("./Live2DWrapper"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[420px] w-[var(--layout-live2d-width)] items-end justify-center border-2 border-dashed border-gray-500 bg-gray-200/60 text-[11px] tracking-widest text-gray-500 uppercase">
      [Live2D loading...]
    </div>
  ),
});

export default function Live2DClientOnly({ variant = "desktop" }: Live2DClientOnlyProps) {
  return <Live2DClientOnlyEnabled variant={variant} />;
}

function Live2DClientOnlyEnabled({ variant }: Required<Live2DClientOnlyProps>) {
  const pathname = usePathname();
  const authUser = useAuthUser();
  const [coreReady, setCoreReady] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  const setProfiles = useCharacterLibraryStore((s) => s.setProfiles);
  const setActive = useCharacterLibraryStore((s) => s.setActive);
  const setProfile = useCharacterStore((s) => s.setProfile);
  const setTracking = useCharacterStore((s) => s.setTracking);
  const setLive2DEnabled = useCharacterStore((s) => s.setLive2DEnabled);
  const setEmotion = useCharacterStore((s) => s.setEmotion);
  const isLive2DEnabled = useCharacterStore((s) => s.isLive2DEnabled);

  useEffect(() => {
    if (typeof window !== "undefined" && window.Live2DCubismCore) {
      setCoreReady(true);
      return;
    }

    let cancelled = false;
    const poll = async () => {
      for (let i = 0; i < 160; i++) {
        if (cancelled) return;
        if (window.Live2DCubismCore) {
          setCoreReady(true);
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    };
    void poll();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (authUser === undefined) return;

    if (!authUser) {
      setProfiles(BASE_PROFILES);
      setActive(MAO_PRO_PROFILE.id);
      setProfile(MAO_PRO_PROFILE);
      setEmotion("idle");
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
      const hasOnlyGuestDefaultCharacter =
        libraryState.activeId === MAO_PRO_PROFILE.id &&
        characterState.profile?.id === MAO_PRO_PROFILE.id;

      // 페이지 새로고침 시 로컬 스토어가 비어 있으면 회원 설정으로 복원.
      if (!hasSelectedCharacter || hasOnlyGuestDefaultCharacter) {
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
  }, [authUser, setActive, setEmotion, setLive2DEnabled, setProfile, setProfiles, setTracking]);

  const isCharacterManagePage = pathname.startsWith("/library/");
  const isFortunePage = pathname.startsWith("/play/fortune");
  const suppressGlobalLive2D = isCharacterManagePage || isFortunePage;

  useEffect(() => {
    if (variant !== "mobile") return;
    setMobileOpen(false);
  }, [pathname, variant]);

  return (
    <>
      <Live2DCubismCoreScript onReady={() => setCoreReady(true)} />
      <CharacterFallbackToast enabled={!isLive2DEnabled || suppressGlobalLive2D} />
      {!suppressGlobalLive2D && coreReady && isLive2DEnabled && variant === "mobile" ? (
        <MobileLive2DLauncher open={mobileOpen} onOpen={() => setMobileOpen(true)} onClose={() => setMobileOpen(false)} />
      ) : !suppressGlobalLive2D && coreReady && isLive2DEnabled ? (
        <Live2DWrapper />
      ) : !suppressGlobalLive2D && !isInitializing ? (
        <CharacterDisabledPanel />
      ) : null}
    </>
  );
}

function MobileLive2DLauncher({
  open,
  onOpen,
  onClose,
}: {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  const profile = useCharacterStore((s) => s.profile);
  const setEmotion = useCharacterStore((s) => s.setEmotion);
  const unreadNotice = useUnreadNotificationNotice();
  const unreadCount = unreadNotice.count;
  const characterName = profile?.name?.replace(/\s*\(.*?\)\s*$/g, "").trim() || "캐릭터";

  const handleOpen = () => {
    setEmotion(Math.random() < 0.35 ? "happy" : "idle");
    onOpen();
  };

  if (!open) {
    return (
      <div className="fixed bottom-5 right-4 z-50">
        <button
          type="button"
          aria-label={`${characterName}와 대화하기`}
          onClick={handleOpen}
          className="relative h-16 w-16 rounded-full border-2 border-pink-200 bg-white shadow-xl outline-none transition hover:-translate-y-0.5 hover:border-pink-300 hover:shadow-2xl focus-visible:ring-2 focus-visible:ring-pink-300"
        >
          <CharacterNotificationBadge count={unreadCount} className="right-0 top-0" />
          <span className="absolute inset-0 overflow-hidden rounded-full">
            {profile?.thumbnailUrl ? (
              <img
                src={profile.thumbnailUrl}
                alt=""
                className="absolute inset-0 h-full w-full scale-125 object-cover object-top"
              />
            ) : (
              <span className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-pink-50 via-white to-sky-50 text-lg font-black text-pink-500">
                캐
              </span>
            )}
          </span>
        </button>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex min-h-dvh flex-col bg-gray-950/45 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`${characterName} 대화`}
    >
      <div className="flex items-center justify-between border-b border-pink-100 bg-white px-4 py-3 shadow-sm">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate text-sm font-black text-gray-900">{characterName}</p>
            <InlineNotificationBadge count={unreadCount} />
          </div>
          <p className="text-xs font-semibold text-gray-500">캐릭터 대화</p>
        </div>
        <button
          type="button"
          aria-label="캐릭터 대화 닫기"
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-lg font-black leading-none text-gray-500 shadow-sm hover:bg-gray-100"
        >
          ×
        </button>
      </div>
      <div className="relative flex flex-1 flex-col overflow-hidden bg-gradient-to-b from-pink-50 via-white to-gray-100">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-white/80 to-transparent" />
        <div className="relative flex flex-1 items-end justify-center pt-6">
          <div className="w-full max-w-[360px]">
            <Live2DWrapper />
          </div>
        </div>
        <div className="border-t border-pink-100 bg-white/90 px-4 py-3 text-center text-xs font-semibold text-gray-500 backdrop-blur">
          캐릭터를 누르면 지금 할 일과 작품 추천을 이어서 고를 수 있어요.
        </div>
      </div>
    </div>
  );
}

function CharacterDisabledPanel() {
  const [saving, setSaving] = useState(false);
  const [bubbleOpen, setBubbleOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const unreadNotice = useUnreadNotificationNotice();
  const unreadCount = unreadNotice.count;
  const profile = useCharacterStore((s) => s.profile);
  const setLive2DEnabled = useCharacterStore((s) => s.setLive2DEnabled);
  const setMessage = useCharacterStore((s) => s.setMessage);
  const setEmotion = useCharacterStore((s) => s.setEmotion);
  const characterName = profile?.name?.replace(/\s*\(.*?\)\s*$/g, "").trim() || "캐릭터";

  const enableCharacter = async () => {
    const nextEmotion = Math.random() < 0.35 ? "happy" : "idle";
    setEmotion(nextEmotion);
    setLive2DEnabled(true);
    setMessage(`${characterName}를 다시 불러왔어요.`);
    setSaving(true);
    try {
      await saveLive2DEnabledPreference(true);
    } catch (error) {
      setLive2DEnabled(false);
      setMessage(error instanceof Error ? `캐릭터 설정 저장 실패: ${error.message}` : "캐릭터 설정 저장에 실패했어요.");
    } finally {
      setSaving(false);
      window.setTimeout(() => {
        const store = useCharacterStore.getState();
        if (store.message) store.setMessage(null);
        if (store.emotion === "happy") store.setEmotion("idle");
      }, 2600);
    }
  };

  useEffect(() => {
    if (!bubbleOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (containerRef.current?.contains(target)) return;
      setBubbleOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [bubbleOpen]);

  return (
    <div className="relative flex min-h-[360px] w-full items-end justify-center px-5 pb-8">
      <div ref={containerRef} className="relative flex flex-col items-center">
        {bubbleOpen && (
          <div className="absolute bottom-full left-1/2 z-20 mb-4 w-[min(260px,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border-2 border-pink-200 bg-white px-4 py-3 text-center text-sm font-semibold text-gray-800 shadow-lg before:absolute before:-bottom-2 before:left-1/2 before:h-4 before:w-4 before:-translate-x-1/2 before:rotate-45 before:border-b-2 before:border-r-2 before:border-pink-200 before:bg-white before:content-['']">
          <p>{characterName}를 다시 부를까요?</p>
          <p className="mt-1 text-xs font-medium leading-5 text-gray-500">
            알림은 계속 토스트로 띄워둘게요.
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-1">
            <button
              type="button"
              disabled={saving}
              onClick={() => void enableCharacter()}
              className="rounded-full border border-pink-200 bg-pink-50 px-3 py-1 text-[11px] font-semibold text-pink-700 hover:bg-pink-100 disabled:opacity-60"
            >
              {saving ? "불러오는 중..." : "다시 나오기"}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => setBubbleOpen(false)}
              className="rounded-full border border-gray-200 bg-white px-3 py-1 text-[11px] font-semibold text-gray-500 hover:bg-gray-100 disabled:opacity-60"
            >
              계속 숨기기
            </button>
          </div>
        </div>
        )}
        {!bubbleOpen && unreadNotice.shouldShowNotice && (
          <span className="sr-only">확인하지 않은 알림 {unreadNotice.count}개</span>
        )}
        <button
          type="button"
          aria-label={`숨겨진 ${characterName} 열기`}
          disabled={saving}
          onClick={() => setBubbleOpen((open) => !open)}
          className="group relative h-20 w-20 rounded-full border-2 border-pink-200 bg-white shadow-lg outline-none transition hover:-translate-y-0.5 hover:border-pink-300 hover:shadow-xl focus-visible:ring-2 focus-visible:ring-pink-300 disabled:opacity-60"
        >
          <CharacterNotificationBadge count={unreadCount} className="right-0 top-0" />
          <span className="absolute inset-0 overflow-hidden rounded-full">
            {profile?.thumbnailUrl ? (
              <img
                src={profile.thumbnailUrl}
                alt=""
                className="absolute inset-0 h-full w-full scale-125 object-cover object-top transition group-hover:scale-[1.32]"
              />
            ) : (
              <span
                className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-pink-50 via-white to-sky-50 text-xl font-black text-pink-500 transition group-hover:scale-105"
                aria-hidden
              >
                캐
              </span>
            )}
          </span>
        </button>
      </div>
    </div>
  );
}

function CharacterNotificationBadge({ count, className = "" }: { count: number; className?: string }) {
  if (count <= 0) return null;

  return (
    <span
      className={`absolute z-10 flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-white bg-red-500 px-1 text-[10px] font-black leading-none text-white shadow-md ${className}`}
      aria-label={`읽지 않은 알림 ${count}개`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

function InlineNotificationBadge({ count }: { count: number }) {
  if (count <= 0) return null;

  return (
    <span
      className="shrink-0 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-black leading-none text-white"
      aria-label={`읽지 않은 알림 ${count}개`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

function CharacterFallbackToast({ enabled }: { enabled: boolean }) {
  const message = useCharacterStore((s) => s.message);
  if (!enabled || !message) return null;

  return (
    <div className="pointer-events-none fixed bottom-5 left-1/2 z-50 w-[min(360px,calc(100vw-2rem))] -translate-x-1/2">
      <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-800 shadow-lg">
        {message}
      </div>
    </div>
  );
}
