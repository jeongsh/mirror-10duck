import { create } from 'zustand';

interface CharacterState {
  isVisible: boolean;
  currentEmotion: "neutral" | "happy" | "sad" | "angry" | "surprised";
  intimacyLevel: number;
  toggleVisibility: () => void;
  setEmotion: (emotion: CharacterState['currentEmotion']) => void;
  increaseIntimacy: (amount?: number) => void;
}

export const useCharacterStore = create<CharacterState>((set) => ({
  isVisible: true,
  currentEmotion: "neutral",
  intimacyLevel: 0,
  toggleVisibility: () => set((state) => ({ isVisible: !state.isVisible })),
  setEmotion: (emotion) => set({ currentEmotion: emotion }),
  increaseIntimacy: (amount = 1) =>
    set((state) => ({ intimacyLevel: state.intimacyLevel + amount })),
}));
