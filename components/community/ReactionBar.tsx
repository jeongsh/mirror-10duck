"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuthUser } from "@/lib/supabase/useAuthUser";
import { useCharacterLibraryStore } from "@/store/useCharacterLibraryStore";
import {
  ALL_REACTION_TYPES,
  type PostReactionSummary,
  type ReactionType,
} from "@/types/community";
import {
  REACTION_META,
  fetchReactionsByPost,
  setReaction,
  summarizeReactions,
} from "@/lib/community/reactions";

/**
 * 게시글 한 개의 리액션 6종 + 최근 반응자의 유저 프로필(닉네임·아바타)을 노출하는 바.
 *
 * - 비로그인 사용자도 카운트는 볼 수 있고, 클릭 시 안내 alert.
 * - 클릭 한 번에 토글 (켜져 있으면 취소, 꺼져 있으면 추가).
 * - "반응한 사람" 영역: 프로필 사진(없으면 캐릭터 썸네일, 둘 다 없으면 이니셜) + 닉네임.
 *
 * 한 클릭에 본인의 유저 메타(닉·아바타) + 활성 캐릭터 스냅샷 + 감정 종류가 기록된다.
 */
interface Props {
  postId: string;
  viewerId: string | null;
}

export default function ReactionBar({ postId, viewerId }: Props) {
  const [summary, setSummary] = useState<PostReactionSummary | null>(null);
  const [busy, setBusy] = useState<ReactionType | null>(null);

  const authUser = useAuthUser();
  const profileDisplayName = useMemo(() => {
    if (!authUser) return null;
    const n = authUser.user_metadata?.nickname;
    return typeof n === "string" && n.trim() ? n.trim() : null;
  }, [authUser]);
  const profileAvatarUrl = useMemo(() => {
    if (!authUser) return null;
    const u = authUser.user_metadata?.avatar_url;
    return typeof u === "string" && u ? u : null;
  }, [authUser]);

  const activeId = useCharacterLibraryStore((s) => s.activeId);
  const profiles = useCharacterLibraryStore((s) => s.profiles);
  const activeProfile = activeId ? profiles.find((p) => p.id === activeId) ?? null : null;

  const refresh = useCallback(async () => {
    const rows = await fetchReactionsByPost(postId);
    setSummary(summarizeReactions(rows, viewerId));
  }, [postId, viewerId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleClick = async (reactionType: ReactionType) => {
    if (!viewerId) {
      alert("리액션은 로그인 후 가능합니다.");
      return;
    }
    if (!summary) return;

    setBusy(reactionType);

    // 한 글당 한 사용자 1리액션 정책: mine 은 0개 또는 1개.
    const currentMineType: ReactionType | null = summary.mine.values().next().value ?? null;
    const isSameType = currentMineType === reactionType;

    // 낙관적 업데이트 (실패 시 refresh 로 정정)
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
      displayName: profileDisplayName,
      avatarUrl: profileAvatarUrl,
    });

    setBusy(null);

    if (!result.ok) {
      alert(`리액션 처리 실패: ${result.error ?? "알 수 없는 오류"}`);
    }
    // DB 와 강제 동기화 (썸네일/타 사용자 반응 포함 최신화)
    refresh();
  };

  const counts = summary?.counts;
  const mine = summary?.mine;
  const reactors = summary?.recentReactors ?? [];

  return (
    <div className="flex flex-col gap-2 border border-dashed border-gray-400 bg-white/80 p-3">
      <div className="flex flex-wrap gap-2">
        {ALL_REACTION_TYPES.map((type) => {
          const meta = REACTION_META[type];
          const count = counts?.[type] ?? 0;
          const isMine = mine?.has(type) ?? false;
          return (
            <button
              key={type}
              type="button"
              onClick={() => handleClick(type)}
              disabled={busy === type}
              className={`flex items-center gap-1 border border-dashed px-3 py-1.5 text-xs transition-colors disabled:opacity-50 ${
                isMine
                  ? "border-gray-800 bg-gray-900 text-white"
                  : "border-gray-400 bg-white text-gray-700 hover:bg-gray-100"
              }`}
              aria-pressed={isMine}
              title={meta.label}
            >
              <span className="text-base leading-none">{meta.emoji}</span>
              <span className="font-bold">{meta.label}</span>
              <span className={`tabular-nums ${isMine ? "text-white" : meta.color}`}>{count}</span>
            </button>
          );
        })}
      </div>

      {reactors.length > 0 ? (
        <div className="border-t border-dashed border-gray-300 pt-2">
          <div className="mb-1.5 text-[11px] font-medium uppercase tracking-widest text-gray-500">
            반응한 사람
          </div>
          <div className="flex flex-wrap items-end gap-3">
            {reactors.map((r) => {
              const src = r.avatarUrl || r.characterThumbnailUrl;
              const name = r.displayName?.trim() || "사용자";
              const initial = name.length > 0 ? name[0] : "?";
              return (
                <div
                  key={r.userId}
                  className="flex max-w-[5rem] flex-col items-center gap-0.5"
                  title={name}
                >
                  {src ? (
                    <span className="inline-block h-9 w-9 overflow-hidden rounded-full border border-dashed border-gray-400 bg-white">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={src}
                        alt=""
                        className="h-full w-full object-cover"
                        draggable={false}
                      />
                    </span>
                  ) : (
                    <span className="flex h-9 w-9 items-center justify-center rounded-full border border-dashed border-gray-400 bg-gray-100 text-xs font-semibold text-gray-600">
                      {initial}
                    </span>
                  )}
                  <span className="w-full truncate text-center text-[10px] leading-tight text-gray-600">
                    {name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
