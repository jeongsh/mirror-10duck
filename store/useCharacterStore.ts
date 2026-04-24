import { create } from "zustand";
import type {
  CharacterEmotion,
  CharacterProfile,
  CharacterViewConfig,
} from "@/types/character";

export type { CharacterEmotion } from "@/types/character";

/**
 * 현재 화면에 떠있는 "활성 캐릭터 한 명"의 런타임 상태.
 *
 * - `profile` 은 모델의 정적 설정(매핑/프리셋/옷 등) 전체 스냅샷.
 * - `modelPath` 는 profile.modelPath 를 복제 보관 (Live2DWrapper 가 이것만 보면
 *   모델 재로드 가능하게 하기 위함, 하위 호환용).
 * - `partOpacities` / `morphValues` 는 스튜디오 UI 가 조절하는 라이브 조작값.
 */
export interface CharacterState {
  profile: CharacterProfile | null;

  isLoading: boolean;
  isReady: boolean;
  isTracking: boolean;
  modelPath: string | null;
  emotion: CharacterEmotion;
  message: string | null;
  error: string | null;
  modelConfig: CharacterViewConfig | null;

  /** part id → opacity (0 ~ 1). 빈 객체면 모델 기본값 유지. */
  partOpacities: Record<string, number>;
  /** 각 outfit group 에서 현재 선택된 part id. */
  selectedOutfits: Record<string, string>;
  /** paramId → value 라이브 모핑 값. */
  morphValues: Record<string, number>;

  setProfile: (profile: CharacterProfile | null) => void;
  setLoading: (loading: boolean) => void;
  setReady: (ready: boolean) => void;
  setTracking: (tracking: boolean) => void;
  setModelPath: (path: string | null) => void;
  setEmotion: (emotion: CharacterEmotion) => void;
  setMessage: (message: string | null) => void;
  setError: (error: string | null) => void;
  setModelConfig: (config: CharacterViewConfig | null) => void;

  setPartOpacity: (partId: string, opacity: number) => void;
  setPartOpacities: (map: Record<string, number>) => void;
  selectOutfit: (groupId: string, partId: string) => void;
  setMorphValue: (paramId: string, value: number) => void;
  resetMorphs: () => void;

  reset: () => void;
}

const INITIAL_STATE: Omit<
  CharacterState,
  | "setProfile"
  | "setLoading"
  | "setReady"
  | "setTracking"
  | "setModelPath"
  | "setEmotion"
  | "setMessage"
  | "setError"
  | "setModelConfig"
  | "setPartOpacity"
  | "setPartOpacities"
  | "selectOutfit"
  | "setMorphValue"
  | "resetMorphs"
  | "reset"
> = {
  profile: null,
  isLoading: false,
  isReady: false,
  isTracking: true,
  modelPath: null,
  emotion: "idle",
  message: null,
  error: null,
  modelConfig: null,
  partOpacities: {},
  selectedOutfits: {},
  morphValues: {},
};

export const useCharacterStore = create<CharacterState>((set) => ({
  ...INITIAL_STATE,

  setProfile: (profile) =>
    set(() => {
      if (!profile) {
        return {
          profile: null,
          modelPath: null,
          selectedOutfits: {},
          partOpacities: {},
          morphValues: {},
          modelConfig: null,
        };
      }
      const selectedOutfits: Record<string, string> = {};
      for (const group of profile.outfits) {
        const def = group.defaultPartId ?? group.parts[0]?.id;
        if (def) selectedOutfits[group.id] = def;
      }
      const morphValues: Record<string, number> = {};
      for (const slider of profile.morphSliders) {
        morphValues[slider.paramId] = slider.defaultValue;
      }
      return {
        profile,
        modelPath: profile.modelPath,
        selectedOutfits,
        partOpacities: {},
        morphValues,
        modelConfig: profile.defaultView,
      };
    }),

  setLoading: (loading) => set({ isLoading: loading }),
  setReady: (ready) => set({ isReady: ready }),
  setTracking: (tracking) => set({ isTracking: tracking }),
  setModelPath: (path) => set({ modelPath: path }),
  setEmotion: (emotion) => set({ emotion }),
  setMessage: (message) => set({ message }),
  setError: (error) => set({ error }),
  setModelConfig: (config) => set({ modelConfig: config }),

  setPartOpacity: (partId, opacity) =>
    set((s) => ({ partOpacities: { ...s.partOpacities, [partId]: opacity } })),
  setPartOpacities: (map) =>
    set((s) => ({ partOpacities: { ...s.partOpacities, ...map } })),
  selectOutfit: (groupId, partId) =>
    set((s) => ({ selectedOutfits: { ...s.selectedOutfits, [groupId]: partId } })),
  setMorphValue: (paramId, value) =>
    set((s) => ({ morphValues: { ...s.morphValues, [paramId]: value } })),
  resetMorphs: () =>
    set((s) => {
      if (!s.profile) return { morphValues: {} };
      const next: Record<string, number> = {};
      for (const slider of s.profile.morphSliders) {
        next[slider.paramId] = slider.defaultValue;
      }
      return { morphValues: next };
    }),

  reset: () => set({ ...INITIAL_STATE }),
}));
