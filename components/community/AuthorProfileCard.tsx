"use client";

import { useEffect, useState } from "react";
import { UserProfile, OshiRegistration, UserBadge, Badge } from "@/types/community";
import { supabase } from "@/lib/supabase/client";
import { formatOshiPrimaryTitle, formatOshiSubtitle } from "@/lib/supabase/oshi";
import { CARD_THEMES } from "@/lib/cardThemes";
import LevelBadge from "@/components/community/LevelBadge";

interface AuthorProfileCardProps {
  profile: UserProfile | null | undefined;
  authorId: string | null;
  viewerId: string | null;
  isFollowing: boolean;
  onToggleFollow: () => void;
}

const RARITY_GLOW: Record<string, string> = {
  common:    "",
  rare:      "shadow-[0_0_6px_rgba(59,130,246,0.4)]",
  epic:      "shadow-[0_0_6px_rgba(168,85,247,0.5)]",
  legendary: "shadow-[0_0_8px_rgba(234,179,8,0.6)]",
  season:    "shadow-[0_0_6px_rgba(34,197,94,0.5)]",
};

export default function AuthorProfileCard({
  profile,
  authorId,
  viewerId,
  isFollowing,
  onToggleFollow,
}: AuthorProfileCardProps) {
  const [mainOshi, setMainOshi] = useState<OshiRegistration | null>(null);
  const [earnedBadges, setEarnedBadges] = useState<(UserBadge & { badge: Badge })[]>([]);
  const [loaded, setLoaded] = useState(false);

  const theme = CARD_THEMES[profile?.card_theme ?? "default"] ?? CARD_THEMES.default;

  const displayBadges = (() => {
    const pinnedIds = profile?.card_badge_ids;
    if (!pinnedIds || pinnedIds.includes("__none__") || pinnedIds.length === 0) return [];
    return pinnedIds
      .map((id) => earnedBadges.find((ub) => ub.badge_id === id))
      .filter((x): x is UserBadge & { badge: Badge } => !!x)
      .slice(0, 4);
  })();

  useEffect(() => {
    if (!authorId) return;
    const fetchAuthorData = async () => {
      const showOshi = profile?.card_show_oshi !== false;
      const [oshiRes, badgeRes] = await Promise.all([
        showOshi
          ? supabase
              .from("oshi_registrations")
              .select("*, oshi_pair_members(*)")
              .eq("user_id", authorId)
              .eq("rank", 1)
              .eq("is_public", true)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        supabase
          .from("user_badges")
          .select("*, badge:badges(*)")
          .eq("user_id", authorId)
          .order("earned_at", { ascending: false })
          .limit(8),
      ]);
      if (oshiRes.data) {
        const row = oshiRes.data as OshiRegistration & {
          oshi_pair_members?: OshiRegistration["pair_members"];
        };
        const { oshi_pair_members, ...rest } = row;
        const pair_members =
          Array.isArray(oshi_pair_members) && oshi_pair_members.length > 0
            ? [...oshi_pair_members].sort((a, b) => a.member_index - b.member_index)
            : undefined;
        setMainOshi({ ...rest, pair_members } as OshiRegistration);
      }
      if (badgeRes.data) setEarnedBadges(badgeRes.data as (UserBadge & { badge: Badge })[]);
      setLoaded(true);
    };
    fetchAuthorData();
  }, [authorId, profile?.card_show_oshi]);

  if (!authorId || !profile) return null;

  const displayName = profile.display_name || profile.nickname || "알 수 없음";
  const isSelf = viewerId === authorId;
  const hasCardImage = Boolean(profile.card_image_url);
  const avatarSrc = (profile as any).card_avatar_url || profile.avatar_url;

  return (
    <div className={`relative overflow-hidden ${theme.card}`}>
      {/* 배경 이미지 레이어 */}
      {hasCardImage && (
        <>
          <img
            src={profile.card_image_url!}
            alt=""
            className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
          />
          {/* 콘텐츠 가독성을 위한 좌→우 그라디언트 */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/60 to-black/20 pointer-events-none" />
        </>
      )}

      {/* 카드 콘텐츠 */}
      <div className="relative flex items-center gap-4 px-5 py-5 min-h-[160px]">

        {/* 아바타 */}
        <div className={`shrink-0 w-20 h-20 overflow-hidden border-2 ${theme.border} bg-gray-100`}>
          {avatarSrc ? (
            <img src={avatarSrc} alt={displayName} className="w-full h-full object-cover" />
          ) : (
            <div className={`flex h-full items-center justify-center text-[10px] font-bold uppercase italic ${theme.subtext}`}>
              No Img
            </div>
          )}
        </div>

        {/* 중앙 정보 */}
        <div className="flex-1 min-w-0 space-y-1.5">
          {/* 닉네임 + 고정 뱃지 */}
          <div className="flex items-center gap-2 flex-wrap">
            {profile.nickname_type === "FIXED" ? (
              <span className={`text-[8px] font-black px-1 border uppercase ${theme.badge}`}>FIXED</span>
            ) : (
              <span className={`text-[8px] font-bold border border-dashed px-1 uppercase ${theme.subtext} ${theme.border}`}>TEMP</span>
            )}
            {profile.level != null && profile.level >= 1 && (
              <LevelBadge level={profile.level} size="sm" />
            )}
            <span
              className={`font-bold text-sm leading-tight ${
                profile.card_nickname_font === "serif" ? "font-serif" :
                profile.card_nickname_font === "mono"  ? "font-mono"  : "font-sans"
              } ${!profile.card_nickname_color ? (hasCardImage ? "text-white" : theme.text) : ""}`}
              style={profile.card_nickname_color ? { color: profile.card_nickname_color } : undefined}
            >
              {displayName}
            </span>
          </div>

          {/* 한줄소개 */}
          {profile.bio && (
            <p
              className={`text-xs line-clamp-1 ${
                profile.card_nickname_color ? "" : (hasCardImage ? "text-white/70" : theme.subtext)
              }`}
              style={profile.card_nickname_color ? { color: profile.card_nickname_color, opacity: 0.8 } : undefined}
            >
              {profile.bio}
            </p>
          )}

          {/* 배지 */}
          {loaded && displayBadges.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap pt-0.5">
              {displayBadges.map((ub) => (
                <div
                  key={ub.badge_id}
                  title={`${ub.badge.name} — ${ub.badge.description}`}
                  className={`flex items-center gap-1 border px-1.5 py-0.5 ${hasCardImage ? "bg-black/40 border-white/20" : theme.badge} ${RARITY_GLOW[ub.badge.rarity]}`}
                >
                  <span className="text-sm leading-none">{ub.badge.icon}</span>
                  <span className={`text-[9px] font-bold whitespace-nowrap ${hasCardImage ? "text-white" : theme.badge.split(" ").find(c => c.startsWith("text-")) ?? "text-gray-700"}`}>
                    {ub.badge.name}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 우측: 오시 + 팔로우 */}
        <div className="shrink-0 flex flex-col items-end justify-between self-stretch py-1 gap-3">
          {/* 메인 오시 */}
          {loaded && mainOshi && profile.card_show_oshi !== false && (
            <div className={`flex items-center gap-2 border px-2 py-1.5 ${hasCardImage ? "bg-black/40 border-white/20" : theme.oshi}`}>
              {mainOshi.image_url && (
                <div className={`w-7 h-7 border overflow-hidden shrink-0 ${hasCardImage ? "border-white/20" : theme.border}`}>
                  <img src={mainOshi.image_url} alt={formatOshiPrimaryTitle(mainOshi)} className="w-full h-full object-cover" />
                </div>
              )}
              <div className="min-w-0">
                <div className={`text-[8px] font-bold uppercase ${hasCardImage ? "text-white/60" : theme.subtext}`}>최애</div>
                <p className={`text-[10px] font-bold truncate max-w-[100px] ${hasCardImage ? "text-white" : theme.text}`}>
                  {formatOshiPrimaryTitle(mainOshi)}
                </p>
                {formatOshiSubtitle(mainOshi) && (
                  <p className={`text-[8px] truncate max-w-[100px] ${hasCardImage ? "text-white/70" : theme.subtext}`}>
                    {formatOshiSubtitle(mainOshi)}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* 팔로우 버튼 */}
          {!isSelf && viewerId && (
            <button
              type="button"
              onClick={onToggleFollow}
              className={`border px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest transition-colors ${
                isFollowing
                  ? `${theme.border} ${theme.badge} hover:border-red-400 hover:text-red-500`
                  : theme.followBtn
              }`}
            >
              {isFollowing ? "팔로잉" : "팔로우"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
