"use client";

import { useCallback, useEffect, useState } from "react";
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
 * 게시글 한 개의 리액션 6종 + 누른 사람들의 캐릭터 스티커 썸네일을 노출하는 바.
 *
 * - 비로그인 사용자도 카운트는 볼 수 있고, 클릭 시 안내 alert.
 * - 클릭 한 번에 토글 (켜져 있으면 취소, 꺼져 있으면 추가).
 * - "응답한 캐릭터" 영역에 최근 반응자 캐릭터 썸네일을 최대 6장까지 가로 스택으로 노출.
 *
 * 텍스트 없이 누를 수 있는 "스티커 답글" 1차 버전 = 이 바 자체.
 * 한 클릭에 본인의 활성 캐릭터 + 감정 종류가 모두 기록된다.
 */
interface Props {
  postId: string;
  viewerId: string | null;
}

export default function ReactionBar({ postId, viewerId }: Props) {
  const [summary, setSummary] = useState<PostReactionSummary | null>(null);
  const [busy, setBusy] = useState<ReactionType | null>(null);

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
      recentThumbnails: summary.recentThumbnails,
    });

    const result = await setReaction({
      postId,
      userId: viewerId,
      reactionType,
      currentMineType,
      characterId: activeProfile?.id ?? null,
      characterThumbnailUrl: activeProfile?.thumbnailUrl ?? null,
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
  const thumbs = summary?.recentThumbnails ?? [];

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

      {thumbs.length > 0 ? (
        <div className="flex items-center gap-2 border-t border-dashed border-gray-300 pt-2">
          <span className="text-[11px] uppercase tracking-widest text-gray-500">반응한 캐릭터</span>
          <div className="flex -space-x-1">
            {thumbs.map((t) => (
              <span
                key={`${t.userId}-${t.url}`}
                className="inline-block h-7 w-7 overflow-hidden rounded-full border border-dashed border-gray-400 bg-white"
                title={t.characterId ?? ""}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={t.url}
                  alt="반응자 캐릭터"
                  className="h-full w-full object-cover"
                  draggable={false}
                />
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
