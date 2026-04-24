"use client";

import { useCallback, useRef, useState } from "react";
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
import { useCharacterLibraryStore } from "@/store/useCharacterLibraryStore";
import { useCharacterStore } from "@/store/useCharacterStore";
import type { CharacterProfile } from "@/types/character";

/**
 * ZIP 모델 패키지를 받아서:
 *  1) 검증 결과(이슈/요약) 를 보여주고
 *  2) 자동 추정된 매핑을 포함한 CharacterProfile 을 라이브러리에 등록
 *  3) 등록 직후 해당 캐릭터를 활성 모델로 로드
 */
export default function CharacterUploader() {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ModelPackageAnalysis | InstalledModelPackage | null>(
    null
  );
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const register = useCharacterLibraryStore((s) => s.register);
  const setActive = useCharacterLibraryStore((s) => s.setActive);
  const setProfile = useCharacterStore((s) => s.setProfile);

  const handleFile = useCallback(async (file: File) => {
    setPending(true);
    setResult(null);
    try {
      const r = await installModelFromZip(file);
      setResult(r);
      if (isInstalled(r) && !name) {
        // 파일명 기반으로 기본 이름 제안
        setName(file.name.replace(/\.zip$/i, ""));
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

  const commit = () => {
    if (!result || !isInstalled(result)) return;
    const morphSliders = guessMorphSliders(result);
    const profile: CharacterProfile = {
      id: `uploaded-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: name || "이름 없는 캐릭터",
      description: description || undefined,
      modelPath: result.modelUrl,
      expressionMap: guessExpressionMap(result),
      motionMap: guessMotionMap(result),
      hitAreaMap: guessHitAreaMap(result),
      outfits: guessOutfits(result),
      morphSliders,
      parameterPresets: defaultPresets(morphSliders),
      sounds: { emotions: {}, actions: {} },
      dialogues: { emotions: {}, actions: {} },
      defaultView: { scale: 0.25, x: 0, y: 20 },
      blobUrls: result.blobUrls,
      isBuiltIn: false,
      createdAt: Date.now(),
    };
    register(profile);
    setActive(profile.id);
    setProfile(profile);

    // 초기화 (다음 업로드 대비)
    setResult(null);
    setName("");
    setDescription("");
    if (inputRef.current) inputRef.current.value = "";
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
          <button
            type="button"
            onClick={commit}
            className="border border-dashed border-green-700 bg-green-100/70 px-3 py-1 text-xs tracking-widest uppercase text-green-900"
          >
            [라이브러리에 등록하고 로드]
          </button>
        </div>
      )}
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
