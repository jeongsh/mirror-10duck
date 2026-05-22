"use client";

import Link from "next/link";
import { CSSProperties, PointerEvent, useMemo, useRef, useState } from "react";
import { Download, ImagePlus, RefreshCcw, Save, Share2, X } from "lucide-react";
import { useAuthUser } from "@/lib/supabase/useAuthUser";
import { getOshiList, upsertOshi } from "@/lib/supabase/oshi";

const WORK_OPTIONS = ["슈타게", "봇치 더 록", "리제로", "주술회전", "프리렌", "체인소 맨", "에반게리온", "메이드 인 어비스"];
const TAG_OPTIONS = ["순애파", "피폐물 좋아함", "작화충", "원작 설정 경찰", "굿즈 수집", "1화 판독관", "오프닝 스킵 불가", "성우 따라감"];
const GRADE_OPTIONS = ["라이트 입덕", "현역 오타쿠", "심연 입구", "심연 거주자", "공식 설정 사서"];
const TYPE_SVG_ACCENT: Record<string, string> = {
  normal: "#949495",
  fighting: "#e09c40",
  flying: "#a2c3e7",
  poison: "#735198",
  ground: "#9c7743",
  rock: "#bfb889",
  bug: "#9fa244",
  ghost: "#684870",
  steel: "#69a9c7",
  fire: "#e56c3e",
  water: "#5185c5",
  grass: "#66a945",
  electric: "#fbb917",
  psychic: "#dd6b7b",
  ice: "#6dc8eb",
  dragon: "#535ca8",
  dark: "#4c4948",
  fairy: "#dab4d4",
};

const TYPE_OPTION_DEFS = [
  { id: "normal", label: "라이트 입덕형" },
  { id: "fighting", label: "전투력 과몰입형" },
  { id: "flying", label: "본방 유목민형" },
  { id: "poison", label: "피폐물 중독형" },
  { id: "ground", label: "원작 설정 지층형" },
  { id: "rock", label: "고전 명작 수호형" },
  { id: "bug", label: "숨은 취향 채집형" },
  { id: "ghost", label: "최애 사망 장례형" },
  { id: "steel", label: "설정 경찰형" },
  { id: "fire", label: "순애 화력형" },
  { id: "water", label: "눈물샘 개방형" },
  { id: "grass", label: "힐링 일상형" },
  { id: "electric", label: "신작 속보형" },
  { id: "psychic", label: "망상 해석형" },
  { id: "ice", label: "작화 감별형" },
  { id: "dragon", label: "세계관 심연형" },
  { id: "dark", label: "흑역사 봉인형" },
  { id: "fairy", label: "최애 숭배형" },
];

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "");
  const value = parseInt(normalized.length === 3 ? normalized.split("").map((char) => char + char).join("") : normalized, 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

function rgbToHex(r: number, g: number, b: number) {
  const clamp = (channel: number) => Math.max(0, Math.min(255, Math.round(channel)));
  return `#${[clamp(r), clamp(g), clamp(b)].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function mixHex(color: string, target: string, weight: number) {
  const source = hexToRgb(color);
  const blend = hexToRgb(target);
  return rgbToHex(
    source.r + (blend.r - source.r) * weight,
    source.g + (blend.g - source.g) * weight,
    source.b + (blend.b - source.b) * weight,
  );
}

function paletteFromAccent(accent: string) {
  const { r, g, b } = hexToRgb(accent);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const bgMix = luminance > 0.58 ? 0.9 : 0.8;
  const bgBase = luminance > 0.58 ? "#080a0f" : "#0f1115";

  return {
    accent,
    bg: mixHex(accent, bgBase, bgMix),
    sub: mixHex(accent, "#ffffff", luminance > 0.58 ? 0.24 : 0.34),
    foil: mixHex(accent, "#ffffff", luminance > 0.58 ? 0.5 : 0.62),
  };
}

const TYPE_OPTIONS = TYPE_OPTION_DEFS.map((item) => ({
  ...item,
  ...paletteFromAccent(TYPE_SVG_ACCENT[item.id]),
}));
const CARD_COPY_OPTIONS = [
  "나는 이런 씹덕입니다",
  "내 취향 보고 도망가지 마세요",
  "이 정도면 아직 라이트합니다",
  "최애 때문에 인생이 바뀐 사람",
];
const PALETTE_OPTIONS = [
  { id: "psychic", label: "사이킥", ...paletteFromAccent(TYPE_SVG_ACCENT.psychic) },
  { id: "electric", label: "일렉트릭", ...paletteFromAccent(TYPE_SVG_ACCENT.electric) },
  { id: "dragon", label: "드래곤", ...paletteFromAccent(TYPE_SVG_ACCENT.dragon) },
  { id: "mono", label: "블랙", bg: "#111113", accent: "#e5e7eb", sub: "#a1a1aa", foil: "#ffffff" },
];
const HOLO_TEXTURE_URL = "/viral/holo.png";
const SPARKLES_TEXTURE_URL = "/viral/sparkles.gif";
const CARD_EXPORT_WIDTH = 734;
const CARD_EXPORT_HEIGHT = 1024;
type Palette = (typeof PALETTE_OPTIONS)[number];
type CardType = (typeof TYPE_OPTIONS)[number];

type TiltState = {
  rotateX: number;
  rotateY: number;
  glareX: number;
  glareY: number;
};

function toggleValue(list: string[], value: string, limit: number) {
  if (list.includes(value)) return list.filter((item) => item !== value);
  if (list.length >= limit) return list;
  return [...list, value];
}

function readImageFile(file: File, onLoad: (dataUrl: string) => void) {
  if (!file.type.startsWith("image/")) return;
  const reader = new FileReader();
  reader.onload = () => onLoad(typeof reader.result === "string" ? reader.result : "");
  reader.readAsDataURL(file);
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  ctx.save();
  roundRect(ctx, x, y, width, height, radius);
  ctx.clip();
  const ratio = Math.max(width / image.width, height / image.height);
  const drawWidth = image.width * ratio;
  const drawHeight = image.height * ratio;
  ctx.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
  ctx.restore();
}

function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines = 2,
) {
  const chars = Array.from(text);
  const lines: string[] = [];
  let line = "";

  for (const char of chars) {
    const test = `${line}${char}`;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = char;
      if (lines.length >= maxLines) break;
    } else {
      line = test;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);

  lines.slice(0, maxLines).forEach((item, index) => {
    ctx.fillText(item, x, y + index * lineHeight);
  });
}

function drawFoil(ctx: CanvasRenderingContext2D, palette: Palette, x: number, y: number, width: number, height: number) {
  const rainbow = ctx.createLinearGradient(x, y, x + width, y + height);
  rainbow.addColorStop(0, "rgba(255,255,255,0.12)");
  rainbow.addColorStop(0.18, `${palette.sub}55`);
  rainbow.addColorStop(0.38, `${palette.accent}55`);
  rainbow.addColorStop(0.58, "rgba(255,255,255,0.18)");
  rainbow.addColorStop(0.78, `${palette.foil}55`);
  rainbow.addColorStop(1, "rgba(255,255,255,0.10)");
  ctx.fillStyle = rainbow;
  roundRect(ctx, x, y, width, height, 42);
  ctx.fill();

  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  for (let offset = -height; offset < width; offset += 34) {
    ctx.beginPath();
    ctx.moveTo(x + offset, y + height);
    ctx.lineTo(x + offset + height, y);
    ctx.stroke();
  }
  ctx.restore();
}

async function drawHoloTexture(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number) {
  const [holo, sparkles] = await Promise.all([
    loadImage(HOLO_TEXTURE_URL).catch(() => null),
    loadImage(SPARKLES_TEXTURE_URL).catch(() => null),
  ]);

  ctx.save();
  roundRect(ctx, x, y, width, height, 42);
  ctx.clip();
  ctx.globalCompositeOperation = "screen";
  ctx.globalAlpha = 0.14;
  if (holo) ctx.drawImage(holo, x, y, width, height);
  ctx.globalAlpha = 0.18;
  if (sparkles) ctx.drawImage(sparkles, x, y, width, height);

  const glare = ctx.createLinearGradient(x - width * 0.3, y + height * 0.15, x + width * 1.15, y + height * 0.82);
  glare.addColorStop(0, "rgba(255,255,255,0)");
  glare.addColorStop(0.44, "rgba(255,255,255,0)");
  glare.addColorStop(0.52, "rgba(255,255,255,0.20)");
  glare.addColorStop(0.58, "rgba(255,255,255,0.06)");
  glare.addColorStop(1, "rgba(255,255,255,0)");
  ctx.globalAlpha = 1;
  ctx.fillStyle = glare;
  ctx.fillRect(x, y, width, height);
  ctx.restore();
  ctx.globalCompositeOperation = "source-over";
}

async function renderCardToBlob({
  nickname,
  oshi,
  works,
  tags,
  grade,
  copy,
  hp,
  cardType,
  evolvesFrom,
  attack1,
  attack1Damage,
  attack2,
  attack2Damage,
  imageDataUrl,
  oshiAvatarDataUrl,
  palette,
}: {
  nickname: string;
  oshi: string;
  works: string[];
  tags: string[];
  grade: string;
  copy: string;
  hp: string;
  cardType: CardType;
  evolvesFrom: string;
  attack1: string;
  attack1Damage: string;
  attack2: string;
  attack2Damage: string;
  imageDataUrl: string;
  oshiAvatarDataUrl: string;
  palette: Palette;
}) {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_EXPORT_WIDTH;
  canvas.height = CARD_EXPORT_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context unavailable");

  ctx.fillStyle = "#f4f4f5";
  roundRect(ctx, 0, 0, canvas.width, canvas.height, 34);
  ctx.fill();

  ctx.fillStyle = "#111827";
  roundRect(ctx, 10, 10, 714, 1004, 26);
  ctx.fill();

  const borderGradient = ctx.createLinearGradient(18, 18, 716, 1006);
  borderGradient.addColorStop(0, "#ffffff");
  borderGradient.addColorStop(0.2, palette.foil);
  borderGradient.addColorStop(0.48, cardType.accent);
  borderGradient.addColorStop(0.72, palette.sub);
  borderGradient.addColorStop(1, "#ffffff");
  ctx.fillStyle = borderGradient;
  roundRect(ctx, 22, 20, 690, 984, 22);
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.92)";
  roundRect(ctx, 36, 34, 662, 956, 14);
  ctx.fill();

  ctx.save();
  roundRect(ctx, 44, 44, 646, 850, 8);
  ctx.clip();

  if (imageDataUrl) {
    try {
      const image = await loadImage(imageDataUrl);
      drawCoverImage(ctx, image, 44, 44, 646, 850, 0);
    } catch {
      // 이미지가 깨져도 카드 생성은 계속한다.
    }
  } else {
    const placeholder = ctx.createLinearGradient(44, 44, 690, 894);
    placeholder.addColorStop(0, palette.accent);
    placeholder.addColorStop(0.52, palette.bg);
    placeholder.addColorStop(1, palette.sub);
    ctx.fillStyle = placeholder;
    ctx.fillRect(44, 44, 646, 850);
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    roundRect(ctx, 128, 240, 480, 360, 18);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.45)";
    ctx.setLineDash([18, 14]);
    roundRect(ctx, 128, 240, 480, 360, 18);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(255,255,255,0.86)";
    ctx.font = "900 34px sans-serif";
    ctx.fillText("CHARACTER IMAGE", 178, 430);
  }
  ctx.restore();

  const artShade = ctx.createLinearGradient(44, 44, 690, 894);
  artShade.addColorStop(0, "rgba(255,255,255,0.12)");
  artShade.addColorStop(0.46, "rgba(255,255,255,0)");
  artShade.addColorStop(0.74, "rgba(0,0,0,0.10)");
  artShade.addColorStop(1, "rgba(0,0,0,0.34)");
  ctx.fillStyle = artShade;
  roundRect(ctx, 44, 44, 646, 850, 8);
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.78)";
  ctx.lineWidth = 4;
  roundRect(ctx, 44, 44, 646, 850, 8);
  ctx.stroke();

  const outlinedText = (text: string, x: number, y: number, font: string, fill = "#ffffff", stroke = "#111827", lineWidth = 7) => {
    ctx.font = font;
    ctx.lineJoin = "round";
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.strokeText(text, x, y);
    ctx.fillStyle = fill;
    ctx.fillText(text, x, y);
  };

  outlinedText(displaySafe(nickname || "이름 없는 오타쿠"), 58, 84, "900 38px sans-serif");
  try {
    const typeLogo = await loadImage(`/viral/type-logos/${cardType.id}.svg`);
    ctx.save();
    roundRect(ctx, 548, 36, 56, 56, 28);
    ctx.clip();
    ctx.drawImage(typeLogo, 548, 36, 56, 56);
    ctx.restore();
  } catch {
    // 타입 로고가 없어도 텍스트만 출력한다.
  }
  outlinedText(cardType.label, 612, 76, "900 18px sans-serif", "#ffffff", "#111827", 5);

  ctx.fillStyle = "rgba(0,0,0,0.58)";
  roundRect(ctx, 58, 584, 618, 136, 14);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.78)";
  ctx.lineWidth = 2;
  roundRect(ctx, 58, 584, 618, 136, 14);
  ctx.stroke();

  if (oshiAvatarDataUrl) {
    try {
      const avatar = await loadImage(oshiAvatarDataUrl);
      ctx.save();
      roundRect(ctx, 80, 610, 92, 92, 14);
      ctx.clip();
      drawCoverImage(ctx, avatar, 80, 610, 92, 92, 0);
      ctx.restore();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 4;
      roundRect(ctx, 80, 610, 92, 92, 14);
      ctx.stroke();
      ctx.strokeStyle = "#111827";
      ctx.lineWidth = 2;
      roundRect(ctx, 80, 610, 92, 92, 14);
      ctx.stroke();
    } catch {
      // 프로필 이미지가 깨져도 카드 생성은 계속한다.
    }
  } else {
    ctx.strokeStyle = "rgba(255,255,255,0.78)";
    ctx.setLineDash([8, 8]);
    roundRect(ctx, 80, 610, 92, 92, 14);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  outlinedText("최애캐 캐릭터", 196, 630, "900 18px sans-serif", "#ffffff", "#111827", 5);
  outlinedText(oshi || "아직 고르는 중", 196, 682, "900 38px sans-serif", "#ffffff", "#111827", 7);

  ctx.fillStyle = "rgba(0,0,0,0.58)";
  roundRect(ctx, 58, 742, 618, 72, 12);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.78)";
  ctx.lineWidth = 2;
  roundRect(ctx, 58, 742, 618, 72, 12);
  ctx.stroke();
  outlinedText("인생작", 78, 787, "900 20px sans-serif", "#ffffff", "#111827", 5);
  outlinedText(works.length ? works.join(" / ") : "인생작 미선택", 178, 787, "900 28px sans-serif", "#ffffff", "#111827", 5);

  ctx.fillStyle = "rgba(0,0,0,0.58)";
  roundRect(ctx, 58, 836, 618, 72, 12);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.78)";
  ctx.lineWidth = 2;
  roundRect(ctx, 58, 836, 618, 72, 12);
  ctx.stroke();
  outlinedText("등급", 78, 881, "900 20px sans-serif", "#ffffff", "#111827", 5);
  outlinedText(grade, 178, 881, "900 30px sans-serif", "#ffffff", "#111827", 6);
  outlinedText("©2026 SSIBDUK fandom profile card", 78, 978, "700 14px sans-serif", "rgba(255,255,255,0.85)", "#111827", 4);

  await drawHoloTexture(ctx, 24, 20, 686, 984);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) reject(new Error("Image export failed"));
      else resolve(blob);
    }, "image/png");
  });
}

function displaySafe(value: string) {
  return value.trim().slice(0, 18) || "SSIBDUK";
}

function splitInlineList(value: string, limit: number) {
  return value
    .split(/[\/,·]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, limit);
}

function typeLogoStyle(cardType: CardType): CSSProperties {
  return {
    backgroundImage: `url(/viral/type-logos/${cardType.id}.svg)`,
  };
}

export default function OshiCardPage() {
  const authUser = useAuthUser();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const oshiAvatarInputRef = useRef<HTMLInputElement>(null);
  const [nickname, setNickname] = useState("");
  const [oshi, setOshi] = useState("");
  const [works, setWorks] = useState<string[]>(["슈타게", "봇치 더 록", "리제로"]);
  const [customWork, setCustomWork] = useState("");
  const [tags, setTags] = useState<string[]>(["순애파", "피폐물 좋아함", "작화충"]);
  const [customTag, setCustomTag] = useState("");
  const [grade, setGrade] = useState(GRADE_OPTIONS[2]);
  const [copy, setCopy] = useState(CARD_COPY_OPTIONS[0]);
  const [hp, setHp] = useState("250");
  const [typeId, setTypeId] = useState(TYPE_OPTIONS[0].id);
  const [evolvesFrom, setEvolvesFrom] = useState("입덕작에서 진화함");
  const [attack1, setAttack1] = useState("순애 서사 과몰입");
  const [attack1Damage, setAttack1Damage] = useState("140");
  const [attack2, setAttack2] = useState("최애 선언 GX");
  const [attack2Damage, setAttack2Damage] = useState("300");
  const [paletteId, setPaletteId] = useState(PALETTE_OPTIONS[0].id);
  const [imageDataUrl, setImageDataUrl] = useState("");
  const [oshiAvatarDataUrl, setOshiAvatarDataUrl] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [isHoveringCard, setIsHoveringCard] = useState(false);
  const [isTypeMenuOpen, setIsTypeMenuOpen] = useState(false);
  const [tilt, setTilt] = useState<TiltState>({ rotateX: 0, rotateY: 0, glareX: 50, glareY: 50 });

  const cardType = useMemo(
    () => TYPE_OPTIONS.find((item) => item.id === typeId) ?? TYPE_OPTIONS[0],
    [typeId],
  );
  const palette = cardType;
  const displayName = nickname.trim() || authUser?.user_metadata?.nickname || "이름 없는 오타쿠";
  const canSave = Boolean(authUser?.id && oshi.trim());
  const gradeStars = Math.max(1, GRADE_OPTIONS.indexOf(grade) + 1);

  const payload = {
    nickname: displayName,
    oshi: oshi.trim(),
    works,
    tags,
    grade,
    copy,
    hp,
    cardType,
    evolvesFrom,
    attack1,
    attack1Damage,
    attack2,
    attack2Damage,
    imageDataUrl,
    oshiAvatarDataUrl,
    palette,
  };

  const handleImagePick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    readImageFile(file, setImageDataUrl);
    event.target.value = "";
  };

  const handleOshiAvatarPick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    readImageFile(file, setOshiAvatarDataUrl);
    event.target.value = "";
  };

  const handleTilt = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    setIsHoveringCard(true);
    setTilt({
      rotateX: (0.5 - y) * 16,
      rotateY: (x - 0.5) * 16,
      glareX: x * 100,
      glareY: y * 100,
    });
  };

  const resetTilt = () => {
    setIsHoveringCard(false);
    setTilt({ rotateX: 0, rotateY: 0, glareX: 50, glareY: 50 });
  };

  const exportBlob = async () => {
    setBusy(true);
    setMessage("");
    try {
      return await renderCardToBlob(payload);
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = async () => {
    try {
      const blob = await exportBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ssibduk-holo-oshi-card-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
      setMessage("홀로 카드 이미지를 저장했습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "이미지 생성에 실패했습니다.");
    }
  };

  const handleShare = async () => {
    try {
      const blob = await exportBlob();
      const file = new File([blob], "ssibduk-holo-oshi-card.png", { type: "image/png" });
      const nav = navigator as Navigator & {
        canShare?: (data: { files: File[] }) => boolean;
        share?: (data: { title: string; text: string; files?: File[] }) => Promise<void>;
      };
      if (nav.share && (!nav.canShare || nav.canShare({ files: [file] }))) {
        await nav.share({ title: "내 덕질 프로필 카드", text: copy, files: [file] });
        setMessage("공유 창을 열었습니다.");
      } else {
        await handleDownload();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "공유에 실패했습니다.");
    }
  };

  const handleSaveProfile = async () => {
    if (!authUser?.id) {
      setMessage("로그인하면 프로필에 저장할 수 있습니다.");
      return;
    }
    if (!oshi.trim()) {
      setMessage("최애를 먼저 입력해주세요.");
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      const current = await getOshiList(authUser.id);
      if (current.length > 0) {
        setMessage("이미 최애캐가 있습니다. 프로필에서 순서와 공개 여부를 조정해주세요.");
        return;
      }
      await upsertOshi(authUser.id, 1, {
        title: oshi.trim(),
        oshi_type: "character",
        description: [...works.slice(0, 2), ...tags.slice(0, 2)].join(" / ").slice(0, 100),
        is_public: true,
      });
      setMessage("프로필의 메인 최애캐로 저장했습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "프로필 저장에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const addCustomWork = () => {
    const value = customWork.trim();
    if (!value || works.includes(value) || works.length >= 5) return;
    setWorks((prev) => [...prev, value]);
    setCustomWork("");
  };

  const addCustomTag = () => {
    const value = customTag.trim();
    if (!value || tags.includes(value) || tags.length >= 6) return;
    setTags((prev) => [...prev, value]);
    setCustomTag("");
  };

  const cardStyle = {
    "--card-bg": cardType.bg,
    "--card-accent": cardType.accent,
    "--card-sub": cardType.sub,
    "--card-foil": cardType.foil,
    "--glare-x": `${tilt.glareX}%`,
    "--glare-y": `${tilt.glareY}%`,
    transform: `rotateX(${tilt.rotateX}deg) rotateY(${tilt.rotateY}deg)`,
  } as CSSProperties;

  const editorCardStyle = {
    "--card-bg": cardType.bg,
    "--card-accent": cardType.accent,
    "--card-sub": cardType.sub,
    "--card-foil": cardType.foil,
    "--glare-x": "50%",
    "--glare-y": "50%",
    transform: "none",
  } as CSSProperties;

  const renderCardFace = (editable: boolean) => (
    <div className="relative z-10 h-full overflow-hidden rounded-[4.2%/3%] border-[4px] border-zinc-950 bg-zinc-100 text-zinc-950">
      <div className="absolute inset-[1.1%] overflow-hidden rounded-[1.2%]">
        {imageDataUrl ? (
          <img src={imageDataUrl} alt="" className="h-full w-full object-cover object-top" />
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-[var(--card-accent)] via-[var(--card-bg)] to-[var(--card-sub)] px-6 text-center text-xs font-black text-white/85"
          >
            <ImagePlus size={28} />
            배경 이미지 추가
          </button>
        )}
      </div>

      <div className="pointer-events-none absolute inset-[1.1%] rounded-[1.2%] bg-gradient-to-b from-black/25 via-transparent to-black/55" />

      <header className="absolute left-[5%] right-[5%] top-[4%] flex items-center justify-between gap-4">
        {editable ? (
          <input
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            maxLength={16}
            placeholder={authUser?.user_metadata?.nickname || "닉네임"}
            className="min-w-0 flex-1 rounded border border-white/70 bg-black/35 px-2 py-1 text-xl font-black text-white outline-none placeholder:text-white/70"
          />
        ) : (
          <h2 className="oshi-title-stroke min-w-0 flex-1 truncate text-xl font-black text-white">
            {displayName}
          </h2>
        )}
        {editable ? (
          <div className="relative w-[44%] shrink-0">
            <button
              type="button"
              onClick={() => setIsTypeMenuOpen((value) => !value)}
              className="flex w-full items-center gap-2 rounded border border-white/70 bg-black/35 px-2 py-1 text-left"
            >
              <span className="h-7 w-7 shrink-0 rounded-full bg-center bg-contain bg-no-repeat" style={typeLogoStyle(cardType)} />
              <span className="min-w-0 flex-1 truncate text-xs font-black text-white">{cardType.label}</span>
            </button>
            {isTypeMenuOpen ? (
              <div className="absolute right-0 top-[calc(100%+6px)] z-50 max-h-56 w-64 overflow-y-auto rounded-lg border border-white/70 bg-zinc-950/95 p-1 shadow-2xl">
                {TYPE_OPTIONS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setTypeId(item.id);
                      setIsTypeMenuOpen(false);
                    }}
                    className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs font-black text-white hover:bg-white/15 ${
                      item.id === typeId ? "bg-white/20" : ""
                    }`}
                  >
                    <span className="h-7 w-7 shrink-0 rounded-full bg-center bg-contain bg-no-repeat" style={typeLogoStyle(item)} />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="flex shrink-0 items-center gap-2">
            <span className="h-6 w-6 rounded-full bg-center bg-contain bg-no-repeat drop-shadow-[0_2px_5px_rgba(0,0,0,.6)]" style={typeLogoStyle(cardType)} />
            <span className="oshi-title-stroke text-base font-black text-white">{cardType.label}</span>
          </div>
        )}
      </header>

      <div className="absolute inset-x-[5%] bottom-[26%] z-20">
        <div className="pointer-events-none absolute left-1/2 top-0 z-30 -translate-x-1/2 -translate-y-1/2">
          <div className="oshi-ribbon">
            <span aria-hidden>✦</span>
            <span>OTAKU CARD</span>
            <span aria-hidden>✦</span>
          </div>
        </div>
        <section className="oshi-info-plate relative flex min-h-[15.5%] items-center gap-3 p-2.5 pt-5">
          <button
            type="button"
            onClick={() => editable && oshiAvatarInputRef.current?.click()}
            className={`oshi-avatar-frame ${editable ? "" : "pointer-events-none"}`}
            aria-label="최애캐 캐릭터 사진 업로드"
          >
            {oshiAvatarDataUrl ? (
              <img src={oshiAvatarDataUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <ImagePlus className="m-auto text-white/90" size={22} />
            )}
            <span className="oshi-ex-badge" aria-hidden>EX</span>
          </button>
          <div className="min-w-0 flex-1">
            <span className="oshi-tag">
              <span aria-hidden>⚡</span> 최애캐
            </span>
            {editable ? (
              <input
                value={oshi}
                onChange={(event) => setOshi(event.target.value)}
                maxLength={28}
                placeholder="최애캐 캐릭터 닉네임"
                className="mt-1.5 w-full rounded border border-white/70 bg-white/90 px-2 py-1 text-lg font-black text-zinc-950 outline-none"
              />
            ) : (
              <p className="oshi-title-stroke mt-1 truncate text-2xl font-black text-white">
                {oshi.trim() || "아직 고르는 중"}
              </p>
            )}
          </div>
        </section>
      </div>

      <section className="oshi-info-plate absolute inset-x-[5%] bottom-[14%] flex min-h-[9%] flex-col justify-center gap-1 px-2.5 py-2">
        <div className="flex items-center gap-1.5">
          <span className="oshi-tag">
            <span aria-hidden>📖</span> 인생작
          </span>
          <span className="text-[9px] font-black tracking-widest text-white/55">{works.length}/5</span>
        </div>
        {editable ? (
          <input
            value={works.join(" / ")}
            onChange={(event) => setWorks(splitInlineList(event.target.value, 5))}
            placeholder="슈타게 / 봇치 더 록 / 리제로"
            className="w-full rounded border border-white/70 bg-white/90 px-2 py-1 text-sm font-black text-zinc-950 outline-none"
          />
        ) : works.length ? (
          <div className="flex flex-wrap gap-1">
            {works.map((work) => (
              <span key={work} className="oshi-chip">
                {work}
              </span>
            ))}
          </div>
        ) : (
          <p className="oshi-title-stroke truncate text-sm font-black italic text-white/80">인생작 미선택</p>
        )}
      </section>

      <section className="oshi-info-plate absolute inset-x-[5%] bottom-[3%] flex min-h-[9%] items-center justify-between gap-2 px-2.5 py-2">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <span className="oshi-tag">
            <span aria-hidden>🏅</span> 등급
          </span>
          {editable ? (
            <select
              value={grade}
              onChange={(event) => setGrade(event.target.value)}
              className="w-full rounded border border-white/70 bg-white/90 px-2 py-1 text-sm font-black text-zinc-950 outline-none"
            >
              {GRADE_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          ) : (
            <p className="oshi-title-stroke truncate text-base font-black text-white">{grade}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-[1px]">
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className={`oshi-star ${i < gradeStars ? "oshi-star-on" : "oshi-star-off"}`} aria-hidden>
              ★
            </span>
          ))}
        </div>
      </section>
    </div>
  );

  return (
    <main className="w-full">
      <div className="border border-dashed border-gray-500 bg-white p-5">
        <Link href="/play" className="text-xs font-bold text-gray-500 hover:underline">
          바이럴 허브로 돌아가기
        </Link>
        <h1 className="mt-3 text-2xl font-black text-gray-900">덕질 프로필 카드 생성기</h1>
        <p className="mt-2 text-sm leading-6 text-gray-600">
          왼쪽 카드에서 직접 입력하고, 오른쪽 카드에서 마우스 오버 홀로그램 반응을 확인합니다.
        </p>
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImagePick} />
      <input ref={oshiAvatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleOshiAvatarPick} />

      <section className="mt-5 grid gap-5 xl:grid-cols-2">
        <div className="border border-dashed border-gray-500 bg-white p-4">
          <div className="mb-3 flex items-center justify-between border-b border-dashed border-gray-300 pb-2">
            <h2 className="text-sm font-black text-gray-900">직접 입력 카드</h2>
            <div className="flex items-center gap-1">
              {oshiAvatarDataUrl ? (
                <button
                  type="button"
                  onClick={() => setOshiAvatarDataUrl("")}
                  className="inline-flex items-center gap-1 border border-dashed border-red-300 px-2 py-1 text-xs font-bold text-red-500 hover:bg-red-50"
                >
                  <X size={14} />
                  프로필 제거
                </button>
              ) : null}
              {imageDataUrl ? (
                <button
                  type="button"
                  onClick={() => setImageDataUrl("")}
                  className="inline-flex items-center gap-1 border border-dashed border-red-300 px-2 py-1 text-xs font-bold text-red-500 hover:bg-red-50"
                >
                  <X size={14} />
                  제거
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => oshiAvatarInputRef.current?.click()}
                className="inline-flex items-center gap-1 border border-dashed border-gray-400 px-2 py-1 text-xs font-bold text-gray-600 hover:bg-gray-100"
              >
                <ImagePlus size={14} />
                최애캐 프로필
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1 border border-dashed border-gray-400 px-2 py-1 text-xs font-bold text-gray-600 hover:bg-gray-100"
              >
                <ImagePlus size={14} />
                배경
              </button>
            </div>
          </div>
          <div
            className="mx-auto [perspective:1200px]"
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "copy";
            }}
            onDrop={(event) => {
              event.preventDefault();
              const file = event.dataTransfer.files?.[0];
              if (file) readImageFile(file, setImageDataUrl);
            }}
          >
            <div
              className="oshi-holo-card relative mx-auto aspect-[734/1024] w-full max-w-[420px] overflow-hidden rounded-[4.8%/3.4%] bg-zinc-100 p-[0.9%] text-white shadow-2xl [transform-style:preserve-3d]"
              style={editorCardStyle}
              data-hovering="false"
            >
              {renderCardFace(true)}
              <div className="pointer-events-none absolute inset-0 z-20 holo-foil" />
              <div className="pointer-events-none absolute inset-0 z-40 rounded-[4.8%/3.4%] ring-2 ring-white/45" />
            </div>
          </div>
        </div>

        <div className="border border-dashed border-gray-500 bg-white p-4">
          <div className="mb-3 border-b border-dashed border-gray-300 pb-2">
            <h2 className="text-sm font-black text-gray-900">공유 미리보기</h2>
            <p className="mt-1 text-xs text-gray-500">이 카드만 마우스 오버와 tilt 홀로그램이 반응합니다.</p>
          </div>
          <div className="mx-auto [perspective:1200px]">
            <div
              className="oshi-holo-card relative mx-auto aspect-[734/1024] w-full max-w-[420px] overflow-hidden rounded-[4.8%/3.4%] bg-zinc-100 p-[0.9%] text-white shadow-2xl transition-transform duration-150 ease-out [transform-style:preserve-3d]"
              style={cardStyle}
              data-hovering={isHoveringCard ? "true" : "false"}
              onPointerMove={handleTilt}
              onPointerLeave={resetTilt}
            >
              {renderCardFace(false)}
              <div
                className="pointer-events-none absolute inset-0 z-20 holo-foil"
                style={{
                  opacity: isHoveringCard ? 0.68 : 0.22,
                  filter: isHoveringCard ? "brightness(1.08) contrast(1.36) saturate(1.6)" : undefined,
                }}
              />
              <div className="pointer-events-none absolute inset-0 z-[25] holo-type-tint" style={{ opacity: isHoveringCard ? 0.3 : 0 }} />
              <div className="pointer-events-none absolute inset-0 z-30 holo-glare" style={{ opacity: isHoveringCard ? 0.46 : 0 }} />
              <div className="pointer-events-none absolute inset-0 z-40 rounded-[4.8%/3.4%] ring-2 ring-white/45" />
            </div>
          </div>
        </div>
      </section>

      {message ? <p className="mt-3 text-xs font-bold text-gray-600">{message}</p> : null}

      <section className="mt-5 grid gap-2 sm:grid-cols-3">
        <button
          type="button"
          disabled={busy}
          onClick={handleDownload}
          className="inline-flex items-center justify-center gap-2 border border-dashed border-gray-700 bg-gray-900 px-3 py-2 text-xs font-bold text-white hover:bg-gray-800 disabled:opacity-50"
        >
          <Download size={15} />
          카드 저장
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={handleShare}
          className="inline-flex items-center justify-center gap-2 border border-dashed border-gray-500 bg-white px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-100 disabled:opacity-50"
        >
          <Share2 size={15} />
          공유하기
        </button>
        <button
          type="button"
          disabled={busy || !canSave}
          onClick={handleSaveProfile}
          className="inline-flex items-center justify-center gap-2 border border-dashed border-pink-500 bg-pink-50 px-3 py-2 text-xs font-bold text-pink-700 hover:bg-pink-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save size={15} />
          프로필 저장
        </button>
      </section>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {!authUser ? (
          <Link href="/auth" className="border border-dashed border-gray-400 bg-white p-3 text-center text-xs font-bold text-gray-600 hover:bg-gray-100">
            로그인하면 최애캐를 프로필에 저장할 수 있습니다.
          </Link>
        ) : (
          <Link href="/profile?tab=oshi" className="border border-dashed border-gray-400 bg-white p-3 text-center text-xs font-bold text-gray-600 hover:bg-gray-100">
            프로필에서 최애캐/카드 더 꾸미기
          </Link>
        )}
        <p className="border border-dashed border-gray-400 bg-white p-3 text-center text-xs font-bold text-gray-600">
          기본 반짝임은 양쪽에 유지되고, hover 반응은 오른쪽만 켜집니다.
        </p>
      </div>

      <style jsx>{`
        .oshi-holo-card {
          background:
            linear-gradient(115deg, transparent 0%, rgba(255,255,255,.20) var(--glare-x), transparent 58%),
            radial-gradient(farthest-corner circle at var(--glare-x) var(--glare-y), rgba(255,255,255,.34) 0%, rgba(255,255,255,.10) 22%, transparent 44%),
            linear-gradient(135deg, var(--card-accent), var(--card-bg) 44%, var(--card-sub));
        }
        .holo-foil {
          background:
            radial-gradient(circle at var(--glare-x) var(--glare-y), color-mix(in srgb, var(--card-accent) 48%, white) 0%, transparent 34%),
            url("${SPARKLES_TEXTURE_URL}") var(--glare-x) var(--glare-y) / cover,
            url("${HOLO_TEXTURE_URL}") center / cover,
            repeating-linear-gradient(115deg, transparent 0 10px, rgba(255,255,255,.10) 11px 12px, transparent 13px 24px),
            conic-gradient(
              from 180deg at var(--glare-x) var(--glare-y),
              rgba(255,0,128,.16),
              rgba(255,140,0,.12),
              rgba(255,255,0,.10),
              rgba(0,255,132,.12),
              rgba(0,194,255,.18),
              rgba(139,92,246,.14),
              rgba(255,0,128,.16)
            );
          background-blend-mode: screen, screen, screen, overlay, normal;
          mix-blend-mode: screen;
          filter: brightness(.82) contrast(1.18) saturate(1.25);
          opacity: .22;
          transition: opacity 160ms ease, filter 160ms ease;
        }
        .holo-glare {
          background:
            linear-gradient(
              115deg,
              transparent 16%,
              rgba(255,255,255,.10) calc(var(--glare-x) - 12%),
              rgba(255,255,255,.34) var(--glare-x),
              rgba(255,255,255,.12) calc(var(--glare-x) + 12%),
              transparent 84%
            ),
            radial-gradient(
              circle at var(--glare-x) var(--glare-y),
              rgba(255, 255, 255, 0.32),
              rgba(255, 255, 255, 0.12) 16%,
              transparent 38%
            );
          mix-blend-mode: screen;
          opacity: 0;
          transition: opacity 160ms ease;
        }
        .holo-type-tint {
          background:
            linear-gradient(115deg, transparent 8%, var(--card-accent) 38%, var(--card-foil) 58%, transparent 86%),
            radial-gradient(circle at var(--glare-x) var(--glare-y), var(--card-sub), transparent 42%);
          mix-blend-mode: color-dodge;
          transition: opacity 160ms ease;
        }
        .oshi-holo-card[data-hovering="true"] .holo-foil {
          opacity: .68;
          filter: brightness(1.08) contrast(1.36) saturate(1.6);
        }
        .oshi-holo-card[data-hovering="true"] .holo-glare {
          opacity: .46;
        }
        :global(.oshi-title-stroke) {
          text-shadow:
            -2px -2px 0 #111827,
            2px -2px 0 #111827,
            -2px 2px 0 #111827,
            2px 2px 0 #111827,
            0 -2px 0 #111827,
            0 2px 0 #111827,
            -2px 0 0 #111827,
            2px 0 0 #111827,
            0 2px 6px rgba(0,0,0,.55);
        }
        :global(.oshi-info-plate) {
          border-radius: 12px;
          background:
            linear-gradient(135deg, rgba(0,0,0,.78) 0%, rgba(20,20,32,.72) 50%, rgba(0,0,0,.82) 100%);
          border: 1.5px solid rgba(255,255,255,.55);
          box-shadow:
            0 10px 26px rgba(0,0,0,.45),
            inset 0 1px 0 rgba(255,255,255,.2),
            inset 0 -1px 0 rgba(0,0,0,.45);
          isolation: isolate;
        }
        :global(.oshi-info-plate::before) {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          padding: 1.5px;
          background: linear-gradient(135deg, var(--card-accent), var(--card-foil) 50%, var(--card-sub));
          -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
          z-index: 1;
        }
        :global(.oshi-info-plate::after) {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          background:
            radial-gradient(120% 60% at 0% 0%, var(--card-accent) 0%, transparent 55%),
            radial-gradient(120% 60% at 100% 100%, var(--card-sub) 0%, transparent 55%);
          mix-blend-mode: overlay;
          opacity: .55;
          pointer-events: none;
          z-index: 0;
        }
        :global(.oshi-info-plate > *) {
          position: relative;
          z-index: 2;
        }
        :global(.oshi-ribbon) {
          display: inline-flex;
          align-items: center;
          gap: .55rem;
          padding: 3px 16px;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: .22em;
          color: #1a1208;
          text-shadow: 0 1px 0 rgba(255,255,255,.55);
          background:
            linear-gradient(180deg, rgba(255,255,255,.55) 0%, rgba(255,255,255,0) 55%),
            linear-gradient(90deg, var(--card-accent) 0%, var(--card-foil) 50%, var(--card-accent) 100%);
          border-radius: 999px;
          border: 1.5px solid rgba(255,255,255,.9);
          box-shadow:
            0 6px 16px rgba(0,0,0,.5),
            inset 0 1px 0 rgba(255,255,255,.7),
            inset 0 -1px 0 rgba(0,0,0,.3);
        }
        :global(.oshi-tag) {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          padding: 1.5px 8px;
          font-size: 9.5px;
          font-weight: 900;
          letter-spacing: .12em;
          color: #fff;
          text-shadow: 0 1px 1px rgba(0,0,0,.55);
          background: linear-gradient(95deg, var(--card-accent), var(--card-sub));
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,.55);
          box-shadow: 0 2px 6px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.35);
          width: fit-content;
          white-space: nowrap;
        }
        :global(.oshi-chip) {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          padding: 2px 8px;
          font-size: 11px;
          font-weight: 900;
          color: #fff;
          text-shadow:
            -1.5px -1.5px 0 #111,
            1.5px -1.5px 0 #111,
            -1.5px 1.5px 0 #111,
            1.5px 1.5px 0 #111;
          background: linear-gradient(135deg, rgba(255,255,255,.22), rgba(255,255,255,.08));
          border: 1px solid rgba(255,255,255,.5);
          border-radius: 6px;
          box-shadow: 0 2px 4px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.3);
        }
        :global(.oshi-chip::before) {
          content: "✦";
          font-size: 9px;
          color: var(--card-foil);
          text-shadow: 0 0 4px var(--card-accent);
        }
        :global(.oshi-avatar-frame) {
          position: relative;
          display: flex;
          height: 5rem;
          width: 5rem;
          flex-shrink: 0;
          overflow: visible;
          border-radius: 14px;
          background: rgba(0,0,0,.4);
          isolation: isolate;
        }
        :global(.oshi-avatar-frame > img),
        :global(.oshi-avatar-frame > svg) {
          border-radius: 12px;
          overflow: hidden;
        }
        :global(.oshi-avatar-frame > img) {
          height: 100%;
          width: 100%;
          object-fit: cover;
        }
        :global(.oshi-avatar-frame::before) {
          content: "";
          position: absolute;
          inset: -2px;
          border-radius: 16px;
          padding: 2.5px;
          background: linear-gradient(135deg, var(--card-accent), var(--card-foil), var(--card-sub));
          -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
          box-shadow: 0 6px 14px rgba(0,0,0,.4);
        }
        :global(.oshi-avatar-frame::after) {
          content: "";
          position: absolute;
          inset: 2px;
          border-radius: 12px;
          border: 1.5px solid rgba(255,255,255,.7);
          pointer-events: none;
        }
        :global(.oshi-ex-badge) {
          position: absolute;
          right: -6px;
          bottom: -6px;
          z-index: 5;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 1.5px 6px;
          font-size: 10px;
          font-weight: 900;
          font-style: italic;
          letter-spacing: .04em;
          color: #1a1208;
          background: linear-gradient(135deg, #fde047, #fbbf24 55%, #fde047);
          border: 1.5px solid #fff;
          border-radius: 999px;
          box-shadow: 0 3px 8px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.6);
        }
        :global(.oshi-star) {
          font-size: 14px;
          line-height: 1;
        }
        :global(.oshi-star-on) {
          color: #fde047;
          text-shadow:
            0 0 6px rgba(253,224,71,.65),
            0 0 2px rgba(253,224,71,.95),
            0 1px 0 rgba(0,0,0,.6);
        }
        :global(.oshi-star-off) {
          color: rgba(255,255,255,.22);
          text-shadow: 0 1px 0 rgba(0,0,0,.45);
        }
      `}</style>
    </main>
  );

  return (
    <main className="grid w-full gap-6 xl:grid-cols-[minmax(0,1fr)_430px]">
      <section className="flex min-w-0 flex-col gap-5">
        <div className="border border-dashed border-gray-500 bg-white p-5">
          <Link href="/play" className="text-xs font-bold text-gray-500 hover:underline">
            바이럴 허브로 돌아가기
          </Link>
          <h1 className="mt-3 text-2xl font-black text-gray-900">최애캐 홀로 카드 생성기</h1>
          <p className="mt-2 text-sm leading-6 text-gray-600">
            최애와 취향을 포켓몬 카드처럼 세로형 홀로 트레이딩 카드로 만듭니다.
            이미지는 서버에 올리지 않고 브라우저 안에서만 렌더링됩니다.
          </p>
        </div>

        <section className="border border-dashed border-gray-500 bg-white p-5">
          <h2 className="border-b border-dashed border-gray-300 pb-2 text-sm font-black text-gray-900">기본 정보</h2>
          <div className="mt-4 grid gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-gray-600">트레이너 이름</span>
              <input
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                maxLength={16}
                placeholder={authUser?.user_metadata?.nickname || "예: 심연입구주민"}
                className="border border-dashed border-gray-400 px-3 py-2 text-sm outline-none focus:border-gray-800"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-gray-600">카드 문구</span>
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <select
                  value={copy}
                  onChange={(event) => setCopy(event.target.value)}
                  className="border border-dashed border-gray-400 bg-white px-3 py-2 text-sm outline-none focus:border-gray-800"
                >
                  {CARD_COPY_OPTIONS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    const index = CARD_COPY_OPTIONS.indexOf(copy);
                    setCopy(CARD_COPY_OPTIONS[(index + 1) % CARD_COPY_OPTIONS.length]);
                  }}
                  className="inline-flex items-center justify-center gap-1 border border-dashed border-gray-400 px-3 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100"
                >
                  <RefreshCcw size={14} />
                  변경
                </button>
              </div>
            </label>
          </div>
        </section>

        <section className="border border-dashed border-gray-500 bg-white p-5">
          <h2 className="border-b border-dashed border-gray-300 pb-2 text-sm font-black text-gray-900">인생작</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {WORK_OPTIONS.map((work) => (
              <button
                key={work}
                type="button"
                onClick={() => setWorks((prev) => toggleValue(prev, work, 5))}
                className={`border px-3 py-1.5 text-xs font-bold ${
                  works.includes(work)
                    ? "border-gray-900 bg-gray-900 text-white"
                    : "border-dashed border-gray-300 bg-white text-gray-600 hover:border-gray-600"
                }`}
              >
                {work}
              </button>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <input
              value={customWork}
              onChange={(event) => setCustomWork(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addCustomWork();
                }
              }}
              placeholder="직접 입력"
              className="min-w-0 flex-1 border border-dashed border-gray-400 px-3 py-2 text-sm outline-none focus:border-gray-800"
            />
            <button type="button" onClick={addCustomWork} className="border border-dashed border-gray-500 px-3 py-2 text-xs font-bold">
              추가
            </button>
          </div>
        </section>

        <section className="border border-dashed border-gray-500 bg-white p-5">
          <h2 className="border-b border-dashed border-gray-300 pb-2 text-sm font-black text-gray-900">취향 타입</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {TAG_OPTIONS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setTags((prev) => toggleValue(prev, tag, 6))}
                className={`border px-3 py-1.5 text-xs font-bold ${
                  tags.includes(tag)
                    ? "border-pink-600 bg-pink-600 text-white"
                    : "border-dashed border-gray-300 bg-white text-gray-600 hover:border-pink-400"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <input
              value={customTag}
              onChange={(event) => setCustomTag(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addCustomTag();
                }
              }}
              placeholder="직접 입력"
              className="min-w-0 flex-1 border border-dashed border-gray-400 px-3 py-2 text-sm outline-none focus:border-gray-800"
            />
            <button type="button" onClick={addCustomTag} className="border border-dashed border-gray-500 px-3 py-2 text-xs font-bold">
              추가
            </button>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <div className="border border-dashed border-gray-500 bg-white p-5">
            <h2 className="border-b border-dashed border-gray-300 pb-2 text-sm font-black text-gray-900">희귀도</h2>
            <select
              value={grade}
              onChange={(event) => setGrade(event.target.value)}
              className="mt-4 w-full border border-dashed border-gray-400 bg-white px-3 py-2 text-sm outline-none focus:border-gray-800"
            >
              {GRADE_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div className="border border-dashed border-gray-500 bg-white p-5">
            <h2 className="border-b border-dashed border-gray-300 pb-2 text-sm font-black text-gray-900">홀로 타입</h2>
            <div className="mt-4 grid grid-cols-4 gap-2">
              {PALETTE_OPTIONS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setPaletteId(item.id)}
                  className={`border p-2 text-xs font-bold ${
                    paletteId === item.id ? "border-gray-900 ring-2 ring-gray-900 ring-offset-1" : "border-dashed border-gray-300"
                  }`}
                >
                  <span className="mb-1 block h-5 border" style={{ background: item.bg, borderColor: item.accent }} />
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="border border-dashed border-gray-500 bg-white p-5">
          <h2 className="border-b border-dashed border-gray-300 pb-2 text-sm font-black text-gray-900">최애캐 카드 구성</h2>
          <div className="mt-4">
            <div className="relative mx-auto aspect-[734/1024] w-full max-w-[360px] rounded-[4.8%/3.4%] border-4 border-gray-900 bg-gradient-to-br from-gray-100 via-white to-gray-200 p-[1.1%] shadow">
              <div className="absolute inset-[1.1%] rounded-[1.2%] border border-dashed border-gray-300 bg-gradient-to-br from-[var(--card-accent)]/20 via-white to-[var(--card-sub)]/20" />

              <label className="absolute left-[4%] right-[31%] top-[3.2%]">
                <span className="sr-only">상단 카드 이름</span>
                <input
                  value={oshi}
                  onChange={(event) => setOshi(event.target.value)}
                  maxLength={28}
                  placeholder="최애캐 이름"
                  className="h-9 w-full rounded border border-gray-300 bg-white/95 px-2 text-base font-black text-gray-950 shadow outline-none focus:border-gray-900"
                />
              </label>

              <label className="absolute right-[4%] top-[3.2%] w-[25%]">
                <span className="sr-only">상단 덕력</span>
                <input
                  value={hp}
                  onChange={(event) => setHp(event.target.value.replace(/[^\d]/g, "").slice(0, 3))}
                  maxLength={3}
                  className="h-9 w-full rounded border border-gray-300 bg-white/95 px-2 text-right text-base font-black text-gray-950 shadow outline-none focus:border-gray-900"
                />
              </label>

              <label className="absolute left-[7%] top-[9.7%] w-[64%] skew-x-[-10deg]">
                <span className="sr-only">상단 입덕 루트</span>
              <input
                value={evolvesFrom}
                onChange={(event) => setEvolvesFrom(event.target.value)}
                maxLength={36}
                  className="h-7 w-full border border-gray-300 bg-white/95 px-2 text-xs font-bold italic text-gray-800 shadow outline-none focus:border-gray-900"
              />
              </label>

              <label className="absolute left-[4.7%] right-[4.7%] bottom-[30.4%]">
                <span className="sr-only">중단 대표 취향</span>
                <div className="grid grid-cols-[1fr_64px] gap-1">
                  <input
                    value={attack1}
                    onChange={(event) => setAttack1(event.target.value)}
                    maxLength={24}
                    className="h-9 rounded border border-gray-300 bg-white/95 px-2 text-sm font-black text-gray-950 shadow outline-none focus:border-gray-900"
                  />
                  <input
                    value={attack1Damage}
                    onChange={(event) => setAttack1Damage(event.target.value.replace(/[^\d]/g, "").slice(0, 3))}
                    maxLength={3}
                    className="h-9 rounded border border-gray-300 bg-white/95 px-2 text-right text-sm font-black text-gray-950 shadow outline-none focus:border-gray-900"
                  />
                </div>
              </label>

              <label className="absolute left-[4.7%] right-[4.7%] bottom-[23.6%]">
                <span className="sr-only">중단 최애 선언</span>
                <div className="grid grid-cols-[1fr_64px] gap-1 rounded-sm p-1" style={{ background: `linear-gradient(90deg, ${cardType.accent}, ${palette.sub}, #111827)` }}>
                  <input
                    value={attack2}
                    onChange={(event) => setAttack2(event.target.value)}
                    maxLength={24}
                    className="h-8 border border-white/50 bg-white/20 px-2 text-sm font-black italic text-white placeholder:text-white/70 outline-none focus:border-white"
                  />
                  <input
                    value={attack2Damage}
                    onChange={(event) => setAttack2Damage(event.target.value.replace(/[^\d]/g, "").slice(0, 3))}
                    maxLength={3}
                    className="h-8 border border-white/50 bg-white/20 px-2 text-right text-sm font-black text-white outline-none focus:border-white"
                  />
                </div>
              </label>

              <label className="absolute left-[4.7%] right-[4.7%] bottom-[16.3%]">
                <span className="sr-only">덕질 속성</span>
              <select
                value={typeId}
                onChange={(event) => setTypeId(event.target.value)}
                  className="h-8 w-full rounded-sm border border-gray-300 bg-white/95 px-2 text-xs font-black text-gray-700 shadow outline-none focus:border-gray-900"
              >
                {TYPE_OPTIONS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
              </label>
            </div>
            <p className="mt-3 text-xs leading-5 text-gray-500">
              추천 구성은 덕력, 입덕 루트, 대표 취향, 최애 선언, 몰입도입니다. 공유용 최애캐 프로필에 자연스럽게 읽히도록 카드 위치만 유지했습니다.
            </p>
          </div>
        </section>
      </section>

      <aside className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-24 xl:self-start">
        <section className="border border-dashed border-gray-500 bg-white p-4">
          <div className="mb-3 flex items-center justify-between border-b border-dashed border-gray-300 pb-2">
            <h2 className="text-sm font-black text-gray-900">홀로 카드 미리보기</h2>
            <div className="flex items-center gap-1">
              {imageDataUrl ? (
                <button
                  type="button"
                  onClick={() => setImageDataUrl("")}
                  className="inline-flex items-center gap-1 border border-dashed border-red-300 px-2 py-1 text-xs font-bold text-red-500 hover:bg-red-50"
                >
                  <X size={14} />
                  제거
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1 border border-dashed border-gray-400 px-2 py-1 text-xs font-bold text-gray-600 hover:bg-gray-100"
              >
                <ImagePlus size={14} />
                이미지
              </button>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImagePick} />
          </div>

          <div
            className="[perspective:1200px]"
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "copy";
            }}
            onDrop={(event) => {
              event.preventDefault();
              const file = event.dataTransfer.files?.[0];
              if (file) readImageFile(file, setImageDataUrl);
            }}
          >
            <div
              className="oshi-holo-card relative mx-auto aspect-[734/1024] w-full max-w-[360px] overflow-hidden rounded-[4.8%/3.4%] bg-zinc-100 p-[0.9%] text-white shadow-2xl transition-transform duration-150 ease-out [transform-style:preserve-3d]"
              style={cardStyle}
              data-hovering={isHoveringCard ? "true" : "false"}
              onPointerMove={handleTilt}
              onPointerLeave={resetTilt}
            >
              <div className="relative z-10 h-full overflow-hidden rounded-[4.2%/3%] border-[4px] border-zinc-950 bg-zinc-100 text-zinc-950">
                <div className="absolute inset-[1.1%] overflow-hidden rounded-[1.2%]">
                  {imageDataUrl ? (
                    <img src={imageDataUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-[var(--card-accent)] via-[var(--card-bg)] to-[var(--card-sub)] px-6 text-center text-xs font-black text-white/85"
                    >
                      <ImagePlus size={28} />
                      캐릭터 이미지 추가
                    </button>
                  )}
                </div>

                <div className="pointer-events-none absolute inset-[1.1%] rounded-[1.2%] bg-gradient-to-b from-white/10 via-transparent to-black/25" />

                <header className="absolute left-[4%] right-[4%] top-[3.2%] flex items-start gap-1.5">
                  <div className="min-w-0 flex-1 rounded border border-zinc-300 bg-white/90 px-2 py-1 shadow">
                    <h2 className="line-clamp-1 text-xl font-black leading-tight text-zinc-950">
                      {oshi.trim() || "아직 고르는 중"}
                      <span className="ml-1 italic text-cyan-500">GX</span>
                    </h2>
                  </div>
                  <span className="shrink-0 rounded border border-zinc-300 bg-white/90 px-1.5 py-1 text-base font-black text-zinc-950 shadow">
                    <span className="text-[9px]">덕력</span> {hp || "250"} <span style={{ color: cardType.accent }}>{cardType.label}</span>
                  </span>
                </header>

                <div className="absolute left-[7%] top-[9.7%] max-w-[70%] skew-x-[-10deg] border border-zinc-400 bg-white/90 px-2 py-0.5 text-[10px] font-bold italic text-zinc-800 shadow">
                  {evolvesFrom || copy}
                </div>

                <section className="absolute inset-x-[4.7%] bottom-[22.1%] rounded border border-white/60 bg-white/90 p-2 shadow">
                  <div className="flex items-center gap-2 border-b border-zinc-300 pb-1">
                    <span className="text-base leading-none">✦✦</span>
                    <span className="min-w-0 flex-1 truncate text-lg font-black">{attack1 || "대표 취향"}</span>
                    <span className="text-xl font-black">{attack1Damage || "140"}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 rounded-sm px-1 py-1 text-white" style={{ background: `linear-gradient(90deg, ${cardType.accent}, ${palette.sub}, #111827)` }}>
                    <span className="text-base leading-none">✦✦</span>
                    <span className="min-w-0 flex-1 truncate text-xl font-black italic">{attack2 || "최애 선언 GX"}</span>
                    <span className="text-xl font-black">{attack2Damage || "300"}</span>
                  </div>
                  <p className="mt-1 truncate text-[10px] font-bold text-slate-600">{copy}</p>
                </section>

                <div className="absolute inset-x-[4.7%] bottom-[16.3%] flex items-center justify-between rounded-sm border border-zinc-300 bg-white/90 px-3 py-1 text-[10px] font-black text-zinc-700 shadow">
                  <span>입덕작 <b style={{ color: cardType.accent }}>★</b></span>
                  <span>인생작</span>
                  <span>취향 ✦ ✦ ✦</span>
                </div>

                <footer className="absolute inset-x-[4.7%] bottom-[3.3%] grid grid-cols-[35%_1fr] overflow-hidden rounded border border-zinc-300 bg-white/95 text-zinc-950 shadow">
                  <div className="p-2" style={{ background: `linear-gradient(135deg, ${cardType.accent}, #fff)` }}>
                    <p className="truncate text-[10px] font-bold">Illus. {displaySafe(displayName)}</p>
                    <p className="truncate text-base font-black">{grade}</p>
                    <p className="text-[9px] font-bold">©2026 SSIBDUK</p>
                  </div>
                  <div className="bg-zinc-950 p-2 text-white">
                    <p className="truncate text-[10px] font-black">{works.length ? works.join(" / ") : "Life works not selected"}</p>
                    <p className="mt-1 line-clamp-2 text-[9px] font-bold text-white/80">
                      {(tags.length ? tags : ["취향 태그 미선택"]).slice(0, 3).join(" · ")}
                    </p>
                  </div>
                </footer>
              </div>
              <div className="pointer-events-none absolute inset-0 z-20 holo-foil" />
              <div className="pointer-events-none absolute inset-0 z-30 holo-glare" />
              <div className="pointer-events-none absolute inset-0 z-40 rounded-[4.8%/3.4%] ring-2 ring-white/45" />
            </div>
          </div>

          {message ? <p className="mt-3 text-xs font-bold text-gray-600">{message}</p> : null}

          <style jsx>{`
            .oshi-holo-card {
              background:
                linear-gradient(115deg, transparent 0%, rgba(255,255,255,.20) var(--glare-x), transparent 58%),
                radial-gradient(farthest-corner circle at var(--glare-x) var(--glare-y), rgba(255,255,255,.34) 0%, rgba(255,255,255,.10) 22%, transparent 44%),
                linear-gradient(135deg, var(--card-accent), var(--card-bg) 44%, var(--card-sub));
            }
            .holo-foil {
              background:
                url("${SPARKLES_TEXTURE_URL}") var(--glare-x) var(--glare-y) / cover,
                url("${HOLO_TEXTURE_URL}") center / cover,
                repeating-linear-gradient(115deg, transparent 0 10px, rgba(255,255,255,.10) 11px 12px, transparent 13px 24px),
                conic-gradient(
                  from 180deg at var(--glare-x) var(--glare-y),
                  rgba(255,0,128,.16),
                  rgba(255,140,0,.12),
                  rgba(255,255,0,.10),
                  rgba(0,255,132,.12),
                  rgba(0,194,255,.18),
                  rgba(139,92,246,.14),
                  rgba(255,0,128,.16)
                );
              background-blend-mode: screen, screen, overlay, normal;
              mix-blend-mode: screen;
              filter: brightness(.82) contrast(1.18) saturate(1.25);
              opacity: .22;
              transition: opacity 160ms ease, filter 160ms ease;
            }
            .holo-glare {
              background:
                linear-gradient(
                  115deg,
                  transparent 16%,
                  rgba(255,255,255,.10) calc(var(--glare-x) - 12%),
                  rgba(255,255,255,.34) var(--glare-x),
                  rgba(255,255,255,.12) calc(var(--glare-x) + 12%),
                  transparent 84%
                ),
                radial-gradient(
                  circle at var(--glare-x) var(--glare-y),
                  rgba(255, 255, 255, 0.32),
                  rgba(255, 255, 255, 0.12) 16%,
                  transparent 38%
                );
              mix-blend-mode: screen;
              opacity: 0;
              transition: opacity 160ms ease;
            }
            .oshi-holo-card[data-hovering="true"] .holo-foil {
              opacity: .68;
              filter: brightness(1.08) contrast(1.36) saturate(1.6);
            }
            .oshi-holo-card[data-hovering="true"] .holo-glare {
              opacity: .46;
            }
          `}</style>
        </section>

        <section className="border border-dashed border-gray-400 bg-white p-4">
          <h2 className="text-sm font-black text-gray-900">공유 전 체크</h2>
          <ul className="mt-3 space-y-2 text-xs text-gray-600">
            <li className={imageDataUrl ? "font-bold text-green-700" : "font-bold text-red-600"}>
              {imageDataUrl ? "캐릭터 이미지 포함됨" : "캐릭터 이미지를 넣으면 카드가 완성됩니다"}
            </li>
            <li>마우스를 카드 위에서 움직이면 홀로그램 반사가 따라옵니다</li>
            <li>이미지는 버튼 선택 또는 카드로 드래그앤드롭해서 넣을 수 있습니다</li>
            <li>저장 이미지는 첨부 카드와 같은 734×1024 PNG로 생성됩니다</li>
          </ul>
        </section>

        <section className="grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
          <button
            type="button"
            disabled={busy}
            onClick={handleDownload}
            className="inline-flex items-center justify-center gap-2 border border-dashed border-gray-700 bg-gray-900 px-3 py-2 text-xs font-bold text-white hover:bg-gray-800 disabled:opacity-50"
          >
            <Download size={15} />
            카드 저장
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={handleShare}
            className="inline-flex items-center justify-center gap-2 border border-dashed border-gray-500 bg-white px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          >
            <Share2 size={15} />
            공유하기
          </button>
          <button
            type="button"
            disabled={busy || !canSave}
            onClick={handleSaveProfile}
            className="inline-flex items-center justify-center gap-2 border border-dashed border-pink-500 bg-pink-50 px-3 py-2 text-xs font-bold text-pink-700 hover:bg-pink-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save size={15} />
            프로필 저장
          </button>
        </section>

        {!authUser ? (
          <Link href="/auth" className="border border-dashed border-gray-400 bg-white p-3 text-center text-xs font-bold text-gray-600 hover:bg-gray-100">
            로그인하면 최애캐를 프로필에 저장할 수 있습니다.
          </Link>
        ) : (
          <Link href="/profile?tab=oshi" className="border border-dashed border-gray-400 bg-white p-3 text-center text-xs font-bold text-gray-600 hover:bg-gray-100">
            프로필에서 최애캐/카드 더 꾸미기
          </Link>
        )}
      </aside>
    </main>
  );
}
