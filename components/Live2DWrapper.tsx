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
  const [appReady, setAppReady] = useState(false);

  const modelPath = useCharacterStore((s) => s.modelPath);
  const setLoading = useCharacterStore((s) => s.setLoading);
  const setReady = useCharacterStore((s) => s.setReady);
  const setError = useCharacterStore((s) => s.setError);

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
          autoHitTest: false,
          autoFocus: false,
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

        // scale 은 app.screen 기준. Live2DModel 의 width/height 는
        // Container.getLocalBounds 경유라 addChild 후에야 유의미한 값이 된다.
        const { width: SW, height: SH } = app.screen;
        const rawW = localModel.width || 1;
        const rawH = localModel.height || 1;
        const fit = Math.min(SW / rawW, SH / rawH) * 0.95;
        localModel.scale.set(fit);
        localModel.x = (SW - localModel.width) / 2;
        localModel.y = SH - localModel.height;

        modelRef.current = localModel;
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
  }, [modelPath, appReady, setLoading, setReady, setError]);

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
      <div className="relative border-2 border-dashed border-gray-500 bg-gray-200/60 p-2">
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className="block bg-gray-100"
          style={{ width: CANVAS_W, height: CANVAS_H }}
        />
        <Live2DStatusBadge />
      </div>
    </aside>
  );
}

function Live2DStatusBadge() {
  const isLoading = useCharacterStore((s) => s.isLoading);
  const isReady = useCharacterStore((s) => s.isReady);
  const emotion = useCharacterStore((s) => s.emotion);
  const error = useCharacterStore((s) => s.error);

  const label = error
    ? `ERROR: ${error}`
    : isLoading
      ? "LOADING..."
      : isReady
        ? `READY · emotion=${emotion}`
        : "IDLE (no model)";

  return (
    <div className="absolute left-2 top-2 border border-dashed border-gray-500 bg-white/70 px-2 py-1 text-[10px] tracking-wider text-gray-700 uppercase">
      {label}
    </div>
  );
}
