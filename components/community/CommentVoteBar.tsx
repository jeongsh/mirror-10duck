"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { PostVoteType } from "@/types/community";

type Props = {
  commentId: string;
  viewerId: string | null;
  upvoteCount: number;
  downvoteCount: number;
  isNews?: boolean;
  /** 집계 갱신 후 상위가 comments 행을 다시 읽을 때 */
  onCountsSynced?: (next: { upvote_count: number; downvote_count: number }) => void;
};

/**
 * 댓글 추천/비추천. `comment_votes` + comments 집계 컬럼(트리거)과 연동.
 * DB 마이그레이션 전에는 insert 실패할 수 있음(버튼은 동작, 에러 알림).
 */
export default function CommentVoteBar({
  commentId,
  viewerId,
  upvoteCount,
  downvoteCount,
  isNews = false,
  onCountsSynced,
}: Props) {
  const [mine, setMine] = useState<PostVoteType | null>(null);
  const [up, setUp] = useState(upvoteCount);
  const [down, setDown] = useState(downvoteCount);
  const [busy, setBusy] = useState(false);
  const onCountsSyncedRef = useRef(onCountsSynced);
  onCountsSyncedRef.current = onCountsSynced;
  const commentTable = isNews ? "news_comments" : "comments";

  useEffect(() => {
    setUp(upvoteCount);
    setDown(downvoteCount);
  }, [upvoteCount, downvoteCount]);

  const syncFromServer = useCallback(async () => {
    const queryVotes = async () => {
      const { data, error } = await supabase
        .from("comment_votes")
        .select("vote_type")
        .eq("comment_id", commentId);
      if (error) {
        console.warn("Comment vote counts fallback failed:", error.message);
        return null;
      }
      const upCount = data?.filter((row) => row.vote_type === "up").length ?? 0;
      const downCount = data?.filter((row) => row.vote_type === "down").length ?? 0;
      return { upCount, downCount };
    };

    const voteCounts = await queryVotes();
    if (voteCounts) {
      setUp(voteCounts.upCount);
      setDown(voteCounts.downCount);
      onCountsSyncedRef.current?.({ upvote_count: voteCounts.upCount, downvote_count: voteCounts.downCount });
    }

    if (viewerId) {
      const { data: v } = await supabase
        .from("comment_votes")
        .select("vote_type")
        .eq("comment_id", commentId)
        .eq("user_id", viewerId)
        .maybeSingle();
      setMine((v?.vote_type as PostVoteType | undefined) ?? null);
    } else {
      setMine(null);
    }
  }, [commentId, viewerId]);

  useEffect(() => {
    syncFromServer();
  }, [syncFromServer]);

  const onVote = async (target: PostVoteType) => {
    if (!viewerId) {
      alert("추천/비추천은 로그인 후 가능합니다.");
      return;
    }
    setBusy(true);
    try {
      if (mine === target) {
        // 같은 투표를 다시 누르면 제거
        const { error } = await supabase
          .from("comment_votes")
          .delete()
          .eq("comment_id", commentId)
          .eq("user_id", viewerId);
        if (error) throw error;
        setMine(null);
        // 로컬 상태 즉시 갱신 (트리거가 작동하지 않아도 UI 반응)
        setUp((prev) => Math.max(0, prev - (mine === "up" ? 1 : 0)));
        setDown((prev) => Math.max(0, prev - (mine === "down" ? 1 : 0)));
      } else if (mine === null) {
        // 새로운 투표
        const { error } = await supabase.from("comment_votes").insert({
          comment_id: commentId,
          user_id: viewerId,
          vote_type: target,
        });
        if (error) throw error;
        setMine(target);
        // 로컬 상태 즉시 갱신
        if (target === "up") setUp((prev) => prev + 1);
        else setDown((prev) => prev + 1);
      } else {
        // 투표 변경
        const { error } = await supabase
          .from("comment_votes")
          .update({ vote_type: target })
          .eq("comment_id", commentId)
          .eq("user_id", viewerId);
        if (error) throw error;
        setMine(target);
        // 로컬 상태 즉시 갱신
        if (mine === "up") setUp((prev) => Math.max(0, prev - 1));
        else setDown((prev) => Math.max(0, prev - 1));
        if (target === "up") setUp((prev) => prev + 1);
        else setDown((prev) => prev + 1);
      }
      // 서버에서 갱신된 값을 읽음 (트리거가 작동하면 이 값으로 덮어씌워짐)
      await syncFromServer();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`투표 반영 실패: ${msg}\n( DB에 comment_votes 마이그레이션이 적용됐는지 확인하세요. )`);
    } finally {
      setBusy(false);
    }
  };

  if (up === 0 && down === 0 && mine === null) {
    // 투표가 하나도 없으면 최소한의 UI만 표시
    return (
      <div className="flex items-center gap-1 text-xs text-gray-400">
        <button
          type="button"
          disabled={busy}
          className="hover:text-gray-600"
          onClick={() => onVote("up")}
          title="추천"
        >
          👍 0
        </button>
        <button
          type="button"
          disabled={busy}
          className="hover:text-gray-600"
          onClick={() => onVote("down")}
          title="비추천"
        >
          👎 0
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs">
      <button
        type="button"
        disabled={busy}
        onClick={() => onVote("up")}
        title="추천"
        className={
          "flex items-center gap-1 px-2 py-1 border border-dashed rounded transition-colors " +
          (mine === "up"
            ? "border-green-600 bg-green-50 text-green-700"
            : "border-gray-300 bg-white/50 text-gray-600 hover:border-green-500 hover:bg-green-50")
        }
      >
        <span>👍</span>
        <span className="font-semibold">{up}</span>
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => onVote("down")}
        title="비추천"
        className={
          "flex items-center gap-1 px-2 py-1 border border-dashed rounded transition-colors " +
          (mine === "down"
            ? "border-red-600 bg-red-50 text-red-700"
            : "border-gray-300 bg-white/50 text-gray-600 hover:border-red-500 hover:bg-red-50")
        }
      >
        <span>👎</span>
        <span className="font-semibold">{down}</span>
      </button>
    </div>
  );
}
