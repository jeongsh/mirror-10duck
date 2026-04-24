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
  isTracking: boolean;
  modelPath: string | null;
  emotion: CharacterEmotion;
  message: string | null;
  error: string | null;
  modelConfig: { scale: number; x: number; y: number } | null;

  setLoading: (loading: boolean) => void;
  setReady: (ready: boolean) => void;
  setTracking: (tracking: boolean) => void;
  setModelPath: (path: string | null) => void;
  setEmotion: (emotion: CharacterEmotion) => void;
  setMessage: (message: string | null) => void;
  setError: (error: string | null) => void;
  setModelConfig: (config: { scale: number; x: number; y: number } | null) => void;
  reset: () => void;
}

const INITIAL_STATE: Omit<
  CharacterState,
  | "setLoading"
  | "setReady"
  | "setTracking"
  | "setModelPath"
  | "setEmotion"
  | "setMessage"
  | "setError"
  | "setModelConfig"
  | "reset"
> = {
  isLoading: false,
  isReady: false,
  isTracking: true,
  modelPath: null,
  emotion: "idle",
  message: null,
  error: null,
  modelConfig: null,
};

export const useCharacterStore = create<CharacterState>((set) => ({
  ...INITIAL_STATE,

  setLoading: (loading) => set({ isLoading: loading }),
  setReady: (ready) => set({ isReady: ready }),
  setTracking: (tracking) => set({ isTracking: tracking }),
  setModelPath: (path) => set({ modelPath: path }),
  setEmotion: (emotion) => set({ emotion }),
  setMessage: (message) => set({ message }),
  setError: (error) => set({ error }),
  setModelConfig: (config) => set({ modelConfig: config }),

  reset: () => set({ ...INITIAL_STATE }),
}));
