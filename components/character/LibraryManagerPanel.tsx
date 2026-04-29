"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { captureLive2DThumbnail } from "@/lib/live2d/thumbnailCapture";
import {
  getTrackingPreference,
  savePreferredCharacter,
  saveTrackingPreference,
} from "@/lib/supabase/characterPreferences";
import { uploadCharacterThumbnail } from "@/lib/supabase/characterStorage";
import { useAuthUser } from "@/lib/supabase/useAuthUser";
import { useCharacterLibraryStore } from "@/store/useCharacterLibraryStore";
import { useCharacterStore } from "@/store/useCharacterStore";
import {
  ALL_ACTIONS,
  ALL_EMOTIONS,
  type CharacterEmotion,
  type DialogueMap,
  type CharacterProfile,
  type CharacterViewConfig,
} from "@/types/character";
import { CharacterUploadPreview } from "./CharacterUploader";

function parseNumberOr(value: string, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function linesToArray(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function arrayToLines(lines: string[] | undefined): string {
  return (lines ?? []).join("\n");
}

function cloneDialogues(dialogues: DialogueMap): DialogueMap {
  return {
    emotions: Object.fromEntries(
      Object.entries(dialogues.emotions).map(([key, value]) => [key, [...(value ?? [])]])
    ),
    actions: Object.fromEntries(
      Object.entries(dialogues.actions).map(([key, value]) => [key, [...(value ?? [])]])
    ),
  };
}

function isSameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export default function LibraryManagerPanel({ initialTargetId }: { initialTargetId?: string }) {
  const router = useRouter();
  const authUser = useAuthUser();
  const profiles = useCharacterLibraryStore((s) => s.profiles);
  const activeId = useCharacterLibraryStore((s) => s.activeId);
  const setActive = useCharacterLibraryStore((s) => s.setActive);
  const updateProfile = useCharacterLibraryStore((s) => s.updateProfile);

  const loadedProfile = useCharacterStore((s) => s.profile);
  const setLoadedProfile = useCharacterStore((s) => s.setProfile);
  const setModelConfig = useCharacterStore((s) => s.setModelConfig);
  const emotion = useCharacterStore((s) => s.emotion);
  const isTracking = useCharacterStore((s) => s.isTracking);
  const setEmotion = useCharacterStore((s) => s.setEmotion);
  const setTracking = useCharacterStore((s) => s.setTracking);

  const [targetId, setTargetId] = useState<string>("");
  const [thumbnailBusy, setThumbnailBusy] = useState(false);
  const [thumbnailError, setThumbnailError] = useState<string | null>(null);
  const [previewMessage, setPreviewMessage] = useState<string | null>(null);
  const [trackingOverrides, setTrackingOverrides] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<{ kind: "success" | "error"; text: string } | null>(
    null
  );
  const [draftName, setDraftName] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [draftView, setDraftView] = useState<CharacterViewConfig>({
    scale: 0,
    x: 0,
    y: 0,
  });
  const [draftDialogues, setDraftDialogues] = useState<DialogueMap>({
    emotions: {},
    actions: {},
  });
  const previewCaptureRef = useRef<(() => Promise<Blob | null>) | null>(null);

  useEffect(() => {
    if (initialTargetId) {
      setTargetId(initialTargetId);
      return;
    }
    if (!targetId && activeId) {
      setTargetId(activeId);
      return;
    }
    if (!targetId && profiles.length > 0) {
      setTargetId(profiles[0].id);
    }
  }, [activeId, profiles, targetId, initialTargetId]);

  const target = useMemo(
    () => profiles.find((p) => p.id === targetId) ?? null,
    [profiles, targetId]
  );

  useEffect(() => {
    if (!target) return;
    setDraftName(target.name);
    setDraftDescription(target.description ?? "");
    setDraftView(target.defaultView);
    setDraftDialogues(cloneDialogues(target.dialogues));
  }, [target?.id]);

  const hasBasicDraftChanges =
    !!target &&
    (draftName !== target.name ||
      draftDescription !== (target.description ?? "") ||
      !isSameJson(draftView, target.defaultView));

  const hasDialogueDraftChanges =
    !!target && !isSameJson(draftDialogues, target.dialogues);

  const hasUnsavedChanges = hasBasicDraftChanges || hasDialogueDraftChanges;

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const handleDocumentClick = (event: MouseEvent) => {
      const targetElement = event.target;
      if (!(targetElement instanceof Element)) return;
      const anchor = targetElement.closest("a[href]");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      if (window.confirm("저장하지 않은 변경사항은 적용되지 않습니다. 페이지를 이동할까요?")) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
    };
    document.addEventListener("click", handleDocumentClick, true);
    return () => document.removeEventListener("click", handleDocumentClick, true);
  }, [hasUnsavedChanges]);

  if (profiles.length === 0) {
    return <Empty msg="등록된 캐릭터가 없습니다. 먼저 업로드 또는 기본 캐릭터를 로드하세요." />;
  }

  if (!target) {
    return <Empty msg="관리할 캐릭터를 선택해주세요." />;
  }

  const showToast = (kind: "success" | "error", text: string) => {
    setToast({ kind, text });
    setTimeout(() => {
      setToast((current) => (current?.text === text ? null : current));
    }, 2600);
  };

  const confirmDiscardIfNeeded = () => {
    if (!hasUnsavedChanges) return true;
    return window.confirm("저장하지 않은 변경사항은 적용되지 않습니다. 페이지를 이동할까요?");
  };

  const patchTarget = (patch: Partial<CharacterProfile>) => {
    updateProfile(target.id, patch);
    if (activeId === target.id && loadedProfile) {
      const next = { ...loadedProfile, ...patch };
      setLoadedProfile(next);
      if (patch.defaultView) setModelConfig(patch.defaultView);
    }
  };

  const updatePreviewView = (view: CharacterViewConfig) => {
    setDraftView(view);
  };

  const saveBasicDraft = () => {
    try {
      patchTarget({
        name: draftName,
        description: draftDescription || undefined,
        defaultView: draftView,
      });
      showToast("success", "기본 정보와 위치를 저장했습니다.");
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "저장에 실패했습니다.");
    }
  };

  const saveDialogueDraft = () => {
    try {
      patchTarget({ dialogues: draftDialogues });
      showToast("success", "상황별 대사를 저장했습니다.");
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "대사 저장에 실패했습니다.");
    }
  };

  const selectAndLoadCharacter = async (id: string) => {
    if (!confirmDiscardIfNeeded()) return;
    setTargetId(id);
    const next = profiles.find((p) => p.id === id);
    if (!next) return;
    // 새 프로필을 활성화하면 기존 캐릭터는 자동으로 교체된다.
    setActive(id);
    setLoadedProfile(next);
    setModelConfig(next.defaultView);
    setTracking(getTrackingPreference(authUser?.user_metadata, id, true));
    await savePreferredCharacter(id).catch((e) => {
      console.warn("[LibraryManagerPanel] preferred character save warning:", e);
      showToast("error", "기본 캐릭터 저장에 실패했습니다.");
    });
    router.push(`/library/${encodeURIComponent(id)}`);
  };

  const regenerateThumbnail = async () => {
    if (!target) return;
    setThumbnailBusy(true);
    setThumbnailError(null);
    try {
      const blob =
        (await previewCaptureRef.current?.()) ??
        (await captureLive2DThumbnail(target.modelPath, draftView));
      if (!blob) throw new Error("썸네일 이미지를 생성하지 못했습니다.");
      const thumbnailUrl = await uploadCharacterThumbnail(target.id, blob);
      patchTarget({ thumbnailUrl: `${thumbnailUrl}?v=${Date.now()}` });
      showToast("success", "썸네일을 저장했습니다.");
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setThumbnailError(message);
      showToast("error", message);
    } finally {
      setThumbnailBusy(false);
    }
  };

  const notify = (msg: string) => {
    setPreviewMessage(msg);
    useCharacterStore.getState().setMessage(msg);
    setTimeout(() => {
      setPreviewMessage((current) => (current === msg ? null : current));
      if (useCharacterStore.getState().message === msg) {
        useCharacterStore.getState().setMessage(null);
      }
    }, 3000);
  };

  const targetTracking = target
    ? trackingOverrides[target.id] ??
      (activeId === target.id
        ? isTracking
        : getTrackingPreference(authUser?.user_metadata, target.id, true))
    : true;

  return (
    <div className="space-y-3">
      {toast && (
        <div
          className={
            "fixed right-4 top-4 z-[80] border border-dashed px-3 py-2 text-xs shadow-sm " +
            (toast.kind === "success"
              ? "border-emerald-600 bg-emerald-50 text-emerald-800"
              : "border-red-600 bg-red-50 text-red-800")
          }
        >
          {toast.text}
        </div>
      )}
      {/* <div className="border border-dashed border-gray-400 bg-white/60 p-3">
        <div className="mb-2 text-[11px] tracking-widest uppercase text-gray-500">
          [통합 캐릭터 관리]
        </div>
        <select
          value={targetId}
          onChange={(e) => {
            void selectAndLoadCharacter(e.target.value);
          }}
          className="w-full border border-dashed border-gray-500 bg-white/80 px-2 py-1 text-xs"
        >
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.id})
            </option>
          ))}
        </select>
      </div> */}

      <Section title="미리보기 위치">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[340px_minmax(0,1fr)]">
          <CharacterUploadPreview
            key={target.id}
            modelUrl={target.modelPath}
            view={draftView}
            onViewChange={updatePreviewView}
            onCaptureReady={(capture) => {
              previewCaptureRef.current = capture;
            }}
            profile={target}
            emotion={emotion}
            message={previewMessage}
            viewCommitMode="end"
          />
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <label className="text-xs text-gray-700">
                이름
                <input
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  className="mt-1 w-full border border-dashed border-gray-500 bg-white/80 px-2 py-1"
                />
              </label>
              <label className="text-xs text-gray-700">
                소개
                <input
                  value={draftDescription}
                  onChange={(e) => setDraftDescription(e.target.value)}
                  className="mt-1 w-full border border-dashed border-gray-500 bg-white/80 px-2 py-1"
                />
              </label>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(["scale", "x", "y"] as const).map((key) => (
                <label key={key} className="text-xs text-gray-700">
                  {key}
                  <input
                    type="number"
                    step={key === "scale" ? "0.01" : "1"}
                    value={draftView[key]}
                    onChange={(e) =>
                      setDraftView({
                        ...draftView,
                        [key]: parseNumberOr(e.target.value, draftView[key]),
                      })
                    }
                    className="mt-1 w-full border border-dashed border-gray-500 bg-white/80 px-2 py-1"
                  />
                </label>
              ))}
            </div>
            <button
              type="button"
              onClick={saveBasicDraft}
              className="border border-dashed border-blue-500 bg-blue-50 px-2 py-1 text-[11px] tracking-widest uppercase text-blue-700"
            >
              [기본 정보 / 위치 저장]
            </button>
          </div>
        </div>
      </Section>

      <Section title="모델 컨트롤 (트래킹 / 알림 테스트)">
        <div className="space-y-3">
          {activeId !== target.id && (
            <button
              type="button"
              onClick={() => {
                void selectAndLoadCharacter(target.id);
              }}
              className="border border-dashed border-amber-600 bg-amber-50 px-2 py-1 text-[11px] tracking-widest uppercase text-amber-800"
            >
              [이 캐릭터를 먼저 LOAD]
            </button>
          )}
          <div className="border border-dashed border-gray-500 bg-white/40 p-3">
            <div className="mb-2 text-[11px] tracking-widest text-gray-500 uppercase">
              [감정 전환 · emotion = {emotion}]
            </div>
            <div className="flex flex-wrap gap-2">
              {ALL_EMOTIONS.map((e: CharacterEmotion) => (
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
          <div className="border border-dashed border-gray-500 bg-white/40 p-3">
            <div className="mb-2 text-[11px] tracking-widest text-gray-500 uppercase">
              [트래킹 / 알림 테스트]
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  const nextTracking = !targetTracking;
                  setTrackingOverrides((current) => ({
                    ...current,
                    [target.id]: nextTracking,
                  }));
                  if (activeId === target.id) {
                    setTracking(nextTracking);
                  }
                  void saveTrackingPreference(target.id, nextTracking).then(() => {
                    showToast("success", "트래킹 설정을 저장했습니다.");
                  }).catch((e) => {
                    const message = e instanceof Error ? e.message : "트래킹 저장에 실패했습니다.";
                    console.warn("[LibraryManagerPanel] tracking save warning:", e);
                    showToast("error", message);
                  });
                }}
                className={
                  "border border-dashed px-3 py-1 text-xs tracking-widest uppercase " +
                  (targetTracking
                    ? "border-green-600 bg-green-100/70 text-green-800"
                    : "border-gray-500 bg-gray-200/70 text-gray-600")
                }
              >
                [Tracking: {targetTracking ? "ON" : "OFF"}]
              </button>
              <button
                type="button"
                onClick={() => notify("새로운 댓글이 달렸어요!")}
                className="border border-dashed border-gray-600 bg-blue-100/70 px-3 py-1 text-xs tracking-widest uppercase"
              >
                [댓글 알림]
              </button>
              <button
                type="button"
                onClick={() => notify("쪽지가 도착했어요!")}
                className="border border-dashed border-gray-600 bg-blue-100/70 px-3 py-1 text-xs tracking-widest uppercase"
              >
                [쪽지 알림]
              </button>
              <button
                type="button"
                onClick={() => notify("다녀오셨어요? 환영해요!")}
                className="border border-dashed border-gray-600 bg-green-100/70 px-3 py-1 text-xs tracking-widest uppercase"
              >
                [로그인 (접속)]
              </button>
              <button
                type="button"
                onClick={() => notify("안녕히가세요! 또 봐요!")}
                className="border border-dashed border-gray-600 bg-red-100/70 px-3 py-1 text-xs tracking-widest uppercase"
              >
                [로그아웃]
              </button>
            </div>
          </div>
        </div>
      </Section>

      <Section title="썸네일">
        <div className="grid grid-cols-1 gap-3 border-t border-dashed border-gray-300 pt-3 md:grid-cols-[96px_minmax(0,1fr)]">
          <div
            className="flex w-24 items-center justify-center overflow-hidden border border-dashed border-gray-400 bg-white/70 text-[10px] text-gray-400"
            style={{ aspectRatio: "320 / 420" }}
          >
            {target.thumbnailUrl ? (
              <img
                src={target.thumbnailUrl}
                alt={`${target.name} thumbnail`}
                className="h-full w-full object-contain"
              />
            ) : (
              "NO THUMB"
            )}
          </div>
          <div className="space-y-2 text-xs text-gray-600">
            <button
              type="button"
              disabled={thumbnailBusy}
              onClick={() => {
                void regenerateThumbnail();
              }}
              className="border border-dashed border-emerald-600 bg-emerald-50 px-2 py-1 text-[11px] font-bold tracking-widest text-emerald-800 disabled:opacity-50"
            >
              {thumbnailBusy ? "[THUMBNAIL GENERATING...]" : "[현재 모델로 썸네일 생성]"}
            </button>
            <p className="text-[11px] text-gray-500">
              기본 위치(scale/x/y)를 기준으로 임시 Live2D 렌더를 만들고 Pixi extract로 PNG를 저장합니다.
            </p>
            {thumbnailError && (
              <p className="border border-dashed border-red-300 bg-red-50 px-2 py-1 text-[11px] text-red-600">
                {thumbnailError}
              </p>
            )}
          </div>
        </div>
      </Section>

      <Section title="상황별 대사">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <div className="text-[11px] tracking-widest uppercase text-gray-500">
              [감정별 대사 (줄바꿈 = 1개 대사)]
            </div>
            {ALL_EMOTIONS.map((emotion) => (
              <label key={emotion} className="block text-xs">
                <span className="mb-1 block font-mono">{emotion}</span>
                <textarea
                  value={arrayToLines(draftDialogues.emotions[emotion])}
                  onChange={(e) =>
                    setDraftDialogues({
                      ...draftDialogues,
                      emotions: {
                        ...draftDialogues.emotions,
                        [emotion]: linesToArray(e.target.value),
                      },
                    })
                  }
                  rows={3}
                  className="w-full border border-dashed border-gray-500 bg-white/80 px-2 py-1"
                />
              </label>
            ))}
          </div>
          <div className="space-y-2">
            <div className="text-[11px] tracking-widest uppercase text-gray-500">
              [액션별 대사 (줄바꿈 = 1개 대사)]
            </div>
            {ALL_ACTIONS.map((action) => (
              <label key={action} className="block text-xs">
                <span className="mb-1 block font-mono">{action}</span>
                <textarea
                  value={arrayToLines(draftDialogues.actions[action])}
                  onChange={(e) =>
                    setDraftDialogues({
                      ...draftDialogues,
                      actions: {
                        ...draftDialogues.actions,
                        [action]: linesToArray(e.target.value),
                      },
                    })
                  }
                  rows={3}
                  className="w-full border border-dashed border-gray-500 bg-white/80 px-2 py-1"
                />
              </label>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={saveDialogueDraft}
          className="border border-dashed border-blue-500 bg-blue-50 px-2 py-1 text-[11px] tracking-widest uppercase text-blue-700"
        >
          [상황별 대사 저장]
        </button>
      </Section>

      <div className="border border-dashed border-amber-500 bg-amber-50 p-3 text-xs text-amber-800">
        고급 매핑(표정/모션/히트영역/모핑/의상/사운드)은 추후 전문가용 페이지에서 제공될 예정입니다.
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2 border border-dashed border-gray-400 bg-white/60 p-3">
      <div className="text-[11px] tracking-widest uppercase text-gray-500">[{title}]</div>
      {children}
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return (
    <div className="border border-dashed border-gray-400 bg-white/40 p-3 text-xs text-gray-500">
      {msg}
    </div>
  );
}
