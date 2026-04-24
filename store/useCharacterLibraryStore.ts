import { create } from "zustand";
import type { CharacterProfile } from "@/types/character";

/**
 * 업로드/내장된 캐릭터 프로필의 라이브러리.
 *
 * - Supabase 연동 전까지는 세션 휘발성. 새로고침하면 기본 내장 캐릭터만 남는다.
 * - `activeId` 가 현재 Live2DWrapper 에 띄운 캐릭터 id.
 * - blob URL 정리는 unregister 시 수동으로 해야 한다 (메모리 누수 방지).
 */
interface CharacterLibraryState {
  profiles: CharacterProfile[];
  activeId: string | null;

  register: (profile: CharacterProfile) => void;
  unregister: (id: string) => void;
  updateProfile: (id: string, patch: Partial<CharacterProfile>) => void;
  setActive: (id: string | null) => void;
}

export const useCharacterLibraryStore = create<CharacterLibraryState>((set) => ({
  profiles: [],
  activeId: null,

  register: (profile) =>
    set((s) => {
      const existing = s.profiles.findIndex((p) => p.id === profile.id);
      if (existing >= 0) {
        const next = [...s.profiles];
        next[existing] = profile;
        return { profiles: next };
      }
      return { profiles: [...s.profiles, profile] };
    }),

  unregister: (id) =>
    set((s) => {
      const target = s.profiles.find((p) => p.id === id);
      if (target && !target.isBuiltIn) {
        for (const url of target.blobUrls) {
          try {
            URL.revokeObjectURL(url);
          } catch (e) {
            console.warn("[CharacterLibrary] revokeObjectURL warning", e);
          }
        }
      }
      return {
        profiles: s.profiles.filter((p) => p.id !== id),
        activeId: s.activeId === id ? null : s.activeId,
      };
    }),

  updateProfile: (id, patch) =>
    set((s) => ({
      profiles: s.profiles.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    })),

  setActive: (id) => set({ activeId: id }),
}));
