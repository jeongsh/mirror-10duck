"use client";

import { useEffect, useRef, useState } from "react";
import { Application, Ticker } from "pixi.js";
import { Live2DModel } from "@naari3/pixi-live2d-display";
import { useCharacterStore } from "@/store/useCharacterStore";

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
        console.info("[Live2DWrapper] pixi application ready", {
          screen: { w: app.screen.width, h: app.screen.height },
        });
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
          // 사용자 요구사항 그대로 `{ children, texture, baseTexture }` 지정.
          // Pixi v8 에서 실제로 인식하는 `textureSource` 도 함께 전달 (타입은 cast).
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
            console.info("[Live2DWrapper] applied Core6 renderOrders compat patch");
          }
        } catch (e) {
          console.warn("[Live2DWrapper] core6 compat patch warning:", e);
        }
        // ───────────────────────────────────────────────────────────────────

        // Pixi v8 용 naari3 포크는 setRenderer 를 내부에서 호출하지 않는다.
        // 첫 프레임 전에 renderer 참조를 수동 주입해 두면 안정적으로 그려진다.
        try {
          (
            localModel as unknown as { setRenderer?: (r: unknown) => void }
          ).setRenderer?.(app.renderer);
        } catch (e) {
          console.warn("[Live2DWrapper] setRenderer warning:", e);
        }

        app.stage.addChild(localModel);

        // 클릭 상호작용 이벤트 (mao_pro 샘플 모델 기준 그룹화)
        localModel.on("hit", (hitAreas: string[]) => {
          if (hitAreas.includes("HitAreaHead")) { // mao_pro 는 HitAreaHead 를 사용
            localModel?.motion("", 0); // mtn_02
            useCharacterStore.getState().setMessage("헤헷!");
            setTimeout(() => useCharacterStore.getState().setMessage(null), 3000);
          } else if (hitAreas.includes("HitAreaBody")) { // mao_pro 는 HitAreaBody 를 사용
            localModel?.motion("", 1); // mtn_03
            useCharacterStore.getState().setMessage("아앗, 거긴 안돼요!");
            setTimeout(() => useCharacterStore.getState().setMessage(null), 3000);
          } else {
            localModel?.motion("", 2); // mtn_04
            useCharacterStore.getState().setMessage("응?");
            setTimeout(() => useCharacterStore.getState().setMessage(null), 3000);
          }
        });

        // scale 은 app.screen 기준. Live2DModel 의 width/height 는
        // Container.getLocalBounds 경유라 addChild 후에야 유의미한 값이 된다.
        const { width: SW, height: SH } = app.screen;
        const rawW = localModel.width || 1;
        const rawH = localModel.height || 1;
        // 상반신 위주 스케일 기본값
        const fit = Math.max(SW / rawW, SH / rawH) * 1.2;
        
        // zustand에 저장된 모델의 뷰 설정이 있다면 우선 반영 (C2C 마켓플레이스 예비 기능)
        const storedConfig = useCharacterStore.getState().modelConfig;
        if (storedConfig) {
          localModel.scale.set(storedConfig.scale);
          localModel.x = storedConfig.x;
          localModel.y = storedConfig.y;
        } else {
          localModel.scale.set(fit);
          localModel.x = (SW - localModel.width) / 2;
          localModel.y = 20;
          
          // 기본 렌더링된 값을 store에 기록
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
        // 원래의 focus 함수를 백업해둡니다 (한 번만)
        originalFocusRef.current = localModel.focus.bind(localModel);
        
        setReady(true);

        console.info("[Live2DWrapper] model ready", {
          path: modelPath,
          screen: { SW, SH },
          raw: { w: rawW, h: rawH },
          fit,
          pos: { x: localModel.x, y: localModel.y },
          scaled: { w: localModel.width, h: localModel.height },
        });
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
  // Effect 3 · 전역 이벤트 (타이핑, 유휴 상태 등 기본 애니메이션)
  // --------------------------------------------------------------------
  useEffect(() => {
    if (!appReady || !modelRef.current) return;
    
    let idleTimeout: NodeJS.Timeout;
    
    const resetIdleTimer = () => {
      clearTimeout(idleTimeout);
      idleTimeout = setTimeout(() => {
        // 10초간 입력이 없으면 유휴 상태 모션
        if (modelRef.current) {
          modelRef.current.motion("Idle", 0);
        }
      }, 10000);
    };

    const handleKeyDown = () => {
      resetIdleTimer();
      // 아주 짧은 딜레이로 모션 연속 실행 방지 (간단하게 구현)
      if (modelRef.current && Math.random() > 0.8) { 
        // 확률적으로 타이핑 반응 (mao_pro 기준 exp_07, mtn_04)
        modelRef.current.expression("exp_07");
        modelRef.current.motion("", 2);
      }
    };

    const handlePointerMoveGlobal = () => {
      resetIdleTimer();
    };

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
  // Effect 4 · 감정(emotion) 상태 변경 시 표정(expression) 적용
  // --------------------------------------------------------------------
  const emotion = useCharacterStore((s) => s.emotion);
  const isTracking = useCharacterStore((s) => s.isTracking);
  
  useEffect(() => {
    if (!appReady || !modelRef.current) return;
    
    // mao_pro 모델의 exp_01 ~ exp_08 에 맞춰 임의 맵핑
    const emotionMap: Record<string, string> = {
      idle: "exp_01",
      happy: "exp_02",
      sad: "exp_03",
      angry: "exp_04",
      surprised: "exp_05",
      shy: "exp_06",
    };
    
    const targetExp = emotionMap[emotion];
    if (targetExp) {
      modelRef.current.expression(targetExp);
    }
  }, [emotion, appReady]);

  // --------------------------------------------------------------------
  // Effect 5 · 트래킹 상태 제어 (focus 함수 인터셉트)
  // --------------------------------------------------------------------
  useEffect(() => {
    if (!appReady || !modelRef.current || !originalFocusRef.current) return;
    
    const model = modelRef.current;
    const originalFocus = originalFocusRef.current;

    // 정면 응시는 model.focus()로는 표현 불가.
    // model.focus(x, y)는 내부적으로 atan2 로 각도만 계산해서 단위원 위 좌표로
    // focusController.focus(cos, -sin) 를 호출하기 때문에, 어떤 입력을 줘도
    // 결과가 단위원 위(±1 부근)로 강제되어 "정면(0, 0)"이 표현되지 않는다.
    // 따라서 OFF 상태에서는 focusController 를 직접 (0, 0) 으로 세팅한다.
    const lookForward = () => {
      const fc = (
        model.internalModel as unknown as {
          focusController?: { focus: (x: number, y: number, instant?: boolean) => void };
        }
      ).focusController;
      // instant=false 로 부드럽게 전이
      fc?.focus(0, 0, false);
    };
    
    // focus 함수를 오버라이드하여 isTracking 상태에 따라 동작 결정
    model.focus = (x: number, y: number) => {
      const { isTracking } = useCharacterStore.getState();
      if (isTracking) {
        originalFocus(x, y);
      } else {
        // OFF일 때는 어떤 좌표가 들어와도 무시하고 정면 응시
        lookForward();
      }
    };
    
    // 상태가 바뀔 때(특히 OFF로 바뀔 때) 즉시 정면을 바라보도록 강제 업데이트
    if (!isTracking) {
      lookForward();
    }

    return () => {
      // 컴포넌트 언마운트나 모델 교체 시 복구 (불필요할 수 있으나 안전을 위해)
      if (modelRef.current) {
        modelRef.current.focus = originalFocus;
      }
    };
  }, [appReady, modelPath, isTracking]);

  // 드래그 앤 줌 핸들러 (C2C 환경의 크리에이터 스튜디오 모델 포지셔닝 기능 시뮬레이터겸)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!modelRef.current) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragData.current = {
      isDragging: true,
      lastX: e.clientX,
      lastY: e.clientY,
    };
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
    // prevent default 비활성화로 페이지 스크롤이 될 수 있지만 MVP 영역이라 그대로 둠
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

function Live2DStatusBadge() {
  const isLoading = useCharacterStore((s) => s.isLoading);
  const isReady = useCharacterStore((s) => s.isReady);
  const emotion = useCharacterStore((s) => s.emotion);
  const error = useCharacterStore((s) => s.error);
  const cfg = useCharacterStore((s) => s.modelConfig);

  const label = error
    ? `ERROR: ${error}`
    : isLoading
      ? "LOADING..."
      : isReady
        ? `READY · emotion=${emotion}`
        : "IDLE (no model)";

  return (
    <div className="absolute left-2 top-2 pointer-events-none border border-dashed border-gray-500 bg-white/70 px-2 py-1 text-[10px] tracking-wider text-gray-700 uppercase flex flex-col gap-1">
      <div>{label}</div>
      {isReady && cfg && (
        <div className="text-blue-600 font-mono">
          [Store] scale: {cfg.scale.toFixed(2)} / x: {Math.round(cfg.x)}, y: {Math.round(cfg.y)}
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
