import { UserProfile } from "@/types/community";
import React from "react";
import LevelBadge from "@/components/community/LevelBadge";

interface IdentityBadgeProps {
  profile?: UserProfile | null;
  /** Fallback for when profile is not fetched yet or only metadata is available */
  fallback?: {
    nickname: string;
    avatar_url?: string | null;
    nickname_type?: "FIXED" | "TEMPORARY";
  };
  size?: "sm" | "md" | "lg";
  showAvatar?: boolean;
  showName?: boolean;
  ip?: string | null;
  isAnonymous?: boolean;
  maxNameLength?: number;
}

function truncateName(name: string, maxLength?: number) {
  if (!maxLength || name.length <= maxLength) return name;
  return name.slice(0, maxLength) + "...";
}

export default function IdentityBadge({ 
  profile, 
  fallback, 
  size = "md",
  showAvatar = true,
  showName = true,
  ip,
  isAnonymous = false,
  maxNameLength,
}: IdentityBadgeProps) {
  const displayName = profile?.display_name || profile?.nickname || fallback?.nickname || "Anonymous";
  const truncatedName = truncateName(displayName, maxNameLength);
  const avatarUrl = profile?.card_avatar_url || profile?.avatar_url || fallback?.avatar_url;
  const isFixed = (profile?.nickname_type || fallback?.nickname_type) === "FIXED";

  const sizeClasses = {
    sm: "text-[11px] gap-1.5",
    md: "text-xs gap-2",
    lg: "text-sm gap-3",
  };

  const avatarSizes = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-10 h-10",
  };

  return (
    <div className={`flex items-center ${sizeClasses[size]} font-sans`}>
      {showAvatar && (
        <div className={`${avatarSizes[size]} shrink-0 overflow-hidden border border-dashed border-gray-400 bg-gray-50`}>
          {avatarUrl ? (
            <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[8px] text-gray-300 font-bold uppercase italic">
              User
            </div>
          )}
        </div>
      )}
      {showName && (
        <div className="flex items-center gap-1.5">
          <span
            className={`font-bold tracking-tight ${isFixed ? "text-gray-900" : "text-gray-500 italic"}`}
            title={displayName !== truncatedName ? displayName : undefined}
          >
            {truncatedName}
            {isAnonymous && ip && (
              <span className="ml-1 text-[10px] font-normal text-gray-400 not-italic">
                ({ip})
              </span>
            )}
          </span>
          {isFixed ? (
            <span className="bg-gray-800 text-white px-1 text-[8px] font-black border border-gray-800 uppercase tracking-tighter leading-tight">
              FIXED
            </span>
          ) : (
            <span className="text-gray-400 text-[8px] font-bold border border-dashed border-gray-300 px-1 uppercase tracking-tighter leading-tight">
              TEMP
            </span>
          )}
          {!isAnonymous && profile?.level != null && profile.level >= 1 && (
            <LevelBadge level={profile.level} size="xs" />
          )}
        </div>
      )}
    </div>
  );
}
