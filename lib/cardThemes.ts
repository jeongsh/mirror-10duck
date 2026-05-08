import { CardTheme } from "@/types/community";

export type ThemeStyles = {
  card:          string;  // 카드 외곽 테두리
  body:          string;  // 배경 없음 시 카드 본문 배경
  text:          string;  // 기본 텍스트
  subtext:       string;  // 보조 텍스트 (테마 악센트 컬러)
  border:        string;  // 내부 구분선
  badge:         string;  // 배지
  oshi:          string;  // 오시 섹션
  followBtn:     string;  // 팔로우 버튼
  label:         string;
  emoji:         string;
  nicknameColor: string;  // 닉네임 기본 색상 (hex, 빈 문자열 = 기본값)
  nicknameFont:  "sans" | "serif" | "mono";  // 닉네임 기본 폰트
  // 하위호환용 (미사용)
  header:        string;
};

export const CARD_THEMES: Record<CardTheme, ThemeStyles> = {
  default: {
    card:          "border border-gray-300 bg-white",
    body:          "bg-white",
    header:        "",
    text:          "text-gray-900",
    subtext:       "text-gray-500",
    border:        "border-gray-300",
    badge:         "bg-gray-100 border-gray-300 text-gray-700",
    oshi:          "bg-gray-50 border-gray-200",
    followBtn:     "border-gray-900 bg-gray-900 text-white hover:bg-gray-700",
    label:         "기본",
    emoji:         "⬜",
    nicknameColor: "",
    nicknameFont:  "sans",
  },
  dark: {
    card:          "border border-gray-900 bg-white",
    body:          "bg-white",
    header:        "",
    text:          "text-gray-900",
    subtext:       "text-gray-600",
    border:        "border-gray-800",
    badge:         "bg-gray-900 border-gray-900 text-white",
    oshi:          "bg-gray-900 border-gray-800",
    followBtn:     "border-gray-900 bg-gray-900 text-white hover:bg-gray-700",
    label:         "다크",
    emoji:         "🖤",
    nicknameColor: "#111827",
    nicknameFont:  "sans",
  },
  neon: {
    card:          "border-2 border-cyan-400 bg-white shadow-[0_0_12px_rgba(34,211,238,0.15)]",
    body:          "bg-white",
    header:        "",
    text:          "text-gray-900",
    subtext:       "text-cyan-500",
    border:        "border-cyan-300",
    badge:         "bg-cyan-50 border-cyan-400 text-cyan-700",
    oshi:          "bg-cyan-50 border-cyan-300",
    followBtn:     "border-cyan-500 bg-cyan-500 text-white hover:bg-cyan-400",
    label:         "네온",
    emoji:         "💙",
    nicknameColor: "#06b6d4",
    nicknameFont:  "mono",
  },
  pastel: {
    card:          "border border-pink-300 bg-white",
    body:          "bg-white",
    header:        "",
    text:          "text-gray-900",
    subtext:       "text-pink-400",
    border:        "border-pink-200",
    badge:         "bg-pink-50 border-pink-300 text-pink-700",
    oshi:          "bg-pink-50 border-pink-200",
    followBtn:     "border-pink-500 bg-pink-500 text-white hover:bg-pink-400",
    label:         "파스텔",
    emoji:         "🌸",
    nicknameColor: "#f472b6",
    nicknameFont:  "serif",
  },
  sakura: {
    card:          "border border-rose-300 bg-white",
    body:          "bg-white",
    header:        "",
    text:          "text-gray-900",
    subtext:       "text-rose-400",
    border:        "border-rose-200",
    badge:         "bg-rose-50 border-rose-300 text-rose-700",
    oshi:          "bg-rose-50 border-rose-200",
    followBtn:     "border-rose-500 bg-rose-500 text-white hover:bg-rose-600",
    label:         "사쿠라",
    emoji:         "🌺",
    nicknameColor: "#fb7185",
    nicknameFont:  "serif",
  },
  ocean: {
    card:          "border border-blue-400 bg-white",
    body:          "bg-white",
    header:        "",
    text:          "text-gray-900",
    subtext:       "text-blue-400",
    border:        "border-blue-200",
    badge:         "bg-blue-50 border-blue-300 text-blue-700",
    oshi:          "bg-blue-50 border-blue-200",
    followBtn:     "border-blue-500 bg-blue-500 text-white hover:bg-blue-600",
    label:         "오션",
    emoji:         "🌊",
    nicknameColor: "#3b82f6",
    nicknameFont:  "sans",
  },
  galaxy: {
    card:          "border border-violet-500 bg-white shadow-[0_0_12px_rgba(139,92,246,0.12)]",
    body:          "bg-white",
    header:        "",
    text:          "text-gray-900",
    subtext:       "text-violet-500",
    border:        "border-violet-300",
    badge:         "bg-violet-50 border-violet-400 text-violet-700",
    oshi:          "bg-violet-50 border-violet-300",
    followBtn:     "border-violet-600 bg-violet-600 text-white hover:bg-violet-500",
    label:         "갤럭시",
    emoji:         "🌌",
    nicknameColor: "#8b5cf6",
    nicknameFont:  "mono",
  },
};

export const THEME_ORDER: CardTheme[] = ["default","dark","neon","pastel","sakura","ocean","galaxy"];
