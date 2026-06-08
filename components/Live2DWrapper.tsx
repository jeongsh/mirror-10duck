"use client";

import { Children, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, ReactNode, RefObject } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Application, Ticker } from "pixi.js";
import { Live2DModel, MotionPriority } from "@naari3/pixi-live2d-display";
import { LIVE2D_VIEWPORT } from "@/lib/live2d/viewport";
import { useCharacterStore } from "@/store/useCharacterStore";
import type { CharacterActionKey, CharacterScenarioKey, MotionRef } from "@/types/character";
import { supabase } from "@/lib/supabase/client";
import { useAuthUser } from "@/lib/supabase/useAuthUser";
import { formatDateTime, getCalendarEvents } from "@/lib/otaku/hub";
import {
  ASSISTANT_SLOT_DEFINITIONS,
  getGuestAssistantSlots,
  getAssistantSlots,
  type AssistantSlotDefinition,
  type AssistantSlotKey,
} from "@/lib/assistant/slots";
import { fetchTodayActivitySummary, summarizeTodayActivity } from "@/lib/community/today";
import { fetchUnrepliedQueue, summarizeUnreplied } from "@/lib/community/unreplied";
import { fetchMissionBoard, summarizeMissionBoard } from "@/lib/community/missions";
import {
  LIVE2D_NOTIFICATION_TYPES,
  fetchUserNotificationSettings,
  markAllAsRead,
  type NotificationType,
} from "@/lib/community/notifications";
import {
  useUnreadNotificationNotice,
} from "@/lib/community/useUnreadNotificationCount";
import { saveLive2DEnabledPreference } from "@/lib/supabase/characterPreferences";
import { fetchFollowedOfficialWorkTitles } from "@/lib/supabase/officialWorkFollows";

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

const ASSISTANT_PROMPTS_AUTH = [
  "불렀어요? 필요한 것부터 같이 골라봐요.",
  "여기 있어요. 지금 뭐가 제일 궁금해요?",
  "옆에서 거들게요. 어디부터 도와드릴까요?",
  "지금 흐름에서 뭘 먼저 볼지 같이 정해봐요.",
];
const ASSISTANT_PROMPTS_GUEST = [
  "처음이면 가볍게 둘러보는 것부터 도와드릴게요.",
  "부담 갖지 말고, 궁금한 것부터 같이 봐요.",
  "둘러보기 모드예요. 어디부터 구경해볼까요?",
  "천천히 봐도 돼요. 제가 길잡이 해드릴게요.",
];

function pickRandomLine(lines: string[]): string {
  return lines[Math.floor(Math.random() * lines.length)] ?? "";
}

function isEditableElementFocused(): boolean {
  if (typeof document === "undefined") return false;
  const el = document.activeElement;
  if (!el) return false;
  if (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement
  ) {
    return true;
  }
  return el instanceof HTMLElement && el.isContentEditable;
}

function isComposePage(pathname: string): boolean {
  return pathname.includes("/write");
}

const ASSISTANT_LOADING_MESSAGE = "\ud655\uc778 \uc911\uc774\uc5d0\uc694.";
const ASSISTANT_RESPONSE_DURATION_MS = 4500;

// 말풍선 버튼 공통 스타일. `live2d-rise` 로 순차 등장, hover/누름 마이크로 인터랙션 포함.
const ASSISTANT_BUTTON_PRIMARY =
  "live2d-rise inline-flex items-center rounded-full border border-pink-200 bg-pink-50 px-3 py-1.5 text-[11px] font-semibold text-pink-700 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-pink-300 hover:bg-pink-100 hover:shadow active:translate-y-0 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-300 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-sm";
const ASSISTANT_BUTTON_GHOST =
  "live2d-rise inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-medium text-gray-500 transition-all duration-150 hover:-translate-y-0.5 hover:bg-gray-100 hover:text-gray-700 active:translate-y-0 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-300 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0";

const PAGE_DIALOGUE_PRESETS: {
  match: (pathname: string) => boolean;
  guestLines: string[];
  authLines: string[];
}[] = [
  {
    match: (pathname) => pathname === "/",
    guestLines: [
      "지금은 둘러보기 모드예요. 마음에 드는 채널부터 살짝 열어볼까요?",
      "로그인하지 않아도 분위기는 볼 수 있어요. 저장과 활동 기록은 로그인 후에 이어져요.",
      "처음 왔다면 실시간 베스트부터 보면 커뮤니티 결이 빨리 보여요.",
      "아직 계정이 없어도 괜찮아요. 먼저 어떤 글이 오가는지 감만 잡아봐요.",
      "제가 너무 앞서가진 않을게요. 궁금한 메뉴만 골라서 안내할게요.",
    ],
    authLines: [
      "오늘 커뮤니티 흐름이 꽤 빠르게 바뀌고 있어요. 베스트부터 훑어볼까요?",
      "읽을 만한 글과 답장할 만한 반응을 나눠서 챙겨볼게요.",
      "오늘 들어온 반응이 있으면 제가 놓치지 않게 옆에서 정리해둘게요.",
      "지금은 홈이에요. 새 글, 미션, 알림 중 먼저 처리할 걸 골라봐요.",
      "잠깐만 봐도 괜찮아요. 필요한 것만 제가 짧게 추려드릴게요.",
    ],
  },
  {
    match: (pathname) => pathname === "/feed",
    guestLines: [
      "피드는 로그인 후 팔로우한 채널을 모아보는 곳이에요. 지금은 채널을 먼저 골라볼까요?",
      "관심 채널을 정해두면 다음부터 여기에 새 글이 모여요.",
      "아직 피드가 비어 보여도 정상이에요. 로그인 후 팔로우가 쌓이면 여기가 살아나요.",
    ],
    authLines: [
      "팔로우한 채널 새 글을 모아뒀어요. 놓친 것부터 볼까요?",
      "여긴 내가 고른 흐름만 모이는 곳이에요. 답장할 글도 같이 챙겨볼게요.",
      "피드가 너무 많으면 반응 많은 글부터 먼저 보는 게 좋아요.",
      "새 글을 다 보지 않아도 괜찮아요. 중요한 반응부터 잡아볼게요.",
    ],
  },
  {
    match: (pathname) => pathname.startsWith("/board/") && pathname.includes("/write"),
    guestLines: [
      "글쓰기는 로그인 후 가능해요. 먼저 어떤 말머리가 잘 맞는지 둘러볼까요?",
      "작성은 잠겨 있지만, 분위기를 보고 나중에 이어 쓰면 좋아요.",
    ],
    authLines: [
      "쓰기 전에 스포일러 여부랑 말머리부터 정하면 반응이 덜 엇갈려요.",
      "제목은 짧게, 본문은 핵심부터. 막히면 제가 임시저장 쪽도 챙겨볼게요.",
      "작성 중에는 제가 크게 끼어들지 않고 필요한 것만 살짝 알려드릴게요.",
      "글이 길어질 것 같으면 첫 문장에 결론을 먼저 놓는 게 좋아요.",
      "댓글 싸움으로 번질 만한 표현은 한 번만 순하게 바꿔볼까요?",
    ],
  },
  {
    match: (pathname) => pathname.startsWith("/board/"),
    guestLines: [
      "이 채널은 로그인 전에도 읽을 수 있어요. 댓글과 내 활동은 로그인 후 이어져요.",
      "처음 보는 채널이면 최신글보다 반응 많은 글부터 보는 게 감 잡기 좋아요.",
    ],
    authLines: [
      "이 채널의 최신 흐름을 보고 있어요. 답장할 만한 글이 있으면 제가 표시해둘게요.",
      "말머리별로 분위기가 달라요. 지금은 제목과 반응 수를 같이 보면 좋아요.",
      "댓글을 달기 전에 스포일러 표시가 필요한 글인지 한 번만 확인해요.",
      "처음 보는 글이면 본문보다 댓글 흐름을 먼저 보는 것도 방법이에요.",
      "반응이 뜨거운 글은 맥락을 놓치기 쉬워요. 원문부터 천천히 볼까요?",
    ],
  },
  {
    match: (pathname) => pathname.startsWith("/profile"),
    guestLines: [
      "프로필은 로그인 후 내 캐릭터와 활동 기록이 같이 쌓이는 공간이에요.",
      "기본 캐릭터 체험은 여기서 끝나지 않아요. 로그인하면 내 설정으로 저장돼요.",
    ],
    authLines: [
      "프로필과 대표 캐릭터를 같이 정리해볼까요?",
      "오늘 활동 기록과 캐릭터 표시가 어색한 곳이 없는지 같이 볼게요.",
      "프로필은 내가 어떤 흐름으로 활동했는지 보여주는 공간이에요.",
      "대표 캐릭터 썸네일이 마음에 안 들면 다시 생성해도 좋아요.",
    ],
  },
  {
    match: (pathname) => pathname.startsWith("/works"),
    guestLines: [
      "작품 정보는 먼저 둘러보고, 관심작 저장은 로그인 후 이어갈 수 있어요.",
      "궁금한 작품을 열어보면 이 서비스가 어떤 식으로 정리하는지 보일 거예요.",
    ],
    authLines: [
      "작품 정보를 보고 있어요. 관심작으로 남길 만한지 같이 체크해볼까요?",
      "리뷰와 소식을 분리해서 보면 스포일러를 피하기 쉬워요.",
    ],
  },
  {
    match: (pathname) => pathname.startsWith("/news"),
    guestLines: [
      "뉴스는 로그인 전에도 볼 수 있어요. 관심작 알림은 로그인하면 제가 챙겨드릴게요.",
      "공식 소식 위주로 먼저 보면 헷갈리는 정보가 줄어요.",
    ],
    authLines: [
      "새 소식부터 확인해볼까요? 관심작과 겹치는 건 제가 더 눈여겨볼게요.",
      "공식 발표와 커뮤니티 반응은 따로 보는 게 좋아요.",
      "뉴스는 제목만 보고 넘기기 쉬워요. 관심작이면 본문까지 열어볼게요.",
      "새 소식이 많을 땐 공식 일정 변경부터 먼저 보는 게 안전해요.",
    ],
  },
  {
    match: (pathname) => pathname.startsWith("/releases"),
    guestLines: [
      "신작 일정은 먼저 둘러보고, 관심작 알림은 로그인 후 받을 수 있어요.",
      "방영일이 가까운 작품부터 보면 지금 시즌 분위기가 보여요.",
    ],
    authLines: [
      "관심 신작 알림을 확인해볼까요? 일정 변경도 같이 볼게요.",
      "이번 주 볼 작품과 나중에 챙길 작품을 나눠두면 편해요.",
      "신작은 첫 화 반응과 방영 시간을 같이 보면 선택이 쉬워져요.",
      "관심작으로 남겨두면 다음에 제가 새 소식부터 챙겨드릴게요.",
    ],
  },
  {
    match: (pathname) => pathname.startsWith("/calendar"),
    guestLines: [
      "캘린더는 전체 일정을 보는 곳이에요. 내 관심작만 추리는 건 로그인 후 가능해요.",
      "오늘 일정부터 보면 서비스가 어떤 식으로 챙겨주는지 바로 보여요.",
    ],
    authLines: [
      "오늘 볼 일정부터 확인해볼까요? 관심작만 추려볼 수 있어요.",
      "이번 주 일정이 몰려 있으면 제가 먼저 중요한 것부터 정리해볼게요.",
      "달력에서 놓치기 쉬운 건 오늘 밤 일정이에요. 먼저 확인해볼까요?",
      "관심작이 많아지면 전체 달력보다 내 일정만 보는 게 훨씬 편해요.",
    ],
  },
  {
    match: (pathname) => pathname.startsWith("/reviews"),
    guestLines: [
      "리뷰를 볼 때는 스포일러 표시부터 확인해요. 처음이면 짧은 평가부터 보세요.",
      "로그인하면 내가 본 작품과 관심작 기준으로 더 잘 골라볼 수 있어요.",
    ],
    authLines: [
      "리뷰를 볼 때 스포일러 표시를 먼저 확인해요.",
      "평가 포인트를 작품 정보와 같이 보면 판단이 더 쉬워요.",
    ],
  },
];

const NOTIFICATION_SCENARIOS: Record<string, CharacterScenarioKey> = {
  COMMENT: "notification",
  REPLY: "notification",
  REACTION: "notification",
  FOLLOW: "notification",
  MENTION: "notification",
  HOT_PROMOTED: "notification",
  SYSTEM: "notification",
  RELEASE: "notification",
};

interface MotionFileMeta {
  durationMs: number;
  loop: boolean;
}

interface SpeechAnchor {
  x: number;
  y: number;
}

type AssistantActionKey = AssistantSlotKey;
type WhatNowMood = "light" | "immersive" | "reaction";
type WhatNowTime = "short" | "medium" | "long";
type WorkRecommendationDetail = "funny" | "healing" | "episodic" | "world" | "strategy" | "emotion" | "season" | "community" | "safe";
type WorkRecommendationLength = "short" | "standard" | "long";
type WorkRecommendationIntensity = "soft" | "balanced" | "strong";
type WorkRecommendationResult = {
  title: string;
  items: string[];
  reason: string;
  filteredCount: number;
};
type WhatNowFlow =
  | { step: "mood"; source: "what_now" | "work_recommendation" }
  | { step: "time"; source: "what_now"; mood: WhatNowMood }
  | { step: "work_detail"; source: "work_recommendation"; mood: WhatNowMood }
  | { step: "work_length"; source: "work_recommendation"; mood: WhatNowMood; detail: WorkRecommendationDetail }
  | { step: "work_intensity"; source: "work_recommendation"; mood: WhatNowMood; detail: WorkRecommendationDetail; length: WorkRecommendationLength }
  | { step: "work_result"; source: "work_recommendation"; mood: WhatNowMood; detail: WorkRecommendationDetail; length: WorkRecommendationLength; intensity: WorkRecommendationIntensity; result: WorkRecommendationResult };

const LIVE2D_BUBBLE_COOLDOWN_GLOBAL_MS = 60 * 1000;
const LIVE2D_BUBBLE_COOLDOWN_PER_TYPE_MS = 5 * 60 * 1000;
const CHARACTER_POINTER_FALLBACK_DELAY_MS = 80;
const CHARACTER_POINTER_BOUNDS_PADDING = 24;
// 말풍선이 한 글자씩 "말하듯" 찍히는 속도(글자당 ms).
const SPEECH_TYPING_SPEED_MS = 28;
// 자동 닫힘 전 최소/최대 노출 시간.
const SPEECH_MIN_DURATION_MS = 2600;
const SPEECH_MAX_DURATION_MS = 8000;
const SPEECH_ACTION_READ_MS = 1000;

/**
 * 문장 길이에 맞춰 말풍선의 타이핑/읽기 시간을 계산한다.
 * - 타이핑 애니메이션 시간 + 읽는 시간을 합산해, 짧은 대사는 가볍게 지나가고
 *   긴 대사는 충분히 머무르도록 자연스러운 호흡을 준다.
 */
function estimateSpeechTiming(text: string): { typingMs: number; readingMs: number; durationMs: number } {
  const length = text.trim().length;
  const typingMs = length * SPEECH_TYPING_SPEED_MS;
  const readingMs = 1100 + length * 55;
  const durationMs = Math.min(Math.max(typingMs + readingMs, SPEECH_MIN_DURATION_MS), SPEECH_MAX_DURATION_MS);
  return { typingMs, readingMs, durationMs };
}

function estimateSpeechDuration(text: string): number {
  return estimateSpeechTiming(text).durationMs;
}

/**
 * 말풍선 안내 후 페이지를 이동하기까지의 지연.
 * 대사가 전부 타이핑된 뒤(typingMs) 잠깐 읽을 시간을 더해, 대사가 끝나기 전에
 * 화면이 넘어가지 않도록 한다. 긴 대사는 상한보다 타이핑 완료를 우선한다.
 */
function estimateNavDelay(text: string): number {
  const { typingMs } = estimateSpeechTiming(text);
  return Math.max(1800, Math.min(typingMs + SPEECH_ACTION_READ_MS, 4500), typingMs + 350);
}

/**
 * 캐릭터 숨김, 페이지 이동처럼 캐릭터 자체가 사라지거나 화면이 바뀌는 액션은
 * 타이핑 중에 실행하지 않는다. 짧은 대사는 최소 노출 시간을 지키고, 긴 대사는
 * 타이핑 완료를 최우선으로 보장한다.
 */
function estimateCharacterActionDelay(text: string): number {
  const { typingMs, durationMs } = estimateSpeechTiming(text);
  return Math.max(durationMs, typingMs + SPEECH_ACTION_READ_MS);
}

function patchPixiCancelResize(app: Application): void {
  const target = app as unknown as { _cancelResize?: unknown };
  if (typeof target._cancelResize !== "function") {
    target._cancelResize = () => {};
  }
}

function normalizeCharacterAction(action: CharacterActionKey): CharacterActionKey {
  if (action === "tap_body") return "attention";
  return action;
}

function normalizeWorkTitle(title: string): string {
  return title.replace(/\s+/g, "").toLowerCase();
}

function pickRandomItems<T>(items: T[], count: number): T[] {
  const copied = [...items];
  for (let i = copied.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copied[i], copied[j]] = [copied[j], copied[i]];
  }
  return copied.slice(0, count);
}

function buildWorkRecommendationResult(
  mood: WhatNowMood,
  detail: WorkRecommendationDetail,
  length: WorkRecommendationLength,
  intensity: WorkRecommendationIntensity,
  followedTitles: Set<string>,
): WorkRecommendationResult {
  const key = `${mood}:${detail}`;
  const pools: Record<string, { title: string; items: string[]; reason: string }> = {
    "light:funny": {
      title: "개그로 가볍게 웃는 타입",
      items: ["은혼", "사이키 쿠스오의 재난", "아소비 아소바세", "월간순정 노자키 군", "히나마츠리", "남자고교생의 일상"],
      reason: "한 화 단위로 웃고 빠질 수 있어서 피로도가 낮아요.",
    },
    "light:healing": {
      title: "편하게 틀어두는 힐링 타입",
      items: ["유루캠", "나츠메 우인장", "바라카몬", "논논비요리", "아리아", "빙과"],
      reason: "큰 사건보다 분위기와 캐릭터 정으로 보는 쪽이에요.",
    },
    "light:episodic": {
      title: "옴니버스 입문 타입",
      items: ["짱구는 못말려", "스파이 패밀리", "일상", "케이온!", "코바야시네 메이드래곤", "아따맘마"],
      reason: "앞뒤 맥락 부담이 적고 중간부터 봐도 따라가기 쉬워요.",
    },
    "immersive:world": {
      title: "세계관에 빨려드는 타입",
      items: ["진격의 거인", "강철의 연금술사", "메이드 인 어비스", "헌터X헌터", "던전밥", "도로헤도로"],
      reason: "설정, 복선, 진실 추적이 강해서 연속 시청에 잘 맞아요.",
    },
    "immersive:strategy": {
      title: "두뇌전과 긴장감 타입",
      items: ["데스노트", "코드기어스", "약속의 네버랜드", "카이지", "원아웃", "싸이코패스"],
      reason: "다음 수가 궁금해서 한 화만 보기 어려운 작품들이에요.",
    },
    "immersive:emotion": {
      title: "감정선에 오래 남는 타입",
      items: ["바이올렛 에버가든", "슈타인즈 게이트", "86 에이티식스", "클라나드", "4월은 너의 거짓말", "플라스틱 메모리즈"],
      reason: "캐릭터의 선택과 후폭풍이 강하게 남는 쪽이에요.",
    },
    "reaction:season": {
      title: "이번 분기 화제작 우선 타입",
      items: ["이번 분기 인기작", "신작 1화 반응 좋은 작품", "방영 직후 언급 많은 작품", "원작 팬덤 반응 좋은 작품", "첫 주차 화제작"],
      reason: "지금 같이 달릴 수 있어서 커뮤니티 대화에 바로 끼기 좋아요.",
    },
    "reaction:community": {
      title: "댓글과 밈이 많은 타입",
      items: ["밈 생성 중인 작품", "토론 많은 작품", "캐릭터 인기 높은 작품", "댓글 싸움 나는 작품", "짤이 많이 도는 작품"],
      reason: "작품 자체보다 사람들 반응까지 같이 보는 재미가 커요.",
    },
    "reaction:safe": {
      title: "실패 확률 낮은 인기작 타입",
      items: ["평점 안정적인 작품", "입소문 오래 가는 작품", "완결 후 평가 좋은 작품", "입문 추천 단골 작품", "후반 평가가 좋은 작품"],
      reason: "유행만 보고 고르기보다 반응이 검증된 쪽으로 좁혀요.",
    },
  };

  const lengthHints: Record<WorkRecommendationLength, string[]> = {
    short: ["짧게 보기 좋은", "진입 장벽 낮은", "한 화 맛보기 쉬운"],
    standard: ["한두 화 보면 감 잡히는", "초반 흡입력이 있는", "주말에 이어보기 좋은"],
    long: ["제대로 몰아보기 좋은", "긴 호흡으로 따라가기 좋은", "완주 만족감이 있는"],
  };
  const intensityHints: Record<WorkRecommendationIntensity, string[]> = {
    soft: ["부담 낮은", "편하게 시작하기 좋은", "피곤할 때도 보기 좋은"],
    balanced: ["취향 확인이 쉬운", "재미와 몰입 균형이 좋은", "무난하게 추천하기 좋은"],
    strong: ["반응이 강하게 갈리는", "한번 잡으면 계속 보게 되는", "인상이 확 남는"],
  };

  const fallback = {
      title: "가볍게 시작하는 추천",
      items: ["짱구는 못말려", "은혼", "스파이 패밀리", "유루캠", "데스노트"],
      reason: "처음 추천이라 부담 낮은 작품부터 잡았어요.",
  };
  const pool = pools[key] ?? fallback;
  const followed = new Set([...followedTitles].map(normalizeWorkTitle));
  const filtered = pool.items.filter((item) => !followed.has(normalizeWorkTitle(item)));
  const backup = Object.values(pools)
    .flatMap((item) => item.items)
    .filter((item, index, arr) => arr.indexOf(item) === index)
    .filter((item) => !followed.has(normalizeWorkTitle(item)));
  const candidates = filtered.length >= 3 ? filtered : [...filtered, ...backup.filter((item) => !filtered.includes(item))];
  const items = pickRandomItems(candidates.length > 0 ? candidates : pool.items, 3);
  const reasonPrefix = `${pickRandomItems(lengthHints[length], 1)[0]}, ${pickRandomItems(intensityHints[intensity], 1)[0]} 쪽으로 골랐어요.`;

  return {
    title: pool.title,
    items,
    reason: `${reasonPrefix} ${pool.reason}`,
    filteredCount: pool.items.length - filtered.length,
  };
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
  const hideCharacterTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  const [whatNowFlow, setWhatNowFlow] = useState<WhatNowFlow | null>(null);
  const lastBubbleAtRef = useRef(0);
  const lastBubbleTypeAtRef = useRef<Map<NotificationType, number>>(new Map());

  const pathname = usePathname();
  const router = useRouter();
  const profile = useCharacterStore((s) => s.profile);
  const modelPath = useCharacterStore((s) => s.modelPath);
  const authUser = useAuthUser();
  const userId = authUser?.id ?? null;
  const unreadNotificationNotice = useUnreadNotificationNotice();
  const showPersistentNotificationNotice =
    unreadNotificationNotice.shouldShowNotice && !assistantOpen && !whatNowFlow;
  const isGuest = !authUser;
  const assistantSlots = isGuest ? getGuestAssistantSlots(pathname) : getAssistantSlots(pathname);
  const setLoading = useCharacterStore((s) => s.setLoading);
  const setReady = useCharacterStore((s) => s.setReady);
  const setError = useCharacterStore((s) => s.setError);
  const setModelConfig = useCharacterStore((s) => s.setModelConfig);
  const setLive2DEnabled = useCharacterStore((s) => s.setLive2DEnabled);
  const selectedOutfits = useCharacterStore((s) => s.selectedOutfits);
  const setPartOpacities = useCharacterStore((s) => s.setPartOpacities);
  // 캐릭터 모델이 실제로 그려지기 전엔 말풍선/페이지 인사를 띄우지 않는다.
  // (홈 진입/채널 이동 직후 모델보다 말풍선이 먼저 뜨는 문제 방지)
  const isReady = useCharacterStore((s) => s.isReady);
  const isLoading = useCharacterStore((s) => s.isLoading);

  function clearMessageTimeout() {
    if (messageTimeoutRef.current) {
      clearTimeout(messageTimeoutRef.current);
      messageTimeoutRef.current = null;
    }
  }

  function clearHideCharacterTimeout() {
    if (hideCharacterTimeoutRef.current) {
      clearTimeout(hideCharacterTimeoutRef.current);
      hideCharacterTimeoutRef.current = null;
    }
  }

  function setTemporaryMessage(message: string, durationMs?: number) {
    clearMessageTimeout();
    const effectiveDuration = durationMs ?? estimateSpeechDuration(message);
    suppressEmotionDialogueUntilRef.current = Date.now() + effectiveDuration;
    useCharacterStore.getState().setMessage(message);
    messageTimeoutRef.current = setTimeout(() => {
      messageTimeoutRef.current = null;
      if (useCharacterStore.getState().message === message) {
        useCharacterStore.getState().setMessage(null);
      }
    }, effectiveDuration);
  }

  function openAssistantMenu() {
    clearMessageTimeout();
    suppressEmotionDialogueUntilRef.current = Number.POSITIVE_INFINITY;
    const model = modelRef.current;
    if (model) setSpeechAnchor(getModelSpeechAnchor(model));
    setWhatNowFlow(null);
    useCharacterStore
      .getState()
      .setMessage(pickRandomLine(isGuest ? ASSISTANT_PROMPTS_GUEST : ASSISTANT_PROMPTS_AUTH));
    setAssistantOpen(true);
  }

  function closeAssistantMenu() {
    clearMessageTimeout();
    suppressEmotionDialogueUntilRef.current = 0;
    setAssistantOpen(false);
    setAssistantBusy(null);
    setWhatNowFlow(null);
    useCharacterStore.getState().setMessage(null);
  }

  function closeSpeechBubble() {
    clearMessageTimeout();
    suppressEmotionDialogueUntilRef.current = 0;
    setAssistantOpen(false);
    setAssistantBusy(null);
    setWhatNowFlow(null);
    useCharacterStore.getState().setMessage(null);
  }

  function closeUnreadNotificationNotice() {
    unreadNotificationNotice.acknowledge();
    closeSpeechBubble();
  }

  function openNotificationsFromNotice() {
    unreadNotificationNotice.acknowledge();
    router.push("/notifications");
  }

  async function markUnreadNotificationsReadFromNotice() {
    if (!userId) return;
    await markAllAsRead(userId);
    unreadNotificationNotice.acknowledge();
    closeSpeechBubble();
  }

  async function hideCharacterFromAssistant() {
    clearMessageTimeout();
    clearHideCharacterTimeout();
    setAssistantOpen(false);
    setAssistantBusy(null);
    setWhatNowFlow(null);
    const store = useCharacterStore.getState();
    const hideMessage = "아, 잠깐 숨어 있을게요. 그래도 필요한 알림은 아래에 띄워둘게요.";
    const hiddenMessage = "캐릭터를 접어뒀어요. 알림은 토스트로 계속 보여드릴게요.";
    const hideDelay = estimateCharacterActionDelay(hideMessage);
    const hideReadyAt = Date.now() + hideDelay;
    store.setEmotion("sad");
    setTemporaryMessage(hideMessage, hideDelay + 800);

    try {
      await saveLive2DEnabledPreference(false);
      const remainingHideDelay = Math.max(0, hideReadyAt - Date.now());
      hideCharacterTimeoutRef.current = setTimeout(() => {
        hideCharacterTimeoutRef.current = null;
        setLive2DEnabled(false);
        const nextStore = useCharacterStore.getState();
        nextStore.setMessage(hiddenMessage);
        window.setTimeout(() => {
          const state = useCharacterStore.getState();
          if (state.message === hiddenMessage) state.setMessage(null);
          if (state.emotion === "sad") state.setEmotion("idle");
        }, estimateSpeechDuration(hiddenMessage));
      }, remainingHideDelay);
    } catch (error) {
      clearHideCharacterTimeout();
      setLive2DEnabled(true);
      useCharacterStore
        .getState()
        .setMessage(error instanceof Error ? `캐릭터 설정 저장 실패: ${error.message}` : "캐릭터 설정 저장에 실패했어요.");
    } finally {
      window.setTimeout(() => {
        const state = useCharacterStore.getState();
        if (state.emotion === "sad") state.setEmotion("idle");
        if (state.message === hideMessage) state.setMessage(null);
      }, hideDelay + 900);
    }
  }

  function isCharacterClickBlocked(): boolean {
    return assistantOpen;
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

  const applyExpressionById = async (expressionId: string): Promise<void> => {
    const model = modelRef.current;
    if (!model) return;

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

    try {
      await model.expression(expressionId);
    } catch (e) {
      console.warn("[Live2DWrapper] expression apply warning:", e);
    }
  };

  const playMappedMotion = (motion: MotionRef, restoreIdle = true) => {
    const model = modelRef.current;
    if (!model) return;

    try {
      void model.motion(motion.group, motion.index, MotionPriority.FORCE);

      if (!restoreIdle) return;

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
          const idleMotion = latestProfile?.scenarioMap?.idle_return?.motion ?? latestProfile?.motionMap.idle;
          pendingIdleReturnRef.current = false;
          if (!idleMotion) return;
          try {
            void model.motion(idleMotion.group, idleMotion.index, MotionPriority.FORCE);
          } catch (e) {
            console.warn("[Live2DWrapper] fallback idle restore warning:", e);
          }
        }, delayMs);
      };

      scheduleFallback(1200);

      if (modelPath) {
        void getMotionMeta(modelPath, motion.group, motion.index).then((meta) => {
          if (!meta || scheduleSeq !== actionIdleTimeoutSeqRef.current) return;
          const calculatedDelay = meta.loop
            ? Math.min(Math.max(Math.round(meta.durationMs * 0.45), 900), 1800)
            : Math.max(600, meta.durationMs + 120);
          scheduleFallback(calculatedDelay);
        });
      }
    } catch (e) {
      console.warn("[Live2DWrapper] motion play warning:", e);
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
    // 캐릭터 모델 로딩이 끝나기 전에는 페이지 인사 말풍선을 띄우지 않는다.
    // pathname 이 먼저 정해지고 isReady 가 나중에 true 가 되어도, deps 에 isReady 가
    // 포함돼 있으니 준비된 시점에 한 번 트리거되어 자연스럽게 인사가 뜬다.
    if (!isReady) return;
    if (assistantOpen || assistantBusy) return;
    if (isComposePage(pathname)) return;

    const preset = PAGE_DIALOGUE_PRESETS.find((item) => item.match(pathname));
    if (!preset) return;

    const lines = isGuest ? preset.guestLines : preset.authLines;
    const line = lines[Math.floor(Math.random() * lines.length)];
    // 페이지 진입 직후 인사는 살짝 늦게 띄워, 모델 등장과 겹치지 않고
    // "이제 막 말을 거는" 느낌을 준다.
    const greetingDelay = window.setTimeout(() => {
      if (useCharacterStore.getState().message) return;
      setTemporaryMessage(line);
    }, 420);
    return () => window.clearTimeout(greetingDelay);
  }, [pathname, isReady]);

  // --------------------------------------------------------------------
  // Effect 1 · Pixi Application 생성 (1회)
  // --------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

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

    // pixi Application 을 WebGL 컨텍스트까지 완전히 해제한다.
    // dev 모드(StrictMode 이중 마운트 + HMR)에서 destroy 가 누락되면 컨텍스트가
    // 누수되어 브라우저 WebGL 컨텍스트 한도를 넘기고 결국 탭이 멈춘다.
    const destroyApp = (target: Application) => {
      try {
        patchPixiCancelResize(target);
        target.destroy(false, { children: true, texture: true, context: true });
      } catch (e) {
        console.warn("[Live2DWrapper] app destroy warning:", e);
      }
      if (window.app === target) {
        window.app = undefined;
      }
    };

    const boot = async () => {
      if (!canvasRef.current) return;
      let app: Application | null = null;
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

        // init() 이 끝나기 전에 cleanup 이 돌았다면(=cancelled), 이 시점이
        // 컨텍스트를 안전하게 해제할 수 있는 유일한 지점이다. cleanup 은
        // 초기화가 끝나지 않은 app 을 건드리지 않으므로 여기서 직접 정리한다.
        if (cancelled) {
          destroyApp(app);
          return;
        }

        Live2DModel.registerTicker(Ticker);
        window.app = app;
        appRef.current = app;
        setAppReady(true);
      } catch (err) {
        // 부트가 취소된 뒤 발생한 오류는 사용자에게 노출할 실제 에러가 아니다.
        if (app) destroyApp(app);
        if (cancelled) return;
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
          modelRef.current.destroy({ children: true });
        } catch (e) {
          console.warn("[Live2DWrapper] model destroy warning:", e);
        }
        modelRef.current = null;
      }

      // 초기화가 끝난(appRef.current 가 채워진) app 만 정리한다.
      // init() 진행 중인 app 은 boot() 가 cancelled 분기에서 안전하게 해제한다.
      const a = appRef.current;
      appRef.current = null;
      if (a) destroyApp(a);
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
      // 새 모델이 화면에 뜰 때까지는 ready 가 아니라고 명시한다.
      // (이전 모델이 ready 상태로 남아있으면 말풍선이 잘못된 위치/타이밍에 뜬다.)
      setReady(false);
      setSpeechAnchor(null);

      // 이전 모델 정리
      if (modelRef.current) {
        try {
          app.stage.removeChild(modelRef.current);
          modelRef.current.destroy({ children: true });
        } catch (e) {
          console.warn("[Live2DWrapper] previous model destroy warning:", e);
        }
        modelRef.current = null;
      }

      if (!modelPath) {
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
          localModel?.destroy({ children: true });
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
          if (isCharacterClickBlocked()) return;

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
        async (payload) => {
          if (!isMounted || !userId || payload.new.receiver_id !== userId) return;

          const rawType = (payload.new.type ?? "") as NotificationType;
          if (!LIVE2D_NOTIFICATION_TYPES.has(rawType)) return;

          const settings = await fetchUserNotificationSettings(userId);
          if (!isMounted) return;
          if (!settings.notifications_enabled || !settings.live2d_bubble_enabled) return;

          const nowMs = Date.now();
          if (nowMs - lastBubbleAtRef.current < LIVE2D_BUBBLE_COOLDOWN_GLOBAL_MS) return;
          const lastForType = lastBubbleTypeAtRef.current.get(rawType) ?? 0;
          if (nowMs - lastForType < LIVE2D_BUBBLE_COOLDOWN_PER_TYPE_MS) return;

          lastBubbleAtRef.current = nowMs;
          lastBubbleTypeAtRef.current.set(rawType, nowMs);

          const aggregateCount = Number(payload.new.aggregate_count ?? 1) || 1;
          const typeLabel =
            rawType === 'COMMENT' ? '새 댓글' :
            rawType === 'REPLY' ? '새 답글' :
            rawType === 'REACTION' ? '새 리액션' :
            rawType === 'FOLLOW' ? '새 팔로워' :
            rawType === 'MENTION' ? '새 멘션' :
            rawType === 'HOT_PROMOTED' ? '개념글 등극' :
            rawType === 'RELEASE' ? '관심작 소식' :
            rawType === 'SYSTEM' ? '시스템 안내' :
            '새로운 알림';

          const message = aggregateCount > 1
            ? `${typeLabel} ${aggregateCount}개가 도착했어요!`
            : `${typeLabel}이 도착했어요!`;

          const scenarioKey = NOTIFICATION_SCENARIOS[rawType] ?? "notification";
          const store = useCharacterStore.getState();
          const scenarioMapping = store.profile?.scenarioMap?.[scenarioKey];

          store.setMessage(message);
          store.triggerScenario(scenarioKey);

          if (!scenarioMapping?.expressionId) {
            store.setEmotion("happy");
          }

          setTimeout(() => {
            if (!isMounted) return;
            const nextStore = useCharacterStore.getState();
            if (nextStore.message === message) {
              nextStore.setMessage(null);
            }
            nextStore.triggerScenario("idle_return");
            if (!nextStore.profile?.scenarioMap?.idle_return?.expressionId) {
              nextStore.setEmotion("idle");
            }
          }, Math.max(estimateSpeechDuration(message), 4200));
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(notificationChannel);
    };
  }, [userId]);

  const scenarioRequest = useCharacterStore((s) => s.scenarioRequest);
  useEffect(() => {
    if (!scenarioRequest || !appReady || !modelRef.current) return;

    const profile = useCharacterStore.getState().profile;
    const mapping = profile?.scenarioMap?.[scenarioRequest.key];
    if (!profile) return;

    if (mapping?.expressionId) {
      void applyExpressionById(mapping.expressionId);
    }
    const motion = mapping?.motion ?? profile.motionMap.idle;
    if (motion) {
      playMappedMotion(motion);
    }
  }, [scenarioRequest, appReady, modelPath]);

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
      if (isEditableElementFocused() || (pathname && isComposePage(pathname))) return;
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
  }, [appReady, modelPath, isReady, pathname]);

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
      }, estimateSpeechDuration(line));
    }
    return () => {
      cancelled = true;
    };
  }, [emotion, appReady, isReady, modelPath]);

  // --------------------------------------------------------------------
  // Effect 4.5 · 프로필 outfit 선택값을 실제 파츠 opacity 로 동기화
  // --------------------------------------------------------------------
  useEffect(() => {
    if (!profile || profile.outfits.length === 0) return;
    const next: Record<string, number> = {};
    for (const group of profile.outfits) {
      const selected = selectedOutfits[group.id] ?? group.defaultPartId ?? group.parts[0]?.id;
      for (const option of group.parts) {
        const visible = option.id === selected ? 1 : 0;
        for (const partId of option.partIds) next[partId] = visible;
      }
    }
    if (Object.keys(next).length > 0) setPartOpacities(next);
  }, [profile, selectedOutfits, setPartOpacities]);

  // --------------------------------------------------------------------
  // Effect 5 · 파츠 opacity (옷/포즈 토글)
  // --------------------------------------------------------------------
  const partOpacities = useCharacterStore((s) => s.partOpacities);
  useEffect(() => {
    if (!appReady || !modelRef.current) return;
    const model = modelRef.current;
    const app = appRef.current;
    if (!app) return;
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
      const applyPartOpacities = () => {
        const values = useCharacterStore.getState().partOpacities;
        for (const [partId, opacity] of Object.entries(values)) {
          const idx = core.getPartIndex?.(partId) ?? -1;
          if (idx >= 0) core.setPartOpacityByIndex?.(idx, opacity);
        }
      };
      applyPartOpacities();
      app.ticker?.add?.(applyPartOpacities);
      return () => {
        const ticker = app?.ticker as
          | { remove?: (fn: () => void) => void }
          | null
          | undefined;
        ticker?.remove?.(applyPartOpacities);
      };
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
              const idleMotion = latestProfile?.scenarioMap?.idle_return?.motion ?? latestProfile?.motionMap.idle;
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
    const suppressTypingDialogue =
      safeAction === "typing" &&
      (isEditableElementFocused() || (pathname ? isComposePage(pathname) : false));
    if (!opensAssistant && !suppressTypingDialogue && lines && lines.length > 0) {
      const line = lines[Math.floor(Math.random() * lines.length)];
      setTemporaryMessage(line);
    }

    const sound = profile.sounds.actions[safeAction];
    if (sound) void playSound(sound);

    if (opensAssistant) {
      openAssistantMenu();
    }
  }

  function navigateAfterAssistantMessage(
    href: string,
    message: string,
    emotion: "happy" | "wink" | "idle" = "happy",
  ) {
    setAssistantOpen(false);
    setAssistantBusy(null);
    setWhatNowFlow(null);
    // 대사가 다 끝난 뒤에 이동하도록, 타이핑+읽기 시간만큼 기다렸다가 router.push 한다.
    const navDelay = estimateNavDelay(message);
    setTemporaryMessage(message, navDelay + 600);
    useCharacterStore.getState().setEmotion(emotion);
    window.setTimeout(() => {
      router.push(href);
    }, navDelay);
  }

  function startWhatNowFlow(source: "what_now" | "work_recommendation" = "what_now") {
    clearMessageTimeout();
    setAssistantBusy(null);
    setAssistantOpen(false);
    setWhatNowFlow({ step: "mood", source });
    suppressEmotionDialogueUntilRef.current = Number.POSITIVE_INFINITY;
    useCharacterStore.getState().setEmotion("wink");
    useCharacterStore
      .getState()
      .setMessage(
        source === "work_recommendation"
          ? "작품 추천은 취향을 먼저 맞춰볼게요. 어떤 작품이 끌려요?"
          : "지금 뭐할지 같이 골라봐요. 어떤 쪽이 끌려요?",
      );
  }

  function handleWhatNowMood(mood: WhatNowMood) {
    if (!whatNowFlow || whatNowFlow.step !== "mood") return;
    if (whatNowFlow.source === "work_recommendation") {
      setWhatNowFlow({ step: "work_detail", source: "work_recommendation", mood });
      const workPrompt =
        mood === "light"
          ? "일상, 개그, 옴니버스 쪽으로 볼게요. 어떤 맛이 좋아요?"
          : mood === "immersive"
            ? "한번 보면 빠져드는 쪽으로 볼게요. 어디에 더 끌려요?"
            : "이번 분기 반응 좋은 쪽으로 볼게요. 어떤 기준으로 고를까요?";
      useCharacterStore.getState().setMessage(workPrompt);
      return;
    }

    setWhatNowFlow({ step: "time", source: "what_now", mood });
    const prompt =
      mood === "light"
        ? "가볍게 즐길 수 있는 걸로 볼게요. 시간은 얼마나 있어요?"
        : mood === "immersive"
          ? "몰입할 작품 위주로 볼게요. 시간은 얼마나 돼요?"
          : "사람들 반응이 모이는 쪽으로 볼게요. 시간은 얼마나 있어요?";
    useCharacterStore.getState().setMessage(prompt);
  }

  function handleWhatNowTime(time: WhatNowTime) {
    if (!whatNowFlow || whatNowFlow.step !== "time") return;

    const { mood } = whatNowFlow;
    if (mood === "immersive") {
      navigateAfterAssistantMessage(
        time === "short" ? "/releases" : time === "medium" ? "/play/oshi-analysis" : "/calendar",
        time === "short"
          ? "짧게 볼 수 있는 신작 소식부터 보여드릴게요. 관심 생기는 작품만 저장하면 돼요."
          : time === "medium"
            ? "몇 가지 취향을 더 물어보고 작품 쪽으로 좁혀볼게요."
            : "시간이 있으면 이번 주 일정과 신작 흐름을 같이 보는 게 좋아요.",
      );
      return;
    }

    if (mood === "reaction") {
      navigateAfterAssistantMessage(
        time === "short" ? "/" : "/board",
        time === "short"
          ? "지금 반응이 빠른 글부터 보여드릴게요. 짧게 훑기 좋아요."
          : "사람들 반응이 모이는 글 쪽으로 볼게요. 제목과 댓글 흐름부터 확인해요.",
      );
      return;
    }

    navigateAfterAssistantMessage(
      time === "short" ? "/play/fortune" : time === "medium" ? "/play/otaku-type" : "/play/oshi-card",
      time === "short"
        ? "가볍게 운세부터 볼게요. 1분 안에 분위기 전환하기 좋아요."
        : time === "medium"
          ? "짧은 테스트로 취향을 먼저 열어볼게요. 결과에 따라 다음 볼거리도 이어갈 수 있어요."
          : "조금 여유가 있으면 최애 카드 쪽이 좋아요. 만들면서 취향을 정리하기 좋아요.",
      "wink",
    );
  }

  function handleWorkRecommendationDetail(detail: WorkRecommendationDetail) {
    if (!whatNowFlow || whatNowFlow.step !== "work_detail") return;
    setWhatNowFlow({
      step: "work_length",
      source: "work_recommendation",
      mood: whatNowFlow.mood,
      detail,
    });
    useCharacterStore.getState().setMessage("좋아요. 이번엔 어느 정도 분량이 편해요?");
  }

  function handleWorkRecommendationLength(length: WorkRecommendationLength) {
    if (!whatNowFlow || whatNowFlow.step !== "work_length") return;
    setWhatNowFlow({
      step: "work_intensity",
      source: "work_recommendation",
      mood: whatNowFlow.mood,
      detail: whatNowFlow.detail,
      length,
    });
    useCharacterStore.getState().setMessage("마지막으로, 어느 정도 자극이 좋아요?");
  }

  async function handleWorkRecommendationIntensity(intensity: WorkRecommendationIntensity) {
    if (!whatNowFlow || whatNowFlow.step !== "work_intensity") return;
    useCharacterStore.getState().setMessage("관심작은 빼고 후보를 섞어볼게요.");

    let followedTitles = new Set<string>();
    if (userId) {
      try {
        followedTitles = await fetchFollowedOfficialWorkTitles(userId);
      } catch (error) {
        console.warn("[Live2DWrapper] followed works warning:", error);
      }
    }

    const result = buildWorkRecommendationResult(
      whatNowFlow.mood,
      whatNowFlow.detail,
      whatNowFlow.length,
      intensity,
      followedTitles,
    );
    setWhatNowFlow({
      step: "work_result",
      source: "work_recommendation",
      mood: whatNowFlow.mood,
      detail: whatNowFlow.detail,
      length: whatNowFlow.length,
      intensity,
      result,
    });
    useCharacterStore.getState().setEmotion("happy");
    useCharacterStore.getState().setMessage(`${result.title} 쪽이면 이 후보부터 볼 만해요.`);
  }

  function openRecommendationViralPage() {
    if (!whatNowFlow || whatNowFlow.step !== "work_result") return;
    navigateAfterAssistantMessage(
      "/play/recommend",
      "정식 애니 추천 바이럴은 여기로 연결해둘게요. 지금은 개발 중 페이지로 먼저 보여드려요.",
      "wink",
    );
  }

  async function runAssistantAction(action: AssistantActionKey) {
    if (assistantBusy) return;
    clearMessageTimeout();
    setAssistantBusy(action);
    useCharacterStore.getState().setMessage(ASSISTANT_LOADING_MESSAGE);
    setAssistantOpen(false);

    try {
      if (action === "what_now" || action === "work_recommendation") {
        startWhatNowFlow(action);
        return;
      }

      if (action === "recommended_posts") {
        navigateAfterAssistantMessage("/", "지금 반응이 좋은 글부터 보여드릴게요. 짧게 보고 넘어가기 좋아요.");
        return;
      }

      if (action === "guest_hot_posts") {
        navigateAfterAssistantMessage("/", "실시간 베스트부터 보여드릴게요. 여기서 커뮤니티 분위기를 가장 빨리 볼 수 있어요.");
        return;
      }

      if (action === "guest_browse") {
        const target = pathname?.startsWith("/board") ? "/" : "/board";
        navigateAfterAssistantMessage(
          target,
          target === "/board"
            ? "채널 목록으로 안내할게요. 마음에 드는 말머리와 분위기부터 골라보면 돼요."
            : "홈으로 돌아가서 실시간 흐름부터 다시 볼게요.",
        );
        return;
      }

      if (action === "guest_login") {
        navigateAfterAssistantMessage("/auth", "로그인 화면으로 안내할게요. 캐릭터 설정과 활동 기록은 로그인 후부터 저장돼요.", "wink");
        return;
      }

      if (action === "guest_login_benefits") {
        setTemporaryMessage(
          "로그인하면 캐릭터 표시 설정, 관심 채널, 미션, 알림, 답장할 글, 관심작 일정이 내 계정에 저장돼요.",
          ASSISTANT_RESPONSE_DURATION_MS,
        );
        useCharacterStore.getState().setEmotion("wink");
        return;
      }

      if (action === "guest_meet_character") {
        setTemporaryMessage(
          "지금은 기본 캐릭터 체험 모드예요. 로그인하면 내 캐릭터가 활동과 알림을 더 잘 챙겨드릴게요.",
          ASSISTANT_RESPONSE_DURATION_MS,
        );
        useCharacterStore.getState().setEmotion("happy");
        return;
      }

      if (action === "open_notifications") {
        if (!userId) {
          navigateAfterAssistantMessage("/auth", "알림은 로그인 후 볼 수 있어요. 먼저 계정을 연결해볼까요?", "wink");
          return;
        }
        navigateAfterAssistantMessage("/notifications", "알림함으로 갈게요. 댓글, 답글, 반응을 한 번에 정리해볼 수 있어요.");
        return;
      }

      if (action === "open_profile") {
        if (!userId) {
          navigateAfterAssistantMessage("/auth", "프로필은 로그인 후 생겨요. 캐릭터와 활동 기록을 같이 저장할 수 있어요.", "wink");
          return;
        }
        navigateAfterAssistantMessage("/profile", "프로필로 갈게요. 캐릭터, 활동 기록, 레벨을 같이 확인해볼 수 있어요.");
        return;
      }

      if (action === "open_character_room") {
        if (!userId) {
          navigateAfterAssistantMessage("/auth", "내 캐릭터 설정은 로그인 후 저장돼요. 먼저 계정에 연결해볼까요?", "wink");
          return;
        }
        const activeProfile = useCharacterStore.getState().profile;
        const target = activeProfile?.id ? `/library/${encodeURIComponent(activeProfile.id)}` : "/profile";
        navigateAfterAssistantMessage(target, "캐릭터 설정으로 갈게요. 표시 위치, 표정, 썸네일을 조정할 수 있어요.");
        return;
      }

      if (action === "open_write") {
        if (!userId) {
          navigateAfterAssistantMessage("/auth", "글쓰기는 로그인 후 가능해요. 먼저 계정을 연결해둘게요.", "wink");
          return;
        }
        navigateAfterAssistantMessage("/feed/write", "글쓰기 화면으로 갈게요. 말머리와 스포일러 표시부터 같이 확인해요.");
        return;
      }

      if (action === "open_notification_settings") {
        if (!userId) {
          navigateAfterAssistantMessage("/auth", "알림 설정은 로그인 후 저장돼요. 계정에 연결하면 캐릭터 말풍선도 조절할 수 있어요.", "wink");
          return;
        }
        navigateAfterAssistantMessage("/settings/notifications", "알림 설정으로 갈게요. 목록 알림과 캐릭터 말풍선을 따로 조절할 수 있어요.");
        return;
      }

      if (action === "today_activity") {
        if (!userId) {
          setTemporaryMessage("오늘 활동 요약은 로그인 후 내 글과 댓글이 생기면 볼 수 있어요.", ASSISTANT_RESPONSE_DURATION_MS);
          return;
        }
        const summary = await fetchTodayActivitySummary(userId);
        setTemporaryMessage(summarizeTodayActivity(summary), ASSISTANT_RESPONSE_DURATION_MS);
        useCharacterStore.getState().setEmotion(summary.total > 0 ? "happy" : "idle");
        return;
      }

      if (action === "unreplied_queue") {
        if (!userId) {
          setTemporaryMessage("미답글 큐는 로그인 후 내 글에 달린 댓글을 기준으로 모아드려요.", ASSISTANT_RESPONSE_DURATION_MS);
          return;
        }
        const queue = await fetchUnrepliedQueue(userId, 20);
        setTemporaryMessage(summarizeUnreplied(queue), ASSISTANT_RESPONSE_DURATION_MS);
        useCharacterStore.getState().setEmotion(queue.total > 0 ? "happy" : "idle");
        return;
      }

      if (action === "daily_missions") {
        if (!userId) {
          setTemporaryMessage("오늘 미션은 로그인 후 출석, 댓글, 추천 활동을 기준으로 채워져요.", ASSISTANT_RESPONSE_DURATION_MS);
          return;
        }
        const board = await fetchMissionBoard(userId);
        setTemporaryMessage(summarizeMissionBoard(board), ASSISTANT_RESPONSE_DURATION_MS);
        useCharacterStore.getState().setEmotion("happy");
        return;
      }

      if (action === "today_schedule") {
        const todayEvents = getCalendarEvents().filter(
          (event) => event.isFollowing && ymdKey(event.startsAt) === ymdKey(new Date()),
        );
        const message =
          todayEvents.length > 0
            ? `오늘은 ${todayEvents.slice(0, 3).map((event) => event.title).join(", ")} 일정이 있어요.`
            : userId
              ? "오늘 관심 일정은 아직 없어요. 관심작을 추가하면 여기서 바로 챙겨드릴게요."
              : "로그인하면 관심작 기준으로 오늘 일정을 따로 추려드릴 수 있어요.";
        setTemporaryMessage(message, ASSISTANT_RESPONSE_DURATION_MS);
        useCharacterStore.getState().setEmotion("happy");
        return;
      }

      if (action === "week_schedule") {
        const now = new Date();
        const weekEvents = getCalendarEvents()
          .filter((event) => event.isFollowing && isWithinDays(new Date(event.startsAt), now, 7))
          .slice(0, 3);
        const message =
          weekEvents.length > 0
            ? `이번 주엔 ${weekEvents.map((event) => `${formatDateTime(event.startsAt)} ${event.title}`).join(", ")}가 있어요.`
            : userId
              ? "이번 주 관심 일정은 아직 비어 있어요. 새로 팔로우한 작품이 생기면 제가 챙겨둘게요."
              : "로그인하면 이번 주 관심작 일정만 따로 추려볼 수 있어요.";
        setTemporaryMessage(message, ASSISTANT_RESPONSE_DURATION_MS);
        useCharacterStore.getState().setEmotion("happy");
        return;
      }

      if (action === "oshi_updates") {
        const unreadCount = await fetchUnreadCount();
        const message =
          unreadCount > 0
            ? `최애 새 소식 ${unreadCount}건이 있어요.`
            : userId
              ? "관심작 새 소식은 아직 없어요. 새 알림이 오면 제가 먼저 알려드릴게요."
              : "로그인하면 관심작을 저장하고 새 소식을 받을 수 있어요.";
        setTemporaryMessage(message, ASSISTANT_RESPONSE_DURATION_MS);
        useCharacterStore.getState().setEmotion("happy");
        return;
      }

      if (action === "sticker_reply") {
        setTemporaryMessage(
          "스티커 답글은 곧 이 페이지에서 1탭으로 등록할 수 있게 연결될 거예요.",
          ASSISTANT_RESPONSE_DURATION_MS,
        );
        useCharacterStore.getState().setEmotion("happy");
        return;
      }

      if (action === "draft_resume") {
        setTemporaryMessage(
          "쓰던 임시저장이 있으면 곧 한 번에 불러올 수 있게 연결될 거예요.",
          ASSISTANT_RESPONSE_DURATION_MS,
        );
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

  function isPointerInsideModelBounds(event: ReactPointerEvent<HTMLCanvasElement>): boolean {
    const model = modelRef.current;
    const canvas = canvasRef.current;
    if (!model || !canvas) return false;

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
        return true;
      }

      const rect = canvas.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * CANVAS_W;
      const y = ((event.clientY - rect.top) / rect.height) * CANVAS_H;

      return (
        x >= bounds.x - CHARACTER_POINTER_BOUNDS_PADDING &&
        x <= bounds.x + bounds.width + CHARACTER_POINTER_BOUNDS_PADDING &&
        y >= bounds.y - CHARACTER_POINTER_BOUNDS_PADDING &&
        y <= bounds.y + bounds.height + CHARACTER_POINTER_BOUNDS_PADDING
      );
    } catch {
      return true;
    }
  }

  function schedulePointerFallbackAction(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (isCharacterClickBlocked()) return;

    const model = modelRef.current;
    if (!model) return;
    if (!isPointerInsideModelBounds(event)) return;
    if (pointerFallbackTimeoutRef.current) {
      clearTimeout(pointerFallbackTimeoutRef.current);
    }
    pointerFallbackTimeoutRef.current = setTimeout(() => {
      pointerFallbackTimeoutRef.current = null;
      if (Date.now() - lastHitAtRef.current < 250) return;
      playAction("attention");
    }, CHARACTER_POINTER_FALLBACK_DELAY_MS);
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
    <aside className="relative w-full max-w-[var(--layout-live2d-width)] select-none" aria-label="[Live2D 캐릭터 영역]">
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className="block w-full max-w-[var(--layout-live2d-width)] bg-transparent touch-none"
          onPointerDown={schedulePointerFallbackAction}
          style={{
            height: "auto",
            aspectRatio: `${CANVAS_W} / ${CANVAS_H}`,
          }}
        />

        {!isReady && (isLoading || modelPath) && (
          <CharacterLoadingIndicator />
        )}

        {isReady && (
          <SpeechBubble
            anchor={speechAnchor}
            bubbleRef={speechBubbleRef}
            fallbackContent={
              showPersistentNotificationNotice ? (
                <NotificationNoticeContent
                  count={unreadNotificationNotice.count}
                  onOpenNotifications={openNotificationsFromNotice}
                  onMarkRead={() => void markUnreadNotificationsReadFromNotice()}
                />
              ) : null
            }
            onClose={showPersistentNotificationNotice ? closeUnreadNotificationNotice : closeSpeechBubble}
          >
            {whatNowFlow && (
              <WhatNowChoices
                flow={whatNowFlow}
                onMood={handleWhatNowMood}
                onTime={handleWhatNowTime}
                onWorkDetail={handleWorkRecommendationDetail}
                onWorkLength={handleWorkRecommendationLength}
                onWorkIntensity={handleWorkRecommendationIntensity}
                onOpenRecommendation={openRecommendationViralPage}
              />
            )}
            {assistantOpen && (
              <AssistantQuickActions
                slots={assistantSlots}
                busyAction={assistantBusy}
                onAction={runAssistantAction}
                onHideCharacter={hideCharacterFromAssistant}
              />
            )}
          </SpeechBubble>
        )}

      </div>
    </aside>
  );
}

function CharacterLoadingIndicator() {
  return (
    <div
      className="pointer-events-none absolute inset-0 flex items-end justify-center pb-8"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex items-center gap-2 rounded-full border-2 border-pink-200 bg-white/85 px-3 py-1 text-xs font-semibold text-pink-700 shadow-sm backdrop-blur-sm">
        <span
          className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-pink-300 border-t-transparent"
          aria-hidden
        />
        {"\uce90\ub9ad\ud130\ub97c \ubd88\ub7ec\uc624\uace0 \uc788\uc5b4\uc694..."}
      </div>
    </div>
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

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/**
 * 말풍선 텍스트를 한 글자씩 찍어 "말하는 듯한" 느낌을 준다.
 * 새 대사로 바뀌면 처음부터 다시 타이핑하고, 동작 최소화 설정이면 즉시 전체를 보여준다.
 */
function useTypewriter(text: string, speedMs = SPEECH_TYPING_SPEED_MS): { shown: string; done: boolean } {
  const reduceMotion = usePrefersReducedMotion();
  const [shown, setShown] = useState(text);

  useEffect(() => {
    if (!text) {
      setShown("");
      return;
    }
    if (reduceMotion) {
      setShown(text);
      return;
    }
    setShown("");
    let index = 0;
    const timer = setInterval(() => {
      index += 1;
      setShown(text.slice(0, index));
      if (index >= text.length) clearInterval(timer);
    }, speedMs);
    return () => clearInterval(timer);
  }, [text, speedMs, reduceMotion]);

  return { shown, done: shown.length >= text.length };
}

function SpeechBubble({
  anchor,
  bubbleRef,
  fallbackMessage = "",
  fallbackContent = null,
  onClose,
  children,
}: {
  anchor: SpeechAnchor | null;
  bubbleRef: RefObject<HTMLDivElement | null>;
  fallbackMessage?: string;
  fallbackContent?: ReactNode;
  onClose: () => void;
  children?: ReactNode;
}) {
  const message = useCharacterStore((s) => s.message);
  const rawMessage = typeof message === "string" ? message.trim() : "";
  const rawFallbackMessage = fallbackMessage.trim();
  const childNodes = children ? Children.toArray(children) : [];
  const hasChildren = childNodes.length > 0;
  const hasFallbackContent = Boolean(fallbackContent);
  const lastMessageRef = useRef("");
  if (rawMessage) lastMessageRef.current = rawMessage;
  // 메뉴/선택지가 떠 있는 동안에는 자동 닫힘 타이머나 알림이 메시지를 비워도
  // 마지막 안내 문구를 유지해, 말풍선만 남고 텍스트가 사라지는 상황을 막는다.
  const cleanMessage = rawMessage || (hasChildren ? lastMessageRef.current : rawFallbackMessage);
  const { shown, done } = useTypewriter(cleanMessage);
  if (!cleanMessage && !hasChildren && !hasFallbackContent) {
    lastMessageRef.current = "";
    return null;
  }
  const y = anchor?.y ?? Math.round(CANVAS_H * 0.18);
  return (
    <div
      ref={bubbleRef}
      className="pointer-events-none absolute z-10 w-max max-w-[90%] -translate-x-1/2 -translate-y-full"
      style={{
        left: "50%",
        top: `${(y / CANVAS_H) * 100}%`,
      }}
    >
      <div className="live2d-bubble-in pointer-events-auto relative w-full break-words whitespace-normal rounded-2xl border-2 border-pink-200 bg-white px-4 py-3 text-center text-sm font-semibold leading-5 text-gray-800 shadow-lg before:absolute before:-bottom-2 before:left-1/2 before:h-4 before:w-4 before:-translate-x-1/2 before:rotate-45 before:border-b-2 before:border-r-2 before:border-pink-200 before:bg-white before:content-['']">
        {(hasChildren || rawFallbackMessage || hasFallbackContent) && (
          <button
            type="button"
            aria-label="말풍선 닫기"
            className="absolute -right-2.5 -top-2.5 z-20 flex h-7 w-7 items-center justify-center rounded-full border-2 border-pink-200 bg-white text-sm font-black leading-none text-gray-400 shadow-sm transition-colors hover:bg-pink-50 hover:text-pink-600"
            onClick={onClose}
          >
            ×
          </button>
        )}
        {cleanMessage && (
          // 타이핑 중 폭이 출렁이지 않도록, 완성된 문장을 invisible sizer 로 깔고
          // 그 위에 현재까지 찍힌 글자를 겹쳐서 보여준다.
          <div className="grid">
            <span aria-hidden className="invisible col-start-1 row-start-1">
              {cleanMessage}
            </span>
            <span aria-hidden className="col-start-1 row-start-1">
              {shown}
              {!done && (
                <span className="ml-0.5 inline-block h-3.5 w-0.5 -translate-y-0.5 animate-pulse rounded-full bg-pink-400 align-middle" />
              )}
            </span>
            <span className="sr-only" aria-live="polite">
              {cleanMessage}
            </span>
          </div>
        )}
        {!rawMessage && !hasChildren && hasFallbackContent && fallbackContent}
        {childNodes}
      </div>
    </div>
  );
}

function NotificationNoticeContent({
  count,
  onOpenNotifications,
  onMarkRead,
}: {
  count: number;
  onOpenNotifications: () => void;
  onMarkRead: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <p>
        확인하지 않은 알림{" "}
        <span className="font-black text-red-500">{count > 99 ? "99+" : count}</span>
        개가 있어요.
      </p>
      <div className="flex flex-wrap justify-center gap-1.5">
        <button
          type="button"
          onClick={onOpenNotifications}
          className="rounded-full border border-pink-200 bg-pink-50 px-3 py-1 text-[11px] font-bold text-pink-700 hover:bg-pink-100"
        >
          알림 보러가기
        </button>
        <button
          type="button"
          onClick={onMarkRead}
          className="rounded-full border border-gray-200 bg-white px-3 py-1 text-[11px] font-bold text-gray-600 hover:bg-gray-100"
        >
          지금 쌓인 알림 확인처리
        </button>
      </div>
    </div>
  );
}

function WhatNowChoices({
  flow,
  onMood,
  onTime,
  onWorkDetail,
  onWorkLength,
  onWorkIntensity,
  onOpenRecommendation,
}: {
  flow: WhatNowFlow;
  onMood: (mood: WhatNowMood) => void;
  onTime: (time: WhatNowTime) => void;
  onWorkDetail: (detail: WorkRecommendationDetail) => void;
  onWorkLength: (length: WorkRecommendationLength) => void;
  onWorkIntensity: (intensity: WorkRecommendationIntensity) => void;
  onOpenRecommendation: () => void;
}) {
  if (flow.step === "work_result") {
    return (
      <div className="mx-auto mt-2 w-full max-w-[320px] overflow-hidden text-center">
        <p className="mx-auto max-w-[280px] break-keep text-xs font-bold leading-5 text-gray-600">{flow.result.reason}</p>
        <div className="mx-auto mt-2 flex max-w-[280px] flex-wrap justify-center gap-1.5">
          {flow.result.items.map((item, idx) => (
            <span
              key={item}
              className="live2d-rise max-w-full rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-bold text-gray-700 whitespace-normal break-keep text-center"
              style={{ animationDelay: `${idx * 45}ms` }}
            >
              {item}
            </span>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap justify-center gap-1.5">
          <button
            type="button"
            className={ASSISTANT_BUTTON_PRIMARY}
            style={{ animationDelay: "135ms" }}
            onClick={onOpenRecommendation}
          >
            추천 페이지 보기
          </button>
        </div>
      </div>
    );
  }

  const choices =
    flow.step === "mood"
      ? flow.source === "work_recommendation"
        ? [
            { key: "light", label: "편하게 볼 작품" },
            { key: "immersive", label: "몰입감 있는 작품" },
            { key: "reaction", label: "반응 좋은 작품" },
          ]
        : [
            { key: "light", label: "가볍게 즐기기" },
            { key: "immersive", label: "몰입할 작품" },
            { key: "reaction", label: "사람들 반응" },
          ]
      : flow.step === "work_detail"
        ? flow.mood === "light"
          ? [
              { key: "funny", label: "개그" },
              { key: "healing", label: "힐링" },
              { key: "episodic", label: "옴니버스" },
            ]
          : flow.mood === "immersive"
            ? [
                { key: "world", label: "세계관" },
                { key: "strategy", label: "두뇌전" },
                { key: "emotion", label: "감정선" },
              ]
            : [
                { key: "season", label: "이번 분기" },
                { key: "community", label: "댓글/밈" },
                { key: "safe", label: "검증된 인기작" },
              ]
        : flow.step === "work_length"
          ? [
              { key: "short", label: "짧게" },
              { key: "standard", label: "한두 쿨" },
              { key: "long", label: "길게" },
            ]
          : flow.step === "work_intensity"
            ? [
                { key: "soft", label: "편안하게" },
                { key: "balanced", label: "적당히" },
                { key: "strong", label: "강하게" },
              ]
        : [
            { key: "short", label: "잠깐 (1분)" },
            { key: "medium", label: "조금 (5분)" },
            { key: "long", label: "넉넉히" },
          ];

  return (
    <div className="mt-2 flex max-w-[420px] flex-wrap items-center justify-center gap-1.5">
      {choices.map((choice, idx) => (
        <button
          key={choice.key}
          type="button"
          className={ASSISTANT_BUTTON_PRIMARY}
          style={{ animationDelay: `${idx * 45}ms` }}
          onClick={() => {
            if (flow.step === "mood") {
              onMood(choice.key as WhatNowMood);
            } else if (flow.step === "work_detail") {
              onWorkDetail(choice.key as WorkRecommendationDetail);
            } else if (flow.step === "work_length") {
              onWorkLength(choice.key as WorkRecommendationLength);
            } else if (flow.step === "work_intensity") {
              void onWorkIntensity(choice.key as WorkRecommendationIntensity);
            } else if (flow.step === "time") {
              onTime(choice.key as WhatNowTime);
            }
          }}
        >
          {choice.label}
        </button>
      ))}
    </div>
  );
}

function AssistantQuickActions({
  slots,
  busyAction,
  onAction,
  onHideCharacter,
}: {
  slots: AssistantSlotKey[];
  busyAction: AssistantActionKey | null;
  onAction: (action: AssistantActionKey) => void;
  onHideCharacter: () => void;
}) {
  const definitions: AssistantSlotDefinition[] = slots.map(
    (key) => ASSISTANT_SLOT_DEFINITIONS[key],
  );

  return (
    <div
      data-testid="assistant-quick-actions"
      className="mt-2 flex max-w-[420px] flex-wrap items-center justify-center gap-1.5"
    >
      {definitions.map((definition, idx) => {
        const isBusy = busyAction === definition.key;
        return (
          <button
            key={definition.key}
            type="button"
            data-testid={`assistant-action-${definition.key}`}
            className={ASSISTANT_BUTTON_PRIMARY}
            style={{ animationDelay: `${idx * 45}ms` }}
            disabled={busyAction !== null}
            onClick={() => onAction(definition.key)}
          >
            {isBusy && (
              <span className="mr-1 inline-block h-2.5 w-2.5 animate-spin rounded-full border border-pink-400 border-t-transparent align-[-1px]" />
            )}
            {isBusy ? definition.busyLabel : definition.label}
          </button>
        );
      })}
      <button
        type="button"
        data-testid="assistant-action-hide-character"
        className={ASSISTANT_BUTTON_GHOST}
        style={{ animationDelay: `${definitions.length * 45}ms` }}
        disabled={busyAction !== null}
        onClick={onHideCharacter}
      >
        잠깐 숨기기
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
