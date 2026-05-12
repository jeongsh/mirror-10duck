"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MAO_PRO_PROFILE, PICHU_PROFILE } from "@/lib/live2d/defaultProfile";
import { listCharacterProfiles } from "@/lib/supabase/characters";
import { useAuthUser } from "@/lib/supabase/useAuthUser";
import { useCharacterLibraryStore } from "@/store/useCharacterLibraryStore";
import { useCharacterStore } from "@/store/useCharacterStore";
import {
  getCharacterSupportedEmotions,
  type CharacterEmotion,
  type CharacterScenarioKey,
} from "@/types/character";
import type { CharacterProfile } from "@/types/character";
import CharacterUploader from "./character/CharacterUploader";
import CharacterLibraryPanel from "./character/CharacterLibraryPanel";

import {
  BASE_PROFILES,
  mergeProfiles,
  resolvePreferredProfile,
} from "@/lib/live2d/profileSync";

type Tab = "basic" | "library" | "upload";

const TABS: { id: Tab; label: string }[] = [
  { id: "basic", label: "기본" },
  { id: "library", label: "라이브러리" },
  { id: "upload", label: "업로드" },
];

/**
 * 캐릭터 컨트롤 패널.
 *
 * - 마운트 시 내장 캐릭터들을 라이브러리에 등록하고 기본 캐릭터를 활성화한다.
 * - 탭 전환으로 기본 제어 / 라이브러리 / 업로드 패널을 표시한다.
 * - 실제 초기화 로직은 Live2DClientOnly(전역) 에서 수행하므로 여기선 UI 제어에 집중한다.
 */
export default function CharacterControls() {
  const [tab, setTab] = useState<Tab>("basic");
  const authUser = useAuthUser();

  const profiles = useCharacterLibraryStore((s) => s.profiles);
  const setProfiles = useCharacterLibraryStore((s) => s.setProfiles);
  const setActive = useCharacterLibraryStore((s) => s.setActive);
  const activeId = useCharacterLibraryStore((s) => s.activeId);

  const profile = useCharacterStore((s) => s.profile);
  const setProfile = useCharacterStore((s) => s.setProfile);

  // 로그인 상태 변화에 따른 동기화 (이미 Live2DClientOnly 에서 수행 중이지만, 
  // 라이브러리 탭 진입 시 최신 상태 보장을 위해 남겨둠)
  useEffect(() => {
    if (authUser === undefined || !authUser) return;

    void (async () => {
      const savedProfiles = await listCharacterProfiles();
      const allProfiles = mergeProfiles(BASE_PROFILES, savedProfiles);
      
      if (profiles.length !== allProfiles.length) {
        setProfiles(allProfiles);
      }

      const preferredId =
        typeof authUser.user_metadata?.activeCharacterId === "string"
          ? (authUser.user_metadata.activeCharacterId as string)
          : undefined;
      const preferredProfile = resolvePreferredProfile(allProfiles, preferredId);
      const hasSelectedCharacter = activeId !== null || profile !== null;
      
      if (preferredProfile && !hasSelectedCharacter) {
        if (activeId !== preferredProfile.id) {
          setActive(preferredProfile.id);
        }
        if (profile?.id !== preferredProfile.id) {
          setProfile(preferredProfile);
        }
      }
    })();
  }, [authUser]);

  // 비로그인: 캐릭터 관련 UI 전체 비표시
  if (!authUser) {
    return (
      <section className="border-2 border-dashed border-gray-400 bg-gray-100/60 p-6 text-center text-sm text-gray-600">
        <div className="mb-2 text-[11px] tracking-[0.2em] uppercase text-gray-500">
          [캐릭터 컨트롤 패널]
        </div>
        <div className="mb-3">로그인 후 이용 가능한 기능입니다.</div>
        <Link
          href="/auth"
          className="inline-block border border-dashed border-gray-500 bg-white px-3 py-1 text-xs tracking-widest uppercase"
        >
          [로그인 / 회원가입]
        </Link>
      </section>
    );
  }

  return (
    <section className="border-2 border-dashed border-red-500 bg-gray-200/60 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] tracking-[0.2em] text-gray-500 uppercase">
          [캐릭터 컨트롤 패널]
        </span>
        <StatusBadge />
      </div>

      <div className="mb-3 flex flex-wrap gap-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={
              "border border-dashed px-3 py-1 text-[11px] tracking-widest uppercase " +
              (tab === t.id
                ? "border-gray-900 bg-gray-300 text-gray-900"
                : "border-gray-500 bg-white/60 text-gray-700")
            }
          >
            [{t.label}]
          </button>
        ))}
      </div>

      <div className="min-h-[120px]">
        {tab === "basic" && <BasicPanel />}
        {tab === "library" && <CharacterLibraryPanel />}
        {tab === "upload" && <CharacterUploader />}
      </div>

      {profile && tab !== "basic" && (
        <div className="mt-3 border-t border-dashed border-gray-400 pt-2 text-[10px] font-mono text-gray-500">
          active = {profile.name} ({profile.id})
        </div>
      )}
    </section>
  );
}

function BasicPanel() {
  const authUser = useAuthUser();
  const emotion = useCharacterStore((s) => s.emotion);
  const profile = useCharacterStore((s) => s.profile);
  const isTracking = useCharacterStore((s) => s.isTracking);
  const setEmotion = useCharacterStore((s) => s.setEmotion);
  const setTracking = useCharacterStore((s) => s.setTracking);
  const supportedEmotions = getCharacterSupportedEmotions(profile, { includeOptional: true });

  const notify = (
    msg: string,
    emotion: CharacterEmotion = "happy",
    scenarioKey?: CharacterScenarioKey
  ) => {
    const store = useCharacterStore.getState();
    const scenarioMapping = scenarioKey ? store.profile?.scenarioMap?.[scenarioKey] : null;
    store.setMessage(msg);
    if (scenarioKey) {
      store.triggerScenario(scenarioKey);
    }
    if (!scenarioMapping?.expressionId) {
      store.setEmotion(emotion);
    }
    setTimeout(() => {
      const nextStore = useCharacterStore.getState();
      nextStore.setMessage(null);
      nextStore.triggerScenario("idle_return");
      if (!nextStore.profile?.scenarioMap?.idle_return?.expressionId) {
        nextStore.setEmotion("idle");
      }
    }, 3000);
  };

  const handleRealNotify = async (type: "COMMENT" | "MESSAGE") => {
    const userId = authUser?.id;
    if (!userId) {
      notify("로그인이 필요합니다.", "sad");
      return;
    }

    const { fetchNotifications } = await import("@/lib/community/notifications");
    const notifs = await fetchNotifications(userId, 50);

    const NOTIFICATION_EMOTIONS: Record<string, CharacterEmotion> = {
      COMMENT: "happy",
      REPLY: "happy",
      REACTION: "wink",
      FOLLOW: "love",
      HOT_PROMOTED: "surprised",
      SYSTEM: "idle",
    };
    const NOTIFICATION_SCENARIOS: Record<string, CharacterScenarioKey> = {
      COMMENT: "notification",
      REPLY: "notification",
      REACTION: "notification",
      FOLLOW: "notification",
      HOT_PROMOTED: "notification",
      SYSTEM: "notification",
    };

    let target: any;
    if (type === "COMMENT") {
      target = notifs.find((n) => n.type === "COMMENT" || n.type === "REPLY");
    } else {
      target = notifs.find((n) => n.type === "SYSTEM");
    }

    if (target) {
      notify(
        target.content,
        NOTIFICATION_EMOTIONS[target.type] || "happy",
        NOTIFICATION_SCENARIOS[target.type] ?? "notification"
      );
    } else {
      notify(
        type === "COMMENT" ? "최근 댓글 알림이 없습니다." : "최근 쪽지 알림이 없습니다.",
        "idle",
        "notification"
      );
    }
  };

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <div className="border border-dashed border-gray-500 bg-white/40 p-3">
        <div className="mb-2 text-[11px] tracking-widest text-gray-500 uppercase">
          [감정 전환 · emotion = {emotion}]
        </div>
        <div className="flex flex-wrap gap-2">
          {supportedEmotions.map((e: CharacterEmotion) => (
            <button
              key={e}
              type="button"
              onClick={() => setEmotion(e)}
              className={
                "border border-dashed px-3 py-1 text-xs tracking-widest uppercase " +
                (emotion === e
                  ? "border-gray-800 bg-gray-300 text-gray-900"
                  : "border-gray-600 bg-white/70 text-gray-700")
              }
            >
              [{e}]
            </button>
          ))}
        </div>
      </div>

      <div className="border border-dashed border-gray-500 bg-white/40 p-3">
        <div className="mb-2 text-[11px] tracking-widest text-gray-500 uppercase">
          [트래킹 / 알림 테스트]
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTracking(!isTracking)}
            className={
              "border border-dashed px-3 py-1 text-xs tracking-widest uppercase " +
              (isTracking
                ? "border-green-600 bg-green-100/70 text-green-800"
                : "border-gray-500 bg-gray-200/70 text-gray-600")
            }
          >
            [Tracking: {isTracking ? "ON" : "OFF"}]
          </button>
          <button
            type="button"
            onClick={() => handleRealNotify("COMMENT")}
            className="border border-dashed border-gray-600 bg-blue-100/70 px-3 py-1 text-xs tracking-widest uppercase"
          >
            [댓글 알림]
          </button>
          <button
            type="button"
            onClick={() => handleRealNotify("MESSAGE")}
            className="border border-dashed border-gray-600 bg-blue-100/70 px-3 py-1 text-xs tracking-widest uppercase"
          >
            [쪽지 알림]
          </button>
          <button
            type="button"
            onClick={() => notify("다녀오셨어요? 환영해요!", "happy", "login")}
            className="border border-dashed border-gray-600 bg-green-100/70 px-3 py-1 text-xs tracking-widest uppercase"
          >
            [로그인 (접속)]
          </button>
          <button
            type="button"
            onClick={() => notify("안녕히가세요! 또 봐요!", "sad", "logout")}
            className="border border-dashed border-gray-600 bg-red-100/70 px-3 py-1 text-xs tracking-widest uppercase"
          >
            [로그아웃]
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusBadge() {
  const status = useCharacterStore((s) =>
    s.error ? `ERROR: ${s.error}` : s.isLoading ? "LOADING..." : s.isReady ? "READY" : "IDLE"
  );
  return (
    <span className="border border-dashed border-gray-500 bg-white/60 px-2 py-1 text-[11px] tracking-widest uppercase">
      status = {status}
    </span>
  );
}
