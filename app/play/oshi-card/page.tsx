"use client";

import Link from "next/link";
import { CSSProperties, PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { Download, ImagePlus, RefreshCcw, Save, Share2, X } from "lucide-react";
import { useAuthUser } from "@/lib/supabase/useAuthUser";
import { supabase } from "@/lib/supabase/client";
import { getOshiList, upsertOshi } from "@/lib/supabase/oshi";
import { createOshiCardShare, fetchLatestOshiCardShareForUser, type OshiCardShare } from "@/lib/supabase/oshiCardShares";
import CardImageCropModal from "@/components/profile/CardImageCropModal";
import type { OfficialWork } from "@/types/official";
import OshiCardStyles from "./OshiCardStyles";

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

const OFFICIAL_WORK_CATEGORY_LABELS: Record<OfficialWork["category"], string> = {
  anime: "애니",
  manga: "만화",
  light_novel: "라노벨",
  webtoon: "웹툰",
  other: "기타",
};

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
type Palette = (typeof PALETTE_OPTIONS)[number];
type CardType = (typeof TYPE_OPTIONS)[number];

type TiltState = {
  rotateX: number;
  rotateY: number;
  glareX: number;
  glareY: number;
};

type DeviceOrientationWithPermission = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<"granted" | "denied">;
};

type CropTarget = {
  kind: "background" | "avatar";
  src: string;
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

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error ?? new Error("이미지를 읽지 못했습니다."));
    reader.readAsDataURL(blob);
  });
}



function displaySafe(value: string) {
  return value.trim().slice(0, 18) || "SSIBDUK";
}


function typeLogoStyle(cardType: CardType): CSSProperties {
  return {
    backgroundImage: `url(/viral/type-logos/${cardType.id}.svg)`,
  };
}

function textWidthScore(text: string) {
  return [...text.trim()].reduce((sum, ch) => {
    if (/[A-Za-z0-9]/.test(ch)) return sum + 0.65;
    if (/\s/.test(ch)) return sum + 0.35;
    return sum + 1;
  }, 0);
}

function oshiNameStyle(name: string): CSSProperties {
  const score = textWidthScore(name);
  const size = score <= 5 ? 42 : score <= 7 ? 38 : score <= 9 ? 34 : score <= 12 ? 30 : 26;
  return { "--oshi-name-size": `${size}px` } as CSSProperties;
}

export default function OshiCardPage() {
  const authUser = useAuthUser();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const oshiAvatarInputRef = useRef<HTMLInputElement>(null);
  const previewCardRef = useRef<HTMLDivElement>(null);
  const skipNextShareUrlResetRef = useRef(false);
  const orientationPermissionRef = useRef<"unknown" | "granted" | "denied">("unknown");
  const [nickname, setNickname] = useState("");
  const [oshi, setOshi] = useState("");
  const [works, setWorks] = useState<string[]>([]);
  const [customWork, setCustomWork] = useState("");
  const [officialWorks, setOfficialWorks] = useState<OfficialWork[]>([]);
  const [officialWorksLoading, setOfficialWorksLoading] = useState(true);
  const [tags, setTags] = useState<string[]>([]);
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
  const [cropTarget, setCropTarget] = useState<CropTarget | null>(null);
  const [shareUrl, setShareUrl] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [isHoveringCard, setIsHoveringCard] = useState(false);
  const [isDeviceTiltEnabled, setIsDeviceTiltEnabled] = useState(false);
  const [isTypeMenuOpen, setIsTypeMenuOpen] = useState(false);
  const [tilt, setTilt] = useState<TiltState>({ rotateX: 0, rotateY: 0, glareX: 50, glareY: 50 });

  const resetCardForm = () => {
    setNickname("");
    setOshi("");
    setWorks([]);
    setTags([]);
    setCustomWork("");
    setCustomTag("");
    setGrade(GRADE_OPTIONS[2]);
    setTypeId(TYPE_OPTIONS[0].id);
    setImageDataUrl("");
    setOshiAvatarDataUrl("");
    setShareUrl("");
  };

  const applyShareToForm = (share: OshiCardShare) => {
    skipNextShareUrlResetRef.current = true;
    setNickname(share.nickname ?? "");
    setOshi(share.oshi ?? "");
    setWorks(Array.isArray(share.works) ? share.works.slice(0, 5) : []);
    setTags([]);
    setCustomWork("");
    setCustomTag("");
    if (GRADE_OPTIONS.includes(share.grade)) setGrade(share.grade);
    if (TYPE_OPTIONS.some((item) => item.id === share.type_id)) setTypeId(share.type_id);
    setImageDataUrl(share.background_image_url ?? "");
    setOshiAvatarDataUrl(share.oshi_avatar_url ?? "");
    setShareUrl(`${window.location.origin}/play/oshi-card/view/${share.id}`);
  };

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const hasUrlParams = p.has("n") || p.has("o") || p.has("w") || p.has("g") || p.has("t");
    if (hasUrlParams) {
      if (p.has("n")) setNickname(p.get("n")!);
      if (p.has("o")) setOshi(p.get("o")!);
      if (p.has("w")) setWorks(p.get("w")!.split(",").filter(Boolean).slice(0, 5));
      if (p.has("g") && GRADE_OPTIONS.includes(p.get("g")!)) setGrade(p.get("g")!);
      if (p.has("t") && TYPE_OPTIONS.some((item) => item.id === p.get("t"))) setTypeId(p.get("t")!);
    }
  }, []);

  useEffect(() => {
    if (authUser === undefined) return;
    const p = new URLSearchParams(window.location.search);
    const hasUrlParams = p.has("n") || p.has("o") || p.has("w") || p.has("g") || p.has("t");
    if (hasUrlParams) return;

    if (!authUser) {
      resetCardForm();
      return;
    }

    let cancelled = false;
    fetchLatestOshiCardShareForUser(authUser.id)
      .then((share) => {
        if (cancelled) return;
        if (share) {
          applyShareToForm(share);
        } else {
          resetCardForm();
        }
      })
      .catch(() => {
        if (!cancelled) resetCardForm();
      });

    return () => {
      cancelled = true;
    };
  }, [authUser]);

  useEffect(() => {
    if (skipNextShareUrlResetRef.current) {
      skipNextShareUrlResetRef.current = false;
      return;
    }
    setShareUrl("");
  }, [nickname, oshi, works, grade, typeId, imageDataUrl, oshiAvatarDataUrl]);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(""), 3200);
    return () => window.clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    let cancelled = false;

    const fetchOfficialWorks = async () => {
      setOfficialWorksLoading(true);
      const { data, error } = await supabase
        .from("official_works")
        .select("id, slug, title, original_title, category, synopsis, cover_image_url, status, sort_order, created_at, updated_at")
        .eq("status", "PUBLISHED")
        .order("sort_order", { ascending: true })
        .order("title", { ascending: true })
        .limit(300);

      if (cancelled) return;
      if (error) {
        console.warn("[oshi-card] failed to fetch official works:", error);
        setOfficialWorks([]);
      } else {
        setOfficialWorks((data ?? []) as OfficialWork[]);
      }
      setOfficialWorksLoading(false);
    };

    void fetchOfficialWorks();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isDeviceTiltEnabled) return;
    const onOrientation = (event: DeviceOrientationEvent) => {
      const beta = event.beta ?? 45;
      const gamma = event.gamma ?? 0;
      const betaOffset = Math.max(-35, Math.min(35, beta - 45));
      const gammaOffset = Math.max(-35, Math.min(35, gamma));
      setIsHoveringCard(true);
      setTilt({
        rotateX: Math.max(-12, Math.min(12, -betaOffset / 2.9)),
        rotateY: Math.max(-12, Math.min(12, gammaOffset / 2.9)),
        glareX: Math.max(0, Math.min(100, 50 + gammaOffset * 1.15)),
        glareY: Math.max(0, Math.min(100, 50 + betaOffset * 1.05)),
      });
    };

    window.addEventListener("deviceorientation", onOrientation);
    return () => window.removeEventListener("deviceorientation", onOrientation);
  }, [isDeviceTiltEnabled]);

  const cardType = useMemo(
    () => TYPE_OPTIONS.find((item) => item.id === typeId) ?? TYPE_OPTIONS[0],
    [typeId],
  );
  const palette = cardType;
  const displayName = nickname.trim() || authUser?.user_metadata?.nickname || "";
  const canSave = Boolean(authUser?.id && oshi.trim());
  const gradeStars = Math.max(1, GRADE_OPTIONS.indexOf(grade) + 1);
  const officialWorkSearchResults = useMemo(() => {
    const query = customWork.trim().toLowerCase();
    if (!query) return officialWorks.filter((work) => !works.includes(work.title)).slice(0, 6);

    return officialWorks
      .filter((work) => {
        if (works.includes(work.title)) return false;
        return [work.title, work.original_title, work.slug]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(query));
      })
      .slice(0, 8);
  }, [customWork, officialWorks, works]);

  const openImageCrop = (file: File, kind: CropTarget["kind"]) => {
    if (!file.type.startsWith("image/")) {
      setMessage("이미지 파일만 업로드할 수 있습니다.");
      return;
    }
    if (cropTarget?.src) URL.revokeObjectURL(cropTarget.src);
    setCropTarget({ kind, src: URL.createObjectURL(file) });
  };

  const closeImageCrop = () => {
    if (cropTarget?.src) URL.revokeObjectURL(cropTarget.src);
    setCropTarget(null);
  };

  const applyImageCrop = async (blob: Blob) => {
    if (!cropTarget) return;
    const dataUrl = await blobToDataUrl(blob);
    if (cropTarget.kind === "background") {
      setImageDataUrl(dataUrl);
    } else {
      setOshiAvatarDataUrl(dataUrl);
    }
    closeImageCrop();
  };

  const handleImagePick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    openImageCrop(file, "background");
    event.target.value = "";
  };

  const handleOshiAvatarPick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    openImageCrop(file, "avatar");
    event.target.value = "";
  };

  const handleTilt = (event: PointerEvent<HTMLDivElement>) => {
    if (isDeviceTiltEnabled) return;
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
    if (isDeviceTiltEnabled) return;
    setIsHoveringCard(false);
    setTilt({ rotateX: 0, rotateY: 0, glareX: 50, glareY: 50 });
  };

  const requestDeviceTilt = async () => {
    if (orientationPermissionRef.current === "denied" || typeof window === "undefined") return;
    const DeviceOrientation = window.DeviceOrientationEvent as DeviceOrientationWithPermission | undefined;
    if (!DeviceOrientation) return;

    if (typeof DeviceOrientation.requestPermission === "function" && orientationPermissionRef.current === "unknown") {
      const result = await DeviceOrientation.requestPermission().catch(() => "denied" as const);
      orientationPermissionRef.current = result === "granted" ? "granted" : "denied";
      if (result !== "granted") return;
    } else if (orientationPermissionRef.current === "unknown") {
      orientationPermissionRef.current = "granted";
    }

    setIsDeviceTiltEnabled(true);
  };

  const handleCardPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!isDeviceTiltEnabled) handleTilt(event);
    void requestDeviceTilt();
  };

  const exportBlob = async (): Promise<Blob> => {
    const el = previewCardRef.current;
    if (!el) throw new Error("미리보기 카드를 찾을 수 없습니다.");
    setBusy(true);
    setMessage("");
    try {
      const prevTransform = el.style.transform;
      el.style.transform = "none";
      const { domToBlob } = await import("modern-screenshot");
      const blob = await domToBlob(el, { scale: 2, type: "image/png" });
      el.style.transform = prevTransform;
      return blob;
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

  const buildFallbackShareUrl = () => {
    const params = new URLSearchParams();
    if (nickname.trim()) params.set("n", nickname.trim());
    if (oshi.trim()) params.set("o", oshi.trim());
    if (works.length) params.set("w", works.join(","));
    params.set("g", grade);
    params.set("t", typeId);
    return `${window.location.origin}/play/oshi-card/view?${params.toString()}`;
  };

  const handleSaveShareCard = async () => {
    setBusy(true);
    try {
      let ogImageDataUrl = "";
      try {
        const ogBlob = await exportBlob();
        ogImageDataUrl = await blobToDataUrl(ogBlob);
        setBusy(true);
      } catch (error) {
        console.warn("OG image capture skipped:", error);
      }

      const share = await createOshiCardShare({
        ownerId: authUser?.id ?? null,
        nickname,
        oshi,
        works,
        grade,
        typeId,
        backgroundImageDataUrl: imageDataUrl,
        oshiAvatarDataUrl,
        ogImageDataUrl,
      });
      const url = `${window.location.origin}/play/oshi-card/view/${share.id}`;
      setShareUrl(url);
      await navigator.clipboard.writeText(url).catch(() => undefined);
      setMessage("카드를 30일 공유용으로 저장했고 링크를 복사했습니다.");
    } catch (error) {
      console.error("Failed to save oshi card share:", error);
      setShareUrl(buildFallbackShareUrl());
      setMessage("DB 저장에 실패했습니다. Supabase 마이그레이션 적용 여부를 확인해 주세요.");
    } finally {
      setBusy(false);
    }
  };

  const handleShare = async () => {
    try {
      const url = shareUrl;
      if (!url) {
        setMessage("먼저 카드 저장을 눌러 30일 공유 링크를 만들어 주세요.");
        return;
      }
      const shareTitle = `${displayName}의 덕질 프로필 카드`;
      const shareText = `${displayName}의 덕질 타입은 ${cardType.label}. 너도 덕질 프로필 카드를 해봐.`;
      let copied = false;

      try {
        await navigator.clipboard.writeText(url);
        copied = true;
      } catch {}

      const canOpenNativeShare =
        typeof navigator.share === "function" &&
        (window.matchMedia("(pointer: coarse)").matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent));

      if (canOpenNativeShare) {
        await navigator.share({ title: shareTitle, text: shareText, url });
        setMessage(copied ? "30일짜리 공유 링크를 복사했고 SNS 공유 창을 열었습니다." : "30일짜리 SNS 공유 창을 열었습니다.");
        return;
      }
      if (copied) {
        setMessage("30일짜리 공유 링크가 클립보드에 복사됐습니다.");
        return;
      }
      setMessage("클립보드 권한이 막혀 링크 복사에 실패했습니다.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setMessage("공유 창을 닫았습니다.");
        return;
      }
      setMessage("공유에 실패했습니다. 다시 시도해 주세요.");
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

  const addOfficialWork = (work: OfficialWork) => {
    if (works.includes(work.title) || works.length >= 5) return;
    setWorks((prev) => [...prev, work.title]);
    setCustomWork("");
  };

  const addCustomWork = () => {
    const firstResult = officialWorkSearchResults[0];
    if (firstResult) addOfficialWork(firstResult);
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
          editable ? (
            <button type="button" onClick={() => fileInputRef.current?.click()} className="block h-full w-full">
              <img src={imageDataUrl} alt="" className="h-full w-full object-cover object-top" />
            </button>
          ) : (
            <img src={imageDataUrl} alt="" draggable={false} className="pointer-events-none h-full w-full select-none object-cover object-top" />
          )
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
            aria-label="최애 캐릭터 사진 업로드"
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
                placeholder="최애 캐릭터 닉네임"
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
          <div className="flex items-center gap-1 overflow-x-auto">
            {works.map((work) => (
              <span key={work} className="flex shrink-0 items-center gap-0.5 rounded bg-white/90 px-1.5 py-0.5 text-[11px] font-black text-zinc-950">
                {work}
                <button
                  type="button"
                  onClick={() => setWorks(works.filter((w) => w !== work))}
                  className="leading-none text-zinc-400 hover:text-zinc-700"
                >
                  ×
                </button>
              </span>
            ))}
            {works.length < 5 && (
              <>
                <input
                  value={customWork}
                  onChange={(event) => setCustomWork(event.target.value)}
                  type="search"
                  maxLength={40}
                  placeholder={works.length === 0 ? "작품명 입력 후 Enter" : "추가..."}
                  className="min-w-[72px] flex-1 rounded border border-white/60 bg-white/15 px-2 py-0.5 text-[11px] font-black text-white outline-none placeholder:font-normal placeholder:text-white/50"
                />
                <button
                  type="button"
                  onClick={addCustomWork}
                  className="shrink-0 rounded border border-white/70 bg-white/20 px-2 py-0.5 text-xs font-black text-white hover:bg-white/30"
                >
                  +
                </button>
              </>
            )}
          </div>
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

  const renderProfileCardFace = (editable: boolean) => (
    <div className="relative z-10 h-full overflow-hidden rounded-[4.2%/3%] border-[4px] border-zinc-950 bg-zinc-100 text-white">
      <div className="absolute inset-[1.1%] overflow-hidden rounded-[1.2%]">
        {imageDataUrl ? (
          editable ? (
            <button type="button" onClick={() => fileInputRef.current?.click()} className="block h-full w-full">
              <img src={imageDataUrl} alt="" className="h-full w-full object-cover object-top" />
            </button>
          ) : (
            <img src={imageDataUrl} alt="" className="h-full w-full object-cover object-top" />
          )
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

      <div className="pointer-events-none absolute inset-[1.1%] rounded-[1.2%] bg-gradient-to-b from-black/35 via-transparent to-black/45" />
      <div className="pointer-events-none absolute inset-x-[1.1%] bottom-[1.1%] h-[38%] rounded-b-[1.2%] oshi-bottom-fade" />

      <header className="absolute left-[6%] right-[6%] top-[5%] z-[80] flex items-center justify-between gap-4">
        {editable ? (
          <input
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            maxLength={16}
            placeholder={authUser?.user_metadata?.nickname || "닉네임"}
            className="min-w-0 flex-1 rounded-lg border border-white/70 bg-black/45 px-3 py-2 text-xl font-black text-white shadow-[0_8px_24px_rgba(0,0,0,.32),inset_0_1px_0_rgba(255,255,255,.22)] outline-none backdrop-blur placeholder:text-white/65 focus:border-[var(--card-foil)] focus:ring-2 focus:ring-[var(--card-accent)]/60"
          />
        ) : (
          <h2 className="oshi-title-stroke min-w-0 flex-1 text-2xl font-black text-white">
            {displayName || "닉네임"}
          </h2>
        )}
        {editable ? (
          <div className="relative z-[90] w-[43%] shrink-0">
            <button
              type="button"
              onClick={() => setIsTypeMenuOpen((value) => !value)}
              className="flex w-full items-center gap-2 rounded-lg border border-white/70 bg-black/45 px-2.5 py-2 text-left shadow-[0_8px_24px_rgba(0,0,0,.32),inset_0_1px_0_rgba(255,255,255,.22)] backdrop-blur hover:bg-black/55"
            >
              <span className="h-7 w-7 shrink-0 rounded-full bg-center bg-contain bg-no-repeat drop-shadow-[0_0_10px_var(--card-accent)]" style={typeLogoStyle(cardType)} />
              <span className="min-w-0 flex-1 truncate text-xs font-black text-white">{cardType.label}</span>
              <span className="text-xs font-black text-white/70" aria-hidden>▾</span>
            </button>
            {isTypeMenuOpen ? (
              <div className="absolute right-0 top-[calc(100%+8px)] z-[120] max-h-56 w-64 overflow-y-auto rounded-lg border border-white/70 bg-zinc-950/95 p-1 shadow-2xl">
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
            <span className="h-8 w-8 rounded-full bg-center bg-contain bg-no-repeat drop-shadow-[0_0_10px_var(--card-accent)]" style={typeLogoStyle(cardType)} />
            <span className="oshi-title-stroke text-lg font-black text-white">{cardType.label}</span>
          </div>
        )}
      </header>

      <div className="absolute inset-x-[7%] bottom-[3.7%] z-20 flex max-h-[38%] flex-col justify-end gap-4">
      <section className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => editable && oshiAvatarInputRef.current?.click()}
          className={`oshi-avatar-circle ${editable ? "" : "pointer-events-none"}`}
          aria-label="최애 캐릭터 사진 업로드"
        >
          {oshiAvatarDataUrl ? (
            <img src={oshiAvatarDataUrl} alt="" draggable={false} />
          ) : (
            <ImagePlus className="m-auto text-white/90" size={22} />
          )}
          <span className="oshi-ex-badge" aria-hidden>EX</span>
        </button>
        <div className="min-w-0 flex-1 pb-1">
          <span className="oshi-soft-badge px-3 py-1 text-xs font-black">
            <span aria-hidden>✦</span> 최애캐
          </span>
          {editable ? (
            <input
              value={oshi}
              onChange={(event) => setOshi(event.target.value)}
              maxLength={28}
              placeholder="최애 캐릭터"
              className="oshi-main-input oshi-glow-text oshi-main-name mt-2 placeholder:text-white/60"
              style={oshiNameStyle(oshi)}
            />
          ) : (
            <p className="oshi-glow-text oshi-main-name mt-2" style={oshiNameStyle(oshi)}>
              {oshi.trim() || "아직 고르는 중"}
            </p>
          )}
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center gap-2 pt-[10]">
          <span className="oshi-soft-badge px-3 py-1 text-xs font-black">
            <span aria-hidden>📖</span> 인생작
          </span>
          <span className="text-xs font-black text-white/70">{works.length}/5</span>
        </div>
        {editable ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {works.map((work) => (
              <span key={work} className="oshi-soft-chip">
                {work}
                <button type="button" onClick={() => setWorks(works.filter((w) => w !== work))} className="ml-1 text-white/55 hover:text-white">
                  ×
                </button>
              </span>
            ))}
            {works.length < 5 ? (
              <div className="relative min-w-[150px] flex-1">
                <input
                  value={customWork}
                  onChange={(event) => setCustomWork(event.target.value)}
                  type="search"
                  maxLength={40}
                  placeholder="공식 작품 검색"
                  className="w-full rounded-md border border-white/35 bg-black/25 px-2 py-1 text-xs font-black text-white outline-none placeholder:text-white/55 focus:border-[var(--card-foil)]"
                />
                {customWork.trim() ? (
                  <div className="absolute bottom-[calc(100%+6px)] left-0 right-0 z-[140] max-h-48 overflow-y-auto rounded-lg border border-white/45 bg-zinc-950/95 p-1 shadow-2xl backdrop-blur">
                    {officialWorksLoading ? (
                      <p className="px-2 py-2 text-[11px] font-black text-white/55">작품 목록을 불러오는 중...</p>
                    ) : officialWorkSearchResults.length === 0 ? (
                      <p className="px-2 py-2 text-[11px] font-black text-white/55">공식 작품 검색 결과가 없습니다.</p>
                    ) : (
                      officialWorkSearchResults.map((work) => (
                        <button
                          key={work.id}
                          type="button"
                          onClick={() => addOfficialWork(work)}
                          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-white/15"
                        >
                          <span className="h-9 w-7 shrink-0 overflow-hidden rounded border border-white/20 bg-white/10">
                            {work.cover_image_url ? (
                              <img src={work.cover_image_url} alt="" className="h-full w-full object-cover" />
                            ) : null}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[11px] font-black text-white">{work.title}</span>
                            <span className="block truncate text-[9px] font-black text-white/45">
                              {OFFICIAL_WORK_CATEGORY_LABELS[work.category]}
                              {work.original_title ? ` · ${work.original_title}` : ""}
                            </span>
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : works.length ? (
          <div className="flex flex-wrap gap-1.5">
            {works.map((work) => (
              <span key={work} className="oshi-soft-chip">
                {work}
              </span>
            ))}
          </div>
        ) : (
          <p className="oshi-title-stroke text-sm font-black italic text-white/75">인생작 미선택</p>
        )}
      </section>

      <section>
        <div className="oshi-grade-divider mb-3" />
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="oshi-soft-badge px-3 py-1 text-xs font-black">
              <span aria-hidden>🏅</span> 등급
            </span>
            {editable ? (
              <select
                value={grade}
                onChange={(event) => setGrade(event.target.value)}
                className="min-w-0 flex-1 rounded-md border border-white/35 bg-black/25 px-2 py-1 text-sm font-black text-white outline-none"
              >
                {GRADE_OPTIONS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            ) : (
              <p className="oshi-glow-text text-base font-black">{grade}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-[2px]">
            {[0, 1, 2, 3, 4].map((i) => (
              <span key={i} className={`oshi-star ${i < gradeStars ? "oshi-star-on" : "oshi-star-off"}`} aria-hidden>
                ★
              </span>
            ))}
          </div>
        </div>
      </section>
      </div>
    </div>
  );

  return (
    <main className="w-full">
      <OshiCardStyles />
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
      {cropTarget ? (
        <CardImageCropModal
          imageSrc={cropTarget.src}
          aspect={cropTarget.kind === "background" ? 734 / 1024 : 1}
          title={cropTarget.kind === "background" ? "카드 배경 이미지 맞추기" : "최애 프로필 이미지 맞추기"}
          description={
            cropTarget.kind === "background"
              ? "공유 카드 실제 비율에 맞춰 이동하거나 크롭하세요."
              : "최애 프로필 영역에 맞춰 정사각형으로 이동하거나 크롭하세요."
          }
          outputSize={cropTarget.kind === "background" ? { width: 734, height: 1024 } : { width: 126, height: 126 }}
          onConfirm={applyImageCrop}
          onCancel={closeImageCrop}
        />
      ) : null}

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
              if (file) openImageCrop(file, "background");
            }}
          >
            <div
              className="oshi-holo-card relative mx-auto aspect-[734/1024] w-full max-w-[420px] overflow-hidden rounded-[4.8%/3.4%] bg-zinc-100 p-[0.9%] text-white shadow-2xl [transform-style:preserve-3d]"
              style={editorCardStyle}
              data-hovering="false"
            >
              {renderProfileCardFace(true)}
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
              ref={previewCardRef}
              className="oshi-holo-card relative mx-auto aspect-[734/1024] w-full max-w-[420px] overflow-hidden rounded-[4.8%/3.4%] bg-zinc-100 p-[0.9%] text-white shadow-2xl transition-transform duration-150 ease-out [transform-style:preserve-3d]"
              style={cardStyle}
              data-hovering={isHoveringCard ? "true" : "false"}
              data-auto-shimmer="true"
              onPointerDown={handleCardPointerDown}
              onPointerMove={handleTilt}
              onPointerUp={resetTilt}
              onPointerCancel={resetTilt}
              onPointerLeave={resetTilt}
            >
              {renderProfileCardFace(false)}
              <div
                className="pointer-events-none absolute inset-0 z-20 holo-foil"
                style={{
                  opacity: isHoveringCard ? 0.35 : 0.22,
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

      {message ? (
        <div className="fixed bottom-5 left-1/2 z-[10000] -translate-x-1/2 rounded-full border border-zinc-700 bg-zinc-950 px-4 py-2 text-xs font-black text-white shadow-2xl">
          {message}
        </div>
      ) : null}

      <section className="mt-5 grid gap-2 sm:grid-cols-3">
        <button
          type="button"
          disabled={busy}
          onClick={handleSaveShareCard}
          className="inline-flex items-center justify-center gap-2 border border-dashed border-gray-700 bg-gray-900 px-3 py-2 text-xs font-bold text-white hover:bg-gray-800 disabled:opacity-50"
        >
          <Save size={15} />
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
          disabled={busy}
          onClick={handleDownload}
          className="inline-flex items-center justify-center gap-2 border border-dashed border-pink-500 bg-pink-50 px-3 py-2 text-xs font-bold text-pink-700 hover:bg-pink-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download size={15} />
          이미지 저장
        </button>
      </section>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <p className="border border-dashed border-gray-400 bg-white p-3 text-center text-xs font-bold text-gray-600">
          카드 저장을 누르면 로그인 여부와 상관없이 30일짜리 공유 링크가 생성됩니다.
        </p>
        <p className="border border-dashed border-gray-400 bg-white p-3 text-center text-xs font-bold text-gray-600">
          기본 반짝임은 양쪽에 유지되고, hover 반응은 오른쪽만 켜집니다.
        </p>
      </div>


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
