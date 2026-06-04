const TYPE_SVG_ACCENT: Record<string, string> = {
  normal: "#949495", fighting: "#e09c40", flying: "#a2c3e7", poison: "#735198",
  ground: "#9c7743", rock: "#bfb889", bug: "#9fa244", ghost: "#684870",
  steel: "#69a9c7", fire: "#e56c3e", water: "#5185c5", grass: "#66a945",
  electric: "#fbb917", psychic: "#dd6b7b", ice: "#6dc8eb", dragon: "#535ca8",
  dark: "#4c4948", fairy: "#dab4d4",
};

function hexToRgb(hex: string) {
  const n = hex.replace("#", "");
  const v = parseInt(n.length === 3 ? n.split("").map((c) => c + c).join("") : n, 16);
  return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
}
function rgbToHex(r: number, g: number, b: number) {
  const cl = (x: number) => Math.max(0, Math.min(255, Math.round(x)));
  return `#${[cl(r), cl(g), cl(b)].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}
function mixHex(color: string, target: string, weight: number) {
  const s = hexToRgb(color), t = hexToRgb(target);
  return rgbToHex(s.r + (t.r - s.r) * weight, s.g + (t.g - s.g) * weight, s.b + (t.b - s.b) * weight);
}
function paletteFromAccent(accent: string) {
  const { r, g, b } = hexToRgb(accent);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return {
    accent,
    bg: mixHex(accent, lum > 0.58 ? "#080a0f" : "#0f1115", lum > 0.58 ? 0.9 : 0.8),
    sub: mixHex(accent, "#ffffff", lum > 0.58 ? 0.24 : 0.34),
    foil: mixHex(accent, "#ffffff", lum > 0.58 ? 0.5 : 0.62),
  };
}

const TYPE_OPTION_DEFS = [
  { id: "normal", label: "라이트 입덕형" }, { id: "fighting", label: "전투력 과몰입형" },
  { id: "flying", label: "본방 유목민형" }, { id: "poison", label: "피폐물 중독형" },
  { id: "ground", label: "원작 설정 지층형" }, { id: "rock", label: "고전 명작 수호형" },
  { id: "bug", label: "숨은 취향 채집형" }, { id: "ghost", label: "최애 사망 장례형" },
  { id: "steel", label: "설정 경찰형" }, { id: "fire", label: "순애 화력형" },
  { id: "water", label: "눈물샘 개방형" }, { id: "grass", label: "힐링 일상형" },
  { id: "electric", label: "신작 속보형" }, { id: "psychic", label: "망상 해석형" },
  { id: "ice", label: "작화 감별형" }, { id: "dragon", label: "세계관 심연형" },
  { id: "dark", label: "흑역사 봉인형" }, { id: "fairy", label: "최애 숭배형" },
];

export const TYPE_OPTIONS = TYPE_OPTION_DEFS.map((item) => ({
  ...item,
  ...paletteFromAccent(TYPE_SVG_ACCENT[item.id]),
}));

export const GRADE_OPTIONS = ["라이트 입덕", "현역 오타쿠", "심연 입구", "심연 거주자", "공식 설정 사서"];

export type CardType = (typeof TYPE_OPTIONS)[number];

/** PC(호버 + 정밀 포인터)는 마우스 tilt만. 모바일·태블릿에서만 deviceorientation tilt 허용. */
export function canUseDeviceOrientationTilt(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) return false;
  return window.matchMedia("(hover: none), (pointer: coarse)").matches;
}
