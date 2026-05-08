"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { usePathname } from "next/navigation";
import { Application, Ticker } from "pixi.js";
import { Live2DModel, MotionPriority } from "@naari3/pixi-live2d-display";
import { LIVE2D_VIEWPORT } from "@/lib/live2d/viewport";
import { useCharacterStore } from "@/store/useCharacterStore";
import type { CharacterActionKey } from "@/types/character";
import { supabase } from "@/lib/supabase/client";
import { useAuthUser } from "@/lib/supabase/useAuthUser";
import { formatDateTime, getCalendarEvents } from "@/lib/otaku/hub";

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

const CANVAS_W = LIVE2D_VIEWPORT.width;
const CANVAS_H = LIVE2D_VIEWPORT.height;

const DEFAULT_ACTION_LINES: Partial<Record<CharacterActionKey, string[]>> = {
  attention: ["네, 확인해볼게요.", "무엇을 도와드릴까요?", "지금 화면에서 필요한 걸 골라볼까요?"],
  tap_head: ["불렀나요?", "여기 있어요.", "무엇을 찾아볼까요?"],
  tap_other: ["작품을 찾아볼까요?", "추천이 필요할까요?", "도움이 필요하면 말해줘요."],
};

const ASSISTANT_PROMPT = "\ubb34\uc5c7\uc744 \ub3c4\uc640\ub4dc\ub9b4\uae4c\uc694?";
const ASSISTANT_LOADING_MESSAGE = "\ud655\uc778 \uc911\uc774\uc5d0\uc694.";
const ASSISTANT_RESPONSE_DURATION_MS = 4500;

const PAGE_DIALOGUE_DURATION_MS = 3500;
const PAGE_DIALOGUE_PRESETS: {
  match: (pathname: string) => boolean;
  lines: string[];
}[] = [
  {
    match: (pathname) => pathname === "/",
    lines: ["실시간 반응을 훑어볼까요?", "오늘 올라온 글을 같이 볼까요?"],
  },
  {
    match: (pathname) => pathname === "/feed",
    lines: ["팔로우한 채널 새 글을 모아봤어요.", "피드에서 놓친 글을 확인해볼까요?"],
  },
  {
    match: (pathname) => pathname.startsWith("/board/") && pathname.includes("/write"),
    lines: ["글을 쓰기 전에 스포일러 여부를 확인해볼까요?", "제목과 말머리를 먼저 정해볼까요?"],
  },
  {
    match: (pathname) => pathname.startsWith("/board/"),
    lines: ["이 채널의 최신 흐름을 볼까요?", "궁금한 글을 골라볼까요?"],
  },
  {
    match: (pathname) => pathname.startsWith("/profile"),
    lines: ["프로필과 대표 캐릭터를 정리해볼까요?", "내 활동 기록을 확인해볼까요?"],
  },
  {
    match: (pathname) => pathname.startsWith("/works"),
    lines: ["작품 정보를 같이 살펴볼까요?", "리뷰와 소식을 확인해볼까요?"],
  },
  {
    match: (pathname) => pathname.startsWith("/news"),
    lines: ["새 소식부터 확인해볼까요?", "공식 발표와 루머를 구분해서 볼게요."],
  },
  {
    match: (pathname) => pathname.startsWith("/releases"),
    lines: ["관심 신작 알림을 확인해볼까요?", "공식 일정이 바뀌었는지 같이 볼까요?"],
  },
  {
    match: (pathname) => pathname.startsWith("/calendar"),
    lines: ["오늘 볼 일정부터 확인해볼까요?", "내 관심작 일정만 추려볼까요?"],
  },
  {
    match: (pathname) => pathname.startsWith("/reviews"),
    lines: ["리뷰를 볼 때 스포일러 표시를 확인해요.", "평가 포인트를 같이 살펴볼까요?"],
  },
];

interface MotionFileMeta {
  durationMs: number;
  loop: boolean;
}

interface SpeechAnchor {
  x: number;
  y: number;
}

type AssistantActionKey = "today" | "week" | "news";

function normalizeCharacterAction(action: CharacterActionKey): CharacterActionKey {
  if (action === "tap_body") return "attention";
  return action;
}

function hasActualHitAreas(model: Live2DModel | null): boolean {
  const hitAreas = (
    model?.internalModel as unknown as {
      hitAreas?: Record<string, unknown>;
    } | undefined
  )?.hitAreas;

  return Object.keys(hitAreas ?? {}).length > 0;
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
 * 4) `autoHitTest`, `autoFocus` 는 켜되, 모델별 히트 액션은 안전 액션으로 정규화한다.
 *    기존 저장 데이터에 남아있을 수 있는 `tap_body` 는 런타임에서 `attention` 으로 처리한다.
 * 5) `window.app` 은 Pixi Application 수명과 1:1 로 동기화한다.
 * 6) Strict Mode 이중 마운트 대비: 두 단계 effect 모두에 `cancelled` 가드 + cleanup.
 * 7) 모델별 특수 ID (표정/모션/히트 영역) 는 store 의 `profile` 매핑에서 읽는다.
 *    mao_pro 전용 하드코딩은 모두 defaultProfile.ts 로 분리되었다.
 */
export default function Live2DWrapper() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const speechBubbleRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const modelRef = useRef<Live2DModel | null>(null);
  const originalFocusRef = useRef<((x: number, y: number) => void) | null>(null);
  const neutralParametersRef = useRef<number[] | null>(null);
  const emotionApplySeqRef = useRef(0);
  const pendingIdleReturnRef = useRef(false);
  const actionIdleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const actionIdleTimeoutSeqRef = useRef(0);
  const pointerFallbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messageTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressCharacterClickUntilRef = useRef(0);
  const suppressEmotionDialogueUntilRef = useRef(0);
  const lastHitAtRef = useRef(0);
  const motionMetaCacheRef = useRef<Map<string, MotionFileMeta>>(new Map());
  const modelMotionsRef = useRef<{ modelPath: string | null; motions: Record<string, { File?: string }[]> }>({
    modelPath: null,
    motions: {},
  });
  const [appReady, setAppReady] = useState(false);
  const [speechAnchor, setSpeechAnchor] = useState<SpeechAnchor | null>(null);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantBusy, setAssistantBusy] = useState<AssistantActionKey | null>(null);

  const pathname = usePathname();
  const modelPath = useCharacterStore((s) => s.modelPath);
  const authUser = useAuthUser();
  const userId = authUser?.id ?? null;
  const setLoading = useCharacterStore((s) => s.setLoading);
  const setReady = useCharacterStore((s) => s.setReady);
  const setError = useCharacterStore((s) => s.setError);
  const setModelConfig = useCharacterStore((s) => s.setModelConfig);

  function clearMessageTimeout() {
    if (messageTimeoutRef.current) {
      clearTimeout(messageTimeoutRef.current);
      messageTimeoutRef.current = null;
    }
  }

  function setTemporaryMessage(message: string, durationMs = 3000) {
    clearMessageTimeout();
    suppressEmotionDialogueUntilRef.current = Date.now() + durationMs;
    useCharacterStore.getState().setMessage(message);
    messageTimeoutRef.current = setTimeout(() => {
      messageTimeoutRef.current = null;
      if (useCharacterStore.getState().message === message) {
        useCharacterStore.getState().setMessage(null);
      }
    }, durationMs);
  }

  function openAssistantMenu() {
    clearMessageTimeout();
    suppressEmotionDialogueUntilRef.current = Number.POSITIVE_INFINITY;
    useCharacterStore.getState().setMessage(ASSISTANT_PROMPT);
    setAssistantOpen(true);
  }

  function closeAssistantMenu() {
    clearMessageTimeout();
    suppressEmotionDialogueUntilRef.current = 0;
    setAssistantOpen(false);
    setAssistantBusy(null);
    useCharacterStore.getState().setMessage(null);
  }

  function closeSpeechBubble() {
    clearMessageTimeout();
    suppressEmotionDialogueUntilRef.current = 0;
    setAssistantOpen(false);
    setAssistantBusy(null);
    useCharacterStore.getState().setMessage(null);
  }

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

  const restoreTransparentClearColor = () => {
    const renderer = appRef.current?.renderer as unknown as {
      gl?: WebGLRenderingContext | WebGL2RenderingContext;
    };
    renderer.gl?.clearColor(0, 0, 0, 0);
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

  useEffect(() => {
    return () => clearMessageTimeout();
  }, []);

  useEffect(() => {
    if (!pathname) return;
    if (assistantOpen || assistantBusy) return;

    const preset = PAGE_DIALOGUE_PRESETS.find((item) => item.match(pathname));
    if (!preset) return;

    const line = preset.lines[Math.floor(Math.random() * preset.lines.length)];
    setTemporaryMessage(line, PAGE_DIALOGUE_DURATION_MS);
  }, [pathname]);

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
        setSpeechAnchor(null);
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
          if (Date.now() < suppressCharacterClickUntilRef.current) return;

          lastHitAtRef.current = Date.now();
          if (pointerFallbackTimeoutRef.current) {
            clearTimeout(pointerFallbackTimeoutRef.current);
            pointerFallbackTimeoutRef.current = null;
          }

          const profile = useCharacterStore.getState().profile;
          if (!profile) return;

          let firedAction: CharacterActionKey = "tap_other";
          for (const mapping of profile.hitAreaMap) {
            if (hitAreas.includes(mapping.hitAreaId)) {
              firedAction = mapping.action;
              break;
            }
          }

          playAction(normalizeCharacterAction(firedAction), firedAction);
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
        setSpeechAnchor(getModelSpeechAnchor(localModel));
        const originalOnRender = localModel.onRender?.bind(localModel);
        if (originalOnRender) {
          localModel.onRender = (ticker) => {
            originalOnRender(ticker);
            restoreTransparentClearColor();
          };
        }
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
  // Effect 3 · 실시간 알림 연동 (말풍선)
  // --------------------------------------------------------------------
  useEffect(() => {
    let isMounted = true;

    if (!userId) {
      return () => {
        isMounted = false;
      };
    }

    const notificationChannel = supabase
      .channel(`live2d-notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `receiver_id=eq.${userId}`,
        },
        (payload) => {
          if (isMounted && userId && payload.new.receiver_id === userId) {
            // 알림 메시지 표시
            const typeLabel = 
              payload.new.type === 'COMMENT' ? '새 댓글' :
              payload.new.type === 'REPLY' ? '새 답글' :
              payload.new.type === 'REACTION' ? '새 리액션' : '새로운 알림';
            
            useCharacterStore.getState().setMessage(`${typeLabel}이 도착했어요!`);
            
            // 기분 좋음 표시
            useCharacterStore.getState().setEmotion('happy');
            
            // 일정 시간 후 메시지 초기화
            setTimeout(() => {
              if (isMounted) {
                useCharacterStore.getState().setMessage(null);
                useCharacterStore.getState().setEmotion('idle');
              }
            }, 5000);
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(notificationChannel);
    };
  }, [userId]);

  useEffect(() => {
    if (!assistantOpen) return;

    window.addEventListener("keydown", closeAssistantMenu);
    return () => window.removeEventListener("keydown", closeAssistantMenu);
  }, [assistantOpen]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (speechBubbleRef.current?.contains(target)) return;
      if (canvasRef.current?.contains(target)) return;

      const state = useCharacterStore.getState();
      if (assistantOpen || state.message) {
        closeSpeechBubble();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [assistantOpen]);

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
    if (Date.now() < suppressEmotionDialogueUntilRef.current) {
      return () => {
        cancelled = true;
      };
    }

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

    if (app.ticker) {
      app.ticker.add(tick);
    }
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
      if (pointerFallbackTimeoutRef.current) {
        clearTimeout(pointerFallbackTimeoutRef.current);
        pointerFallbackTimeoutRef.current = null;
      }
      actionIdleTimeoutSeqRef.current += 1;
    };
  }, [appReady, modelPath, isReady]);

  // --------------------------------------------------------------------
  // 공통 헬퍼
  // --------------------------------------------------------------------
  function playAction(action: CharacterActionKey, originalAction: CharacterActionKey = action) {
    const safeAction = normalizeCharacterAction(action);
    const model = modelRef.current;
    if (!model) return;
    const profile = useCharacterStore.getState().profile;
    if (!profile) return;

    const motion = profile.motionMap[safeAction] ?? profile.motionMap[originalAction];
    if (motion) {
      try {
        void model.motion(motion.group, motion.index, MotionPriority.FORCE);

        if (safeAction !== "idle") {
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

    const opensAssistant =
      safeAction === "attention" || safeAction === "tap_head" || safeAction === "tap_other";
    const lines = profile.dialogues.actions[safeAction] ?? DEFAULT_ACTION_LINES[safeAction];
    if (!opensAssistant && lines && lines.length > 0) {
      const line = lines[Math.floor(Math.random() * lines.length)];
      setTemporaryMessage(line);
    }

    const sound = profile.sounds.actions[safeAction];
    if (sound) void playSound(sound);

    if (opensAssistant) {
      openAssistantMenu();
    }
  }

  async function runAssistantAction(action: AssistantActionKey) {
    if (assistantBusy) return;
    clearMessageTimeout();
    setAssistantBusy(action);
    useCharacterStore.getState().setMessage(ASSISTANT_LOADING_MESSAGE);
    setAssistantOpen(false);

    try {
      if (action === "today") {
        const todayEvents = getCalendarEvents().filter(
          (event) => event.isFollowing && ymdKey(event.startsAt) === ymdKey(new Date()),
        );
        const message =
          todayEvents.length > 0
            ? `오늘은 ${todayEvents.slice(0, 3).map((event) => event.title).join(", ")} 일정이 있어요.`
            : "오늘 관심 일정은 아직 없어요.";
        setTemporaryMessage(message, ASSISTANT_RESPONSE_DURATION_MS);
        useCharacterStore.getState().setEmotion("happy");
        return;
      }

      if (action === "week") {
        const now = new Date();
        const weekEvents = getCalendarEvents()
          .filter((event) => event.isFollowing && isWithinDays(new Date(event.startsAt), now, 7))
          .slice(0, 3);
        const message =
          weekEvents.length > 0
            ? `이번 주엔 ${weekEvents.map((event) => `${formatDateTime(event.startsAt)} ${event.title}`).join(", ")}가 있어요.`
            : "이번 주 관심 일정은 아직 비어 있어요.";
        setTemporaryMessage(message, ASSISTANT_RESPONSE_DURATION_MS);
        useCharacterStore.getState().setEmotion("happy");
        return;
      }

      if (action === "news") {
        const unreadCount = await fetchUnreadCount();
        const message =
          unreadCount > 0
            ? `새 알림이 ${unreadCount}개 있어요.`
            : "확인할 새 알림은 없어요.";
        setTemporaryMessage(message, ASSISTANT_RESPONSE_DURATION_MS);
        useCharacterStore.getState().setEmotion("happy");
        return;
      }

    } catch (e) {
      console.warn("[Live2DWrapper] assistant action warning:", e);
      setTemporaryMessage(
        "\uc815\ubcf4\ub97c \ubd88\ub7ec\uc624\uc9c0 \ubabb\ud588\uc5b4\uc694. \uc7a0\uc2dc \ud6c4 \ub2e4\uc2dc \uc2dc\ub3c4\ud574\ubcfc\uac8c\uc694.",
        ASSISTANT_RESPONSE_DURATION_MS
      );
    } finally {
      setAssistantBusy(null);
      setTimeout(() => {
        const state = useCharacterStore.getState();
        if (state.emotion === "happy") {
          state.setEmotion("idle");
        }
      }, 3500);
    }
  }

  async function fetchUnreadCount() {
    if (!userId) return 0;
    const { count, error } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("receiver_id", userId)
      .eq("is_read", false);

    if (error) {
      console.warn("[Live2DWrapper] unread count warning:", error.message);
      return 0;
    }
    return count ?? 0;
  }

  function schedulePointerFallbackAction() {
    if (assistantOpen || useCharacterStore.getState().message) {
      suppressCharacterClickUntilRef.current = Date.now() + 250;
      closeSpeechBubble();
      return;
    }

    const model = modelRef.current;
    if (!model) return;
    if (hasActualHitAreas(model)) return;
    if (pointerFallbackTimeoutRef.current) {
      clearTimeout(pointerFallbackTimeoutRef.current);
    }
    pointerFallbackTimeoutRef.current = setTimeout(() => {
      pointerFallbackTimeoutRef.current = null;
      if (Date.now() - lastHitAtRef.current < 250) return;
      playAction("attention");
    }, 120);
  }

  function getModelSpeechAnchor(model: Live2DModel): SpeechAnchor {
    const fallback = {
      x: CANVAS_W / 2,
      y: Math.round(CANVAS_H * 0.18),
    };

    try {
      const bounds = (
        model as unknown as {
          getBounds?: () => { x: number; y: number; width: number; height: number };
        }
      ).getBounds?.();
      if (
        !bounds ||
        !Number.isFinite(bounds.x) ||
        !Number.isFinite(bounds.y) ||
        !Number.isFinite(bounds.width) ||
        !Number.isFinite(bounds.height) ||
        bounds.width <= 0 ||
        bounds.height <= 0
      ) {
        return fallback;
      }

      return {
        x: Math.min(Math.max(bounds.x + bounds.width / 2, 48), CANVAS_W - 48),
        y: Math.min(Math.max(bounds.y + Math.min(bounds.height * 0.12, 72), 48), CANVAS_H - 80),
      };
    } catch {
      return fallback;
    }
  }

  return (
    <aside
      className="fixed bottom-0 right-0 z-50 select-none"
      aria-label="[Live2D 캐릭터 영역]"
    >

      <div
        className="relative"
      >
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className="block bg-transparent touch-none"
          onPointerDown={schedulePointerFallbackAction}
          style={{
            width: `min(${CANVAS_W}px, calc(100vw - 16px))`,
            height: "auto",
            aspectRatio: `${CANVAS_W} / ${CANVAS_H}`,
          }}
        />

        <SpeechBubble anchor={speechAnchor} bubbleRef={speechBubbleRef}>
          {assistantOpen && (
            <AssistantQuickActions
              busyAction={assistantBusy}
              onAction={runAssistantAction}
              onClose={closeAssistantMenu}
            />
          )}
        </SpeechBubble>
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

function SpeechBubble({
  anchor,
  bubbleRef,
  children,
}: {
  anchor: SpeechAnchor | null;
  bubbleRef: RefObject<HTMLDivElement | null>;
  children?: ReactNode;
}) {
  const message = useCharacterStore((s) => s.message);
  if (!message && !children) return null;
  const x = anchor?.x ?? CANVAS_W / 2;
  const y = anchor?.y ?? Math.round(CANVAS_H * 0.18);
  return (
    <div
      ref={bubbleRef}
      className="absolute -translate-x-1/2 -translate-y-full bg-white px-4 py-3 rounded-2xl shadow-lg border-2 border-pink-200 text-sm font-semibold text-gray-800 min-w-[160px] max-w-[min(280px,80vw)] text-center pointer-events-auto z-10 before:content-[''] before:absolute before:-bottom-2 before:left-1/2 before:-translate-x-1/2 before:w-4 before:h-4 before:bg-white before:rotate-45 before:border-b-2 before:border-r-2 before:border-pink-200"
      style={{
        left: `${(x / CANVAS_W) * 100}%`,
        top: `${(y / CANVAS_H) * 100}%`,
      }}
    >
      {message && <div>{message}</div>}
      {children}
    </div>
  );
}

function AssistantQuickActions({
  busyAction,
  onAction,
  onClose,
}: {
  busyAction: AssistantActionKey | null;
  onAction: (action: AssistantActionKey) => void;
  onClose: () => void;
}) {
  const buttonClass =
    "rounded-full border border-pink-200 bg-pink-50 px-3 py-1 text-[11px] font-semibold text-pink-700 shadow-sm hover:bg-pink-100 disabled:opacity-50";

  return (
    <div
      data-testid="assistant-quick-actions"
      className="mt-2 flex flex-wrap items-center justify-center gap-1"
    >
      <button
        type="button"
        data-testid="assistant-action-today"
        className={buttonClass}
        disabled={busyAction !== null}
        onClick={() => onAction("today")}
      >
        {busyAction === "today" ? "\ud655\uc778 \uc911" : "\uc624\ub298 \uc77c\uc815"}
      </button>
      <button
        type="button"
        data-testid="assistant-action-week"
        className={buttonClass}
        disabled={busyAction !== null}
        onClick={() => onAction("week")}
      >
        {busyAction === "week" ? "\ud655\uc778 \uc911" : "\uc774\ubc88 \uc8fc"}
      </button>
      <button
        type="button"
        data-testid="assistant-action-news"
        className={buttonClass}
        disabled={busyAction !== null}
        onClick={() => onAction("news")}
      >
        {busyAction === "news" ? "\ud655\uc778 \uc911" : "\uc0c8 \uc18c\uc2dd"}
      </button>
      <button
        type="button"
        data-testid="assistant-action-close"
        className="rounded-full border border-gray-200 bg-white px-3 py-1 text-[11px] text-gray-500 hover:bg-gray-100"
        onClick={onClose}
      >
        {"\ub2eb\uae30"}
      </button>
    </div>
  );
}

function ymdKey(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function isWithinDays(target: Date, base: Date, days: number): boolean {
  const start = new Date(base.getFullYear(), base.getMonth(), base.getDate()).getTime();
  const end = start + days * 24 * 60 * 60 * 1000;
  const time = target.getTime();
  return time >= start && time <= end;
}
