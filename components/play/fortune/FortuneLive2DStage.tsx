"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Live2DModel } from "@naari3/pixi-live2d-display";
import { MAO_PRO_PROFILE } from "@/lib/live2d/defaultProfile";
import {
  FORTUNE_STAGE_BG,
  FORTUNE_STAGE_BG_HEX,
  type FortuneMotionTrigger,
} from "@/lib/fortune/fortuneLive2DStage";

/**
 * 마오 뒤 흰 배경 제거 전략:
 *  - Pixi 캔버스는 투명(backgroundAlpha:0)으로 두고, 캔버스/컨테이너 CSS 배경을 STAGE_BG 로.
 *  - 페이지 전체 배경도 같은 STAGE_BG 로 맞춰 캔버스 경계가 보이지 않게 한다.
 *  (이 포크에서 backgroundAlpha:1 은 흰색으로 칠해지는 버그가 있어 투명 + CSS 로 처리)
 */
const DEFAULT_STAGE_W = 480;
const DEFAULT_STAGE_H = 540;

type MaoView = { scale: number; x: number; y: number };
type MaoStage = { w: number; h: number };

const MAO_STAGE_STORAGE_KEY = "fortune-mao-stage";

function loadStoredMaoStage(): MaoStage | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(MAO_STAGE_STORAGE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<MaoStage>;
    if (typeof v.w === "number" && typeof v.h === "number") return { w: v.w, h: v.h };
  } catch {
    /* ignore */
  }
  return null;
}

function saveStoredMaoStage(v: MaoStage): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MAO_STAGE_STORAGE_KEY, JSON.stringify(v));
  } catch {
    /* ignore */
  }
}

/**
 * 마오 위치/크기 고정값. null 이면 contain-fit 자동 계산을 쓴다.
 * 조절 패널에서 나온 숫자를 여기에 박으면 다음부터 그 좌표로 고정된다.
 */
const MAO_VIEW: MaoView | null = { scale: 0.1053, x: -51, y: 13 };

const MAO_VIEW_STORAGE_KEY = "fortune-mao-view";

function loadStoredMaoView(): MaoView | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(MAO_VIEW_STORAGE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<MaoView>;
    if (typeof v.scale === "number" && typeof v.x === "number" && typeof v.y === "number") {
      return { scale: v.scale, x: v.x, y: v.y };
    }
  } catch {
    /* ignore */
  }
  return null;
}

function saveStoredMaoView(v: MaoView): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MAO_VIEW_STORAGE_KEY, JSON.stringify(v));
  } catch {
    /* ignore */
  }
}

/**
 * 모션 길이(Meta.Duration)를 motion3.json 에서 읽어온다.
 * default#3/#4(special) 처럼 긴 모션이 끝나기 전에 idle 로 끊기지 않도록 사용.
 */
let model3Cache: Promise<Record<string, unknown>> | null = null;
const motionDurationCache = new Map<string, number>();

function patchPixiCancelResize(app: import("pixi.js").Application): void {
  const target = app as unknown as { _cancelResize?: unknown };
  if (typeof target._cancelResize !== "function") {
    target._cancelResize = () => {};
  }
}

async function getMotionDurationMs(group: string, index: number): Promise<number | null> {
  try {
    const base = MAO_PRO_PROFILE.modelPath.replace(/[^/]+$/, "");
    if (!model3Cache) {
      model3Cache = fetch(MAO_PRO_PROFILE.modelPath).then((r) => r.json());
    }
    const m3 = (await model3Cache) as {
      FileReferences?: { Motions?: Record<string, { File?: string }[]> };
    };
    const entry = m3?.FileReferences?.Motions?.[group]?.[index];
    if (!entry?.File) return null;
    const key = `${group}#${index}`;
    if (motionDurationCache.has(key)) return motionDurationCache.get(key)!;
    const mo = (await fetch(base + entry.File).then((r) => r.json())) as {
      Meta?: { Duration?: number };
    };
    const dur = mo?.Meta?.Duration;
    if (typeof dur !== "number" || dur <= 0) return null;
    const ms = dur * 1000;
    motionDurationCache.set(key, ms);
    return ms;
  } catch {
    return null;
  }
}

export interface FortuneLive2DStageProps {
  /** 적용 후 유지할 표정 ID (예: "exp_01"). */
  expressionId?: string;
  /** nonce 가 바뀌면 해당 (group,index) 모션을 1회 강제 재생. */
  motionTrigger?: FortuneMotionTrigger | null;
  /** 켜지면 가끔 default#0 / default#2 모션을 섞어 자연스러운 idle 연출. */
  ambient?: boolean;
  /** 말하는 중이면 입(ParamA)을 움직여 발화처럼 보이게 한다. */
  talking?: boolean;
  /** 마우스 위치로 시선 트래킹. */
  tracking?: boolean;
  /** 켜지면 드래그(이동)+휠(확대)로 마오 크기/위치를 직접 조절하고 좌표를 표시한다. */
  adjustable?: boolean;
  className?: string;
}

export default function FortuneLive2DStage({
  expressionId = "exp_01",
  motionTrigger = null,
  ambient = true,
  talking = false,
  tracking = true,
  adjustable = false,
  className = "",
}: FortuneLive2DStageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modelRef = useRef<Live2DModel | null>(null);
  const appRef = useRef<import("pixi.js").Application | null>(null);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // 조절 패널 상태
  const adjustableRef = useRef(adjustable);
  adjustableRef.current = adjustable;
  const viewRef = useRef<MaoView | null>(null);
  const draggingRef = useRef(false);
  const dragLastRef = useRef({ x: 0, y: 0 });
  const [viewReadout, setViewReadout] = useState<MaoView | null>(null);

  // 캔버스 크기 (조절 가능)
  const [stage, setStage] = useState<MaoStage>({ w: DEFAULT_STAGE_W, h: DEFAULT_STAGE_H });
  const stageRef = useRef(stage);
  stageRef.current = stage;

  const applyView = useCallback((view: MaoView, persist = false) => {
    const model = modelRef.current;
    if (!model) return;
    model.scale.set(view.scale);
    model.x = view.x;
    model.y = view.y;
    viewRef.current = view;
    setViewReadout(view);
    if (persist) saveStoredMaoView(view);
  }, []);

  const talkingRef = useRef(talking);
  talkingRef.current = talking;
  const trackingRef = useRef(tracking);
  trackingRef.current = tracking;
  const ambientRef = useRef(ambient);
  ambientRef.current = ambient;
  const forcedMotionUntilRef = useRef(0);
  const idleReturnTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const motionTokenRef = useRef(0);

  const playMotion = useCallback((group: string, index: number, priority = 3) => {
    const model = modelRef.current;
    if (!model) return;
    try {
      void model.motion(group, index, priority);
    } catch {
      /* ignore */
    }
  }, []);

  /**
   * 이 모델의 "" 그룹 모션(default#0~5)은 대부분 루프라, 한 번 보여준 뒤
   * 모션 길이만큼 기다렸다가 강제로 Idle 로 되돌려야 "한 번만 재생 후 idle" 이 된다.
   * 길이는 motion3.json 의 Meta.Duration 에서 읽어 끝나기 전에 끊기지 않게 한다.
   */
  const playOnceThenIdle = useCallback(
    (group: string, index: number) => {
      if (idleReturnTimeoutRef.current) {
        clearTimeout(idleReturnTimeoutRef.current);
        idleReturnTimeoutRef.current = null;
      }
      const token = ++motionTokenRef.current;
      playMotion(group, index, 3);
      void getMotionDurationMs(group, index).then((ms) => {
        if (token !== motionTokenRef.current) return;
        const hold = (ms ?? 2400) + 300;
        forcedMotionUntilRef.current = performance.now() + hold;
        idleReturnTimeoutRef.current = setTimeout(() => {
          if (token !== motionTokenRef.current) return;
          playMotion("Idle", 0, 3);
        }, hold);
      });
    },
    [playMotion],
  );

  useEffect(() => {
    let cancelled = false;
    let app: import("pixi.js").Application | null = null;
    const previousApp = window.app;
    let lipTick: (() => void) | null = null;

    const waitForCore = async () => {
      for (let i = 0; i < 160; i++) {
        if (window.Live2DCubismCore) return;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      throw new Error("Live2D 코어를 불러오지 못했습니다.");
    };

    const boot = async () => {
      if (!canvasRef.current) return;
      try {
        await waitForCore();
        if (cancelled) return;

        const [{ Application, Ticker }, { Live2DModel: Live2DModelClass }] = await Promise.all([
          import("pixi.js"),
          import("@naari3/pixi-live2d-display"),
        ]);
        if (cancelled) return;

        // 저장된 캔버스 크기 적용
        const initStage = (adjustableRef.current ? loadStoredMaoStage() : null) ?? {
          w: DEFAULT_STAGE_W,
          h: DEFAULT_STAGE_H,
        };
        stageRef.current = initStage;
        setStage(initStage);

        app = new Application();
        await app.init({
          canvas: canvasRef.current,
          preference: "webgl",
          antialias: true,
          // Some pixi-live2d/Pixi combinations ignore canvas CSS and clear to white.
          // Set the renderer clear color directly so the WebGL backing store is never white.
          background: FORTUNE_STAGE_BG_HEX,
          backgroundColor: FORTUNE_STAGE_BG_HEX,
          backgroundAlpha: 1,
          resolution: 1,
          autoDensity: false,
          width: initStage.w,
          height: initStage.h,
        } as unknown as Parameters<InstanceType<typeof Application>["init"]>[0]);
        if (cancelled) return;

        try {
          const renderer = app.renderer as unknown as {
            background?: { color?: number; alpha?: number };
            clear?: (options?: { color?: number; alpha?: number }) => void;
          };
          if (renderer.background) {
            renderer.background.color = FORTUNE_STAGE_BG_HEX;
            renderer.background.alpha = 1;
          }
          renderer.clear?.({ color: FORTUNE_STAGE_BG_HEX, alpha: 1 });
        } catch {
          /* ignore */
        }

        Live2DModelClass.registerTicker(Ticker);
        window.app = app;
        appRef.current = app;

        const model = await Live2DModelClass.from(MAO_PRO_PROFILE.modelPath, {
          autoHitTest: false,
          autoFocus: false,
        });
        if (cancelled) {
          model.destroy({ children: true });
          return;
        }

        try {
          const core = (
            model.internalModel as unknown as {
              coreModel?: { _model?: { drawables?: { renderOrders?: Int32Array }; renderOrders?: Int32Array } };
            }
          ).coreModel?._model;
          if (core?.drawables && !core.drawables.renderOrders && core.renderOrders) {
            core.drawables.renderOrders = core.renderOrders;
          }
        } catch {
          /* ignore */
        }

        try {
          (model as unknown as { setRenderer?: (renderer: unknown) => void }).setRenderer?.(app.renderer);
        } catch {
          /* ignore */
        }

        app.stage.addChild(model);
        modelRef.current = model;

        // 위치/크기: 저장된 조절값 → 박힌 고정값(MAO_VIEW) → contain-fit 자동
        const storedView = adjustableRef.current ? loadStoredMaoView() : null;
        if (storedView ?? MAO_VIEW) {
          applyView((storedView ?? MAO_VIEW)!);
        } else {
          model.scale.set(1);
          const rawW = model.width || 1;
          const rawH = model.height || 1;
          const sw = stageRef.current.w;
          const sh = stageRef.current.h;
          const contain = Math.min(sw / rawW, sh / rawH);
          const scale = contain * 1.04;
          model.scale.set(scale);
          applyView({ scale, x: (sw - model.width) / 2, y: sh * 0.02 });
        }

        // 립싱크: talking 일 때 ParamA(모델의 LipSync 파라미터)를 움직인다.
        const lipCore = (
          model.internalModel as unknown as {
            coreModel?: { setParameterValueById?: (id: string, v: number) => void };
          }
        ).coreModel;
        const setParam = lipCore?.setParameterValueById?.bind(lipCore);
        if (setParam) {
          lipTick = () => {
            if (!talkingRef.current) return;
            const t = performance.now();
            const base = Math.sin(t / 65) * 0.5 + 0.5;
            const flutter = Math.sin(t / 21) * 0.22;
            const open = Math.max(0.12, Math.min(1, base * 0.9 + flutter));
            try {
              setParam("ParamA", open);
              setParam("ParamMouthOpenY", open);
            } catch {
              /* ignore */
            }
          };
          app.ticker?.add(lipTick);
        }

        setReady(true);
        setLoadError(null);
      } catch (err) {
        console.error("[FortuneLive2DStage] load failed:", err);
        if (!cancelled) setLoadError(err instanceof Error ? err.message : String(err));
      }
    };

    void boot();

    return () => {
      cancelled = true;
      setReady(false);
      if (idleReturnTimeoutRef.current) {
        clearTimeout(idleReturnTimeoutRef.current);
        idleReturnTimeoutRef.current = null;
      }
      if (lipTick && appRef.current?.ticker) {
        try {
          appRef.current.ticker.remove(lipTick);
        } catch {
          /* ignore */
        }
      }
      if (modelRef.current) {
        try {
          modelRef.current.destroy({ children: true });
        } catch {
          /* ignore */
        }
        modelRef.current = null;
      }
      const targetApp = appRef.current ?? app;
      if (targetApp) {
        try {
          patchPixiCancelResize(targetApp);
          targetApp.destroy(false);
        } catch {
          /* ignore */
        }
      }
      appRef.current = null;
      if (window.app === targetApp) window.app = previousApp;
    };
  }, []);

  // 표정 적용 (유지)
  useEffect(() => {
    const model = modelRef.current;
    if (!model || !ready || !expressionId) return;
    try {
      void model.expression(expressionId);
    } catch {
      /* ignore */
    }
  }, [expressionId, ready]);

  // 모션 트리거. group "Idle" 이면 base idle 로 유지, 그 외는 1회 재생 후 idle 복귀.
  useEffect(() => {
    if (!ready || !motionTrigger) return;
    if (motionTrigger.group === "Idle") {
      motionTokenRef.current += 1; // 진행 중인 idle 복귀 타이머 무효화
      if (idleReturnTimeoutRef.current) {
        clearTimeout(idleReturnTimeoutRef.current);
        idleReturnTimeoutRef.current = null;
      }
      forcedMotionUntilRef.current = 0;
      playMotion("Idle", 0, 3);
    } else {
      playOnceThenIdle(motionTrigger.group, motionTrigger.index);
    }
  }, [motionTrigger, ready, playMotion, playOnceThenIdle]);

  // ambient: 가끔 default#0 / default#2 를 1회 보여주고 다시 idle.
  useEffect(() => {
    if (!ready) return;
    const id = setInterval(() => {
      if (!ambientRef.current) return;
      if (performance.now() < forcedMotionUntilRef.current) return;
      const pick = Math.random() < 0.5 ? 0 : 2;
      playOnceThenIdle("", pick);
    }, 7000);
    return () => clearInterval(id);
  }, [ready, playOnceThenIdle]);

  // 마우스 시선 트래킹
  useEffect(() => {
    if (!ready) return;
    const onMove = (e: PointerEvent) => {
      const model = modelRef.current;
      const canvas = canvasRef.current;
      if (!model || !canvas || !trackingRef.current || draggingRef.current) return;
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const x = ((e.clientX - rect.left) / rect.width) * stageRef.current.w;
      const y = ((e.clientY - rect.top) / rect.height) * stageRef.current.h;
      try {
        model.focus(x, y);
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [ready]);

  // 조절: 캔버스 드래그(이동) + 휠(확대/축소)
  useEffect(() => {
    if (!ready || !adjustable) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onDown = (e: PointerEvent) => {
      if (!modelRef.current) return;
      draggingRef.current = true;
      dragLastRef.current = { x: e.clientX, y: e.clientY };
      canvas.setPointerCapture?.(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      const model = modelRef.current;
      if (!draggingRef.current || !model) return;
      const rect = canvas.getBoundingClientRect();
      const sx = rect.width > 0 ? stageRef.current.w / rect.width : 1;
      const sy = rect.height > 0 ? stageRef.current.h / rect.height : 1;
      const next: MaoView = {
        scale: model.scale.x,
        x: model.x + (e.clientX - dragLastRef.current.x) * sx,
        y: model.y + (e.clientY - dragLastRef.current.y) * sy,
      };
      dragLastRef.current = { x: e.clientX, y: e.clientY };
      applyView(next);
    };
    const onUp = (e: PointerEvent) => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      canvas.releasePointerCapture?.(e.pointerId);
      if (viewRef.current) saveStoredMaoView(viewRef.current);
    };
    const onWheel = (e: WheelEvent) => {
      const model = modelRef.current;
      if (!model) return;
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.96 : 1.04;
      const scale = Math.max(0.01, model.scale.x * factor);
      applyView({ scale, x: model.x, y: model.y }, true);
    };

    canvas.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      canvas.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [ready, adjustable, applyView]);

  const resetView = useCallback(() => {
    const model = modelRef.current;
    if (!model) return;
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(MAO_VIEW_STORAGE_KEY);
      } catch {
        /* ignore */
      }
    }
    model.scale.set(1);
    const rawW = model.width || 1;
    const rawH = model.height || 1;
    const sw = stageRef.current.w;
    const sh = stageRef.current.h;
    const contain = Math.min(sw / rawW, sh / rawH);
    const scale = contain * 1.04;
    model.scale.set(scale);
    applyView({ scale, x: (sw - model.width) / 2, y: sh * 0.02 }, true);
  }, [applyView]);

  // 캔버스 크기 변경 시 렌더러 리사이즈
  useEffect(() => {
    const app = appRef.current;
    if (!ready || !app) return;
    try {
      (app.renderer as unknown as { resize: (w: number, h: number) => void }).resize(stage.w, stage.h);
    } catch {
      /* ignore */
    }
  }, [ready, stage.w, stage.h]);

  const changeStage = useCallback((dw: number, dh: number) => {
    setStage((prev) => {
      const next = {
        w: Math.max(160, Math.min(720, prev.w + dw)),
        h: Math.max(160, Math.min(960, prev.h + dh)),
      };
      saveStoredMaoStage(next);
      return next;
    });
  }, []);

  const resetStage = useCallback(() => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(MAO_STAGE_STORAGE_KEY);
      } catch {
        /* ignore */
      }
    }
    setStage({ w: DEFAULT_STAGE_W, h: DEFAULT_STAGE_H });
  }, []);

  return (
    <div
      className={`relative mx-auto w-full select-none ${className}`}
      style={{ maxWidth: stage.w, aspectRatio: `${stage.w} / ${stage.h}`, background: FORTUNE_STAGE_BG }}
    >
      <canvas
        ref={canvasRef}
        width={stage.w}
        height={stage.h}
        className="block h-full w-full"
        style={{ background: FORTUNE_STAGE_BG }}
        aria-label="운세 안내 캐릭터 마오"
      />
      {!ready && !loadError ? (
        <div className="absolute inset-0 flex items-end justify-center pb-12 text-[11px] font-bold uppercase tracking-[0.3em] text-stone-400">
          마오를 부르는 중...
        </div>
      ) : null}
      {loadError ? (
        <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-xs text-stone-500">
          마오를 불러오지 못했어요.
        </div>
      ) : null}

      {adjustable && viewReadout ? (
        <div className="absolute bottom-2 left-2 right-2 z-20 flex flex-col gap-1.5 rounded-lg border border-white/15 bg-black/75 p-2 font-mono text-[11px] text-white backdrop-blur">
          <p className="text-[10px] text-amber-300">드래그=이동 · 휠=크기</p>
          <code className="select-text break-all leading-4 text-emerald-200">
            {`{ scale: ${viewReadout.scale.toFixed(4)}, x: ${Math.round(viewReadout.x)}, y: ${Math.round(viewReadout.y)} }`}
          </code>
          <code className="select-text break-all leading-4 text-sky-200">
            {`canvas { w: ${stage.w}, h: ${stage.h} }`}
          </code>

          {/* 캔버스 크기 조절 */}
          <div className="flex items-center gap-1">
            <span className="w-7 text-[10px] text-white/60">W</span>
            <button type="button" onClick={() => changeStage(-20, 0)} className="rounded border border-white/25 px-1.5 py-0.5 hover:bg-white/10">-</button>
            <button type="button" onClick={() => changeStage(20, 0)} className="rounded border border-white/25 px-1.5 py-0.5 hover:bg-white/10">+</button>
            <span className="ml-2 w-7 text-[10px] text-white/60">H</span>
            <button type="button" onClick={() => changeStage(0, -20)} className="rounded border border-white/25 px-1.5 py-0.5 hover:bg-white/10">-</button>
            <button type="button" onClick={() => changeStage(0, 20)} className="rounded border border-white/25 px-1.5 py-0.5 hover:bg-white/10">+</button>
          </div>

          {/* 모션 미리보기 */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-white/60">모션</span>
            <button type="button" onClick={() => playOnceThenIdle("", 3)} className="rounded border border-violet-300/40 bg-violet-400/20 px-2 py-0.5 hover:bg-violet-400/30">3번</button>
            <button type="button" onClick={() => playOnceThenIdle("", 4)} className="rounded border border-violet-300/40 bg-violet-400/20 px-2 py-0.5 hover:bg-violet-400/30">4번</button>
            <button type="button" onClick={() => playMotion("Idle", 0, 3)} className="rounded border border-white/25 px-2 py-0.5 hover:bg-white/10">idle</button>
          </div>

          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => {
                const v = viewRef.current;
                if (v) {
                  const text = `{ scale: ${v.scale.toFixed(4)}, x: ${Math.round(v.x)}, y: ${Math.round(v.y)} } / canvas { w: ${stage.w}, h: ${stage.h} }`;
                  void navigator.clipboard?.writeText(text);
                }
              }}
              className="rounded bg-amber-300 px-2 py-1 font-bold text-black hover:bg-amber-200"
            >
              복사
            </button>
            <button
              type="button"
              onClick={resetView}
              className="rounded border border-white/25 px-2 py-1 hover:bg-white/10"
            >
              위치리셋
            </button>
            <button
              type="button"
              onClick={resetStage}
              className="rounded border border-white/25 px-2 py-1 hover:bg-white/10"
            >
              크기리셋
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
