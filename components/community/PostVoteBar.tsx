"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { PostVoteType } from "@/types/community";

type Props = {
  postId: string;
  viewerId: string | null;
  upvoteCount: number;
  downvoteCount: number;
  /** 집계 갱신 후 상위가 posts 행을 다시 읽을 때 */
  onCountsSynced?: (next: { upvote_count: number; downvote_count: number }) => void;
};

/**
 * 게시글 추천/비추천. `post_votes` + posts 집계 컬럼(트리거)과 연동.
 * DB 마이그레이션 전에는 insert 실패할 수 있음(버튼은 동작, 에러 알림).
 */
export default function PostVoteBar({
  postId,
  viewerId,
  upvoteCount,
  downvoteCount,
  onCountsSynced,
}: Props) {
  const [mine, setMine] = useState<PostVoteType | null>(null);
  const [up, setUp] = useState(upvoteCount);
  const [down, setDown] = useState(downvoteCount);
  const [busy, setBusy] = useState(false);
  const onCountsSyncedRef = useRef(onCountsSynced);
  onCountsSyncedRef.current = onCountsSynced;

  useEffect(() => {
    setUp(upvoteCount);
    setDown(downvoteCount);
  }, [upvoteCount, downvoteCount]);

  const syncFromServer = useCallback(async () => {
    const { data: row } = await supabase
      .from("posts")
      .select("upvote_count, downvote_count")
      .eq("id", postId)
      .maybeSingle();
    if (row) {
      const u = row.upvote_count ?? 0;
      const d = row.downvote_count ?? 0;
      setUp(u);
      setDown(d);
      onCountsSyncedRef.current?.({ upvote_count: u, downvote_count: d });
    }
    if (viewerId) {
      const { data: v } = await supabase
        .from("post_votes")
        .select("vote_type")
        .eq("post_id", postId)
        .eq("user_id", viewerId)
        .maybeSingle();
      setMine((v?.vote_type as PostVoteType | undefined) ?? null);
    } else {
      setMine(null);
    }
  }, [postId, viewerId]);

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
        const { error } = await supabase
          .from("post_votes")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", viewerId);
        if (error) throw error;
        setMine(null);
      } else if (mine === null) {
        const { error } = await supabase.from("post_votes").insert({
          post_id: postId,
          user_id: viewerId,
          vote_type: target,
        });
        if (error) throw error;
        setMine(target);
      } else {
        const { error } = await supabase
          .from("post_votes")
          .update({ vote_type: target })
          .eq("post_id", postId)
          .eq("user_id", viewerId);
        if (error) throw error;
        setMine(target);
      }
      await syncFromServer();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      alert(`투표 반영 실패: ${msg}\n( DB에 post_votes 마이그레이션이 적용됐는지 확인하세요. )`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 border border-dashed border-gray-300 bg-white/80 px-3 py-2 text-sm">
      <span className="text-xs font-bold uppercase tracking-widest text-gray-500">추천</span>
      <button
        type="button"
        disabled={busy}
        onClick={() => onVote("up")}
        className={`rounded border border-dashed px-2 py-1 text-xs font-bold transition-colors ${
          mine === "up" ? "border-emerald-600 bg-emerald-100 text-emerald-800" : "border-gray-400 bg-white hover:bg-gray-50"
        } disabled:opacity-50`}
      >
        ▲ {up}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => onVote("down")}
        className={`rounded border border-dashed px-2 py-1 text-xs font-bold transition-colors ${
          mine === "down" ? "border-rose-600 bg-rose-100 text-rose-800" : "border-gray-400 bg-white hover:bg-gray-50"
        } disabled:opacity-50`}
      >
        ▼ {down}
      </button>
    </div>
  );
}
