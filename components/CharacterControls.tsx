"use client";

import { useCharacterStore, type CharacterEmotion } from "@/store/useCharacterStore";

const MAO_PRO_PATH = "/live2d/mao_pro/mao_pro.model3.json";

const EMOTIONS: CharacterEmotion[] = [
  "idle",
  "happy",
  "sad",
  "angry",
  "surprised",
  "shy",
];

/**
 * 와이어프레임 검증용 캐릭터 컨트롤 패널.
 * - 모델 로드/해제: useCharacterStore.setModelPath 로 Live2DWrapper 재마운트 트리거
 * - 감정 전환: setEmotion (실제 expression 연결은 후속 작업)
 */
export default function CharacterControls() {
  const modelPath = useCharacterStore((s) => s.modelPath);
  const isLoading = useCharacterStore((s) => s.isLoading);
  const isReady = useCharacterStore((s) => s.isReady);
  const emotion = useCharacterStore((s) => s.emotion);
  const error = useCharacterStore((s) => s.error);
  const setModelPath = useCharacterStore((s) => s.setModelPath);
  const setEmotion = useCharacterStore((s) => s.setEmotion);
  const reset = useCharacterStore((s) => s.reset);

  const status = error
    ? `ERROR: ${error}`
    : isLoading
      ? "LOADING..."
      : isReady
        ? "READY"
        : "IDLE";

  return (
    <section className="border-2 border-dashed border-gray-500 bg-gray-200/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[11px] tracking-[0.2em] text-gray-500 uppercase">
          [캐릭터 컨트롤 패널 영역]
        </span>
        <span className="border border-dashed border-gray-500 bg-white/60 px-2 py-1 text-[11px] tracking-widest">
          status = {status}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {/* 모델 로드 --------------------------------------------------- */}
        <div className="border border-dashed border-gray-500 bg-white/40 p-3">
          <div className="mb-2 text-[11px] tracking-widest text-gray-500 uppercase">
            [모델 로드]
          </div>
          <div className="mb-2 break-all font-mono text-[11px] text-gray-600">
            modelPath = {modelPath ?? "null"}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setModelPath(MAO_PRO_PATH)}
              disabled={modelPath === MAO_PRO_PATH}
              className="border border-dashed border-gray-600 bg-white/70 px-3 py-1 text-xs tracking-widest uppercase disabled:opacity-40"
            >
              [Load mao_pro]
            </button>
            <button
              type="button"
              onClick={() => setModelPath(null)}
              disabled={modelPath === null}
              className="border border-dashed border-gray-600 bg-white/70 px-3 py-1 text-xs tracking-widest uppercase disabled:opacity-40"
            >
              [Unload]
            </button>
            <button
              type="button"
              onClick={() => reset()}
              className="border border-dashed border-gray-600 bg-white/70 px-3 py-1 text-xs tracking-widest uppercase"
            >
              [Reset Store]
            </button>
          </div>
        </div>

        {/* 감정 전환 --------------------------------------------------- */}
        <div className="border border-dashed border-gray-500 bg-white/40 p-3">
          <div className="mb-2 text-[11px] tracking-widest text-gray-500 uppercase">
            [감정 전환 · emotion = {emotion}]
          </div>
          <div className="flex flex-wrap gap-2">
            {EMOTIONS.map((e) => (
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
      </div>
    </section>
  );
}
