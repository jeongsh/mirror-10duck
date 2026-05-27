"use client";

import { Suspense, useCallback, useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useAuthUser } from "@/lib/supabase/useAuthUser";
import { useCharacterLibraryStore } from "@/store/useCharacterLibraryStore";
import { useCharacterStore } from "@/store/useCharacterStore";
import CharacterUploader, {
  CharacterUploadPreview,
  INITIAL_UPLOAD_VIEW,
} from "@/components/character/CharacterUploader";
import {
  Board,
  OshiRegistration,
  OshiType,
  OshiPairDirection,
  Badge,
  UserBadge,
  CardTheme,
  UserProfile,
} from "@/types/community";
import { listCharacterProfiles } from "@/lib/supabase/characters";
import { BASE_PROFILES, mergeProfiles } from "@/lib/live2d/profileSync";
import { getProfile, updateProfile, checkHandleAvailability } from "@/lib/supabase/profiles";
import {
  getOshiList,
  upsertOshi,
  deleteOshi,
  reorderOshi,
  formatOshiPrimaryTitle,
  formatOshiSubtitle,
} from "@/lib/supabase/oshi";
import { saveLive2DEnabledPreference } from "@/lib/supabase/characterPreferences";
import { getAllBadges, getUserBadges, checkAndGrantOshiBadges } from "@/lib/supabase/badges";
import {
  fetchFollowedOfficialWorkIds,
  setOfficialWorkFollow,
} from "@/lib/supabase/officialWorkFollows";
import AuthorProfileCard from "@/components/community/AuthorProfileCard";
import { CARD_THEMES, THEME_ORDER } from "@/lib/cardThemes";
import CardImageCropModal from "@/components/profile/CardImageCropModal";
import type { OfficialOshiCharacter, OfficialWork } from "@/types/official";

type TabId = "profile" | "library" | "subscription" | "oshi" | "card" | "account";

const TABS: { id: TabId; label: string }[] = [
  { id: "profile", label: "프로필" },
  { id: "library", label: "캐릭터 관리" },
  { id: "subscription", label: "구독 채널" },
  { id: "oshi", label: "최애 & 배지" },
  { id: "card", label: "카드 꾸미기" },
  { id: "account", label: "계정 설정" },
];

const OSHI_TYPE_LABELS: Record<OshiType, string> = {
  anime: "애니",
  manga: "만화",
  game: "게임",
  character: "캐릭터",
  other: "기타",
  voice_actor: "성우",
  creator: "크리에이터",
  pair: "CP(커플링)",
  idol_group: "아이돌 그룹",
};

const OSHI_TITLE_FIELD_LABELS: Record<OshiType, string> = {
  anime: "작품명 *",
  manga: "작품명 *",
  game: "작품명 *",
  character: "캐릭터 이름 *",
  other: "이름 *",
  voice_actor: "성우 이름 *",
  creator: "이름 · 활동명 *",
  pair: "",
  idol_group: "그룹명 *",
};

const PAIR_DIRECTION_LABELS: Record<OshiPairDirection, string> = {
  a_to_b: "A→B (고정)",
  b_to_a: "B→A (고정)",
  reversible: "양방향",
  unknown: "미정·비밀",
};

const RARITY_COLORS: Record<string, string> = {
  common: "border-gray-300 bg-gray-50 text-gray-600",
  rare: "border-blue-300 bg-blue-50 text-blue-700",
  epic: "border-purple-300 bg-purple-50 text-purple-700",
  legendary: "border-yellow-400 bg-yellow-50 text-yellow-700",
};

const RARITY_LABELS: Record<string, string> = {
  common: "COMMON",
  rare: "RARE",
  epic: "EPIC",
  legendary: "LEGENDARY",
};

function ProfilePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useAuthUser();
  const profiles = useCharacterLibraryStore((s) => s.profiles);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const thumbnailCaptureRef = useRef<(() => Promise<Blob | null>) | null>(null);
  const oshiImageInputRef = useRef<HTMLInputElement>(null);
  const cardImageInputRef = useRef<HTMLInputElement>(null);
  const cardAvatarInputRef = useRef<HTMLInputElement>(null);
  const [oshiImageUploading, setOshiImageUploading] = useState(false);
  const [cardImageUploading, setCardImageUploading] = useState(false);
  const [cardAvatarUploading, setCardAvatarUploading] = useState(false);
  const [live2dSaving, setLive2dSaving] = useState(false);
  
  const [activeTab, setActiveTab] = useState<TabId>("profile");

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && TABS.some((item) => item.id === tab)) {
      setActiveTab(tab as TabId);
    }
  }, [searchParams]);
  
  // 프로필 상태
  const [nickname, setNickname] = useState("");
  const [handle, setHandle] = useState("");
  const [bio, setBio] = useState("");
  const [handleUpdatedAt, setHandleUpdatedAt] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [tempAvatarUrl, setTempAvatarUrl] = useState("");
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  /** 모달 안에서만 편집; 확인 시 tempAvatarUrl 로 반영 */
  const [modalAvatarDraft, setModalAvatarDraft] = useState("");
  const [isFixedNickname, setIsFixedNickname] = useState(true);
  
  // 계정 보안 상태
  const [isAccountVerified, setIsAccountVerified] = useState(false);
  const [verifyPassword, setVerifyPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  // 탈퇴 모달 상태
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawInput, setWithdrawInput] = useState("");
  const [showCharacterUploadModal, setShowCharacterUploadModal] = useState(false);
  const [previewModelUrl, setPreviewModelUrl] = useState<string | null>(null);
  const [previewView, setPreviewView] = useState(INITIAL_UPLOAD_VIEW);
  const [savedView, setSavedView] = useState(INITIAL_UPLOAD_VIEW);
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // 팔로우 상태
  const [followedBoards, setFollowedBoards] = useState<Board[]>([]);
  const [boardsLoading, setBoardsLoading] = useState(true);

  // 카드 커스터마이징 상태
  const [cardTheme, setCardTheme] = useState<CardTheme>("default");
  const [cardAccent, setCardAccent] = useState<string>("");
  const [cardShowOshi, setCardShowOshi] = useState<boolean>(true);
  const [cardBadgeIds, setCardBadgeIds] = useState<string[]>([]);
  const [cardHideBadges, setCardHideBadges] = useState(false);
  const [cardNicknameColor, setCardNicknameColor] = useState("");
  const [cardNicknameFont, setCardNicknameFont] = useState<"sans" | "serif" | "mono">("sans");
  const [cardImageUrl, setCardImageUrl] = useState<string>("");
  const [cardAvatarUrl, setCardAvatarUrl] = useState<string>("");
  const [cardSaving, setCardSaving] = useState(false);
  const [cardMessage, setCardMessage] = useState("");
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropType, setCropType] = useState<"profileAvatar" | "oshi" | "banner" | "avatar">("banner");

  // 오시 & 배지 상태
  const [oshiList, setOshiList] = useState<OshiRegistration[]>([]);
  const [allBadges, setAllBadges] = useState<Badge[]>([]);
  const [userBadges, setUserBadges] = useState<UserBadge[]>([]);
  const [oshiLoading, setOshiLoading] = useState(true);
  const [showOshiForm, setShowOshiForm] = useState(false);
  const [editingOshi, setEditingOshi] = useState<OshiRegistration | null>(null);
  const [oshiForm, setOshiForm] = useState({
    title: "",
    oshi_type: "anime" as OshiType,
    image_url: "",
    description: "",
    is_public: true,
    affiliation: "",
    reference_work: "",
    pair_work_title: "",
    pair_char_a: "",
    pair_char_b: "",
    pair_direction: "reversible" as OshiPairDirection,
    official_work_id: "",
    official_oshi_id: "",
  });
  const [officialWorks, setOfficialWorks] = useState<OfficialWork[]>([]);
  const [officialOshi, setOfficialOshi] = useState<OfficialOshiCharacter[]>([]);
  const [followedOfficialWorkIds, setFollowedOfficialWorkIds] = useState<Set<string>>(new Set());
  const [officialWorkFollowSavingId, setOfficialWorkFollowSavingId] = useState<string | null>(null);
  const [interestWorkQuery, setInterestWorkQuery] = useState("");
  const [oshiWorkQuery, setOshiWorkQuery] = useState("");
  const [newBadgeIds, setNewBadgeIds] = useState<string[]>([]);

  // 캐릭터 라이브러리 동기화 및 관리
  const setProfiles = useCharacterLibraryStore((s) => s.setProfiles);
  const activeCharacterId = useCharacterLibraryStore((s) => s.activeId);
  const setActiveCharacterId = useCharacterLibraryStore((s) => s.setActive);
  const unregister = useCharacterLibraryStore((s) => s.unregister);
  const setProfile = useCharacterStore((s) => s.setProfile);
  const isLive2DEnabled = useCharacterStore((s) => s.isLive2DEnabled);
  const setLive2DEnabled = useCharacterStore((s) => s.setLive2DEnabled);

  const handlePreviewModelChange = useCallback((modelUrl: string | null) => {
    setPreviewModelUrl(modelUrl);
    if (modelUrl) {
      setPreviewView(INITIAL_UPLOAD_VIEW);
      setSavedView(INITIAL_UPLOAD_VIEW);
    }
  }, []);

  const toggleLive2D = useCallback(async () => {
    const nextValue = !isLive2DEnabled;
    setLive2DEnabled(nextValue);
    setLive2dSaving(true);

    try {
      await saveLive2DEnabledPreference(nextValue);
    } catch (error) {
      setLive2DEnabled(!nextValue);
      const message = error instanceof Error ? error.message : "알 수 없는 오류";
      setMessage(`Live2D 설정 저장 실패: ${message}`);
    } finally {
      setLive2dSaving(false);
    }
  }, [isLive2DEnabled, setLive2DEnabled]);

  useEffect(() => {
    if (!user) return;
    setNickname(user.user_metadata?.nickname || "");
    const savedAvatar = user.user_metadata?.avatar_url || "";
    setAvatarUrl(savedAvatar);
    setTempAvatarUrl(savedAvatar);
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const syncData = async () => {
      setBoardsLoading(true);
      const { data: followRows } = await supabase
        .from("follows_board")
        .select("board_id")
        .eq("user_id", user.id);

      const boardIds = (followRows as any[])?.map((row) => row.board_id) ?? [];
      if (boardIds.length > 0) {
        const { data: boardRows } = await supabase.from("boards").select("*").in("id", boardIds);
        setFollowedBoards(boardRows || []);
      } else {
        setFollowedBoards([]);
      }
      setBoardsLoading(false);

      // DB 프로필 동기화
      const dbProfile = await getProfile(user.id);
      if (dbProfile) {
        setNickname(dbProfile.nickname || "");
        setHandle(dbProfile.handle || "");
        setBio((dbProfile as any).bio || "");
        setHandleUpdatedAt(dbProfile.handle_updated_at);
        const savedAvatar = dbProfile.avatar_url || "";
        setAvatarUrl(savedAvatar);
        setTempAvatarUrl(savedAvatar);
        setIsFixedNickname(dbProfile.nickname_type === "FIXED");
        setCardTheme((dbProfile.card_theme as CardTheme) || "default");
        setCardAccent(dbProfile.card_accent || "");
        setCardShowOshi(dbProfile.card_show_oshi !== false);
        const rawBadgeIds = dbProfile.card_badge_ids || [];
        if (rawBadgeIds.includes("__none__")) {
          setCardHideBadges(true);
          setCardBadgeIds([]);
        } else {
          setCardHideBadges(false);
          setCardBadgeIds(rawBadgeIds);
        }
        setCardImageUrl(dbProfile.card_image_url || "");
        setCardAvatarUrl((dbProfile as any).card_avatar_url || "");
        setCardNicknameColor((dbProfile as any).card_nickname_color || "");
        setCardNicknameFont(((dbProfile as any).card_nickname_font as "sans" | "serif" | "mono") || "sans");
      } else {
        // 하위 호환성: 메타데이터 사용
        setNickname(user.user_metadata?.nickname || "");
        setHandle(user.user_metadata?.nickname || "");
        const savedAvatar = user.user_metadata?.avatar_url || "";
        setAvatarUrl(savedAvatar);
        setTempAvatarUrl(savedAvatar);
      }

      const savedProfiles = await listCharacterProfiles();
      const allProfiles = mergeProfiles(BASE_PROFILES, savedProfiles);
      setProfiles(allProfiles);

      // 오시 & 배지 동기화
      const [oshiData, badgesData, userBadgesData] = await Promise.all([
        getOshiList(user.id),
        getAllBadges(),
        getUserBadges(user.id),
      ]);
      setOshiList(oshiData);
      setAllBadges(badgesData);
      setUserBadges(userBadgesData);
      setOshiLoading(false);
    };

    void syncData();
  }, [user, setProfiles]);

  useEffect(() => {
    const fetchOfficialCatalog = async () => {
      const [{ data: worksData, error: worksError }, { data: oshiData, error: oshiError }] =
        await Promise.all([
          supabase
            .from("official_works")
            .select("*")
            .eq("status", "PUBLISHED")
            .order("sort_order", { ascending: true })
            .order("title", { ascending: true }),
          supabase
            .from("official_oshi_characters")
            .select("*")
            .eq("status", "PUBLISHED")
            .order("sort_order", { ascending: true })
            .order("name", { ascending: true }),
        ]);

      if (!worksError) setOfficialWorks((worksData ?? []) as OfficialWork[]);
      if (!oshiError) setOfficialOshi((oshiData ?? []) as OfficialOshiCharacter[]);

      if (user?.id) {
        try {
          const followed = await fetchFollowedOfficialWorkIds(user.id);
          setFollowedOfficialWorkIds(followed);
        } catch (error) {
          console.warn("[profile] failed to fetch official work follows:", error);
          setFollowedOfficialWorkIds(new Set());
        }
      }
    };

    void fetchOfficialCatalog();
  }, [user?.id]);

  if (user === undefined) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 p-6">
        <div className="border border-dashed border-gray-500 bg-white/70 p-8 text-center italic text-gray-500 animate-pulse">
          로딩 중...
        </div>
      </main>
    );
  }

  if (user === null) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 p-6">
        <div className="border border-dashed border-gray-500 bg-white/70 p-8 text-center">
          <p className="mb-4 text-sm text-gray-600">로그인이 필요한 페이지입니다.</p>
          <Link href="/auth" className="border border-dashed border-gray-800 bg-white px-4 py-2 text-sm">로그인</Link>
        </div>
      </main>
    );
  }

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    if (!handle.trim()) {
      setMessage("오류: 아이디를 입력해주세요.");
      setLoading(false);
      return;
    }

    if (!/^[a-zA-Z0-9_]{3,20}$/.test(handle)) {
      setMessage("오류: 아이디는 영문, 숫자, 언더바(_)만 사용하여 3~20자로 입력해주세요.");
      setLoading(false);
      return;
    }

    try {
      // 0. 아이디 중복 확인
      const isAvailable = await checkHandleAvailability(handle, user!.id);
      if (!isAvailable) {
        setMessage("오류: 이미 사용 중인 아이디입니다.");
        setLoading(false);
        return;
      }

      // 0.1 30일 제한 확인
      let newHandleUpdatedAt = handleUpdatedAt;
      if (handleUpdatedAt) {
        const lastUpdated = new Date(handleUpdatedAt);
        const now = new Date();
        const diffDays = (now.getTime() - lastUpdated.getTime()) / (1000 * 3600 * 24);
        
        // 아이디가 변경되었을 경우에만 체크 (초기화나 기존 아이디 그대로인 경우는 패스)
        const dbProfile = await getProfile(user!.id);
        if (dbProfile?.handle !== handle) {
          if (diffDays < 30) {
            setMessage(`오류: 아이디는 30일에 한 번만 변경할 수 있습니다. (남은 일수: ${Math.ceil(30 - diffDays)}일)`);
            setLoading(false);
            return;
          }
          newHandleUpdatedAt = now.toISOString();
        }
      } else {
        const dbProfile = await getProfile(user!.id);
        if (dbProfile?.handle !== handle) {
           newHandleUpdatedAt = new Date().toISOString();
        }
      }

      // 1. 프로필 테이블 업데이트
      await updateProfile(user!.id, {
        nickname,
        handle,
        handle_updated_at: newHandleUpdatedAt,
        avatar_url: tempAvatarUrl,
        nickname_type: isFixedNickname ? "FIXED" : "TEMPORARY",
        ...({ bio: bio.trim() || null } as any),
      });

      // 2. Auth 메타데이터 업데이트 (편의상 유지)
      const { error } = await supabase.auth.updateUser({
        data: { nickname, handle, avatar_url: tempAvatarUrl },
      });

      if (error) throw error;

      setMessage("성공적으로 저장되었습니다.");
      setAvatarUrl(tempAvatarUrl);
      setHandleUpdatedAt(newHandleUpdatedAt);
    } catch (err: any) {
      setMessage(`오류: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: user.email!,
        password: verifyPassword,
      });
      if (error) throw new Error("비밀번호가 올바르지 않습니다.");
      setIsAccountVerified(true);
      setVerifyPassword("");
    } catch (err: any) {
      setMessage(`오류: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setMessage("오류: 새 비밀번호가 일치하지 않습니다.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;

      setMessage("비밀번호가 성공적으로 변경되었습니다.");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setMessage(`오류: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const executeWithdraw = async () => {
    if (withdrawInput !== "탈퇴하겠습니다") {
      alert("입력한 문구가 올바르지 않습니다.");
      return;
    }
    setLoading(true);
    try {
      // 탈퇴 처리 (엣지 펑션 등 백엔드 연동 전까지 회원 세션 삭제 처리로 구성)
      await supabase.auth.signOut();
      alert("회원 탈퇴가 정상적으로 처리되었습니다.");
      router.push("/");
    } catch (e: any) {
      alert(`탈퇴 중 오류 발생: ${e.message}`);
    } finally {
      setLoading(false);
      setShowWithdrawModal(false);
    }
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCropType("profileAvatar");
    setCropSrc(URL.createObjectURL(file));
    e.target.value = "";
  };

  const handleOshiImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setCropType("oshi");
    setCropSrc(URL.createObjectURL(file));
    e.target.value = "";
  };

  const openAvatarModal = () => {
    setModalAvatarDraft(tempAvatarUrl);
    setShowAvatarModal(true);
  };

  const cancelAvatarModal = () => {
    setShowAvatarModal(false);
  };

  const confirmAvatarModal = () => {
    setTempAvatarUrl(modalAvatarDraft);
    setShowAvatarModal(false);
  };

  const pickModalCharacterThumbnail = (thumbnailUrl: string | undefined) => {
    if (!thumbnailUrl) return;
    setModalAvatarDraft(thumbnailUrl);
  };

  const handleUnfollow = async (boardId: string) => {
    if (!confirm("정말 이 채널의 구독을 취소하시겠습니까?")) return;
    const { error } = await supabase
      .from("follows_board")
      .delete()
      .eq("user_id", user.id)
      .eq("board_id", boardId);

    if (!error) {
      setFollowedBoards((prev) => prev.filter((b) => b.id !== boardId));
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  const handleSaveCard = async () => {
    if (!user) return;
    setCardSaving(true);
    setCardMessage("");
    try {
      await updateProfile(user.id, {
        card_theme: cardTheme,
        card_accent: cardAccent || null,
        card_show_oshi: cardShowOshi,
        card_badge_ids: cardHideBadges ? ["__none__"] : cardBadgeIds,
        card_image_url: cardImageUrl || null,
        card_avatar_url: cardAvatarUrl || null,
        card_nickname_color: cardNicknameColor || null,
        card_nickname_font: cardNicknameFont,
        bio: bio.trim() || null,
      } as any);
      setCardMessage("저장됐습니다.");
    } catch (err: any) {
      setCardMessage(`오류: ${err.message}`);
    } finally {
      setCardSaving(false);
    }
  };

  const handleCardImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCropType("banner");
    setCropSrc(URL.createObjectURL(file));
    e.target.value = "";
  };

  const handleCardAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCropType("avatar");
    setCropSrc(URL.createObjectURL(file));
    e.target.value = "";
  };

  const uploadCroppedImage = async (blob: Blob, path: string) => {
    const { error: uploadError } = await supabase.storage
      .from("character-assets")
      .upload(path, blob, { upsert: true, contentType: "image/jpeg" });
    if (uploadError) throw uploadError;
    const { data: { publicUrl } } = supabase.storage
      .from("character-assets")
      .getPublicUrl(path);
    return publicUrl;
  };

  const handleCropConfirm = async (blob: Blob) => {
    if (!user) return;
    const type = cropType;
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);

    if (type === "profileAvatar") {
      setLoading(true);
      try {
        const publicUrl = await uploadCroppedImage(blob, `${user.id}/avatars/avatar-${Date.now()}.jpg`);
        setModalAvatarDraft(publicUrl);
      } catch (err: any) {
        alert(`업로드 오류: ${err.message}`);
      } finally {
        setLoading(false);
      }
      return;
    }

    if (type === "oshi") {
      setOshiImageUploading(true);
      try {
        const publicUrl = await uploadCroppedImage(blob, `${user.id}/oshi/${Date.now()}.jpg`);
        setOshiForm((f) => ({ ...f, image_url: publicUrl }));
      } catch (err: any) {
        alert(`업로드 오류: ${err.message}`);
      } finally {
        setOshiImageUploading(false);
      }
      return;
    }

    if (type === "banner") {
      setCardImageUploading(true);
      try {
        const publicUrl = await uploadCroppedImage(blob, `${user.id}/card/${Date.now()}.jpg`);
        setCardImageUrl(publicUrl);
      } catch (err: any) {
        alert(`업로드 오류: ${err.message}`);
      } finally {
        setCardImageUploading(false);
      }
    } else {
      setCardAvatarUploading(true);
      try {
        const publicUrl = await uploadCroppedImage(blob, `${user.id}/card/avatar-${Date.now()}.jpg`);
        setCardAvatarUrl(publicUrl);
      } catch (err: any) {
        alert(`업로드 오류: ${err.message}`);
      } finally {
        setCardAvatarUploading(false);
      }
    }
  };

  const toggleCardBadge = (badgeId: string) => {
    setCardBadgeIds((prev) => {
      if (prev.includes(badgeId)) return prev.filter((id) => id !== badgeId);
      if (prev.length >= 4) return prev; // 최대 4개
      return [...prev, badgeId];
    });
  };

  const openOshiForm = (existing?: OshiRegistration) => {
    if (existing) {
      setEditingOshi(existing);
      const members = [...(existing.pair_members ?? [])].sort(
        (a, b) => a.member_index - b.member_index
      );
      const d = (members[0]?.direction as OshiPairDirection | null) ?? "reversible";
      setOshiForm({
        title: existing.oshi_type === "pair" ? "" : existing.title,
        oshi_type: existing.oshi_type,
        image_url: existing.image_url ?? "",
        description: existing.description ?? "",
        is_public: existing.is_public,
        affiliation: existing.affiliation ?? "",
        reference_work: existing.reference_work ?? "",
        pair_work_title: existing.oshi_type === "pair" ? existing.title : "",
        pair_char_a: members[0]?.character_title ?? "",
        pair_char_b: members[1]?.character_title ?? "",
        pair_direction: ["a_to_b", "b_to_a", "reversible", "unknown"].includes(d)
          ? d
          : "reversible",
        official_work_id: existing.official_work_id ?? "",
        official_oshi_id: existing.official_oshi_character_id ?? "",
      });
      setOshiWorkQuery(
        officialWorks.find((work) => work.id === existing.official_work_id)?.title ?? ""
      );
    } else {
      setEditingOshi(null);
      setOshiWorkQuery("");
      setOshiForm({
        title: "",
        oshi_type: "anime",
        image_url: "",
        description: "",
        is_public: true,
        affiliation: "",
        reference_work: "",
        pair_work_title: "",
        pair_char_a: "",
        pair_char_b: "",
        pair_direction: "reversible",
        official_work_id: "",
        official_oshi_id: "",
      });
    }
    setShowOshiForm(true);
  };

  const officialOshiForSelectedWork = officialOshi.filter(
    (item) => item.work_id === oshiForm.official_work_id,
  );

  const followedOfficialWorks = officialWorks.filter((work) =>
    followedOfficialWorkIds.has(work.id),
  );

  const interestWorkSearchResults = officialWorks
    .filter((work) => !followedOfficialWorkIds.has(work.id))
    .filter((work) => {
      const query = interestWorkQuery.trim().toLowerCase();
      if (!query) return false;
      return [work.title, work.original_title ?? "", work.slug]
        .join(" ")
        .toLowerCase()
        .includes(query);
    })
    .slice(0, 8);

  const oshiWorkSearchResults = officialWorks
    .filter((work) => {
      const query = oshiWorkQuery.trim().toLowerCase();
      if (!query) return false;
      return [work.title, work.original_title ?? "", work.slug]
        .join(" ")
        .toLowerCase()
        .includes(query);
    })
    .slice(0, 8);

  const applyOfficialWork = (workId: string) => {
    const work = officialWorks.find((item) => item.id === workId);
    if (!work) {
      setOshiForm((f) => ({ ...f, official_work_id: "", official_oshi_id: "" }));
      return;
    }

    const nextType: OshiType =
      work.category === "anime" || work.category === "manga" ? work.category : "other";

    setOshiWorkQuery(work.title);
    setOshiForm((f) => ({
      ...f,
      official_work_id: work.id,
      official_oshi_id: "",
      oshi_type: nextType,
      title: work.title,
      image_url: work.cover_image_url ?? f.image_url,
      reference_work: "",
    }));
  };

  const applyOfficialOshi = (oshiId: string) => {
    const selected = officialOshi.find((item) => item.id === oshiId);
    if (!selected) {
      setOshiForm((f) => ({ ...f, official_oshi_id: "" }));
      return;
    }

    const work = officialWorks.find((item) => item.id === selected.work_id);
    setOshiForm((f) => ({
      ...f,
      official_work_id: selected.work_id,
      official_oshi_id: selected.id,
      oshi_type: "character",
      title: selected.name,
      image_url: selected.profile_image_url ?? f.image_url,
      affiliation: selected.role_label ?? "",
      reference_work: work?.title ?? "",
      description: selected.description ? selected.description.slice(0, 100) : f.description,
    }));
  };

  const handleOfficialWorkFollowToggle = async (workId: string) => {
    if (!user) return;
    const nextEnabled = !followedOfficialWorkIds.has(workId);
    const previous = followedOfficialWorkIds;
    const next = new Set(previous);
    if (nextEnabled) next.add(workId);
    else next.delete(workId);

    setFollowedOfficialWorkIds(next);
    setOfficialWorkFollowSavingId(workId);
    try {
      await setOfficialWorkFollow(user.id, workId, nextEnabled);
    } catch (error) {
      setFollowedOfficialWorkIds(previous);
      const message = error instanceof Error ? error.message : "알 수 없는 오류";
      alert(`관심작 변경 실패: ${message}`);
    } finally {
      setOfficialWorkFollowSavingId(null);
    }
  };

  const handleOshiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (oshiForm.oshi_type === "pair") {
      const a = oshiForm.pair_char_a.trim();
      const b = oshiForm.pair_char_b.trim();
      if (!a || !b) {
        alert("CP 타입은 캐릭터 A·B 이름을 모두 입력해 주세요.");
        return;
      }
    } else if (!oshiForm.title.trim()) {
      return;
    }

    setLoading(true);
    try {
      const rank = editingOshi ? editingOshi.rank : (oshiList.length + 1);
      const isPair = oshiForm.oshi_type === "pair";
      const titleForDb = isPair
        ? (oshiForm.pair_work_title.trim() || `${oshiForm.pair_char_a.trim()}×${oshiForm.pair_char_b.trim()}`).slice(
            0,
            50
          )
        : oshiForm.title.trim();

      const saved = await upsertOshi(user.id, rank, {
        title: titleForDb,
        oshi_type: oshiForm.oshi_type,
        official_work_id: oshiForm.official_work_id || null,
        official_oshi_character_id: oshiForm.official_oshi_id || null,
        image_url: oshiForm.image_url.trim() || undefined,
        description: oshiForm.description.trim() || undefined,
        is_public: oshiForm.is_public,
        affiliation: oshiForm.affiliation.trim() || null,
        reference_work: oshiForm.reference_work.trim() || null,
        pair: isPair
          ? {
              charA: oshiForm.pair_char_a.trim(),
              charB: oshiForm.pair_char_b.trim(),
              direction: oshiForm.pair_direction,
            }
          : null,
      });

      setOshiList((prev) => {
        const without = prev.filter((o) => o.rank !== rank);
        return [...without, saved].sort((a, b) => a.rank - b.rank);
      });

      // 배지 자동 체크
      const newIds = await checkAndGrantOshiBadges(user.id);
      if (newIds.length > 0) {
        setNewBadgeIds(newIds);
        const fresh = await getUserBadges(user.id);
        setUserBadges(fresh);
        setTimeout(() => setNewBadgeIds([]), 4000);
      }

      setShowOshiForm(false);
    } catch (err: any) {
      alert(`오류: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleOshiDelete = async (oshi: OshiRegistration) => {
    if (!user) return;
    if (!confirm(`"${formatOshiPrimaryTitle(oshi)}" 최애 등록을 삭제하시겠습니까?`)) return;
    setLoading(true);
    try {
      await deleteOshi(user.id, oshi.id);
      const remaining = oshiList.filter((o) => o.id !== oshi.id);
      // rank 재정렬
      const reranked = remaining.map((o, idx) => ({ ...o, rank: idx + 1 }));
      setOshiList(reranked);

      const newIds = await checkAndGrantOshiBadges(user.id);
      if (newIds.length > 0) {
        const fresh = await getUserBadges(user.id);
        setUserBadges(fresh);
      }
    } catch (err: any) {
      alert(`오류: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleOshiMove = async (oshiId: string, direction: "up" | "down") => {
    if (!user) return;
    const currentIndex = oshiList.findIndex((oshi) => oshi.id === oshiId);
    if (currentIndex < 0) return;
    const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (nextIndex < 0 || nextIndex >= oshiList.length) return;

    const nextList = [...oshiList];
    [nextList[currentIndex], nextList[nextIndex]] = [
      nextList[nextIndex],
      nextList[currentIndex],
    ];
    const reranked = nextList.map((oshi, index) => ({ ...oshi, rank: index + 1 }));
    const previous = oshiList;

    setOshiList(reranked);
    try {
      await reorderOshi(user.id, reranked.map((oshi) => oshi.id));
    } catch (err: any) {
      setOshiList(previous);
      alert(`순서 변경 실패: ${err.message}`);
    }
  };

  const handleSelectCharacter = async (profileId: string) => {
    const selected = profiles.find((p) => p.id === profileId);
    if (selected) {
      setActiveCharacterId(profileId);
      setProfile(selected);

      // 1. 프로필 테이블 업데이트 (대표 캐릭터)
      await updateProfile(user!.id, {
        representative_character_id: profileId
      });

      // 2. user metadata에 상태 저장
      await supabase.auth.updateUser({
        data: { activeCharacterId: profileId },
      });
      alert(`[${selected.name}] 캐릭터가 기본 활성 캐릭터로 설정되었습니다.`);
    }
  };

  const handleDeleteCharacter = (profileId: string) => {
    if (confirm("정말 이 캐릭터를 라이브러리에서 삭제하시겠습니까? 관련된 설정 데이터가 모두 지워집니다.")) {
      unregister(profileId);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 p-6 font-sans text-gray-800">
      {cropSrc && (
        <CardImageCropModal
          imageSrc={cropSrc}
          aspect={cropType === "banner" ? 4 : 1}
          title={
            cropType === "profileAvatar"
              ? "프로필 이미지 리사이즈"
              : cropType === "oshi"
                ? "최애 이미지 리사이즈"
                : cropType === "avatar"
                  ? "카드 아바타 리사이즈"
                  : "카드 배경 이미지 리사이즈"
          }
          outputSize={
            cropType === "banner"
              ? { width: 1200, height: 300 }
              : { width: 512, height: 512 }
          }
          onConfirm={handleCropConfirm}
          onCancel={() => { URL.revokeObjectURL(cropSrc); setCropSrc(null); }}
        />
      )}
      {/* GNB 연동 탭 네비게이션 */}
      <div className="flex flex-wrap gap-x-6 border-b border-dashed border-gray-400 pb-2 mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => { 
                setActiveTab(tab.id); 
                setMessage(""); 
                if (tab.id !== "account") setIsAccountVerified(false); 
            }}
            className={`text-sm font-bold transition-all border-b-2 pb-2 -mb-[10px] ${
              activeTab === tab.id
                ? "text-gray-900 border-gray-900"
                : "text-gray-400 border-transparent hover:text-gray-600"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="border border-dashed border-gray-500 bg-white/70 p-8">
        {activeTab === "profile" && (
          <form onSubmit={handleUpdateProfile} className="space-y-12">
            {/* 프로필 이미지 행 */}
            <div className="flex flex-col md:flex-row gap-6 md:gap-20">
              <label className="w-40 text-sm font-bold shrink-0 pt-1 uppercase tracking-tight">프로필 이미지</label>
              <div className="space-y-4">
                <div className="flex flex-wrap items-end gap-4">
                  <div className="h-32 w-32 shrink-0 overflow-hidden border border-dashed border-gray-400 bg-gray-100">
                    {tempAvatarUrl ? (
                      <img src={tempAvatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center px-2 text-center text-[10px] text-gray-400">
                        NO IMAGE
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={openAvatarModal}
                    className="border border-dashed border-gray-800 bg-white px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-gray-800 transition-colors hover:bg-gray-800 hover:text-white"
                  >
                    프로필 변경
                  </button>
                </div>
                <p className="text-[11px] text-gray-400 italic">
                  ※ 모달에서 썸네일·업로드를 고른 뒤 확인하면 미리보기에 반영됩니다. 계정 반영은 [정보 저장]을 눌러 주세요.
                </p>
                <input type="file" ref={fileInputRef} onChange={handleAvatarUpload} className="hidden" accept="image/*" />
              </div>
            </div>

            {/* 아이디 행 */}
            <div className="flex flex-col md:flex-row gap-6 md:gap-20">
              <label className="w-40 text-sm font-bold shrink-0 pt-2 uppercase tracking-tight">아이디</label>
              <div className="flex-1 max-w-2xl space-y-3">
                <div className="flex border border-dashed border-gray-500 bg-white overflow-hidden">
                  <span className="flex items-center px-3 text-gray-500 font-bold bg-gray-50 border-r border-dashed border-gray-400">@</span>
                  <input
                    type="text"
                    value={handle}
                    onChange={(e) => setHandle(e.target.value)}
                    placeholder="영문, 숫자, 언더바 3~20자"
                    className="flex-1 bg-transparent px-4 py-2 text-sm outline-none"
                  />
                </div>
                <div className="text-[11px] text-gray-400 space-y-1">
                  <p>• 아이디는 고유하며 중복될 수 없습니다.</p>
                  <p>• 변경 후 30일간 변경이 불가능합니다.</p>
                </div>
              </div>
            </div>

            {/* 닉네임 행 */}
            <div className="flex flex-col md:flex-row gap-6 md:gap-20">
              <label className="w-40 text-sm font-bold shrink-0 pt-2 uppercase tracking-tight">닉네임</label>
              <div className="flex-1 max-w-2xl space-y-3">
                <div className="flex border border-dashed border-gray-500 bg-white overflow-hidden">
                  <input
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    className="flex-1 bg-transparent px-4 py-2 text-sm outline-none"
                  />
                  <label className="flex items-center gap-2 px-4 border-l border-dashed border-gray-400 bg-gray-50 shrink-0 text-xs text-gray-600 font-bold select-none cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={isFixedNickname} 
                      onChange={(e) => setIsFixedNickname(e.target.checked)}
                      className="accent-gray-800"
                    />
                    고정닉
                  </label>
                </div>
                <div className="text-[11px] text-gray-400 space-y-1">
                  <p>• 타인에게 불쾌감을 주는 닉네임은 제재의 대상이 될 수 있습니다.</p>
                </div>
              </div>
            </div>

            {/* 하단 저장 버튼 */}
            <div className="flex justify-end pt-8 border-t border-dashed border-gray-200">
              <div className="flex items-center gap-4">
                {message && (
                  <span className={`text-[11px] font-bold ${message.startsWith('오류') ? 'text-red-500' : 'text-green-600'}`}>
                    {message}
                  </span>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="border border-dashed border-gray-800 bg-gray-800 text-white px-10 py-2.5 text-xs font-bold hover:bg-gray-700 disabled:opacity-50 transition-colors uppercase tracking-widest"
                >
                  {loading ? "SAVING..." : "[정보 저장]"}
                </button>
              </div>
            </div>
          </form>
        )}

        {activeTab === "oshi" && (
          <div className="space-y-10">
            {/* 획득한 새 배지 토스트 */}
            {newBadgeIds.length > 0 && (
              <div className="border border-dashed border-yellow-400 bg-yellow-50 px-5 py-3 text-xs font-bold text-yellow-700 flex items-center gap-3">
                <span className="text-lg">🎉</span>
                새 배지 획득! {newBadgeIds.map((id) => allBadges.find((b) => b.id === id)?.name).filter(Boolean).join(", ")}
              </div>
            )}

            <section>
              <div className="flex items-end justify-between border-b border-dashed border-gray-300 pb-2 mb-6">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500">내 관심작</h2>
                  <p className="text-[11px] text-gray-400 mt-0.5">공식 작품 중 관심 있는 작품을 등록합니다.</p>
                </div>
                <span className="text-[10px] text-gray-400">TOTAL: {followedOfficialWorkIds.size}</span>
              </div>

              <div className="mb-4 space-y-3">
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-gray-500">
                    작품 검색
                  </span>
                  <input
                    type="search"
                    value={interestWorkQuery}
                    onChange={(e) => setInterestWorkQuery(e.target.value)}
                    placeholder="작품명, 원제, 슬러그로 검색"
                    className="w-full border border-dashed border-gray-400 bg-white px-3 py-2 text-sm outline-none focus:border-gray-700"
                  />
                </label>

                {interestWorkQuery.trim() && (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {interestWorkSearchResults.length === 0 ? (
                      <p className="border border-dashed border-gray-300 bg-gray-50 p-4 text-xs text-gray-400 sm:col-span-2">
                        검색 결과가 없습니다.
                      </p>
                    ) : (
                      interestWorkSearchResults.map((work) => {
                        const saving = officialWorkFollowSavingId === work.id;
                        return (
                          <button
                            key={work.id}
                            type="button"
                            disabled={saving}
                            onClick={() => void handleOfficialWorkFollowToggle(work.id)}
                            className="flex gap-3 border border-dashed border-gray-300 bg-white p-3 text-left transition-colors hover:border-blue-400 hover:bg-blue-50 disabled:opacity-50"
                          >
                            <div className="h-12 w-9 shrink-0 overflow-hidden border border-dashed border-gray-300 bg-gray-100">
                              {work.cover_image_url ? (
                                <img src={work.cover_image_url} alt={work.title} className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex h-full items-center justify-center text-[9px] text-gray-400">NO</div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-bold text-gray-900">{work.title}</p>
                              {work.original_title && (
                                <p className="mt-0.5 truncate text-[10px] text-gray-400">{work.original_title}</p>
                              )}
                              <p className="mt-1 text-[10px] font-bold text-blue-600">
                                {saving ? "저장 중..." : "+ 관심 등록"}
                              </p>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {followedOfficialWorks.length === 0 ? (
                <div className="border border-dashed border-gray-300 bg-gray-50/50 p-8 text-center text-xs text-gray-400">
                  아직 등록된 관심작이 없습니다.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {followedOfficialWorks.map((work) => {
                    const saving = officialWorkFollowSavingId === work.id;
                    return (
                      <div
                        key={work.id}
                        className="flex gap-3 border border-dashed border-blue-400 bg-blue-50 p-3"
                      >
                        <div className="h-14 w-10 shrink-0 overflow-hidden border border-dashed border-gray-300 bg-gray-100">
                          {work.cover_image_url ? (
                            <img src={work.cover_image_url} alt={work.title} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full items-center justify-center text-[10px] text-gray-400">NO</div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-bold text-gray-900">{work.title}</p>
                          {work.original_title && (
                            <p className="mt-0.5 truncate text-[10px] text-gray-400">{work.original_title}</p>
                          )}
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => void handleOfficialWorkFollowToggle(work.id)}
                            className="mt-2 border border-dashed border-blue-400 bg-blue-600 px-3 py-1 text-[10px] font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                          >
                            {saving ? "저장 중..." : "관심 해제"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* 오시 섹션 */}
            <section>
              <div className="flex items-end justify-between border-b border-dashed border-gray-300 pb-2 mb-6">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500">내 최애</h2>
                  <p className="text-[11px] text-gray-400 mt-0.5">최대 5개 · 1번이 메인 최애</p>
                </div>
                {oshiList.length < 5 && (
                  <button
                    type="button"
                    onClick={() => openOshiForm()}
                    className="border border-dashed border-gray-800 bg-white px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-800 hover:bg-gray-800 hover:text-white transition-colors"
                  >
                    [+ 최애 추가]
                  </button>
                )}
              </div>

              {oshiLoading ? (
                <p className="text-center py-8 text-xs text-gray-400 animate-pulse italic font-bold">LOADING...</p>
              ) : oshiList.length === 0 ? (
                <div className="border border-dashed border-gray-300 bg-gray-50/50 p-12 text-center text-xs text-gray-400 italic space-y-2">
                  <div className="text-3xl">💘</div>
                  <p>아직 등록된 최애가 없습니다.</p>
                  <button
                    type="button"
                    onClick={() => openOshiForm()}
                    className="mt-2 border border-dashed border-gray-400 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-600 hover:bg-gray-100 transition-colors"
                  >
                    [첫 최애 등록하기]
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* 메인 오시 (rank 1) */}
                  {oshiList.filter((o) => o.rank === 1).map((oshi) => (
                    <div key={oshi.id} className="flex gap-4 border border-gray-700 bg-gray-50 p-4">
                      <div className="shrink-0 w-16 h-16 border border-dashed border-gray-400 bg-gray-100 overflow-hidden">
                        {oshi.image_url ? (
                          <img src={oshi.image_url} alt={formatOshiPrimaryTitle(oshi)} className="w-full h-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-lg">💘</div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[9px] font-bold bg-gray-800 text-white px-1.5 py-0.5">#1 메인 최애</span>
                          <span className="text-[9px] border border-dashed border-gray-400 text-gray-500 px-1 font-bold uppercase">{OSHI_TYPE_LABELS[oshi.oshi_type]}</span>
                          {!oshi.is_public && <span className="text-[9px] border border-dashed border-gray-300 text-gray-400 px-1">비공개</span>}
                        </div>
                        <p className="mt-1 text-sm font-bold text-gray-900 truncate">{formatOshiPrimaryTitle(oshi)}</p>
                        {formatOshiSubtitle(oshi) && (
                          <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-1 italic">{formatOshiSubtitle(oshi)}</p>
                        )}
                        {!formatOshiSubtitle(oshi) && oshi.description && (
                          <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-1 italic">{oshi.description}</p>
                        )}
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        <div className="flex gap-1">
                          <button
                            type="button"
                            disabled={oshi.rank === 1}
                            onClick={() => handleOshiMove(oshi.id, "up")}
                            className="border border-dashed border-gray-300 px-2 py-1 text-[10px] font-bold text-gray-400 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30"
                            aria-label="최애 순서 위로"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            disabled={oshi.rank === oshiList.length}
                            onClick={() => handleOshiMove(oshi.id, "down")}
                            className="border border-dashed border-gray-300 px-2 py-1 text-[10px] font-bold text-gray-400 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30"
                            aria-label="최애 순서 아래로"
                          >
                            ↓
                          </button>
                        </div>
                        <button onClick={() => openOshiForm(oshi)} className="border border-dashed border-gray-400 px-3 py-1 text-[10px] font-bold text-gray-500 hover:bg-gray-100 transition-colors">[편집]</button>
                        <button onClick={() => handleOshiDelete(oshi)} className="border border-dashed border-red-300 px-3 py-1 text-[10px] font-bold text-red-400 hover:bg-red-50 transition-colors">[삭제]</button>
                      </div>
                    </div>
                  ))}

                  {/* 서브 오시 (rank 2~5) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {oshiList.filter((o) => o.rank > 1).map((oshi) => (
                      <div key={oshi.id} className="flex gap-3 border border-dashed border-gray-400 bg-white p-3 group hover:border-gray-700 transition-colors">
                        <div className="shrink-0 w-10 h-10 border border-dashed border-gray-300 bg-gray-50 overflow-hidden">
                          {oshi.image_url ? (
                            <img src={oshi.image_url} alt={formatOshiPrimaryTitle(oshi)} className="w-full h-full object-cover" />
                          ) : (
                            <div className="flex h-full items-center justify-center text-sm">🎌</div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-bold text-gray-400">#{oshi.rank}</span>
                            <span className="text-[9px] border border-dashed border-gray-300 text-gray-400 px-1 uppercase">{OSHI_TYPE_LABELS[oshi.oshi_type]}</span>
                          </div>
                          <p className="text-xs font-bold text-gray-800 truncate mt-0.5">{formatOshiPrimaryTitle(oshi)}</p>
                          {(formatOshiSubtitle(oshi) || oshi.description) && (
                            <p className="text-[10px] text-gray-400 truncate italic">
                              {formatOshiSubtitle(oshi) ?? oshi.description}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col gap-1 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <div className="flex gap-1">
                            <button
                              type="button"
                              disabled={oshi.rank === 1}
                              onClick={() => handleOshiMove(oshi.id, "up")}
                              className="text-[11px] font-bold text-gray-400 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-30"
                              aria-label="최애 순서 위로"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              disabled={oshi.rank === oshiList.length}
                              onClick={() => handleOshiMove(oshi.id, "down")}
                              className="text-[11px] font-bold text-gray-400 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-30"
                              aria-label="최애 순서 아래로"
                            >
                              ↓
                            </button>
                          </div>
                          <button onClick={() => openOshiForm(oshi)} className="text-[9px] font-bold text-gray-400 hover:text-gray-700 px-1">[편집]</button>
                          <button onClick={() => handleOshiDelete(oshi)} className="text-[9px] font-bold text-red-300 hover:text-red-500 px-1">[삭제]</button>
                        </div>
                      </div>
                    ))}

                    {/* 빈 슬롯 */}
                    {Array.from({ length: Math.max(0, 4 - oshiList.filter((o) => o.rank > 1).length) }).map((_, i) => (
                      <button
                        key={`empty-${i}`}
                        type="button"
                        onClick={() => openOshiForm()}
                        disabled={oshiList.length >= 5}
                        className="flex items-center justify-center gap-2 border border-dashed border-gray-200 bg-gray-50/50 p-3 text-[10px] text-gray-300 hover:border-gray-400 hover:text-gray-400 transition-colors disabled:cursor-default h-16"
                      >
                        + 추가
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* 배지 섹션 */}
            <section>
              <div className="flex items-end justify-between border-b border-dashed border-gray-300 pb-2 mb-6">
                <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500">내 배지</h2>
                <span className="text-[10px] text-gray-400">
                  획득 {userBadges.length} / 전체 {allBadges.length}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {allBadges.map((badge) => {
                  const earned = userBadges.find((ub) => ub.badge_id === badge.id);
                  const isNew = newBadgeIds.includes(badge.id);
                  return (
                    <div
                      key={badge.id}
                      className={`relative border border-dashed p-3 flex flex-col gap-1.5 transition-all ${
                        earned
                          ? `${RARITY_COLORS[badge.rarity]} ${isNew ? "ring-2 ring-yellow-400 ring-offset-1" : ""}`
                          : "border-gray-200 bg-gray-50/30 opacity-40 grayscale"
                      }`}
                    >
                      {isNew && (
                        <span className="absolute -top-1.5 -right-1.5 text-[9px] font-bold bg-yellow-400 text-white px-1">NEW</span>
                      )}
                      <div className="text-2xl">{badge.icon}</div>
                      <div>
                        <p className="text-[11px] font-bold text-gray-800 leading-tight">{badge.name}</p>
                        <p className="text-[10px] text-gray-500 leading-tight mt-0.5">{badge.description}</p>
                      </div>
                      <span className={`self-start text-[9px] font-bold px-1 border border-dashed ${RARITY_COLORS[badge.rarity]}`}>
                        {RARITY_LABELS[badge.rarity]}
                      </span>
                      {earned && (
                        <p className="text-[9px] text-gray-400">
                          {new Date(earned.earned_at).toLocaleDateString("ko-KR")} 획득
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}

        {activeTab === "card" && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

                {/* 카드 이미지 */}
                <section>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 border-b border-dashed border-gray-300 pb-2 mb-4">카드 이미지</h3>
                  <p className="text-[10px] text-gray-400 mb-3">카드 상단 배너로 표시됩니다. 권장 비율 16:4 (예: 800×200)</p>
                  {cardImageUrl ? (
                    <div className="space-y-2">
                      <div className="relative h-24 w-full overflow-hidden border border-dashed border-gray-400">
                        <img src={cardImageUrl} alt="card" className="h-full w-full object-cover" />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={cardImageUploading}
                          onClick={() => cardImageInputRef.current?.click()}
                          className="border border-dashed border-gray-400 px-3 py-1.5 text-[11px] font-bold text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                        >
                          {cardImageUploading ? "업로드 중..." : "이미지 변경"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setCardImageUrl("")}
                          className="border border-dashed border-red-300 px-3 py-1.5 text-[11px] font-bold text-red-400 hover:bg-red-50"
                        >
                          이미지 제거
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={cardImageUploading}
                      onClick={() => cardImageInputRef.current?.click()}
                      className="w-full border border-dashed border-gray-400 bg-gray-50/50 py-8 text-[11px] font-bold text-gray-400 hover:border-gray-600 hover:text-gray-600 disabled:opacity-50 transition-colors flex flex-col items-center gap-2"
                    >
                      <span className="text-2xl">🖼️</span>
                      {cardImageUploading ? "업로드 중..." : "파일 선택"}
                    </button>
                  )}
                  <input
                    ref={cardImageInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleCardImageUpload}
                  />
                </section>

                {/* 테마 선택 */}
                <section>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 border-b border-dashed border-gray-300 pb-2 mb-4">테마</h3>
                  <div className="grid grid-cols-4 gap-2">
                    {THEME_ORDER.map((themeKey) => {
                      const t = CARD_THEMES[themeKey];
                      const isActive = cardTheme === themeKey;
                      return (
                        <button
                          key={themeKey}
                          type="button"
                          onClick={() => {
                            setCardTheme(themeKey);
                            setCardNicknameColor(t.nicknameColor);
                            setCardNicknameFont(t.nicknameFont);
                          }}
                          className={`flex flex-col items-center gap-1.5 border p-2 transition-all ${
                            isActive
                              ? "border-gray-900 ring-2 ring-gray-900 ring-offset-1"
                              : "border-dashed border-gray-300 hover:border-gray-500"
                          }`}
                        >
                          <span className="text-xl">{t.emoji}</span>
                          <span className="text-[10px] font-bold text-gray-700">{t.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>

                {/* 닉네임 스타일 */}
                <section>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 border-b border-dashed border-gray-300 pb-2 mb-4">닉네임 스타일</h3>

                  {/* 폰트 선택 */}
                  <div className="flex gap-2 mb-3">
                    {(["sans", "serif", "mono"] as const).map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setCardNicknameFont(f)}
                        className={`flex-1 border py-1.5 text-[11px] font-bold transition-all ${
                          cardNicknameFont === f
                            ? "border-gray-900 bg-gray-900 text-white"
                            : "border-dashed border-gray-300 text-gray-600 hover:border-gray-500"
                        } ${f === "serif" ? "font-serif" : f === "mono" ? "font-mono" : "font-sans"}`}
                      >
                        {{ sans: "고딕", serif: "명조", mono: "모노" }[f]}
                      </button>
                    ))}
                  </div>

                  {/* 색상 선택 */}
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={cardNicknameColor || "#111111"}
                      onChange={(e) => setCardNicknameColor(e.target.value)}
                      className="w-9 h-9 border border-dashed border-gray-400 cursor-pointer bg-transparent shrink-0"
                    />
                    <input
                      type="text"
                      value={cardNicknameColor}
                      onChange={(e) => setCardNicknameColor(e.target.value)}
                      placeholder="#hex (비우면 기본 색상)"
                      className="flex-1 border border-dashed border-gray-400 px-3 py-2 text-xs outline-none focus:border-gray-700 bg-white"
                    />
                    {cardNicknameColor && (
                      <button
                        type="button"
                        onClick={() => setCardNicknameColor("")}
                        className="text-[10px] font-bold text-gray-400 hover:text-red-500 border border-dashed border-gray-300 px-2 py-2 shrink-0"
                      >
                        초기화
                      </button>
                    )}
                  </div>
                </section>

                {/* 한줄소개 */}
                <section>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 border-b border-dashed border-gray-300 pb-2 mb-4">한줄소개</h3>
                  <input
                    type="text"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    maxLength={20}
                    placeholder="카드에 표시될 한줄소개 (20자 이내)"
                    className="w-full border border-dashed border-gray-400 px-3 py-2 text-xs outline-none focus:border-gray-700 bg-white"
                  />
                </section>

                {/* 오시 표시 여부 */}
                <section>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 border-b border-dashed border-gray-300 pb-2 mb-4">최애 표시</h3>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={cardShowOshi}
                      onChange={(e) => setCardShowOshi(e.target.checked)}
                      className="accent-gray-800 w-4 h-4"
                    />
                    <span className="text-xs font-bold text-gray-700">카드에 메인 최애 표시</span>
                  </label>
                </section>

                {/* 배지 고정 선택 */}
                <section>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 border-b border-dashed border-gray-300 pb-2 mb-3">카드에 고정할 배지</h3>

                  {/* 표시 여부 토글 */}
                  <label className="flex items-center gap-2 cursor-pointer select-none mb-3">
                    <input
                      type="checkbox"
                      checked={!cardHideBadges}
                      onChange={(e) => {
                        setCardHideBadges(!e.target.checked);
                        if (!e.target.checked) setCardBadgeIds([]);
                      }}
                      className="accent-gray-800 w-4 h-4"
                    />
                    <span className="text-xs font-bold text-gray-700">카드에 배지 표시</span>
                  </label>

                  {!cardHideBadges && (
                    <p className="text-[10px] text-gray-400 mb-3">최대 4개 · 선택한 배지만 카드에 표시됩니다</p>
                  )}

                  {!cardHideBadges && (
                    userBadges.length === 0 ? (
                      <p className="text-[11px] text-gray-400 italic">획득한 배지가 없습니다.</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {userBadges.map((ub) => {
                          if (!ub.badge) return null;
                          const isPinned = cardBadgeIds.includes(ub.badge_id);
                          const order = cardBadgeIds.indexOf(ub.badge_id);
                          return (
                            <button
                              key={ub.badge_id}
                              type="button"
                              onClick={() => toggleCardBadge(ub.badge_id)}
                              disabled={!isPinned && cardBadgeIds.length >= 4}
                              className={`flex items-center gap-2 border p-2 text-left transition-all disabled:opacity-40 ${
                                isPinned
                                  ? "border-gray-800 bg-gray-50 ring-1 ring-gray-700"
                                  : "border-dashed border-gray-300 hover:border-gray-500"
                              }`}
                            >
                              <span className="text-lg">{ub.badge.icon}</span>
                              <span className="text-[10px] font-bold text-gray-700 flex-1 leading-tight">{ub.badge.name}</span>
                              {isPinned && (
                                <span className="text-[9px] font-black bg-gray-800 text-white px-1">
                                  {order + 1}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )
                  )}
                </section>

            </div>

            {/* 미리보기 — 풀너비 */}
            <section className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 border-b border-dashed border-gray-300 pb-2">미리보기</h3>
              <p className="text-[10px] text-gray-400">카드 위에서 직접 클릭해 편집할 수 있습니다.</p>

              <div className="relative group">
                <AuthorProfileCard
                  profile={{
                    ...(({
                      id: user?.id ?? "",
                      user_id: user?.id ?? "",
                      nickname,
                      display_name: null,
                      handle,
                      handle_updated_at: null,
                      avatar_url: avatarUrl,
                      bio: bio || null,
                      representative_character_id: null,
                      nickname_type: isFixedNickname ? "FIXED" : "TEMPORARY",
                      role: "USER",
                      card_theme: cardTheme,
                      card_accent: null,
                      card_show_oshi: cardShowOshi,
                      card_badge_ids: cardHideBadges ? ["__none__"] : cardBadgeIds,
                      card_image_url: cardImageUrl || null,
                      card_avatar_url: cardAvatarUrl || null,
                      card_nickname_color: cardNicknameColor || null,
                      card_nickname_font: cardNicknameFont,
                      created_at: "",
                      updated_at: "",
                    }) as UserProfile),
                  }}
                  authorId={user?.id ?? null}
                  viewerId={null}
                  isFollowing={false}
                  onToggleFollow={() => {}}
                />

                {/* 배경 편집 오버레이 */}
                <button
                  type="button"
                  disabled={cardImageUploading}
                  onClick={() => cardImageInputRef.current?.click()}
                  className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/10 hover:bg-black/25 disabled:cursor-not-allowed"
                >
                  <span className="bg-black/70 text-white text-[10px] font-bold px-2.5 py-1">
                    {cardImageUploading ? "업로드 중..." : cardImageUrl ? "배경 변경" : "+ 배경 추가"}
                  </span>
                </button>

                {/* 아바타 편집 오버레이 */}
                <button
                  type="button"
                  disabled={cardAvatarUploading}
                  onClick={(e) => { e.stopPropagation(); cardAvatarInputRef.current?.click(); }}
                  className="absolute opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 hover:bg-black/70 flex items-center justify-center disabled:cursor-not-allowed z-10"
                  style={{ top: 40, left: 20, width: 80, height: 80 }}
                >
                  <span className="text-white text-[10px] font-bold leading-tight text-center">
                    {cardAvatarUploading ? "..." : "사진\n변경"}
                  </span>
                </button>
              </div>

              <input
                ref={cardAvatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleCardAvatarUpload}
              />
            </section>

            {/* 저장 버튼 — 최하단 */}
            <div className="flex items-center justify-end gap-4 pt-2 border-t border-dashed border-gray-200">
              {cardMessage && (
                <span className={`text-[11px] font-bold ${cardMessage.startsWith("오류") ? "text-red-500" : "text-green-600"}`}>
                  {cardMessage}
                </span>
              )}
              <button
                type="button"
                onClick={handleSaveCard}
                disabled={cardSaving}
                className="border border-dashed border-gray-800 bg-gray-800 text-white px-8 py-2.5 text-xs font-bold hover:bg-gray-700 disabled:opacity-50 uppercase tracking-widest"
              >
                {cardSaving ? "SAVING..." : "[카드 저장]"}
              </button>
            </div>
          </div>
        )}

        {activeTab === "account" && !isAccountVerified && (
          <form onSubmit={handleVerifyPassword} className="space-y-6 max-w-md mx-auto py-10">
            <h2 className="text-sm font-bold border-b border-dashed border-gray-300 pb-2 uppercase tracking-widest text-gray-500 text-center">
              본인 확인
            </h2>
            <p className="text-[11px] text-gray-400 text-center">안전한 계정 설정을 위해 현재 비밀번호를 다시 한 번 입력해주세요.</p>
            <div className="flex flex-col gap-2">
              <input
                type="password"
                required
                placeholder="비밀번호 입력"
                value={verifyPassword}
                onChange={(e) => setVerifyPassword(e.target.value)}
                className="w-full border border-dashed border-gray-500 px-4 py-2 text-sm bg-gray-50 focus:bg-white outline-none text-center"
              />
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full border border-dashed border-gray-800 bg-gray-800 text-white py-2.5 text-xs font-bold hover:bg-gray-700 disabled:opacity-50 transition-colors uppercase tracking-widest"
            >
              {loading ? "VERIFYING..." : "[확인]"}
            </button>
            {message && <div className="text-center text-red-500 text-[11px] font-bold mt-2">{message}</div>}
          </form>
        )}

        {activeTab === "account" && isAccountVerified && (
          <div className="space-y-12">
            <form onSubmit={handleUpdatePassword} className="space-y-8">
              <h2 className="text-sm font-bold border-b border-dashed border-gray-300 pb-2 uppercase tracking-widest text-gray-400">
                비밀번호 변경
              </h2>
              
              <div className="flex flex-col md:flex-row gap-6 md:gap-20">
                <label className="w-40 text-sm font-bold pt-2 uppercase tracking-tight">새 비밀번호</label>
                <div className="flex-1 max-w-sm space-y-4">
                  <input
                    type="password"
                    required
                    placeholder="6자 이상 입력"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full border border-dashed border-gray-500 px-4 py-2 text-sm bg-white outline-none"
                  />
                  <input
                    type="password"
                    required
                    placeholder="새 비밀번호 다시 입력"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full border border-dashed border-gray-500 px-4 py-2 text-sm bg-white outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <div className="flex items-center gap-4">
                  {message && (
                    <span className={`text-[11px] font-bold ${message.startsWith('오류') ? 'text-red-500' : 'text-green-600'}`}>
                      {message}
                    </span>
                  )}
                  <button
                    type="submit"
                    disabled={loading}
                    className="border border-dashed border-gray-800 bg-gray-800 text-white px-10 py-2.5 text-xs font-bold hover:bg-gray-700 disabled:opacity-50 transition-colors uppercase tracking-widest"
                  >
                    {loading ? "UPDATING..." : "[비밀번호 변경 실행]"}
                  </button>
                </div>
              </div>
            </form>

            <div className="border-t border-dashed border-red-300 pt-8 space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-widest text-red-500">회원 탈퇴</h2>
              <p className="text-[11px] text-gray-500">탈퇴하시면 모든 계정 정보와 라이브러리, 사용 기록이 영구적으로 삭제되며 복구할 수 없습니다.</p>
              <button
                type="button"
                onClick={() => setShowWithdrawModal(true)}
                className="border border-dashed border-red-300 bg-red-50 text-red-600 px-6 py-2 text-xs font-bold hover:bg-red-500 hover:text-white transition-colors uppercase tracking-widest"
              >
                [회원 탈퇴 진행]
              </button>
            </div>
          </div>
        )}

        {activeTab === "library" && (
          <div className="space-y-8">
            <div className="flex justify-between items-end border-b border-dashed border-gray-300 pb-2 mb-6">
              <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500">캐릭터 라이브러리</h2>
              <span className="text-[10px] text-gray-400">TOTAL: {profiles.length}</span>
            </div>

            {/* 업로더 영역 */}
            <div className="flex items-center justify-between gap-4 border border-dashed border-gray-300 bg-gray-50/30 p-4">
              <div>
                <div className="text-xs font-bold text-gray-700">캐릭터 업로드</div>
                <p className="mt-1 text-[11px] text-gray-400">
                  ZIP 패키지를 모달에서 등록하고 Live2D 미리보기로 위치를 맞춥니다.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={() => void toggleLive2D()}
                  disabled={live2dSaving}
                  className={
                    "shrink-0 border border-dashed px-4 py-2 text-xs font-bold tracking-widest transition-colors disabled:opacity-50 " +
                    (isLive2DEnabled
                      ? "border-pink-600 bg-pink-100 text-pink-800 hover:bg-pink-200"
                      : "border-gray-500 bg-gray-200 text-gray-700 hover:bg-gray-300")
                  }
                >
                  [Live2D: {live2dSaving ? "..." : isLive2DEnabled ? "ON" : "OFF"}]
                </button>
                <button
                  type="button"
                  onClick={() => setShowCharacterUploadModal(true)}
                  className="shrink-0 border border-dashed border-gray-800 bg-white px-4 py-2 text-xs font-bold tracking-widest text-gray-800 transition-colors hover:bg-gray-800 hover:text-white"
                >
                  [캐릭터 업로드]
                </button>
              </div>
            </div>

            {profiles.length === 0 ? (
              <div className="border border-dashed border-gray-300 bg-gray-50/50 p-16 text-center italic text-gray-400 text-xs">
                라이브러리에 등록된 캐릭터가 현재 없습니다.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {profiles.map((profile) => (
                  <div key={profile.id} className={`border p-4 flex flex-col gap-3 group transition-colors ${profile.id === activeCharacterId ? 'border-gray-800 bg-gray-50' : 'border-dashed border-gray-500 bg-white hover:border-gray-800'}`}>
                    <div
                      className="mx-auto flex w-full max-w-[160px] items-center justify-center overflow-hidden border border-dashed border-gray-300 bg-gray-50 text-[10px] font-bold text-gray-300"
                      style={{ aspectRatio: "320 / 420" }}
                    >
                      {profile.thumbnailUrl ? (
                        <img
                          src={profile.thumbnailUrl}
                          alt={`${profile.name} thumbnail`}
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        "NO THUMBNAIL"
                      )}
                    </div>
                    <div className="flex justify-between items-center">
                      <h3 className="text-xs font-bold truncate pr-2 flex items-center gap-2">
                        {profile.name}
                        {profile.id === activeCharacterId && (
                           <span className="text-[9px] bg-red-100 text-red-600 px-1 font-bold border border-red-300">ACTIVE</span>
                        )}
                      </h3>
                      {profile.isBuiltIn && (
                        <span className="text-[9px] border border-dashed border-gray-400 text-gray-500 px-1 font-bold uppercase shrink-0">Basic</span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-400 line-clamp-2 h-8 italic">
                      {profile.description || "No description provided."}
                    </p>
                    <div className="mt-2 pt-3 border-t border-dashed border-gray-300 flex flex-wrap gap-2">
                      <button
                        onClick={() => handleSelectCharacter(profile.id)}
                        disabled={profile.id === activeCharacterId}
                        className="flex-1 text-center border border-dashed border-gray-800 bg-white py-1.5 text-[10px] font-bold hover:bg-gray-800 hover:text-white transition-all disabled:opacity-50 disabled:hover:bg-white disabled:hover:text-gray-800"
                      >
                        [SELECT]
                      </button>
                      <Link
                        href={`/library/${encodeURIComponent(profile.id)}`}
                        className="flex-1 text-center border border-dashed border-gray-400 bg-gray-50 py-1.5 text-[10px] font-bold hover:bg-gray-200 transition-all text-gray-600"
                      >
                        [MANAGE]
                      </Link>
                      {!profile.isBuiltIn && (
                        <button
                          onClick={() => handleDeleteCharacter(profile.id)}
                          className="flex-1 text-center border border-dashed border-red-300 bg-red-50 text-red-600 py-1.5 text-[10px] font-bold hover:bg-red-500 hover:text-white transition-all"
                        >
                          [DELETE]
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "subscription" && (
          <div className="space-y-6">
            <div className="flex justify-between items-end border-b border-dashed border-gray-300 pb-2 mb-6 text-gray-500">
              <h2 className="text-sm font-bold uppercase tracking-widest">내가 구독한 채널</h2>
              <span className="text-[10px]">TOTAL: {followedBoards.length}</span>
            </div>

            {boardsLoading ? (
              <p className="text-center py-8 text-xs text-gray-400 animate-pulse italic font-bold">INFO SYNCING...</p>
            ) : followedBoards.length === 0 ? (
              <div className="border border-dashed border-gray-300 bg-gray-50/50 p-16 text-center italic text-gray-400 text-xs">
                구독 중인 채널이 없습니다.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {followedBoards.map(board => (
                  <div key={board.id} className="flex items-center justify-between border border-dashed border-gray-400 bg-gray-50 px-4 py-3 group hover:bg-white hover:border-gray-800 transition-all">
                    <Link href={`/board/${board.slug}`} className="text-xs font-bold truncate hover:underline">
                      # {board.name}
                    </Link>
                    <button 
                      onClick={() => handleUnfollow(board.id)}
                      className="text-gray-300 hover:text-red-500 text-[11px] px-2 font-bold transition-colors"
                    >
                      [UNSUB]
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-8 flex justify-center">
        <button
          onClick={handleLogout}
          className="text-[10px] text-gray-400 hover:text-red-500 underline uppercase tracking-widest font-bold"
        >
          - Logout from this account -
        </button>
      </div>

      {showAvatarModal && (
        <div
          className="fixed inset-0 z-[58] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={cancelAvatarModal}
          role="presentation"
        >
          <div
            className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden border border-dashed border-gray-500 bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-dashed border-gray-300 px-5 py-4">
              <h3 className="text-sm font-bold uppercase tracking-widest text-gray-800">프로필 이미지</h3>
              <p className="mt-1 text-[11px] text-gray-500">
                캐릭터 썸네일을 고르거나 이미지를 업로드한 뒤 <span className="font-bold text-gray-700">확인</span>을 누르면
                아래 미리보기에 반영됩니다.
              </p>
            </div>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
              <div className="flex flex-col items-center gap-2 border border-dashed border-gray-300 bg-gray-50/60 py-4">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">모달 미리보기</span>
                <div className="h-28 w-28 overflow-hidden border border-dashed border-gray-400 bg-gray-100">
                  {modalAvatarDraft ? (
                    <img src={modalAvatarDraft} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center px-2 text-center text-[10px] text-gray-400">
                      NO IMAGE
                    </div>
                  )}
                </div>
              </div>

              <section>
                <h4 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-gray-500">
                  캐릭터 썸네일
                </h4>
                {profiles.length === 0 ? (
                  <p className="border border-dashed border-gray-300 bg-gray-50/60 py-8 text-center text-[11px] text-gray-400">
                    라이브러리에 캐릭터가 없습니다. 캐릭터 관리 탭에서 등록해 주세요.
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                    {profiles.map((p) => {
                      const hasThumb = Boolean(p.thumbnailUrl);
                      const isSelected = Boolean(
                        modalAvatarDraft && p.thumbnailUrl && modalAvatarDraft === p.thumbnailUrl
                      );
                      return (
                        <button
                          key={p.id}
                          type="button"
                          disabled={!hasThumb}
                          onClick={() => pickModalCharacterThumbnail(p.thumbnailUrl)}
                          className={`flex flex-col gap-1 text-left transition-colors ${
                            hasThumb
                              ? `border border-dashed p-1.5 hover:border-gray-800 hover:bg-gray-50 ${
                                  isSelected ? "border-gray-800 bg-gray-50 ring-1 ring-gray-800" : "border-gray-400 bg-white"
                                }`
                              : "cursor-not-allowed border border-dashed border-gray-200 bg-gray-50/80 opacity-60"
                          }`}
                        >
                          <div
                            className="relative flex w-full items-center justify-center overflow-hidden border border-dashed border-gray-300 bg-gray-100"
                            style={{ aspectRatio: "320 / 420" }}
                          >
                            {p.thumbnailUrl ? (
                              <img
                                src={p.thumbnailUrl}
                                alt=""
                                className="h-full w-full object-contain"
                              />
                            ) : (
                              <span className="px-1 text-center text-[9px] font-bold text-gray-400">
                                NO THUMB
                              </span>
                            )}
                            {p.id === activeCharacterId && (
                              <span className="absolute right-0.5 top-0.5 bg-red-100 px-1 text-[8px] font-bold text-red-600">
                                ACTIVE
                              </span>
                            )}
                          </div>
                          <span className="truncate px-0.5 text-[10px] font-bold text-gray-800">{p.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>

              <section className="border-t border-dashed border-gray-200 pt-5">
                <h4 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-gray-500">
                  이미지 업로드
                </h4>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border border-dashed border-gray-800 bg-white py-3 text-xs font-bold uppercase tracking-widest text-gray-800 transition-colors hover:bg-gray-800 hover:text-white disabled:opacity-50"
                >
                  {loading ? "업로드 중…" : "파일에서 선택"}
                </button>
                <p className="mt-2 text-[11px] text-gray-400">
                  업로드가 끝나면 모달 미리보기에만 반영됩니다. 확인 후 프로필 미리보기로 옮기고, [정보 저장]으로 계정에 저장하세요.
                </p>
              </section>
            </div>

            <div className="flex justify-end gap-2 border-t border-dashed border-gray-300 px-5 py-4">
              <button
                type="button"
                onClick={cancelAvatarModal}
                className="border border-dashed border-gray-400 bg-white px-6 py-2.5 text-xs font-bold uppercase tracking-widest text-gray-600 hover:bg-gray-100"
              >
                취소
              </button>
              <button
                type="button"
                onClick={confirmAvatarModal}
                className="border border-dashed border-gray-800 bg-gray-800 px-6 py-2.5 text-xs font-bold uppercase tracking-widest text-white hover:bg-gray-700"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {showWithdrawModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm border border-dashed border-gray-500 bg-white p-6 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-red-600 uppercase tracking-widest border-b border-dashed border-red-200 pb-2">정말 탈퇴하시겠습니까?</h3>
            <p className="text-[11px] text-gray-600 leading-relaxed">
              계정을 삭제하시려면 아래 칸에 <br/>
              <span className="font-bold text-gray-900 border border-dashed border-gray-400 px-1 mx-1 bg-gray-100 placeholder-hide">탈퇴하겠습니다</span> 
              를 정확히 입력해주세요.
            </p>
            <input
              type="text"
              value={withdrawInput}
              onChange={(e) => setWithdrawInput(e.target.value)}
              placeholder="탈퇴하겠습니다"
              className="w-full border border-dashed border-red-300 px-3 py-2 text-sm focus:outline-none focus:border-red-500 bg-red-50/50 text-center font-bold"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => { setShowWithdrawModal(false); setWithdrawInput(""); }}
                className="border border-dashed border-gray-400 px-4 py-2 text-xs font-bold text-gray-500 hover:bg-gray-100"
              >
                [취소]
              </button>
              <button
                onClick={executeWithdraw}
                disabled={withdrawInput !== "탈퇴하겠습니다" || loading}
                className="border border-dashed border-red-500 bg-red-500 text-white px-4 py-2 text-xs font-bold hover:bg-red-600 disabled:opacity-50"
              >
                {loading ? "처리중..." : "[영구 탈퇴]"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showOshiForm && (
        <div
          className="fixed inset-0 z-[58] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={() => setShowOshiForm(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-md border border-dashed border-gray-500 bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-dashed border-gray-300 px-5 py-4">
              <h3 className="text-sm font-bold uppercase tracking-widest text-gray-800">
                {editingOshi ? "최애 편집" : "최애 등록"}
              </h3>
              {!editingOshi && (
                <p className="mt-1 text-[11px] text-gray-400">
                  #{oshiList.length + 1} 슬롯에 등록됩니다.
                </p>
              )}
            </div>
            <form onSubmit={handleOshiSubmit} className="p-5 space-y-4 max-h-[85vh] overflow-y-auto">
              {officialWorks.length > 0 && (
                <div className="space-y-3 rounded border border-dashed border-blue-300 bg-blue-50/50 p-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-blue-700">
                      공식 작품/최애캐에서 선택
                    </p>
                    <p className="mt-1 text-[10px] text-blue-500">
                      선택하면 아래 입력값이 자동으로 채워집니다. 목록에 없으면 직접 입력하세요.
                    </p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold uppercase tracking-widest text-gray-500">
                      공식 작품 검색
                    </label>
                    <input
                      type="search"
                      value={oshiWorkQuery}
                      onChange={(e) => {
                        setOshiWorkQuery(e.target.value);
                        if (!e.target.value.trim()) {
                          setOshiForm((f) => ({
                            ...f,
                            official_work_id: "",
                            official_oshi_id: "",
                          }));
                        }
                      }}
                      placeholder="작품명, 원제, 슬러그로 검색"
                      className="w-full border border-dashed border-blue-300 bg-white px-3 py-2 text-sm outline-none"
                    />
                    {oshiWorkQuery.trim() && !oshiForm.official_work_id && (
                      <div className="max-h-48 overflow-y-auto border border-dashed border-blue-200 bg-white">
                        {oshiWorkSearchResults.length === 0 ? (
                          <p className="p-3 text-xs text-gray-400">검색 결과가 없습니다.</p>
                        ) : (
                          oshiWorkSearchResults.map((work) => (
                            <button
                              key={work.id}
                              type="button"
                              onClick={() => applyOfficialWork(work.id)}
                              className="flex w-full gap-2 border-b border-dashed border-blue-100 p-2 text-left last:border-b-0 hover:bg-blue-50"
                            >
                              <div className="h-10 w-7 shrink-0 overflow-hidden border border-dashed border-gray-300 bg-gray-100">
                                {work.cover_image_url ? (
                                  <img src={work.cover_image_url} alt={work.title} className="h-full w-full object-cover" />
                                ) : (
                                  <div className="flex h-full items-center justify-center text-[8px] text-gray-400">NO</div>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-bold text-gray-900">{work.title}</p>
                                {work.original_title && (
                                  <p className="truncate text-[10px] text-gray-400">{work.original_title}</p>
                                )}
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                    {oshiForm.official_work_id && (
                      <button
                        type="button"
                        onClick={() => {
                          setOshiWorkQuery("");
                          setOshiForm((f) => ({
                            ...f,
                            official_work_id: "",
                            official_oshi_id: "",
                          }));
                        }}
                        className="text-[10px] font-bold text-blue-600 hover:underline"
                      >
                        작품 선택 해제
                      </button>
                    )}
                  </div>
                  {oshiForm.official_work_id && officialOshiForSelectedWork.length > 0 && (
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold uppercase tracking-widest text-gray-500">
                        공식 최애캐
                      </label>
                      <select
                        value={oshiForm.official_oshi_id}
                        onChange={(e) => applyOfficialOshi(e.target.value)}
                        className="w-full border border-dashed border-blue-300 bg-white px-3 py-2 text-sm outline-none"
                      >
                        <option value="">작품만 등록</option>
                        {officialOshiForSelectedWork.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                            {item.role_label ? ` · ${item.role_label}` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-widest text-gray-500">타입 *</label>
                <select
                  value={oshiForm.oshi_type}
                  onChange={(e) => setOshiForm((f) => ({ ...f, oshi_type: e.target.value as OshiType }))}
                  className="w-full border border-dashed border-gray-400 px-3 py-2 text-sm outline-none bg-white"
                >
                  {(Object.keys(OSHI_TYPE_LABELS) as OshiType[]).map((t) => (
                    <option key={t} value={t}>{OSHI_TYPE_LABELS[t]}</option>
                  ))}
                </select>
              </div>

              {oshiForm.oshi_type === "pair" ? (
                <>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold uppercase tracking-widest text-gray-500">캐릭터 A *</label>
                    <input
                      type="text"
                      required
                      maxLength={50}
                      value={oshiForm.pair_char_a}
                      onChange={(e) => setOshiForm((f) => ({ ...f, pair_char_a: e.target.value }))}
                      placeholder="첫 번째 캐릭터"
                      className="w-full border border-dashed border-gray-400 px-3 py-2 text-sm outline-none focus:border-gray-700 bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold uppercase tracking-widest text-gray-500">캐릭터 B *</label>
                    <input
                      type="text"
                      required
                      maxLength={50}
                      value={oshiForm.pair_char_b}
                      onChange={(e) => setOshiForm((f) => ({ ...f, pair_char_b: e.target.value }))}
                      placeholder="두 번째 캐릭터"
                      className="w-full border border-dashed border-gray-400 px-3 py-2 text-sm outline-none focus:border-gray-700 bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold uppercase tracking-widest text-gray-500">방향성 *</label>
                    <select
                      value={oshiForm.pair_direction}
                      onChange={(e) =>
                        setOshiForm((f) => ({ ...f, pair_direction: e.target.value as OshiPairDirection }))
                      }
                      className="w-full border border-dashed border-gray-400 px-3 py-2 text-sm outline-none bg-white"
                    >
                      {(Object.keys(PAIR_DIRECTION_LABELS) as OshiPairDirection[]).map((d) => (
                        <option key={d} value={d}>{PAIR_DIRECTION_LABELS[d]}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold uppercase tracking-widest text-gray-500">작품명 (선택)</label>
                    <input
                      type="text"
                      maxLength={50}
                      value={oshiForm.pair_work_title}
                      onChange={(e) => setOshiForm((f) => ({ ...f, pair_work_title: e.target.value }))}
                      placeholder="비우면 A×B 형식으로 저장"
                      className="w-full border border-dashed border-gray-400 px-3 py-2 text-sm outline-none focus:border-gray-700 bg-white"
                    />
                  </div>
                </>
              ) : (
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-gray-500">
                    {OSHI_TITLE_FIELD_LABELS[oshiForm.oshi_type]}
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={50}
                    value={oshiForm.title}
                    onChange={(e) => setOshiForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="최대 50자"
                    className="w-full border border-dashed border-gray-400 px-3 py-2 text-sm outline-none focus:border-gray-700 bg-white"
                  />
                </div>
              )}

              {(oshiForm.oshi_type === "voice_actor" ||
                oshiForm.oshi_type === "creator" ||
                oshiForm.oshi_type === "idol_group") && (
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-gray-500">
                    {oshiForm.oshi_type === "idol_group" ? "소속사 (선택)" : "소속 (선택)"}
                  </label>
                  <input
                    type="text"
                    maxLength={80}
                    value={oshiForm.affiliation}
                    onChange={(e) => setOshiForm((f) => ({ ...f, affiliation: e.target.value }))}
                    className="w-full border border-dashed border-gray-400 px-3 py-2 text-sm outline-none focus:border-gray-700 bg-white"
                  />
                </div>
              )}

              {(oshiForm.oshi_type === "voice_actor" || oshiForm.oshi_type === "creator") && (
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-gray-500">
                    {oshiForm.oshi_type === "voice_actor" ? "대표 출연작 (선택)" : "대표 작 (선택)"}
                  </label>
                  <input
                    type="text"
                    maxLength={120}
                    value={oshiForm.reference_work}
                    onChange={(e) => setOshiForm((f) => ({ ...f, reference_work: e.target.value }))}
                    className="w-full border border-dashed border-gray-400 px-3 py-2 text-sm outline-none focus:border-gray-700 bg-white"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-widest text-gray-500">이미지</label>
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 shrink-0 border border-dashed border-gray-300 bg-gray-50 overflow-hidden">
                    {oshiForm.image_url ? (
                      <img src={oshiForm.image_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-lg">🎌</div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5 flex-1">
                    <button
                      type="button"
                      disabled={oshiImageUploading}
                      onClick={() => oshiImageInputRef.current?.click()}
                      className="border border-dashed border-gray-400 px-3 py-2 text-[11px] font-bold text-gray-600 hover:bg-gray-100 disabled:opacity-50 transition-colors"
                    >
                      {oshiImageUploading ? "업로드 중..." : "파일 선택"}
                    </button>
                    {oshiForm.image_url && (
                      <button
                        type="button"
                        onClick={() => setOshiForm((f) => ({ ...f, image_url: "" }))}
                        className="text-[10px] font-bold text-red-400 hover:text-red-600 text-left"
                      >
                        이미지 제거
                      </button>
                    )}
                  </div>
                </div>
                <input
                  ref={oshiImageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleOshiImageUpload}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-widest text-gray-500">한 줄 설명</label>
                <textarea
                  maxLength={100}
                  rows={2}
                  value={oshiForm.description}
                  onChange={(e) => setOshiForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="최대 100자"
                  className="w-full border border-dashed border-gray-400 px-3 py-2 text-sm outline-none focus:border-gray-700 bg-white resize-none"
                />
                <p className="text-[10px] text-gray-400 text-right">{oshiForm.description.length}/100</p>
              </div>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={oshiForm.is_public}
                  onChange={(e) => setOshiForm((f) => ({ ...f, is_public: e.target.checked }))}
                  className="accent-gray-800"
                />
                <span className="text-xs font-bold text-gray-600">프로필에 공개</span>
              </label>

              <div className="flex justify-end gap-2 pt-2 border-t border-dashed border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowOshiForm(false)}
                  className="border border-dashed border-gray-400 px-5 py-2 text-xs font-bold text-gray-500 hover:bg-gray-100"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="border border-dashed border-gray-800 bg-gray-800 text-white px-6 py-2 text-xs font-bold hover:bg-gray-700 disabled:opacity-50 uppercase tracking-widest"
                >
                  {loading ? "저장 중..." : "[저장]"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCharacterUploadModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-5xl flex-col border border-dashed border-gray-500 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-dashed border-gray-300 px-5 py-4">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-widest text-gray-700">
                  캐릭터 업로드
                </h3>
                <p className="mt-1 text-[11px] text-gray-400">
                  분석이 끝나면 모달 내부 오른쪽에 Live2D 미리보기가 표시됩니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowCharacterUploadModal(false);
                  setPreviewModelUrl(null);
                  thumbnailCaptureRef.current = null;
                  setPreviewView(INITIAL_UPLOAD_VIEW);
                  setSavedView(INITIAL_UPLOAD_VIEW);
                }}
                className="border border-dashed border-gray-400 px-3 py-1 text-xs font-bold text-gray-500 hover:bg-gray-100"
              >
                [닫기]
              </button>
            </div>
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto p-5 lg:grid-cols-[minmax(0,1fr)_340px]">
              <CharacterUploader
                previewMode="external"
                savedView={savedView}
                previewView={previewView}
                onPreviewModelChange={handlePreviewModelChange}
                onPreviewViewChange={setPreviewView}
                createThumbnailBlob={() => thumbnailCaptureRef.current?.() ?? Promise.resolve(null)}
                onCommitted={() => {
                  setShowCharacterUploadModal(false);
                  setPreviewModelUrl(null);
                  thumbnailCaptureRef.current = null;
                  setPreviewView(INITIAL_UPLOAD_VIEW);
                  setSavedView(INITIAL_UPLOAD_VIEW);
                }}
              />
              <aside className="border border-dashed border-blue-300 bg-blue-50/60 p-4 text-xs text-blue-900">
                <div className="mb-2 font-bold uppercase tracking-widest">[미리보기 화면]</div>
                {previewModelUrl ? (
                  <div className="space-y-2">
                    <CharacterUploadPreview
                      modelUrl={previewModelUrl}
                      view={previewView}
                      onViewChange={setPreviewView}
                      onCaptureReady={(capture) => {
                        thumbnailCaptureRef.current = capture;
                      }}
                    />
                    <div className="grid grid-cols-3 gap-2 font-mono text-[11px] text-blue-900">
                      <span>scale {previewView.scale.toFixed(2)}</span>
                      <span>x {Math.round(previewView.x)}</span>
                      <span>y {Math.round(previewView.y)}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSavedView(previewView)}
                      className="w-full border border-dashed border-blue-500 bg-white px-2 py-1 text-[11px] font-bold tracking-widest text-blue-800 transition-colors hover:bg-blue-100"
                    >
                      [현재 scale/x/y 저장]
                    </button>
                  </div>
                ) : (
                  <div className="flex h-[340px] items-center justify-center border border-dashed border-blue-300 bg-white/60 p-4 text-center text-[11px] text-blue-700">
                    ZIP 선택 후 이 영역에 Live2D 미리보기가 표시됩니다.
                  </div>
                )}
                <p className="mt-3 leading-relaxed">
                  캐릭터를 드래그하고 마우스 휠로 scale을 맞춘 뒤 오른쪽의 저장 버튼을 누르면 등록 시 기본
                  위치로 저장됩니다.
                </p>
              </aside>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<main className="w-full p-4 text-sm font-bold text-gray-500">프로필을 불러오는 중...</main>}>
      <ProfilePageContent />
    </Suspense>
  );
}
