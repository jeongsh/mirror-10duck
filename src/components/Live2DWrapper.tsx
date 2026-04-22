"use client";

import { useCharacterStore } from "@/store/useCharacterStore";

export default function Live2DWrapper() {
  const { isVisible, currentEmotion, intimacyLevel } = useCharacterStore();

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 right-8 z-50 flex flex-col items-end gap-2 pointer-events-none">
      {/* Character Status UI */}
      <div className="bg-white dark:bg-zinc-900 p-3 wf-border-thick text-[10px] wf-shadow pointer-events-auto mb-2 uppercase font-bold">
        <p className="border-b wf-border mb-1 pb-1">STATUS</p>
        <p>EMOTION: {currentEmotion}</p>
        <p>INTIMACY: {intimacyLevel}</p>
      </div>
      
      {/* Live2D Canvas Placeholder */}
      <div className="w-[300px] h-[400px] wf-border-thick bg-white dark:bg-zinc-900 flex items-center justify-center relative pointer-events-auto">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-full h-[1px] bg-foreground/10 rotate-45 absolute"></div>
            <div className="w-full h-[1px] bg-foreground/10 -rotate-45 absolute"></div>
        </div>
        <p className="relative z-10 font-black tracking-widest wf-border bg-background px-4 py-2 text-xs">
          LIVE2D_CANVAS_AREA
        </p>
      </div>
    </div>
  );
}
