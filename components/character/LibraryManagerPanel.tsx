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
  CORE_EMOTIONS,
  getCharacterSupportedEmotions,
  type CharacterActionKey,
  type CharacterEmotion,
  type DialogueMap,
  type CharacterProfile,
  type CharacterViewConfig,
  type MotionRef,
  type CharacterScenarioMapping,
  type CharacterScenarioKey,
} from "@/types/character";
import { CharacterUploadPreview, type MotionPreviewRequest } from "./CharacterUploader";
import MappingPanel from "./MappingPanel";

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

const MANAGED_DIALOGUE_EMOTIONS: CharacterEmotion[] = CORE_EMOTIONS;
const MANAGED_DIALOGUE_ACTIONS: CharacterActionKey[] = [
  "attention",
  "greet",
  "typing",
  "cheer",
  "celebrate",
];

function compactDialogues(dialogues: DialogueMap): DialogueMap {
  const emotions: DialogueMap["emotions"] = {};
  for (const emotion of MANAGED_DIALOGUE_EMOTIONS) {
    const lines = dialogues.emotions[emotion]?.slice(0, 2);
    if (lines?.length) emotions[emotion] = lines;
  }

  const actions: DialogueMap["actions"] = {};
  for (const action of MANAGED_DIALOGUE_ACTIONS) {
    const lines = dialogues.actions[action]?.slice(0, 2);
    if (lines?.length) actions[action] = lines;
  }

  return { emotions, actions };
}

interface DialoguePreset {
  id: string;
  name: string;
  description: string;
  previewEmotion: CharacterEmotion;
  dialogues: DialogueMap;
}

const DIALOGUE_PRESETS: DialoguePreset[] = [
  {
    id: "friendly",
    name: "친근한",
    description: "처음 만난 사람에게도 편하게 다가가는 밝은 안내 톤",
    previewEmotion: "happy",
    dialogues: {
      emotions: {
        idle: ["필요하면 언제든 불러주세요.", "오늘은 어떤 작품을 찾아볼까요?", "잠깐 쉬어가도 괜찮아요."],
        happy: ["좋아요, 이 흐름 마음에 들어요.", "그거 괜찮은 선택이에요.", "같이 보니까 더 재밌네요."],
        sad: ["괜찮아요. 천천히 다시 보면 돼요.", "조금 막혀도 제가 옆에서 볼게요.", "오늘은 쉬운 것부터 해볼까요?"],
        angry: ["잠깐만요, 차분히 정리해볼게요.", "이건 한 번 더 확인해봐야겠어요.", "속상할 만해요. 같이 해결해봐요."],
        surprised: ["오, 이건 예상 밖인데요?", "새로운 소식이 있나 봐요.", "잠깐 확인해볼게요."],
        shy: ["조용히 도와드릴게요.", "조금 쑥스럽지만 열심히 해볼게요.", "필요한 만큼만 말할게요."],
        love: ["취향에 꽤 잘 맞을지도 몰라요.", "이 작품은 저장해둘 만해요.", "좋아하는 포인트가 보이네요."],
        wink: ["작은 힌트 하나 드릴게요.", "이건 체크해두면 좋아요.", "놓치지 않게 표시해둘게요."],
      },
      actions: {
        tap_head: ["불렀어요?", "네, 여기 있어요.", "무엇부터 볼까요?"],
        tap_other: ["필요한 게 있으면 말해주세요.", "작품을 같이 찾아볼까요?", "다음 행동을 골라볼게요."],
        attention: ["중요한 것부터 정리해볼게요.", "지금 볼 만한 걸 추려볼게요.", "알림을 확인해볼까요?"],
        cheer: ["좋아요, 계속 가봐요.", "지금 흐름 괜찮아요.", "조금만 더 하면 돼요."],
        thinking: ["잠깐 생각해볼게요.", "조건을 조금 좁혀볼까요?", "취향에 맞는 쪽으로 골라볼게요."],
        celebrate: ["축하해요!", "좋은 반응이네요.", "이건 기록해둘 만해요."],
        idle: ["대기 중이에요.", "필요하면 바로 도와드릴게요.", "편하게 둘러보세요."],
        greet: ["어서 오세요.", "오늘도 같이 찾아봐요.", "반가워요. 뭐부터 볼까요?"],
        typing: ["정리하는 중이에요.", "생각을 천천히 적어봐요.", "문장을 다듬어볼게요."],
        special: ["오늘의 추천을 골라볼까요?", "새로운 작품을 찾아볼게요.", "취향에 맞는 후보를 모아볼게요."],
      },
    },
  },
  {
    id: "casual",
    name: "반말",
    description: "가깝고 편한 친구처럼 말하는 캐주얼 톤",
    previewEmotion: "wink",
    dialogues: {
      emotions: {
        idle: ["필요하면 불러.", "오늘 뭐 볼래?", "나 여기서 기다리고 있을게."],
        happy: ["좋다, 이거 괜찮은데?", "오, 감 잡았네.", "이대로 가보자."],
        sad: ["괜찮아, 다시 보면 돼.", "막히면 내가 같이 봐줄게.", "천천히 해도 돼."],
        angry: ["잠깐 진정하고 다시 보자.", "이건 좀 이상한데? 확인해볼게.", "괜찮아, 하나씩 정리하자."],
        surprised: ["어? 이건 좀 의외다.", "오, 새 소식인가 봐.", "잠깐만, 바로 볼게."],
        shy: ["아, 알겠어. 조용히 도와줄게.", "조금 민망하지만 해볼게.", "필요한 만큼만 말할게."],
        love: ["이거 네 취향일 것 같은데?", "저장해두면 좋겠다.", "좋아하는 포인트 딱 보인다."],
        wink: ["힌트 하나 줄게.", "이건 체크해둬.", "놓치면 아까울걸?"],
      },
      actions: {
        tap_head: ["불렀어?", "응, 여기 있어.", "뭐부터 볼까?"],
        tap_other: ["필요한 거 말해줘.", "작품 같이 찾아볼까?", "다음엔 뭐 할래?"],
        attention: ["중요한 것부터 보자.", "지금 볼 만한 거 추려줄게.", "알림 확인해볼래?"],
        cheer: ["좋아, 계속 가자.", "지금 괜찮아.", "조금만 더 해보자."],
        thinking: ["잠깐 생각해볼게.", "조건을 좀 좁혀볼까?", "취향 맞는 쪽으로 골라볼게."],
        celebrate: ["축하해!", "반응 좋다.", "이건 기록해두자."],
        idle: ["대기 중이야.", "필요하면 바로 불러.", "편하게 둘러봐."],
        greet: ["왔어?", "오늘도 같이 찾아보자.", "반가워. 뭐부터 볼래?"],
        typing: ["정리 중이야.", "천천히 적어도 돼.", "문장 좀 다듬어볼게."],
        special: ["오늘 추천 골라볼까?", "새 작품 찾아볼게.", "취향 후보 모아볼게."],
      },
    },
  },
  {
    id: "cute",
    name: "귀여운",
    description: "짧고 말랑한 리액션이 많은 밝은 톤",
    previewEmotion: "happy",
    dialogues: {
      emotions: {
        idle: ["부르면 바로 올게요.", "오늘도 같이 놀듯이 찾아봐요.", "살짝 기다리는 중이에요."],
        happy: ["와아, 좋아요!", "이거 반짝반짝해요.", "기분 좋아지는 선택이에요."],
        sad: ["괜찮아요, 토닥토닥.", "천천히 다시 하면 돼요.", "제가 옆에서 응원할게요."],
        angry: ["으음, 이건 다시 봐야겠어요.", "잠깐만요. 차분히 살펴볼게요.", "속상한 건 제가 정리해볼게요."],
        surprised: ["앗, 깜짝이야!", "오잉? 새로 뭔가 왔어요.", "이건 빨리 봐야겠어요."],
        shy: ["헤헤, 조용히 도울게요.", "조금 부끄럽지만 해볼게요.", "살짝만 말해볼게요."],
        love: ["이거 취향 저격일지도요.", "마음에 쏙 들 것 같아요.", "소중히 저장해둘까요?"],
        wink: ["비밀 힌트 하나예요.", "여기 체크하면 좋아요.", "살짝 알려드릴게요."],
      },
      actions: {
        tap_head: ["네에?", "불렀나요?", "제가 왔어요."],
        tap_other: ["필요한 거 있나요?", "같이 찾아봐요.", "다음 버튼은 제가 봐둘게요."],
        attention: ["중요한 것부터 콕 집어볼게요.", "볼 만한 것만 쏙쏙 고를게요.", "알림을 살짝 확인해볼까요?"],
        cheer: ["할 수 있어요!", "좋아요, 반짝!", "조금만 더 가봐요."],
        thinking: ["음음, 생각 중이에요.", "조건을 쪼끔만 좁혀볼까요?", "어울리는 걸 찾아볼게요."],
        celebrate: ["축하해요, 짝짝!", "좋은 일이에요.", "기록해두면 뿌듯하겠어요."],
        idle: ["얌전히 기다리는 중이에요.", "필요하면 콕 불러주세요.", "편하게 구경하세요."],
        greet: ["어서 와요.", "오늘도 반가워요.", "뭐부터 볼까요?"],
        typing: ["끄적끄적 정리 중이에요.", "천천히 적어봐요.", "예쁘게 다듬어볼게요."],
        special: ["오늘의 추천을 뽑아볼게요.", "새 작품을 데려올게요.", "취향 후보를 모아둘게요."],
      },
    },
  },
  {
    id: "tsundere",
    name: "츤데레",
    description: "무심한 척하지만 결국 챙겨주는 가벼운 츤데레 톤",
    previewEmotion: "shy",
    dialogues: {
      emotions: {
        idle: ["딱히 기다린 건 아니고요.", "필요하면 말하세요. 바쁘진 않으니까요.", "혼자 헤매면 오래 걸릴 텐데요."],
        happy: ["뭐, 나쁘진 않네요.", "그 정도면 꽤 괜찮아요.", "이번 선택은 인정해드릴게요."],
        sad: ["그렇게 풀이 죽을 일은 아니에요.", "다시 보면 되죠. 제가 봐드릴게요.", "실수해도 끝난 건 아니니까요."],
        angry: ["잠깐, 감정적으로 넘기지 마세요.", "이건 제가 정리해볼게요.", "성급하게 판단하면 손해예요."],
        surprised: ["어라, 이건 예상 못 했네요.", "흠, 새 소식인가 봐요.", "확인 정도는 해드릴게요."],
        shy: ["고맙다는 말은 됐어요.", "그냥 도와드린 것뿐이에요.", "너무 기대하진 말고요."],
        love: ["취향에 맞을 수도 있겠네요.", "저장해두든 말든 자유지만요.", "놓치면 조금 아까울지도요."],
        wink: ["힌트예요. 특별히요.", "이건 체크해두세요.", "제가 말 안 했다고 하진 마세요."],
      },
      actions: {
        tap_head: ["왜요?", "불렀으면 용건을 말하세요.", "뭐가 필요한데요?"],
        tap_other: ["필요하면 말하세요.", "작품 정도는 찾아드릴게요.", "다음 행동은 빨리 고르세요."],
        attention: ["중요한 것부터 보죠.", "쓸 만한 것만 골라드릴게요.", "알림 확인 정도는 해볼게요."],
        cheer: ["이 정도는 할 수 있잖아요.", "조금만 더 해보세요.", "포기하기엔 이르죠."],
        thinking: ["잠깐 생각 중이에요.", "조건이 너무 넓어요. 좁혀보죠.", "취향에 맞는 걸 골라보겠습니다."],
        celebrate: ["축하해요. 뭐, 잘했네요.", "반응이 괜찮네요.", "기록해둘 가치는 있겠어요."],
        idle: ["대기 중이에요. 딱히 심심한 건 아니고요.", "필요하면 부르세요.", "편하게 보세요."],
        greet: ["왔네요.", "오늘도 찾아보긴 할 건가요?", "반가워요. 뭐부터 볼 거죠?"],
        typing: ["문장 정리 중이에요.", "천천히 쓰세요. 제가 보고 있을게요.", "조금 다듬어드릴게요."],
        special: ["추천 정도는 골라드릴게요.", "새 작품을 찾아보죠.", "취향 후보를 모아둘게요."],
      },
    },
  },
];

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
  const [previewExpressionId, setPreviewExpressionId] = useState<string | null>(null);
  const [previewExpressionNonce, setPreviewExpressionNonce] = useState(0);
  const [motionPreviewRequest, setMotionPreviewRequest] = useState<MotionPreviewRequest | null>(null);
  const [latestHitAreas, setLatestHitAreas] = useState<string[]>([]);
  const [trackingOverrides, setTrackingOverrides] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<{ kind: "success" | "error"; text: string } | null>(
    null
  );
  const [draftName, setDraftName] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [draftView, setDraftView] = useState<CharacterViewConfig>({
    scale: 0.05,
    x: 0,
    y: 20,
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
    setDraftDialogues(compactDialogues(target.dialogues));
    setPreviewExpressionId(null);
    setPreviewExpressionNonce(0);
    setMotionPreviewRequest(null);
    setLatestHitAreas([]);
  }, [target?.id]);

  const hasBasicDraftChanges =
    !!target &&
    (draftName !== target.name ||
      draftDescription !== (target.description ?? "") ||
      !isSameJson(draftView, target.defaultView));

  const hasDialogueDraftChanges =
    !!target && !isSameJson(draftDialogues, target.dialogues);

  const hasUnsavedChanges = hasBasicDraftChanges || hasDialogueDraftChanges;

  const codeEmotionKeys = new Set(ALL_EMOTIONS);
  const codeActionKeys = new Set(ALL_ACTIONS);
  const isEmotionUnsupported = (emotionKey: CharacterEmotion) =>
    !codeEmotionKeys.has(emotionKey);
  const isActionUnsupported = (actionKey: CharacterActionKey) =>
    !codeActionKeys.has(actionKey);
  const dialogueTextareaClass = (unsupported: boolean) =>
    [
      "w-full border border-dashed bg-white/80 px-2 py-1",
      unsupported ? "border-red-500 bg-red-50/70" : "border-gray-500",
    ].join(" ");

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
      patchTarget({ dialogues: compactDialogues(draftDialogues) });
      showToast("success", "기본 반응 대사를 저장했습니다.");
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

  const notify = (
    msg: string,
    emotion: CharacterEmotion = "happy",
    scenarioKey?: CharacterScenarioKey
  ) => {
    const store = useCharacterStore.getState();
    const scenarioMapping = scenarioKey ? store.profile?.scenarioMap?.[scenarioKey] : null;
    setPreviewExpressionId(null);
    setPreviewMessage(msg);
    store.setMessage(msg);
    if (scenarioKey) {
      store.triggerScenario(scenarioKey);
    }
    if (!scenarioMapping?.expressionId) {
      store.setEmotion(emotion);
    }
    setTimeout(() => {
      setPreviewMessage((current) => (current === msg ? null : current));
      const nextStore = useCharacterStore.getState();
      if (nextStore.message === msg) {
        nextStore.setMessage(null);
        nextStore.triggerScenario("idle_return");
        if (!nextStore.profile?.scenarioMap?.idle_return?.expressionId) {
          nextStore.setEmotion("idle");
        }
      }
    }, 3000);
  };

  const previewExpression = (expressionId: string) => {
    const message = `표정 미리보기: ${expressionId}`;
    setPreviewExpressionId(expressionId);
    setPreviewExpressionNonce(Date.now());
    setPreviewMessage(message);
    setTimeout(() => {
      setPreviewMessage((current) => (current === message ? null : current));
    }, 2200);
  };

  const previewMotion = (motion: MotionRef) => {
    const message = `모션 재생: ${motion.group || "(default)"} #${motion.index}`;
    setPreviewMessage(message);
    setMotionPreviewRequest({
      group: motion.group,
      index: motion.index,
      nonce: Date.now(),
    });
    setTimeout(() => {
      setPreviewMessage((current) => (current === message ? null : current));
    }, 2200);
  };

  const previewScenario = (scenario: CharacterScenarioMapping, label: string) => {
    const message = `상황 미리보기: ${label}`;
    setPreviewExpressionId(scenario.expressionId ?? null);
    setPreviewExpressionNonce(Date.now());
    const motion = scenario.motion ?? target?.motionMap.idle ?? null;
    if (motion) {
      setMotionPreviewRequest({
        group: motion.group,
        index: motion.index,
        nonce: Date.now(),
      });
    }
    setPreviewMessage(message);
    setTimeout(() => {
      setPreviewMessage((current) => (current === message ? null : current));
    }, 2400);
  };

  const applyDialoguePreset = (preset: DialoguePreset) => {
    const nextDialogues = compactDialogues(preset.dialogues);
    setDraftDialogues(cloneDialogues(nextDialogues));
    showToast("success", `${preset.name} 대사 프리셋을 적용했습니다. 저장을 눌러 반영하세요.`);
    notify(nextDialogues.emotions[preset.previewEmotion]?.[0] ?? preset.name, preset.previewEmotion);
  };

  const handleRealNotify = async (type: "COMMENT" | "MESSAGE") => {
    if (!authUser?.id) {
      notify("로그인이 필요합니다.", "sad");
      return;
    }

    const { fetchNotifications } = await import("@/lib/community/notifications");
    const notifs = await fetchNotifications(authUser.id, 50);

    const NOTIFICATION_EMOTIONS: Record<string, CharacterEmotion> = {
      COMMENT: "happy",
      REPLY: "happy",
      REACTION: "wink",
      FOLLOW: "love",
      HOT_PROMOTED: "surprised",
      SYSTEM: "idle",
    };
    const NOTIFICATION_SCENARIOS: Record<string, CharacterScenarioKey> = {
      COMMENT: "notification",
      REPLY: "notification",
      REACTION: "notification",
      FOLLOW: "notification",
      HOT_PROMOTED: "notification",
      SYSTEM: "notification",
    };

    let target: any;
    if (type === "COMMENT") {
      target = notifs.find((n) => n.type === "COMMENT" || n.type === "REPLY");
    } else {
      target = notifs.find((n) => n.type === "SYSTEM");
    }

    if (target) {
      notify(
        target.content,
        NOTIFICATION_EMOTIONS[target.type] || "happy",
        NOTIFICATION_SCENARIOS[target.type] ?? "notification"
      );
    } else {
      notify(
        type === "COMMENT" ? "최근 댓글 알림이 없습니다." : "최근 쪽지 알림이 없습니다.",
        "idle",
        "notification"
      );
    }
  };

  const targetTracking = target
    ? trackingOverrides[target.id] ??
      (activeId === target.id
        ? isTracking
        : getTrackingPreference(authUser?.user_metadata, target.id, true))
    : true;
  const supportedPreviewEmotions = getCharacterSupportedEmotions(target, {
    includeOptional: true,
  });

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

      <Section title="미리보기 / 상황 매핑">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[340px_minmax(0,1fr)]">
          <div className="space-y-3 lg:sticky lg:top-4 lg:self-start">
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
              previewExpressionId={previewExpressionId}
              previewExpressionNonce={previewExpressionNonce}
              motionPreviewRequest={motionPreviewRequest}
              onHitAreas={(hitAreas) => setLatestHitAreas(hitAreas)}
              message={previewMessage}
              viewCommitMode="end"
            />
            <div className="border border-dashed border-gray-300 bg-white/50 p-2 text-[11px] text-gray-600">
              최근 클릭 HitArea: {latestHitAreas.length > 0 ? latestHitAreas.join(", ") : "(아직 없음)"}
            </div>
            <div className="space-y-2 border border-dashed border-gray-300 bg-white/50 p-2">
              <div className="grid grid-cols-1 gap-2">
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
          <div className="space-y-2">
            <MappingPanel
              profile={target}
              onPatch={patchTarget}
              onPreviewExpression={previewExpression}
              onPreviewMotion={previewMotion}
              onPreviewScenario={previewScenario}
              highlightedHitAreaIds={latestHitAreas}
            />
            <p className="text-[11px] leading-4 text-gray-500">
              상황별로 표정과 액션을 한 번에 매핑합니다. `[미리보기]`를 누르면 왼쪽 모델에서 바로 확인할 수 있습니다.
            </p>
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
              {supportedPreviewEmotions.map((e: CharacterEmotion) => (
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
                onClick={() => handleRealNotify("COMMENT")}
                className="border border-dashed border-gray-600 bg-blue-100/70 px-3 py-1 text-xs tracking-widest uppercase"
              >
                [댓글 알림]
              </button>
              <button
                type="button"
                onClick={() => handleRealNotify("MESSAGE")}
                className="border border-dashed border-gray-600 bg-blue-100/70 px-3 py-1 text-xs tracking-widest uppercase"
              >
                [쪽지 알림]
              </button>
              <button
                type="button"
                onClick={() => notify("다녀오셨어요? 환영해요!", "happy", "login")}
                className="border border-dashed border-gray-600 bg-green-100/70 px-3 py-1 text-xs tracking-widest uppercase"
              >
                [로그인 (접속)]
              </button>
              <button
                type="button"
                onClick={() => notify("안녕히가세요! 또 봐요!", "sad", "logout")}
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

      <Section title="기본 반응 대사">
        <div className="space-y-2 border border-dashed border-gray-300 bg-white/40 p-3">
          <div className="text-[11px] tracking-widest uppercase text-gray-500">
            [톤 프리셋]
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
            {DIALOGUE_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyDialoguePreset(preset)}
                className="min-h-20 border border-dashed border-gray-500 bg-white/80 px-3 py-2 text-left hover:border-blue-500 hover:bg-blue-50"
                title={preset.description}
              >
                <span className="block text-xs font-bold text-gray-900">[{preset.name}]</span>
                <span className="mt-1 block text-[11px] leading-4 text-gray-600">
                  {preset.description}
                </span>
              </button>
            ))}
          </div>
          <p className="text-[11px] leading-4 text-gray-500">
            여기서는 전역 기본 반응만 관리합니다. 페이지 입장 대사는 나중에 페이지별 프리셋에서 따로 관리합니다.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <div className="text-[11px] tracking-widest uppercase text-gray-500">
              [공통 감정 대사 (최대 2줄)]
            </div>
            {MANAGED_DIALOGUE_EMOTIONS.map((emotion) => (
              <label key={emotion} className="block text-xs">
                <span className="mb-1 flex items-center justify-between gap-2 font-mono">
                  <span>{emotion}</span>
                  {isEmotionUnsupported(emotion) && (
                    <span className="font-sans text-[10px] text-red-600">코드 키 없음</span>
                  )}
                </span>
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
                  className={dialogueTextareaClass(isEmotionUnsupported(emotion))}
                />
              </label>
            ))}
          </div>
          <div className="space-y-2">
            <div className="text-[11px] tracking-widest uppercase text-gray-500">
              [공통 액션 대사 (최대 2줄)]
            </div>
            {MANAGED_DIALOGUE_ACTIONS.map((action) => (
              <label key={action} className="block text-xs">
                <span className="mb-1 flex items-center justify-between gap-2 font-mono">
                  <span>{action}</span>
                  {isActionUnsupported(action) && (
                    <span className="font-sans text-[10px] text-red-600">코드 키 없음</span>
                  )}
                </span>
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
                  className={dialogueTextareaClass(isActionUnsupported(action))}
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
          [기본 반응 대사 저장]
        </button>
      </Section>

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
