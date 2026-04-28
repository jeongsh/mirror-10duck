"use client";

import { useEffect, useRef, useState } from "react";
import { Application, Ticker } from "pixi.js";
import { Live2DModel, MotionPriority } from "@naari3/pixi-live2d-display";
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

interface MotionFileMeta {
  durationMs: number;
  loop: boolean;
}

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
  const neutralParametersRef = useRef<number[] | null>(null);
  const emotionApplySeqRef = useRef(0);
  const pendingIdleReturnRef = useRef(false);
  const actionIdleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const actionIdleTimeoutSeqRef = useRef(0);
  const motionMetaCacheRef = useRef<Map<string, MotionFileMeta>>(new Map());
  const modelMotionsRef = useRef<{ modelPath: string | null; motions: Record<string, { File?: string }[]> }>({
    modelPath: null,
    motions: {},
  });
  const [appReady, setAppReady] = useState(false);

  const modelPath = useCharacterStore((s) => s.modelPath);
  const setLoading = useCharacterStore((s) => s.setLoading);
  const setReady = useCharacterStore((s) => s.setReady);
  const setError = useCharacterStore((s) => s.setError);
  const setModelConfig = useCharacterStore((s) => s.setModelConfig);

  const dragData = useRef({ isDragging: false, lastX: 0, lastY: 0 });

  const getMotionMeta = async (
    currentModelPath: string,
    group: string,
    index: number
  ): Promise<MotionFileMeta | null> => {
    const cacheKey = `${currentModelPath}::${group}::${index}`;
    const cached = motionMetaCacheRef.current.get(cacheKey);
    if (cached) return cached;

    try {
      if (modelMotionsRef.current.modelPath !== currentModelPath) {
        const settingsRes = await fetch(currentModelPath);
        if (!settingsRes.ok) return null;
        const settingsJson = (await settingsRes.json()) as {
          FileReferences?: {
            Motions?: Record<string, { File?: string }[]>;
          };
        };
        modelMotionsRef.current = {
          modelPath: currentModelPath,
          motions: settingsJson.FileReferences?.Motions ?? {},
        };
      }

      const groupDefs = modelMotionsRef.current.motions[group];
      const motionFile = groupDefs?.[index]?.File;
      if (!motionFile) return null;

      const baseUrl = new URL(currentModelPath, window.location.origin);
      const motionUrl = new URL(motionFile, baseUrl).toString();
      const motionRes = await fetch(motionUrl);
      if (!motionRes.ok) return null;

      const motionJson = (await motionRes.json()) as {
        Meta?: {
          Duration?: number;
          Loop?: boolean;
        };
      };
      const durationSec = motionJson.Meta?.Duration;
      const loop = motionJson.Meta?.Loop === true;
      if (typeof durationSec !== "number" || !Number.isFinite(durationSec)) return null;

      const meta: MotionFileMeta = {
        durationMs: Math.max(0, Math.round(durationSec * 1000)),
        loop,
      };
      motionMetaCacheRef.current.set(cacheKey, meta);
      return meta;
    } catch (e) {
      console.warn("[Live2DWrapper] getMotionMeta warning:", e);
      return null;
    }
  };

  const captureNeutralParameters = (model: Live2DModel) => {
    try {
      const core = (
        model.internalModel as unknown as {
          coreModel?: {
            getParameterCount?: () => number;
            getParameterValueByIndex?: (index: number) => number;
          };
        }
      ).coreModel;
      if (!core?.getParameterCount || !core.getParameterValueByIndex) {
        neutralParametersRef.current = null;
        return;
      }

      const count = core.getParameterCount();
      const snapshot: number[] = [];
      for (let i = 0; i < count; i++) {
        snapshot.push(core.getParameterValueByIndex(i));
      }
      neutralParametersRef.current = snapshot;
    } catch (e) {
      neutralParametersRef.current = null;
      console.warn("[Live2DWrapper] neutral parameter capture warning:", e);
    }
  };

  const restoreNeutralParameters = (model: Live2DModel) => {
    const snapshot = neutralParametersRef.current;
    if (!snapshot) return;

    try {
      const core = (
        model.internalModel as unknown as {
          coreModel?: {
            getParameterCount?: () => number;
            setParameterValueByIndex?: (index: number, value: number, weight?: number) => void;
          };
        }
      ).coreModel;
      if (!core?.getParameterCount || !core.setParameterValueByIndex) return;

      const count = Math.min(core.getParameterCount(), snapshot.length);
      for (let i = 0; i < count; i++) {
        core.setParameterValueByIndex(i, snapshot[i], 1);
      }
    } catch (e) {
      console.warn("[Live2DWrapper] neutral parameter restore warning:", e);
    }
  };

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
        captureNeutralParameters(localModel);

        setReady(true);
      } catch (err) {
        console.error(
          "[Live2DWrapper] model load 실패:",
          err instanceof Error ? err : String(err),
          err instanceof Error ? err.stack : undefined
        );
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
  //
  // `isReady` 를 의존성에 포함해야 하는 이유:
  //   Effect 2 가 모델을 비동기로 로드한다. modelPath 만 dep 로 쓰면, 이 effect 가
  //   실행되는 시점에는 아직 `modelRef.current` 가 null 이라 리스너가 모델과
  //   연결되지 않는다. Effect 2 가 모델 로드 성공 시 `setReady(true)` 를 호출하는
  //   것을 트리거로 삼아 재실행한다. (Effect 5/6/7 도 동일)
  // --------------------------------------------------------------------
  const isReady = useCharacterStore((s) => s.isReady);
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
  }, [appReady, modelPath, isReady]);

  // --------------------------------------------------------------------
  // Effect 4 · 감정 상태 → 표정 + 사운드 + 대사
  // --------------------------------------------------------------------
  const emotion = useCharacterStore((s) => s.emotion);
  const isTracking = useCharacterStore((s) => s.isTracking);

  useEffect(() => {
    if (!appReady || !modelRef.current) return;
    const profile = useCharacterStore.getState().profile;
    if (!profile) return;
    const model = modelRef.current;
    let cancelled = false;

    // 핵심 포인트:
    // 1) Cubism 은 표현식 큐를 비워도 직전 프레임에 이미 반영된 파라미터 값은 자동으로
    //    중립 상태로 되돌리지 않는다. 그래서 "합쳐진 얼굴" 이 계속 남을 수 있다.
    // 2) expression() 은 내부적으로 비동기 로드/적용을 하므로, happy -> sad 를 빠르게
    //    누르면 늦게 끝난 이전 요청이 최신 표정을 덮어쓰는 경쟁 상태가 생길 수 있다.
    const applyEmotionExpression = async (
      targetEmotion: typeof emotion,
      seq: number
    ): Promise<void> => {
      if (cancelled || modelRef.current !== model) return;

      const activeProfile = useCharacterStore.getState().profile;
      if (activeProfile?.id !== profile.id) return;

      const expManager = (
        model.internalModel as unknown as {
          motionManager?: {
            expressionManager?: {
              stopAllExpressions?: () => void;
            };
          };
        }
      ).motionManager?.expressionManager;

      try {
        expManager?.stopAllExpressions?.();
      } catch (e) {
        console.warn("[Live2DWrapper] expression clear warning:", e);
      }

      restoreNeutralParameters(model);

      const targetExp = profile.expressionMap[targetEmotion];
      if (!targetExp) return;

      try {
        await model.expression(targetExp);
      } catch (e) {
        console.warn("[Live2DWrapper] expression apply warning:", e);
        return;
      }

      if (cancelled || modelRef.current !== model) return;
      if (seq !== emotionApplySeqRef.current) {
        const latestEmotion = useCharacterStore.getState().emotion;
        const latestSeq = ++emotionApplySeqRef.current;
        void applyEmotionExpression(latestEmotion, latestSeq);
      }
    };

    const seq = ++emotionApplySeqRef.current;
    void applyEmotionExpression(emotion, seq);

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
    return () => {
      cancelled = true;
    };
  }, [emotion, appReady, isReady, modelPath]);

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
  }, [partOpacities, appReady, isReady, modelPath]);

  // --------------------------------------------------------------------
  // Effect 6 · 파라미터 라이브 모핑
  // Live2D 는 매 프레임 파라미터를 재설정하지 않으면 0 으로 리셋되므로
  // 매 tick 에서 값을 덮어써야 한다.
  //
  // 주의: store 의 morphValues 를 구독하지 않는다.
  //   - 매 프레임 getState 로 최신 값을 직접 읽기 때문에 구독은 불필요하고,
  //     구독을 걸면 값이 바뀔 때마다 컴포넌트 전체가 리렌더되어 오히려 손해다.
  // --------------------------------------------------------------------
  useEffect(() => {
    if (!appReady || !modelRef.current) return;
    const model = modelRef.current;
    const app = appRef.current;
    if (!app) return;

    // 모델 로드 시점에 한 번만 coreModel 을 해석한다 (매 프레임 internalModel 재캐스팅 회피).
    const core = (
      model.internalModel as unknown as {
        coreModel?: {
          setParameterValueById?: (id: string, v: number) => void;
        };
      }
    ).coreModel;
    const setParam = core?.setParameterValueById?.bind(core);
    if (!setParam) return;

    const tick = () => {
      const values = useCharacterStore.getState().morphValues;
      // try/catch 를 루프 밖으로 빼서 호출 오버헤드를 줄인다.
      // 잘못된 파라미터 ID 로 throw 가 나도 다음 프레임에 다시 시도되므로 무방.
      try {
        for (const id in values) {
          setParam(id, values[id]);
        }
      } catch {
        /* ignore */
      }
    };

    app.ticker.add(tick);
    return () => {
      // StrictMode/언마운트 경합으로 app 이 이미 destroy 된 경우 ticker 가 null 일 수 있다.
      const ticker = app?.ticker as { remove?: (fn: () => void) => void } | null | undefined;
      ticker?.remove?.(tick);
    };
  }, [appReady, modelPath, isReady]);

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
  }, [appReady, modelPath, isTracking, isReady]);

  // --------------------------------------------------------------------
  // Effect 8 · 모델 swap / 언마운트 시 idle 복귀 fallback 타이머 정리
  //
  // 과거에는 매 프레임 motionManager.playing 을 폴링해서 모션 종료를 감지했지만,
  // 현재 사용 중인 액션 모션이 모두 Loop=true 라 playing 플래그가 false 로
  // 떨어지지 않았다. 결국 폴러는 한 번도 트리거되지 않으면서 60fps 콜백 비용만
  // 지불하는 dead code 였기에 제거했다.
  //
  // 비루프 모션도 fallback 타이머가 `durationMs + 120ms` 로 동일하게 처리한다.
  // (모션 메타는 playAction 에서 motion3.json 을 읽어 캐시한다.)
  // --------------------------------------------------------------------
  useEffect(() => {
    return () => {
      pendingIdleReturnRef.current = false;
      if (actionIdleTimeoutRef.current) {
        clearTimeout(actionIdleTimeoutRef.current);
        actionIdleTimeoutRef.current = null;
      }
      actionIdleTimeoutSeqRef.current += 1;
    };
  }, [appReady, modelPath, isReady]);

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
        void model.motion(motion.group, motion.index, MotionPriority.FORCE);

        if (action !== "idle") {
          // 액션 모션이 끝나면 idle 로 복귀해야 한다는 플래그.
          // 라이브러리의 motionFinish 이벤트는 Loop=true 모션에서 절대 발화하지
          // 않으므로, 모션 길이를 미리 읽어 setTimeout 으로 강제 복귀시킨다.
          pendingIdleReturnRef.current = true;

          const scheduleSeq = ++actionIdleTimeoutSeqRef.current;
          const scheduleFallback = (delayMs: number) => {
            if (scheduleSeq !== actionIdleTimeoutSeqRef.current) return;
            if (actionIdleTimeoutRef.current) {
              clearTimeout(actionIdleTimeoutRef.current);
            }
            actionIdleTimeoutRef.current = setTimeout(() => {
              if (modelRef.current !== model) return;
              const latestProfile = useCharacterStore.getState().profile;
              const idleMotion = latestProfile?.motionMap.idle;
              pendingIdleReturnRef.current = false;
              if (!idleMotion) return;
              try {
                void model.motion(idleMotion.group, idleMotion.index, MotionPriority.FORCE);
              } catch (e) {
                console.warn("[Live2DWrapper] fallback idle restore warning:", e);
              }
            }, delayMs);
          };

          // 메타 로드 실패해도 기본값(1200ms)으로 즉시 스케줄.
          scheduleFallback(1200);

          if (modelPath) {
            void getMotionMeta(modelPath, motion.group, motion.index).then((meta) => {
              if (!meta || scheduleSeq !== actionIdleTimeoutSeqRef.current) return;
              // 비루프: 자연스러운 종료 직후 (+120ms 마진) idle 로 전환.
              // 루프: 길이의 ~45% 지점에서 끊되 0.9~1.8초 범위로 클램프해
              //       너무 짧게 끊기거나 너무 오래 머무는 걸 방지.
              const calculatedDelay = meta.loop
                ? Math.min(Math.max(Math.round(meta.durationMs * 0.45), 900), 1800)
                : Math.max(600, meta.durationMs + 120);
              scheduleFallback(calculatedDelay);
            });
          }
        } else {
          pendingIdleReturnRef.current = false;
          if (actionIdleTimeoutRef.current) {
            clearTimeout(actionIdleTimeoutRef.current);
            actionIdleTimeoutRef.current = null;
          }
          actionIdleTimeoutSeqRef.current += 1;
        }
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

  return (
    <aside
      className="fixed bottom-0 right-0 z-50 select-none"
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
