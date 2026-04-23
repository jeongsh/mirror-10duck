import { create } from "zustand";

export type CharacterEmotion =
  | "idle"
  | "happy"
  | "sad"
  | "angry"
  | "surprised"
  | "shy";

export interface CharacterState {
  isLoading: boolean;
  isReady: boolean;
  modelPath: string | null;
  emotion: CharacterEmotion;
  error: string | null;
  modelConfig: { scale: number; x: number; y: number } | null;

  setLoading: (loading: boolean) => void;
  setReady: (ready: boolean) => void;
  setModelPath: (path: string | null) => void;
  setEmotion: (emotion: CharacterEmotion) => void;
  setError: (error: string | null) => void;
  setModelConfig: (config: { scale: number; x: number; y: number } | null) => void;
  reset: () => void;
}

const INITIAL_STATE: Omit<
  CharacterState,
  | "setLoading"
  | "setReady"
  | "setModelPath"
  | "setEmotion"
  | "setError"
  | "setModelConfig"
  | "reset"
> = {
  isLoading: false,
  isReady: false,
  modelPath: null,
  emotion: "idle",
  error: null,
  modelConfig: null,
};

export const useCharacterStore = create<CharacterState>((set) => ({
  ...INITIAL_STATE,

  setLoading: (loading) => set({ isLoading: loading }),
  setReady: (ready) => set({ isReady: ready }),
  setModelPath: (path) => set({ modelPath: path }),
  setEmotion: (emotion) => set({ emotion }),
  setError: (error) => set({ error }),
  setModelConfig: (config) => set({ modelConfig: config }),

  reset: () => set({ ...INITIAL_STATE }),
}));
