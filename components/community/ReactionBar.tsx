"use client";

import { SmilePlus, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { createNotification } from "@/lib/community/notifications";
import { bumpMissionProgress } from "@/lib/community/missions";
import { grantExperience, XP_AMOUNTS } from "@/lib/supabase/experience";
import {
  REACTION_META,
  fetchReactionsByPost,
  setReaction,
  summarizeReactions,
} from "@/lib/community/reactions";
import { getProfile } from "@/lib/supabase/profiles";
import { useCharacterLibraryStore } from "@/store/useCharacterLibraryStore";
import {
  ALL_REACTION_TYPES,
  type PostReactionSummary,
  type ReactionType,
  type UserProfile,
} from "@/types/community";

interface Props {
  postId: string;
  viewerId: string | null;
  authorId?: string;
}

export default function ReactionBar({ postId, viewerId, authorId }: Props) {
  const [summary, setSummary] = useState<PostReactionSummary | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [busy, setBusy] = useState<ReactionType | null>(null);
  const [open, setOpen] = useState(false);

  const activeId = useCharacterLibraryStore((s) => s.activeId);
  const profiles = useCharacterLibraryStore((s) => s.profiles);
  const activeProfile = activeId ? profiles.find((p) => p.id === activeId) ?? null : null;

  const refresh = useCallback(async () => {
    const rows = await fetchReactionsByPost(postId);
    setSummary(summarizeReactions(rows, viewerId));
  }, [postId, viewerId]);

  useEffect(() => {
    void refresh();
    if (viewerId) void getProfile(viewerId).then(setUserProfile);
  }, [refresh, viewerId]);

  const totalCount = summary
    ? ALL_REACTION_TYPES.reduce((sum, type) => sum + (summary.counts[type] ?? 0), 0)
    : 0;
  const mineType = summary?.mine.values().next().value ?? null;

  const handleClick = async (reactionType: ReactionType) => {
    if (!viewerId) {
      alert("리액션은 로그인 후 사용할 수 있습니다.");
      return;
    }
    if (!summary) return;

    setBusy(reactionType);

    const currentMineType: ReactionType | null = summary.mine.values().next().value ?? null;
    const isSameType = currentMineType === reactionType;
    const nextCounts = { ...summary.counts };
    const nextMine = new Set<ReactionType>();

    if (currentMineType) {
      nextCounts[currentMineType] = Math.max(0, (nextCounts[currentMineType] ?? 0) - 1);
    }
    if (!isSameType) {
      nextCounts[reactionType] = (nextCounts[reactionType] ?? 0) + 1;
      nextMine.add(reactionType);
    }

    setSummary({
      counts: nextCounts,
      mine: nextMine,
      recentReactors: summary.recentReactors,
    });

    const result = await setReaction({
      postId,
      userId: viewerId,
      reactionType,
      currentMineType,
      characterId: activeProfile?.id ?? null,
      characterThumbnailUrl: activeProfile?.thumbnailUrl ?? null,
      displayName: userProfile?.nickname ?? null,
      avatarUrl: userProfile?.avatar_url ?? null,
    });

    if (result.ok && !isSameType && viewerId) {
      void bumpMissionProgress(viewerId, "reaction", 1);
    }

    if (result.ok && !isSameType && authorId && authorId !== viewerId) {
      const meta = REACTION_META[reactionType];
      await createNotification({
        receiverId: authorId,
        senderId: viewerId,
        type: "REACTION",
        title: "새 리액션",
        content: `${userProfile?.nickname || "누군가"}님이 글에 ${meta.emoji} 반응을 남겼습니다.`,
        linkUrl: window.location.pathname,
      });
      void grantExperience(authorId, XP_AMOUNTS.REACTION_RECEIVED);
    }

    setBusy(null);

    if (!result.ok) {
      alert(`리액션 처리 실패: ${result.error ?? "알 수 없는 오류"}`);
    }

    void refresh();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 hover:text-gray-900"
        title="리액션"
      >
        <SmilePlus size={17} />
        <span className="tabular-nums">{totalCount}</span>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm border border-dashed border-gray-500 bg-white p-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold">리액션</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center border border-dashed border-gray-400 bg-white hover:bg-gray-100"
                title="닫기"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {ALL_REACTION_TYPES.map((type) => {
                const meta = REACTION_META[type];
                const count = summary?.counts[type] ?? 0;
                const isMine = mineType === type;

                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleClick(type)}
                    disabled={busy === type}
                    className={`flex items-center justify-between border border-dashed px-3 py-2 text-xs disabled:opacity-50 ${
                      isMine
                        ? "border-gray-800 bg-gray-900 text-white"
                        : "border-gray-400 bg-white text-gray-700 hover:bg-gray-100"
                    }`}
                    aria-pressed={isMine}
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="text-base leading-none">{meta.emoji}</span>
                      <span className="font-bold">{meta.label}</span>
                    </span>
                    <span className="tabular-nums">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
