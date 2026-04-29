"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  installModelFromZip,
  isInstalled,
  type InstalledModelPackage,
  type ModelPackageAnalysis,
  type ValidationIssue,
} from "@/lib/live2d/modelPackage";
import {
  defaultPresets,
  guessExpressionMap,
  guessHitAreaMap,
  guessMorphSliders,
  guessMotionMap,
  guessOutfits,
} from "@/lib/live2d/autoMap";
import { LIVE2D_VIEWPORT } from "@/lib/live2d/viewport";
import { extractRendererThumbnail } from "@/lib/live2d/thumbnailCapture";
import {
  uploadCharacterAssets,
  uploadCharacterThumbnail,
} from "@/lib/supabase/characterStorage";
import { useCharacterLibraryStore } from "@/store/useCharacterLibraryStore";
import { useCharacterStore } from "@/store/useCharacterStore";
import type { CharacterProfile, CharacterViewConfig } from "@/types/character";

interface CharacterUploaderProps {
  onCommitted?: (profile: CharacterProfile) => void;
  previewMode?: "inline" | "external";
  savedView?: CharacterViewConfig;
  previewView?: CharacterViewConfig;
  onPreviewModelChange?: (modelUrl: string | null) => void;
  onPreviewViewChange?: (view: CharacterViewConfig) => void;
  createThumbnailBlob?: () => Promise<Blob | null>;
}

export const INITIAL_UPLOAD_VIEW: CharacterViewConfig = { scale: 0.05, x: 0, y: 20 };
const PREVIEW_W = LIVE2D_VIEWPORT.width;
const PREVIEW_H = LIVE2D_VIEWPORT.height;

/**
 * ZIP 모델 패키지를 받아서:
 *  1) 검증 결과(이슈/요약) 를 보여주고
 *  2) Supabase Storage 에 업로드해 영구 URL 을 확보
 *  3) 자동 추정된 매핑을 포함한 CharacterProfile 을 라이브러리에 등록
 *  4) 등록 직후 해당 캐릭터를 활성 모델로 로드
 */
export default function CharacterUploader({
  onCommitted,
  previewMode = "inline",
  savedView = INITIAL_UPLOAD_VIEW,
  previewView,
  onPreviewModelChange,
  onPreviewViewChange,
  createThumbnailBlob,
}: CharacterUploaderProps) {
  const [pending, setPending] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [commitError, setCommitError] = useState<string | null>(null);
  const [result, setResult] = useState<ModelPackageAnalysis | InstalledModelPackage | null>(
    null
  );
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const register = useCharacterLibraryStore((s) => s.register);
  const setActive = useCharacterLibraryStore((s) => s.setActive);
  const setProfile = useCharacterStore((s) => s.setProfile);

  useEffect(() => {
    return () => {
      if (!result || !isInstalled(result)) return;
      for (const url of result.blobUrls) {
        try {
          URL.revokeObjectURL(url);
        } catch {
          /* ignore */
        }
      }
    };
  }, [result]);

  useEffect(() => {
    if (previewMode !== "external") return;
    onPreviewModelChange?.(result && isInstalled(result) ? result.modelUrl : null);
    return () => onPreviewModelChange?.(null);
  }, [onPreviewModelChange, previewMode, result]);

  const buildProfile = useCallback(
    (
      installed: InstalledModelPackage,
      characterId: string,
      modelPath: string,
      blobUrls: string[],
      view: CharacterViewConfig,
      thumbnailUrl?: string
    ): CharacterProfile => {
      const morphSliders = guessMorphSliders(installed);
      return {
        id: characterId,
        name: name || "이름 없는 캐릭터",
        description: description || undefined,
        modelPath,
        thumbnailUrl,
        expressionMap: guessExpressionMap(installed),
        motionMap: guessMotionMap(installed),
        hitAreaMap: guessHitAreaMap(installed),
        outfits: guessOutfits(installed),
        morphSliders,
        parameterPresets: defaultPresets(morphSliders),
        sounds: { emotions: {}, actions: {} },
        dialogues: { emotions: {}, actions: {} },
        defaultView: view,
        blobUrls,
        isBuiltIn: false,
        createdAt: Date.now(),
      };
    },
    [description, name]
  );

  const handleFile = useCallback(async (file: File) => {
    setPending(true);
    setResult(null);
    setZipFile(null);
    setCommitError(null);
    try {
      const r = await installModelFromZip(file);
      setResult(r);
      if (isInstalled(r)) {
        setZipFile(file);
        if (!name) {
          setName(file.name.replace(/\.zip$/i, ""));
        }
      }
    } catch (e) {
      console.error("[CharacterUploader] install 실패:", e);
      setResult({
        ok: false,
        issues: [{ level: "error", message: String(e) }],
        rootDir: null,
        modelJsonPath: null,
        model3: null,
        hitAreas: [],
        expressions: [],
        motions: [],
        poseParts: [],
        displayParams: [],
        textures: [],
        totalReferencedBytes: 0,
        discardedFileCount: 0,
      });
    } finally {
      setPending(false);
    }
  }, [name]);

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!/\.zip$/i.test(file.name)) {
      alert("ZIP 파일만 업로드 가능합니다.");
      return;
    }
    void handleFile(file);
  }, [handleFile]);

  const onPick = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) void handleFile(f);
    },
    [handleFile]
  );

  const commit = async () => {
    if (!result || !isInstalled(result) || !zipFile) return;

    setCommitting(true);
    setCommitError(null);

    const characterId = `uploaded-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    try {
      const { modelUrl } = await uploadCharacterAssets(zipFile, characterId);

      let thumbnailUrl: string | undefined;
      if (createThumbnailBlob) {
        try {
          const thumbnail = await createThumbnailBlob();
          if (thumbnail) {
            thumbnailUrl = await uploadCharacterThumbnail(characterId, thumbnail);
          }
        } catch (e) {
          console.warn("[CharacterUploader] thumbnail capture/upload warning:", e);
        }
      }

      const profile = buildProfile(result, characterId, modelUrl, [], savedView, thumbnailUrl);

      // 미리 만들어진 blob URL 들은 Storage 업로드가 끝난 시점에 더 이상 필요 없으므로 정리.
      for (const url of result.blobUrls) {
        try {
          URL.revokeObjectURL(url);
        } catch {
          /* ignore */
        }
      }

      register(profile);
      setActive(profile.id);
      setProfile(profile);

      setResult(null);
      setZipFile(null);
      setName("");
      setDescription("");
      if (inputRef.current) inputRef.current.value = "";
      onCommitted?.(profile);
    } catch (e) {
      console.error("[CharacterUploader] commit 실패:", e);
      setCommitError(e instanceof Error ? e.message : String(e));
    } finally {
      setCommitting(false);
    }
  };

  return (
    <div className="border border-dashed border-gray-500 bg-white/40 p-3 space-y-3">
      <div className="text-[11px] tracking-widest text-gray-500 uppercase">
        [캐릭터 업로드 · ZIP 패키지]
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={
          "border-2 border-dashed p-6 text-center text-xs tracking-widest uppercase transition-colors " +
          (dragOver
            ? "border-pink-500 bg-pink-50 text-pink-800"
            : "border-gray-500 bg-white/60 text-gray-600")
        }
      >
        {pending ? (
          <span>[분석 중...]</span>
        ) : (
          <>
            <div>ZIP 파일을 여기에 드롭</div>
            <div className="mt-1 text-[10px] text-gray-500 normal-case tracking-normal">
              (*.model3.json + moc3 + textures + [physics/pose/expressions/motions])
            </div>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="mt-3 border border-dashed border-gray-600 bg-white/80 px-3 py-1 text-xs tracking-widest uppercase"
            >
              [파일 선택]
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".zip,application/zip,application/x-zip-compressed"
              onChange={onPick}
              className="hidden"
            />
          </>
        )}
      </div>

      {result && <AnalysisSummary analysis={result} />}

      {result && isInstalled(result) && (
        <div className="space-y-2 border-t border-dashed border-gray-400 pt-3">
          <div className="text-[11px] tracking-widest text-gray-500 uppercase">
            [메타데이터 입력]
          </div>
          <label className="block text-xs">
            <span className="block mb-1 tracking-widest uppercase text-[10px] text-gray-500">
              캐릭터 이름
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 시즈쿠쨩"
              className="w-full border border-dashed border-gray-500 bg-white/70 px-2 py-1 text-xs"
            />
          </label>
          <label className="block text-xs">
            <span className="block mb-1 tracking-widest uppercase text-[10px] text-gray-500">
              소개
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="캐릭터 소개, 작가 크레딧 등"
              className="w-full border border-dashed border-gray-500 bg-white/70 px-2 py-1 text-xs"
            />
          </label>

          {commitError && (
            <div className="border border-dashed border-red-500 bg-red-50 px-2 py-1 text-[11px] text-red-700">
              [업로드 실패] {commitError}
            </div>
          )}

          <button
            type="button"
            onClick={() => void commit()}
            disabled={committing}
            className="border border-dashed border-green-700 bg-green-100/70 px-3 py-1 text-xs tracking-widest uppercase text-green-900 disabled:opacity-50"
          >
            {committing ? "[Storage 업로드 중...]" : "[라이브러리에 등록하고 로드]"}
          </button>
          <div className="border border-dashed border-blue-300 bg-blue-50/70 p-2 text-[11px] text-blue-900">
            <div className="mb-2 font-bold tracking-widest uppercase">[미리보기 위치]</div>
            <p className="text-blue-800">
              오른쪽 미리보기 화면에서 드래그로 위치를 옮기고 휠로 크기를 조절하세요.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export function CharacterUploadPreview({
  modelUrl,
  view,
  onViewChange,
  onCaptureReady,
}: {
  modelUrl: string;
  view: CharacterViewConfig;
  onViewChange: (view: CharacterViewConfig) => void;
  onCaptureReady?: (capture: (() => Promise<Blob | null>) | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const appRef = useRef<any>(null);
  const modelRef = useRef<any>(null);
  const dragData = useRef({ isDragging: false, lastX: 0, lastY: 0 });
  const onViewChangeRef = useRef(onViewChange);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onViewChangeRef.current = onViewChange;
  }, [onViewChange]);

  const captureThumbnail = useCallback(async (): Promise<Blob | null> => {
    const app = appRef.current;
    const canvas = canvasRef.current;
    if (!app || !canvas) return null;

    return extractRendererThumbnail(app, canvas);
  }, []);

  useEffect(() => {
    onCaptureReady?.(captureThumbnail);
    return () => onCaptureReady?.(null);
  }, [captureThumbnail, onCaptureReady]);

  useEffect(() => {
    let cancelled = false;
    let app: any = null;
    const previousApp = window.app;

    const boot = async () => {
      if (!canvasRef.current) return;
      try {
        const [{ Application, Ticker }, { Live2DModel }] = await Promise.all([
          import("pixi.js"),
          import("@naari3/pixi-live2d-display"),
        ]);
        if (cancelled) return;

        app = new Application();
        await app.init({
          canvas: canvasRef.current,
          preference: "webgl",
          antialias: true,
          backgroundAlpha: 0,
          resolution: 1,
          autoDensity: false,
          width: PREVIEW_W,
          height: PREVIEW_H,
        });
        if (cancelled) return;

        Live2DModel.registerTicker(Ticker);
        window.app = app;
        appRef.current = app;

        const model = await Live2DModel.from(modelUrl, {
          autoHitTest: false,
          autoFocus: false,
        });
        if (cancelled) {
          model.destroy({ children: true, texture: true, baseTexture: true });
          return;
        }

        try {
          const core = (
            model.internalModel as unknown as {
              coreModel?: {
                _model?: {
                  drawables?: { renderOrders?: Int32Array };
                  renderOrders?: Int32Array;
                };
              };
            }
          ).coreModel?._model;
          if (core?.drawables && !core.drawables.renderOrders && core.renderOrders) {
            core.drawables.renderOrders = core.renderOrders;
          }
        } catch (e) {
          console.warn("[CharacterUploadPreview] core6 compat patch warning:", e);
        }

        try {
          (
            model as unknown as { setRenderer?: (renderer: unknown) => void }
          ).setRenderer?.(app.renderer);
        } catch (e) {
          console.warn("[CharacterUploadPreview] setRenderer warning:", e);
        }

        model.scale.set(view.scale);
        model.x = view.x;
        model.y = view.y;
        app.stage.addChild(model);
        modelRef.current = model;
        onViewChangeRef.current(view);
      } catch (e) {
        console.error("[CharacterUploadPreview] preview load 실패:", e);
        setError(e instanceof Error ? e.message : String(e));
      }
    };

    void boot();

    return () => {
      cancelled = true;
      if (modelRef.current) {
        try {
          modelRef.current.destroy({ children: true, texture: true, baseTexture: true });
        } catch (e) {
          console.warn("[CharacterUploadPreview] model destroy warning:", e);
        }
        modelRef.current = null;
      }
      const targetApp = appRef.current ?? app;
      if (targetApp) {
        try {
          targetApp.destroy(true, {
            children: true,
            texture: true,
            baseTexture: true,
            textureSource: true,
          });
        } catch (e) {
          console.warn("[CharacterUploadPreview] app destroy warning:", e);
        }
      }
      appRef.current = null;
      if (window.app === targetApp) {
        window.app = previousApp;
      }
    };
  }, [modelUrl]);

  useEffect(() => {
    const model = modelRef.current;
    if (!model) return;
    model.scale.set(view.scale);
    model.x = view.x;
    model.y = view.y;
  }, [view.scale, view.x, view.y]);

  const updateView = () => {
    const model = modelRef.current;
    if (!model) return;
    onViewChange({ scale: model.scale.x, x: model.x, y: model.y });
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!modelRef.current) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragData.current = { isDragging: true, lastX: e.clientX, lastY: e.clientY };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const model = modelRef.current;
    if (!dragData.current.isDragging || !model) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    const scaleX = rect && rect.width > 0 ? PREVIEW_W / rect.width : 1;
    const scaleY = rect && rect.height > 0 ? PREVIEW_H / rect.height : 1;
    model.x += (e.clientX - dragData.current.lastX) * scaleX;
    model.y += (e.clientY - dragData.current.lastY) * scaleY;
    dragData.current.lastX = e.clientX;
    dragData.current.lastY = e.clientY;
    updateView();
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const model = modelRef.current;
    if (!model) return;
    e.preventDefault();
    const scaleFactor = e.deltaY > 0 ? 0.95 : 1.05;
    model.scale.x *= scaleFactor;
    model.scale.y *= scaleFactor;
    updateView();
  };

  return (
    <div
      className="mb-2 flex justify-center border border-dashed border-blue-300 bg-white/70"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={() => {
        dragData.current.isDragging = false;
      }}
      onPointerCancel={() => {
        dragData.current.isDragging = false;
      }}
      onWheel={handleWheel}
    >
      <div className="relative cursor-grab active:cursor-grabbing">
        <canvas
          ref={canvasRef}
          width={PREVIEW_W}
          height={PREVIEW_H}
          className="block touch-none bg-transparent"
          style={{
            width: "min(100%, 320px)",
            height: "auto",
            aspectRatio: `${PREVIEW_W} / ${PREVIEW_H}`,
          }}
        />
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 p-3 text-center text-[11px] text-red-600">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

function AnalysisSummary({
  analysis,
}: {
  analysis: ModelPackageAnalysis | InstalledModelPackage;
}) {
  const mb = (b: number) => `${(b / (1024 * 1024)).toFixed(2)}MB`;
  return (
    <div className="border border-dashed border-gray-500 bg-white/60 p-3 text-[11px] text-gray-700 space-y-2">
      <div className="tracking-widest uppercase text-gray-500">[분석 결과]</div>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono">
        <li>root = {analysis.rootDir || "(루트)"}</li>
        <li>model3 = {analysis.modelJsonPath || "-"}</li>
        <li>textures = {analysis.textures.length}</li>
        <li>expressions = {analysis.expressions.length}</li>
        <li>motions = {analysis.motions.length}</li>
        <li>hit areas = {analysis.hitAreas.length}</li>
        <li>pose parts = {analysis.poseParts.length}</li>
        <li>display params = {analysis.displayParams.length}</li>
        <li>참조된 총량 = {mb(analysis.totalReferencedBytes)}</li>
        <li>버려진 파일 = {analysis.discardedFileCount}</li>
      </ul>
      {analysis.issues.length > 0 && (
        <ul className="space-y-1">
          {analysis.issues.map((i, idx) => (
            <IssueLine key={idx} issue={i} />
          ))}
        </ul>
      )}
    </div>
  );
}

function IssueLine({ issue }: { issue: ValidationIssue }) {
  return (
    <li
      className={
        "border border-dashed px-2 py-1 " +
        (issue.level === "error"
          ? "border-red-500 bg-red-50 text-red-800"
          : "border-amber-500 bg-amber-50 text-amber-800")
      }
    >
      [{issue.level.toUpperCase()}] {issue.message}
    </li>
  );
}
