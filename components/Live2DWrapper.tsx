"use client";

import { useEffect, useRef, useState } from "react";
import { Application, Ticker } from "pixi.js";
import { Live2DModel } from "@naari3/pixi-live2d-display";
import { useCharacterStore } from "@/store/useCharacterStore";
import type { CharacterActionKey } from "@/types/character";

declare global {
  interface Window {
    Live2DCubismCore?: unknown;
    /**
     * @naari3/pixi-live2d-display 가 렌더 콜백에서 `globalThis.app || window.app` 로
     * Pixi Application 을 찾기 때문에 반드시 이 전역에 Application 을 노출해야
     * Live2DModel 이 실제로 그려진다.
     */
    app?: Application;
  }
}

const CANVAS_W = 320;
const CANVAS_H = 420;

/**
 * Live2D 캐릭터 렌더링 래퍼.
 *
 * 핵심 설계:
 * 1) Pixi Application 은 컴포넌트 마운트 시 1회만 생성한다.
 *    modelPath 가 바뀔 때마다 앱을 재생성하면 GL 상태 파괴/재초기화 + 무거운 GPU 업로드가
 *    연쇄되어 메인 스레드가 수 초 멈추는 freeze 가 일어난다.
 * 2) modelPath 변경 시에는 기존 모델만 stage 에서 떼고 destroy 한 뒤 새 모델을 로드한다.
 * 3) `preference: 'webgl'` 로 WebGPU 를 강제 차단 (Cubism SDK 호환).
 * 4) `autoHitTest: false`, `autoFocus: false` 로 Automator 의 globalpointermove 핸들러를
 *    비활성화한다. Live2D 모델은 drawable 수가 많아 매 pointer 이벤트마다 getBounds 가
 *    호출되면 성능이 급격히 떨어진다. (성능 검증 이후 다시 켤 수 있음)
 * 5) `window.app` 은 Pixi Application 수명과 1:1 로 동기화한다.
 * 6) Strict Mode 이중 마운트 대비: 두 단계 effect 모두에 `cancelled` 가드 + cleanup.
 * 7) 모델별 특수 ID (표정/모션/히트 영역) 는 store 의 `profile` 매핑에서 읽는다.
 *    mao_pro 전용 하드코딩은 모두 defaultProfile.ts 로 분리되었다.
 */
export default function Live2DWrapper() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const modelRef = useRef<Live2DModel | null>(null);
  const originalFocusRef = useRef<((x: number, y: number) => void) | null>(null);
  const [appReady, setAppReady] = useState(false);

  const modelPath = useCharacterStore((s) => s.modelPath);
  const setLoading = useCharacterStore((s) => s.setLoading);
  const setReady = useCharacterStore((s) => s.setReady);
  const setError = useCharacterStore((s) => s.setError);
  const setModelConfig = useCharacterStore((s) => s.setModelConfig);

  const dragData = useRef({ isDragging: false, lastX: 0, lastY: 0 });

  // --------------------------------------------------------------------
  // Effect 1 · Pixi Application 생성 (1회)
  // --------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    let app: Application | null = null;

    const waitForCubismCore = async (timeoutMs = 5000) => {
      const start = Date.now();
      while (!window.Live2DCubismCore) {
        if (Date.now() - start > timeoutMs) {
          throw new Error(
            "Live2DCubismCore 전역이 준비되지 않았습니다. /live2dcubismcore.min.js 를 확인하세요."
          );
        }
        await new Promise((r) => setTimeout(r, 50));
      }
    };

    const boot = async () => {
      if (!canvasRef.current) return;
      try {
        await waitForCubismCore();
        if (cancelled) return;

        app = new Application();
        await app.init({
          canvas: canvasRef.current,
          preference: "webgl",
          antialias: true,
          backgroundAlpha: 0,
          // resolution 을 1 로 고정해 app.screen 과 stage 좌표를 일치시킨다.
          // (DPR 과 CSS 크기 차이에서 오는 위치 계산 버그를 제거)
          resolution: 1,
          autoDensity: false,
          width: CANVAS_W,
          height: CANVAS_H,
        });

        if (cancelled) {
          app.destroy(true, {
            children: true,
            texture: true,
            baseTexture: true,
            textureSource: true,
          } as unknown as Parameters<Application["destroy"]>[1]);
          app = null;
          return;
        }

        Live2DModel.registerTicker(Ticker);
        window.app = app;
        appRef.current = app;
        setAppReady(true);
      } catch (err) {
        console.error("[Live2DWrapper] application boot 실패:", err);
        setError(err instanceof Error ? err.message : String(err));
      }
    };

    void boot();

    return () => {
      cancelled = true;
      setAppReady(false);

      if (modelRef.current) {
        try {
          modelRef.current.destroy({
            children: true,
            texture: true,
            baseTexture: true,
          });
        } catch (e) {
          console.warn("[Live2DWrapper] model destroy warning:", e);
        }
        modelRef.current = null;
      }

      const a = appRef.current ?? app;
      if (a) {
        try {
          a.destroy(true, {
            children: true,
            texture: true,
            baseTexture: true,
            textureSource: true,
          } as unknown as Parameters<Application["destroy"]>[1]);
        } catch (e) {
          console.warn("[Live2DWrapper] app destroy warning:", e);
        }
      }
      appRef.current = null;

      if (window.app === a) {
        window.app = undefined;
      }
    };
  }, [setError]);

  // --------------------------------------------------------------------
  // Effect 2 · modelPath 변경 시 모델 로드/해제
  // --------------------------------------------------------------------
  useEffect(() => {
    if (!appReady) return;
    const app = appRef.current;
    if (!app) return;

    let cancelled = false;
    let localModel: Live2DModel | null = null;

    const swap = async () => {
      // 이전 모델 정리
      if (modelRef.current) {
        try {
          app.stage.removeChild(modelRef.current);
          modelRef.current.destroy({
            children: true,
            texture: true,
            baseTexture: true,
          });
        } catch (e) {
          console.warn("[Live2DWrapper] previous model destroy warning:", e);
        }
        modelRef.current = null;
      }

      if (!modelPath) {
        setReady(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        localModel = await Live2DModel.from(modelPath, {
          autoHitTest: true,
          autoFocus: true, // 항상 켜두되, 아래에서 focus 함수를 가로채서 제어합니다.
        });
        if (cancelled) {
          localModel?.destroy({ children: true, texture: true, baseTexture: true });
          return;
        }

        // ─── Cubism Core 6.0+ 호환 monkey-patch ────────────────────────────
        // Core 5 에서는 `model.drawables.renderOrders` 였지만 Core 6 에서는
        // `model.renderOrders` (top-level, offscreens 포함) 로 이동했다.
        // @naari3/pixi-live2d-display@1.2.5 은 구 경로를 읽어서 undefined → crash.
        // drawables 는 일반 JS 객체라 누락된 키를 그대로 얹어주면 동작한다.
        try {
          const core = (
            localModel.internalModel as unknown as {
              coreModel?: { _model?: { drawables?: { renderOrders?: Int32Array }; renderOrders?: Int32Array } };
            }
          ).coreModel?._model;
          if (core?.drawables && !core.drawables.renderOrders && core.renderOrders) {
            core.drawables.renderOrders = core.renderOrders;
          }
        } catch (e) {
          console.warn("[Live2DWrapper] core6 compat patch warning:", e);
        }

        // Pixi v8 용 naari3 포크는 setRenderer 를 내부에서 호출하지 않는다.
        try {
          (
            localModel as unknown as { setRenderer?: (r: unknown) => void }
          ).setRenderer?.(app.renderer);
        } catch (e) {
          console.warn("[Live2DWrapper] setRenderer warning:", e);
        }

        app.stage.addChild(localModel);

        // 히트 영역 → 액션 매핑 (profile 기반)
        localModel.on("hit", (hitAreas: string[]) => {
          const profile = useCharacterStore.getState().profile;
          if (!profile) return;

          let firedAction: CharacterActionKey = "tap_other";
          for (const mapping of profile.hitAreaMap) {
            if (hitAreas.includes(mapping.hitAreaId)) {
              firedAction = mapping.action;
              break;
            }
          }

          playAction(firedAction);
        });

        // scale / position
        const { width: SW, height: SH } = app.screen;
        const rawW = localModel.width || 1;
        const rawH = localModel.height || 1;
        const fit = Math.max(SW / rawW, SH / rawH) * 1.2;

        const storedConfig = useCharacterStore.getState().modelConfig;
        if (storedConfig) {
          localModel.scale.set(storedConfig.scale);
          localModel.x = storedConfig.x;
          localModel.y = storedConfig.y;
        } else {
          localModel.scale.set(fit);
          localModel.x = (SW - localModel.width) / 2;
          localModel.y = 20;

          setTimeout(() => {
            if (modelRef.current) {
              setModelConfig({
                scale: modelRef.current.scale.x,
                x: modelRef.current.x,
                y: modelRef.current.y,
              });
            }
          }, 0);
        }

        modelRef.current = localModel;
        originalFocusRef.current = localModel.focus.bind(localModel);

        setReady(true);
      } catch (err) {
        console.error("[Live2DWrapper] model load 실패:", err);
        setError(err instanceof Error ? err.message : String(err));
        setReady(false);
      } finally {
        setLoading(false);
      }
    };

    void swap();

    return () => {
      cancelled = true;
    };
  }, [modelPath, appReady, setLoading, setReady, setError, setModelConfig]);

  // --------------------------------------------------------------------
  // Effect 3 · 유휴 / 타이핑 핸들러
  // --------------------------------------------------------------------
  useEffect(() => {
    if (!appReady || !modelRef.current) return;

    let idleTimeout: NodeJS.Timeout;

    const resetIdleTimer = () => {
      clearTimeout(idleTimeout);
      idleTimeout = setTimeout(() => {
        playAction("idle");
      }, 10000);
    };

    const handleKeyDown = () => {
      resetIdleTimer();
      if (Math.random() > 0.8) {
        playAction("typing");
      }
    };

    const handlePointerMoveGlobal = () => resetIdleTimer();

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("pointermove", handlePointerMoveGlobal);
    resetIdleTimer();

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("pointermove", handlePointerMoveGlobal);
      clearTimeout(idleTimeout);
    };
  }, [appReady, modelPath]);

  // --------------------------------------------------------------------
  // Effect 4 · 감정 상태 → 표정 + 사운드 + 대사
  // --------------------------------------------------------------------
  const emotion = useCharacterStore((s) => s.emotion);
  const isTracking = useCharacterStore((s) => s.isTracking);

  useEffect(() => {
    if (!appReady || !modelRef.current) return;
    const profile = useCharacterStore.getState().profile;
    if (!profile) return;

    const targetExp = profile.expressionMap[emotion];
    if (targetExp) {
      try {
        modelRef.current.expression(targetExp);
      } catch (e) {
        console.warn("[Live2DWrapper] expression apply warning:", e);
      }
    }

    // 사운드
    const soundUrl = profile.sounds.emotions[emotion];
    if (soundUrl) void playSound(soundUrl);

    // 대사
    const lines = profile.dialogues.emotions[emotion];
    if (lines && lines.length > 0) {
      const line = lines[Math.floor(Math.random() * lines.length)];
      useCharacterStore.getState().setMessage(line);
      setTimeout(() => {
        if (useCharacterStore.getState().message === line) {
          useCharacterStore.getState().setMessage(null);
        }
      }, 3000);
    }
  }, [emotion, appReady]);

  // --------------------------------------------------------------------
  // Effect 5 · 파츠 opacity (옷/포즈 토글)
  // --------------------------------------------------------------------
  const partOpacities = useCharacterStore((s) => s.partOpacities);
  useEffect(() => {
    if (!appReady || !modelRef.current) return;
    const model = modelRef.current;
    try {
      const core = (
        model.internalModel as unknown as {
          coreModel?: {
            getPartIndex?: (id: string) => number;
            setPartOpacityByIndex?: (i: number, v: number) => void;
          };
        }
      ).coreModel;
      if (!core?.getPartIndex || !core.setPartOpacityByIndex) return;
      for (const [partId, opacity] of Object.entries(partOpacities)) {
        const idx = core.getPartIndex(partId);
        if (idx >= 0) core.setPartOpacityByIndex(idx, opacity);
      }
    } catch (e) {
      console.warn("[Live2DWrapper] part opacity warning:", e);
    }
  }, [partOpacities, appReady]);

  // --------------------------------------------------------------------
  // Effect 6 · 파라미터 라이브 모핑
  // Live2D 는 매 프레임 파라미터를 재설정하지 않으면 0 으로 리셋되므로
  // 매 tick 에서 값을 덮어써야 한다.
  // --------------------------------------------------------------------
  const morphValues = useCharacterStore((s) => s.morphValues);
  useEffect(() => {
    if (!appReady || !modelRef.current) return;
    const model = modelRef.current;
    const app = appRef.current;
    if (!app) return;

    const tick = () => {
      const values = useCharacterStore.getState().morphValues;
      const core = (
        model.internalModel as unknown as {
          coreModel?: {
            setParameterValueById?: (id: string, v: number) => void;
          };
        }
      ).coreModel;
      if (!core?.setParameterValueById) return;
      for (const [id, v] of Object.entries(values)) {
        try {
          core.setParameterValueById(id, v);
        } catch {
          /* ignore */
        }
      }
    };

    app.ticker.add(tick);
    return () => {
      app.ticker.remove(tick);
    };
    // morphValues 가 바뀔 때 재구독할 필요는 없음 (store 에서 직접 읽음).
    // 하지만 의존성 명시로 lint 억제.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appReady, modelPath]);

  // --------------------------------------------------------------------
  // Effect 7 · 트래킹 제어
  // --------------------------------------------------------------------
  useEffect(() => {
    if (!appReady || !modelRef.current || !originalFocusRef.current) return;

    const model = modelRef.current;
    const originalFocus = originalFocusRef.current;

    const lookForward = () => {
      const fc = (
        model.internalModel as unknown as {
          focusController?: { focus: (x: number, y: number, instant?: boolean) => void };
        }
      ).focusController;
      fc?.focus(0, 0, false);
    };

    model.focus = (x: number, y: number) => {
      const { isTracking } = useCharacterStore.getState();
      if (isTracking) originalFocus(x, y);
      else lookForward();
    };

    if (!isTracking) lookForward();

    return () => {
      if (modelRef.current) modelRef.current.focus = originalFocus;
    };
  }, [appReady, modelPath, isTracking]);

  // --------------------------------------------------------------------
  // 공통 헬퍼
  // --------------------------------------------------------------------
  function playAction(action: CharacterActionKey) {
    const model = modelRef.current;
    if (!model) return;
    const profile = useCharacterStore.getState().profile;
    if (!profile) return;

    const motion = profile.motionMap[action];
    if (motion) {
      try {
        model.motion(motion.group, motion.index);
      } catch (e) {
        console.warn("[Live2DWrapper] motion play warning:", e);
      }
    }

    const lines = profile.dialogues.actions[action];
    if (lines && lines.length > 0) {
      const line = lines[Math.floor(Math.random() * lines.length)];
      useCharacterStore.getState().setMessage(line);
      setTimeout(() => {
        if (useCharacterStore.getState().message === line) {
          useCharacterStore.getState().setMessage(null);
        }
      }, 3000);
    }

    const sound = profile.sounds.actions[action];
    if (sound) void playSound(sound);
  }

  // 드래그 앤 줌
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!modelRef.current) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragData.current = { isDragging: true, lastX: e.clientX, lastY: e.clientY };
  };
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragData.current.isDragging || !modelRef.current) return;
    const dx = e.clientX - dragData.current.lastX;
    const dy = e.clientY - dragData.current.lastY;
    modelRef.current.x += dx;
    modelRef.current.y += dy;
    dragData.current.lastX = e.clientX;
    dragData.current.lastY = e.clientY;
    setModelConfig({
      scale: modelRef.current.scale.x,
      x: modelRef.current.x,
      y: modelRef.current.y,
    });
  };
  const handlePointerUp = () => { dragData.current.isDragging = false; };
  const handlePointerCancel = () => { dragData.current.isDragging = false; };
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!modelRef.current) return;
    const scaleFactor = e.deltaY > 0 ? 0.95 : 1.05;
    modelRef.current.scale.x *= scaleFactor;
    modelRef.current.scale.y *= scaleFactor;
    setModelConfig({
      scale: modelRef.current.scale.x,
      x: modelRef.current.x,
      y: modelRef.current.y,
    });
  };

  void morphValues; // dependency marker

  return (
    <aside
      className="fixed bottom-6 right-6 z-50 select-none"
      aria-label="[Live2D 캐릭터 영역]"
    >
      <div className="mb-1 flex items-center justify-between text-[11px] tracking-wider text-gray-600 uppercase">
        <span>[Live2D 캐릭터 영역]</span>
        <span className="text-gray-400">
          {CANVAS_W} x {CANVAS_H}
        </span>
      </div>
      <div
        className="relative border-2 border-dashed border-gray-500 bg-gray-200/60 p-2 cursor-grab active:cursor-grabbing"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onWheel={handleWheel}
      >
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className="block bg-gray-100 touch-none"
          style={{ width: CANVAS_W, height: CANVAS_H }}
        />
        <Live2DStatusBadge />
        <SpeechBubble />
      </div>
    </aside>
  );
}

// ───────────────────────────── 오디오 ─────────────────────────────
// 중복 재생으로 채널이 끊기지 않도록 간단한 풀 구성.
const audioPool = new Map<string, HTMLAudioElement>();
async function playSound(url: string) {
  try {
    let a = audioPool.get(url);
    if (!a) {
      a = new Audio(url);
      a.preload = "auto";
      audioPool.set(url, a);
    }
    a.currentTime = 0;
    await a.play();
  } catch (e) {
    console.warn("[Live2DWrapper] playSound warning:", e);
  }
}

function Live2DStatusBadge() {
  const isLoading = useCharacterStore((s) => s.isLoading);
  const isReady = useCharacterStore((s) => s.isReady);
  const emotion = useCharacterStore((s) => s.emotion);
  const error = useCharacterStore((s) => s.error);
  const cfg = useCharacterStore((s) => s.modelConfig);
  const profile = useCharacterStore((s) => s.profile);

  const label = error
    ? `ERROR: ${error}`
    : isLoading
      ? "LOADING..."
      : isReady
        ? `READY · ${profile?.name ?? "?"} · emotion=${emotion}`
        : "IDLE (no model)";

  return (
    <div className="absolute left-2 top-2 pointer-events-none border border-dashed border-gray-500 bg-white/70 px-2 py-1 text-[10px] tracking-wider text-gray-700 uppercase flex flex-col gap-1 max-w-[calc(100%-1rem)]">
      <div className="truncate">{label}</div>
      {isReady && cfg && (
        <div className="text-blue-600 font-mono">
          scale: {cfg.scale.toFixed(2)} / x: {Math.round(cfg.x)}, y: {Math.round(cfg.y)}
        </div>
      )}
    </div>
  );
}

function SpeechBubble() {
  const message = useCharacterStore((s) => s.message);
  if (!message) return null;
  return (
    <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-white px-4 py-2 rounded-2xl shadow-lg border-2 border-pink-200 text-sm font-semibold text-gray-800 animate-bounce min-w-[120px] text-center pointer-events-none z-10 before:content-[''] before:absolute before:-bottom-2 before:left-1/2 before:-translate-x-1/2 before:w-4 before:h-4 before:bg-white before:rotate-45 before:border-b-2 before:border-r-2 before:border-pink-200">
      {message}
    </div>
  );
}
