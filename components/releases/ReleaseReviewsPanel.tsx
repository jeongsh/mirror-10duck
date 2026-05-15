"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { getCurrentUserId } from "@/lib/supabase/releaseFollows";
import { StarBar } from "@/components/ui/StarBar";
import IdentityBadge from "@/components/community/IdentityBadge";
import type { UserProfile } from "@/types/community";
import {
  isReleaseAiredForReview,
  normalizeReleaseReviewBody,
  RELEASE_REVIEW_BODY_MAX,
} from "@/lib/otaku/releaseReview";

export type ReleaseReviewRow = {
  id: string;
  user_id: string;
  stars: number;
  body: string;
  created_at: string;
  updated_at: string;
};

export function ReleaseReviewsPanel({
  releaseItemId,
  releaseDate,
}: {
  releaseItemId: string;
  releaseDate: string | null;
}) {
  const canInteract = useMemo(() => isReleaseAiredForReview(releaseDate), [releaseDate]);

  const [userId, setUserId] = useState<string | null>(null);
  const [rows, setRows] = useState<ReleaseReviewRow[]>([]);
  const [profileByUserId, setProfileByUserId] = useState<Record<string, UserProfile>>({});
  const [loading, setLoading] = useState(true);
  const [savingStars, setSavingStars] = useState(false);
  const [savingReview, setSavingReview] = useState(false);

  const [starsDraft, setStarsDraft] = useState(0);
  const [bodyDraft, setBodyDraft] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const uid = await getCurrentUserId();
    setUserId(uid);

    const { data, error } = await supabase
      .from("release_item_reviews")
      .select("id, user_id, stars, body, created_at, updated_at")
      .eq("release_item_id", releaseItemId)
      .order("created_at", { ascending: false });

    if (error) {
      if (error.code === "42P01" || error.message?.includes("does not exist")) {
        setRows([]);
        setProfileByUserId({});
        setLoading(false);
        return;
      }
      console.error("release_item_reviews load:", error);
      setRows([]);
      setProfileByUserId({});
      setLoading(false);
      return;
    }

    const list = (data ?? []) as ReleaseReviewRow[];
    setRows(list);

    const ids = Array.from(new Set(list.map((r) => r.user_id)));
    if (ids.length > 0) {
      const { data: profs, error: pErr } = await supabase.from("profiles").select("*").in("user_id", ids);
      if (pErr) {
        console.error("profiles load (reviews):", pErr);
        setProfileByUserId({});
      } else {
        const map: Record<string, UserProfile> = {};
        for (const p of (profs ?? []) as UserProfile[]) {
          map[p.user_id] = p;
        }
        setProfileByUserId(map);
      }
    } else {
      setProfileByUserId({});
    }

    const mine = uid ? list.find((r) => r.user_id === uid) : undefined;
    if (mine) {
      setStarsDraft(mine.stars);
      setBodyDraft(mine.body ?? "");
    } else {
      setStarsDraft(0);
      setBodyDraft("");
    }

    setLoading(false);
  }, [releaseItemId]);

  useEffect(() => {
    void load();
  }, [load]);

  const mine = useMemo(
    () => (userId ? rows.find((r) => r.user_id === userId) : undefined),
    [rows, userId],
  );

  const starAggregate = useMemo(() => {
    if (rows.length === 0) return null;
    const sum = rows.reduce((acc, r) => acc + r.stars, 0);
    return { avg: sum / rows.length, count: rows.length };
  }, [rows]);

  const textReviews = useMemo(
    () => rows.filter((r) => normalizeReleaseReviewBody(r.body ?? "").length > 0),
    [rows],
  );

  const saveStars = async () => {
    if (!canInteract) {
      alert("방영이 시작된 작품에만 별점을 남길 수 있습니다.");
      return;
    }
    if (!userId) {
      alert("로그인 후 별점을 남길 수 있습니다.");
      return;
    }
    if (starsDraft < 1 || starsDraft > 5) {
      alert("별점을 1~5점으로 선택해 주세요.");
      return;
    }

    const bodyKeep = normalizeReleaseReviewBody(bodyDraft);

    setSavingStars(true);
    try {
      const { error } = await supabase.from("release_item_reviews").upsert(
        {
          user_id: userId,
          release_item_id: releaseItemId,
          stars: starsDraft,
          body: bodyKeep,
        },
        { onConflict: "user_id,release_item_id" },
      );
      if (error) {
        alert(error.message || "저장에 실패했습니다.");
        return;
      }
      await load();
    } finally {
      setSavingStars(false);
    }
  };

  const clearMyStars = async () => {
    if (!userId || !mine) return;
    if (normalizeReleaseReviewBody(mine.body ?? "").length > 0) {
      alert("텍스트 리뷰가 남아 있을 때는 별점만 지울 수 없습니다. 아래 리뷰에서 글을 먼저 지워 주세요.");
      return;
    }
    if (!confirm("내 별점을 삭제할까요?")) return;
    setSavingStars(true);
    try {
      const { error } = await supabase
        .from("release_item_reviews")
        .delete()
        .eq("release_item_id", releaseItemId)
        .eq("user_id", userId);
      if (error) {
        alert(error.message || "삭제에 실패했습니다.");
        return;
      }
      setStarsDraft(0);
      setBodyDraft("");
      await load();
    } finally {
      setSavingStars(false);
    }
  };

  const saveReview = async () => {
    if (!canInteract) {
      alert("방영이 시작된 작품에만 리뷰를 남길 수 있습니다.");
      return;
    }
    if (!userId) {
      alert("로그인 후 리뷰를 남길 수 있습니다.");
      return;
    }
    const trimmed = normalizeReleaseReviewBody(bodyDraft);
    if (trimmed.length < 1) {
      alert("리뷰 내용을 입력해 주세요.");
      return;
    }
    if (trimmed.length > RELEASE_REVIEW_BODY_MAX) {
      alert(`리뷰는 ${RELEASE_REVIEW_BODY_MAX}자 이하로 작성해 주세요.`);
      return;
    }

    const starVal = mine?.stars ?? starsDraft;
    if (starVal < 1 || starVal > 5) {
      alert("위 별점 섹션에서 먼저 별점을 저장해 주세요. 리뷰는 별점이 있는 경우에만 등록할 수 있습니다.");
      return;
    }

    setSavingReview(true);
    try {
      const { error } = await supabase.from("release_item_reviews").upsert(
        {
          user_id: userId,
          release_item_id: releaseItemId,
          stars: starVal,
          body: trimmed,
        },
        { onConflict: "user_id,release_item_id" },
      );
      if (error) {
        alert(error.message || "저장에 실패했습니다.");
        return;
      }
      await load();
    } finally {
      setSavingReview(false);
    }
  };

  const clearMyReviewText = async () => {
    if (!userId || !mine) return;
    if (normalizeReleaseReviewBody(mine.body ?? "").length < 1) return;
    if (!confirm("리뷰 글만 삭제할까요? 별점은 유지됩니다.")) return;
    setSavingReview(true);
    try {
      const { error } = await supabase.from("release_item_reviews").upsert(
        {
          user_id: userId,
          release_item_id: releaseItemId,
          stars: mine.stars,
          body: "",
        },
        { onConflict: "user_id,release_item_id" },
      );
      if (error) {
        alert(error.message || "삭제에 실패했습니다.");
        return;
      }
      setBodyDraft("");
      await load();
    } finally {
      setSavingReview(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <section className="border border-dashed border-gray-500 bg-white/75 p-5">
          <h2 className="mb-3 text-sm font-bold tracking-widest text-gray-800">별점</h2>
          <p className="text-sm text-gray-500">불러오는 중...</p>
        </section>
        <section className="border border-dashed border-gray-500 bg-white/75 p-5">
          <h2 className="mb-3 text-sm font-bold tracking-widest text-gray-800">리뷰</h2>
          <p className="text-sm text-gray-500">불러오는 중...</p>
        </section>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 별점: 집계 + 내 점수만 — 타인 별점 목록 없음 */}
      <section className="border border-dashed border-gray-500 bg-white/75 p-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-dashed border-gray-300 pb-3">
          <h2 className="text-sm font-bold tracking-widest text-gray-800">별점</h2>
          {starAggregate && (
            <StarBar
              avg={starAggregate.avg}
              count={starAggregate.count}
              size="sm"
              className="justify-end"
            />
          )}
        </div>
        <p className="mb-4 text-xs text-gray-500">
          전체 평균만 공개됩니다. 누가 몇 점을 줬는지는 표시하지 않습니다.
        </p>

        {!canInteract && (
          <p className="mb-4 rounded border border-dashed border-amber-400 bg-amber-50 p-3 text-sm text-amber-900">
            첫 방송일(방영일)이 지난 작품에만 별점을 남길 수 있습니다.
            {releaseDate ? (
              <>
                {" "}
                등록된 방영일: <span className="font-mono">{releaseDate}</span>
              </>
            ) : null}
          </p>
        )}

        {canInteract && (
          <div className="space-y-3 rounded border border-dashed border-gray-400 bg-white/80 p-4">
            <div>
              <span className="text-xs font-semibold text-gray-600">내 별점</span>
              <div className="mt-1 flex flex-wrap gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setStarsDraft(n)}
                    className={`h-9 min-w-[2.25rem] border border-dashed px-2 text-sm font-bold ${
                      starsDraft === n
                        ? "border-gray-800 bg-gray-300 text-gray-950"
                        : "border-gray-400 bg-white text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={savingStars || !userId}
                onClick={() => void saveStars()}
                className="rounded bg-black px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
              >
                {mine ? "별점 저장" : "별점 등록"}
              </button>
              {userId && mine && (
                <button
                  type="button"
                  disabled={savingStars}
                  onClick={() => void clearMyStars()}
                  className="rounded border border-gray-400 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  내 별점 삭제
                </button>
              )}
              {!userId && <p className="self-center text-xs text-gray-500">로그인 후 남길 수 있습니다.</p>}
            </div>
          </div>
        )}
      </section>

      {/* 리뷰: 텍스트가 있는 글만 목록 + 프로필 */}
      <section className="border border-dashed border-gray-500 bg-white/75 p-5">
        <div className="mb-4 border-b border-dashed border-gray-300 pb-3">
          <h2 className="text-sm font-bold tracking-widest text-gray-800">리뷰</h2>
          <p className="mt-1 text-xs text-gray-500">작성자 프로필과 리뷰 글만 표시됩니다. 별점만 남긴 경우에는 여기에 나오지 않습니다.</p>
        </div>

        {!canInteract && (
          <p className="mb-4 rounded border border-dashed border-amber-400 bg-amber-50 p-3 text-sm text-amber-900">
            첫 방송일(방영일)이 지난 작품에만 리뷰를 남길 수 있습니다.
            {releaseDate ? (
              <>
                {" "}
                등록된 방영일: <span className="font-mono">{releaseDate}</span>
              </>
            ) : null}
          </p>
        )}

        <ul className="mb-6 divide-y divide-dashed divide-gray-300">
          {textReviews.length === 0 ? (
            <li className="py-4 text-sm text-gray-500">아직 등록된 리뷰 글이 없습니다.</li>
          ) : (
            textReviews.map((r) => {
              const prof = profileByUserId[r.user_id];
              const handle = prof?.handle?.trim();

              return (
                <li key={r.id} className="py-4">
                  <div className="flex gap-3">
                    <div className="shrink-0 pt-0.5">
                      {handle ? (
                        <Link href={`/user/${encodeURIComponent(handle)}`} className="block hover:opacity-90">
                          <IdentityBadge profile={prof} size="lg" showAvatar showName={false} />
                        </Link>
                      ) : (
                        <IdentityBadge profile={prof} size="lg" showAvatar showName={false} />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-600">
                        {handle ? (
                          <Link
                            href={`/user/${encodeURIComponent(handle)}`}
                            className="inline-flex min-w-0 items-center gap-2 font-semibold text-gray-900 hover:underline"
                          >
                            <IdentityBadge profile={prof} size="sm" showAvatar={false} showName />
                            <span className="truncate font-normal text-gray-500">@{handle}</span>
                          </Link>
                        ) : (
                          <IdentityBadge profile={prof} size="sm" showAvatar={false} showName />
                        )}
                        <span className="text-gray-400">
                          {new Date(r.created_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}
                        </span>
                        {r.user_id === userId && (
                          <span className="text-[10px] font-normal text-pink-600">(나)</span>
                        )}
                      </div>
                      {prof?.bio ? (
                        <p className="mt-1 line-clamp-2 text-xs text-gray-500">{prof.bio}</p>
                      ) : null}
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-800">{r.body}</p>
                    </div>
                  </div>
                </li>
              );
            })
          )}
        </ul>

        {canInteract && (
          <div className="space-y-3 rounded border border-dashed border-gray-400 bg-white/80 p-4">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-gray-600">
                내 리뷰 ({normalizeReleaseReviewBody(bodyDraft).length}/{RELEASE_REVIEW_BODY_MAX}자)
              </span>
              <textarea
                value={bodyDraft}
                onChange={(e) => setBodyDraft(e.target.value)}
                rows={5}
                maxLength={RELEASE_REVIEW_BODY_MAX}
                placeholder="감상을 적어 주세요. 별점은 위 섹션에서 따로 저장합니다."
                className="resize-y rounded border border-gray-300 p-2 text-sm focus:border-black focus:outline-none"
              />
            </label>
            <p className="text-[11px] text-gray-500">
              리뷰를 올리려면 먼저 위에서 별점을 저장해 두어야 합니다.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={savingReview || !userId}
                onClick={() => void saveReview()}
                className="rounded bg-black px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
              >
                {mine && normalizeReleaseReviewBody(mine.body ?? "").length > 0 ? "리뷰 수정" : "리뷰 등록"}
              </button>
              {userId && mine && normalizeReleaseReviewBody(mine.body ?? "").length > 0 && (
                <button
                  type="button"
                  disabled={savingReview}
                  onClick={() => void clearMyReviewText()}
                  className="rounded border border-gray-400 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  리뷰 글만 삭제
                </button>
              )}
              {!userId && <p className="self-center text-xs text-gray-500">로그인 후 작성할 수 있습니다.</p>}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
