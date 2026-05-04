"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useAuthUser } from "@/lib/supabase/useAuthUser";
import { useCharacterLibraryStore } from "@/store/useCharacterLibraryStore";
import { useCharacterStore } from "@/store/useCharacterStore";
import CharacterUploader, {
  CharacterUploadPreview,
  INITIAL_UPLOAD_VIEW,
} from "@/components/character/CharacterUploader";
import { Board } from "@/types/community";
import { listCharacterProfiles } from "@/lib/supabase/characters";
import { BASE_PROFILES, mergeProfiles } from "@/lib/live2d/profileSync";

type TabId = "profile" | "library" | "subscription" | "account";

const TABS: { id: TabId; label: string }[] = [
  { id: "profile", label: "프로필" },
  { id: "library", label: "캐릭터 관리" },
  { id: "subscription", label: "구독 채널" },
  { id: "account", label: "계정 설정" },
];

export default function ProfilePage() {
  const router = useRouter();
  const user = useAuthUser();
  const profiles = useCharacterLibraryStore((s) => s.profiles);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const thumbnailCaptureRef = useRef<(() => Promise<Blob | null>) | null>(null);
  
  const [activeTab, setActiveTab] = useState<TabId>("profile");
  
  // 프로필 상태
  const [nickname, setNickname] = useState("");
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

  // 캐릭터 라이브러리 동기화 및 관리
  const setProfiles = useCharacterLibraryStore((s) => s.setProfiles);
  const activeCharacterId = useCharacterLibraryStore((s) => s.activeId);
  const setActiveCharacterId = useCharacterLibraryStore((s) => s.setActive);
  const unregister = useCharacterLibraryStore((s) => s.unregister);
  const setProfile = useCharacterStore((s) => s.setProfile);

  const handlePreviewModelChange = useCallback((modelUrl: string | null) => {
    setPreviewModelUrl(modelUrl);
    if (modelUrl) {
      setPreviewView(INITIAL_UPLOAD_VIEW);
      setSavedView(INITIAL_UPLOAD_VIEW);
    }
  }, []);

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

      const savedProfiles = await listCharacterProfiles();
      const allProfiles = mergeProfiles(BASE_PROFILES, savedProfiles);
      setProfiles(allProfiles);
    };

    void syncData();
  }, [user, setProfiles]);

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

    const { error } = await supabase.auth.updateUser({
      data: { nickname, avatar_url: tempAvatarUrl },
    });

    if (error) {
      setMessage(`오류: ${error.message}`);
    } else {
      setMessage("성공적으로 저장되었습니다.");
      setAvatarUrl(tempAvatarUrl);
    }
    setLoading(false);
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

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/avatars/avatar-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('character-assets')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('character-assets')
        .getPublicUrl(filePath);

      setModalAvatarDraft(publicUrl);
    } catch (err: any) {
      alert(`업로드 오류: ${err.message}`);
    } finally {
      setLoading(false);
      e.target.value = "";
    }
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

  const handleSelectCharacter = async (profileId: string) => {
    const selected = profiles.find((p) => p.id === profileId);
    if (selected) {
      setActiveCharacterId(profileId);
      setProfile(selected);
      // user metadata에 상태 저장
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
                  <p>• 닉네임 변경 후 5일간 변경이 불가능합니다.</p>
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
              <button
                type="button"
                onClick={() => setShowCharacterUploadModal(true)}
                className="shrink-0 border border-dashed border-gray-800 bg-white px-4 py-2 text-xs font-bold tracking-widest text-gray-800 transition-colors hover:bg-gray-800 hover:text-white"
              >
                [캐릭터 업로드]
              </button>
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
