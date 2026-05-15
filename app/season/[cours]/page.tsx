"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Bell, BellRing } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { formatCoursShort, normalizeCours, getCurrentCours, getRecentCoursList } from "@/lib/otaku/cours";
import {
  getCoursCalendarPhase,
  isLineupVoteAllowed,
  releaseDateToWeekdayKo,
} from "@/lib/otaku/coursPhase";
import {
  fetchFollowedReleaseIds,
  getCurrentUserId,
  setReleaseFollow,
} from "@/lib/supabase/releaseFollows";

const EMPTY_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='600' viewBox='0 0 800 600'%3E%3Crect width='800' height='600' fill='%23f3f4f6'/%3E%3Ctext x='400' y='300' text-anchor='middle' fill='%239ca3af' font-family='sans-serif' font-size='28'%3ENo Image%3C/text%3E%3C/svg%3E";

type ReleaseRow = {
  id: string;
  category: "ANIME" | "MANGA" | "GAME";
  title: string;
  synopsis: string;
  poster_url: string | null;
  genres: string[] | null;
  studios: string[] | null;
  release_date: string | null;
  cours: string | null;
};

type LineupVote = {
  release_item_id: string;
  intent: "watch" | "maybe" | "skip";
};

type VoteCount = {
  watch: number;
  maybe: number;
  skip: number;
};

type GroupMode = "popular" | "weekday";

function lineupHeatScore(counts: VoteCount | undefined): number {
  if (!counts) return 0;
  return counts.watch * 3 + counts.maybe * 2 + counts.skip;
}

function compareReleaseDateAsc(a: string | null, b: string | null): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a.localeCompare(b);
}

export default function SeasonLineupPage() {
  const params = useParams<{ cours: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [items, setItems] = useState<ReleaseRow[]>([]);
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const [votesByItem, setVotesByItem] = useState<Record<string, VoteCount>>({});
  const [myVotes, setMyVotes] = useState<Record<string, LineupVote["intent"] | null>>({});
  const [groupMode, setGroupMode] = useState<GroupMode>("popular");

  const cours = useMemo(
    () => normalizeCours(params.cours?.replaceAll("_", "-")),
    [params.cours],
  );
  const currentCours = useMemo(() => getCurrentCours(), []);
  const recentCoursList = useMemo(() => getRecentCoursList(5), []);
  const isPastSeason = useMemo(
    () => cours !== null && cours !== currentCours,
    [cours, currentCours],
  );

  const calendarPhase = useMemo(() => (cours ? getCoursCalendarPhase(cours) : "archived"), [cours]);
  const lineupVoteAllowed = useMemo(
    () => (cours ? isLineupVoteAllowed(cours) : false),
    [cours],
  );

  const retroBoardSlug = process.env.NEXT_PUBLIC_SEASON_RETRO_BOARD_SLUG;

  useEffect(() => {
    if (params.cours && !cours) {
      router.replace("/season/current");
    }
  }, [cours, params.cours, router]);

  const groupedSections = useMemo(() => {
    if (groupMode === "popular") {
      const sorted = [...items].sort((a, b) => {
        const sa = lineupHeatScore(votesByItem[a.id]);
        const sb = lineupHeatScore(votesByItem[b.id]);
        if (sb !== sa) return sb - sa;
        return compareReleaseDateAsc(a.release_date, b.release_date);
      });
      return [{ key: "popular", heading: "", items: sorted }];
    }
    const map = new Map<string, ReleaseRow[]>();
    for (const item of items) {
      const w = releaseDateToWeekdayKo(item.release_date) ?? "방송일 미정";
      if (!map.has(w)) map.set(w, []);
      map.get(w)!.push(item);
    }
    const order = ["월", "화", "수", "목", "금", "토", "일", "방송일 미정"];
    return Array.from(map.entries())
      .sort(([a], [b]) => order.indexOf(a) - order.indexOf(b))
      .map(([label, rowItems]) => ({
        key: label,
        heading: label === "방송일 미정" ? label : `${label}요일`,
        items: rowItems
          .slice()
          .sort((x, y) => compareReleaseDateAsc(x.release_date, y.release_date)),
      }));
  }, [groupMode, items, votesByItem]);

  useEffect(() => {
    const run = async () => {
      if (!cours) {
        setLoading(false);
        return;
      }
      setLoading(true);

      const currentUserId = await getCurrentUserId();
      setUserId(currentUserId);

      const { data: releaseRows, error: releaseError } = await supabase
        .from("release_items")
        .select("id, category, title, synopsis, poster_url, genres, studios, release_date, cours")
        .eq("cours", cours)
        .eq("category", "ANIME")
        .eq("status", "PUBLISHED")
        .order("release_date", { ascending: true, nullsFirst: false });

      let mappedRows = (releaseRows ?? []) as ReleaseRow[];
      if (releaseError) {
        if (releaseError.code === "42703") {
          // Fallback for environments where release_items.cours migration is not applied yet.
          const { data: fallbackRows, error: fallbackError } = await supabase
            .from("release_items")
            .select("id, category, title, synopsis, poster_url, genres, studios, release_date")
            .eq("category", "ANIME")
            .eq("status", "PUBLISHED")
            .order("release_date", { ascending: true, nullsFirst: false });

          if (fallbackError) {
            console.error("Failed to fetch season lineup (fallback):", fallbackError);
            mappedRows = [];
          } else {
            mappedRows = ((fallbackRows ?? []) as Array<Omit<ReleaseRow, "cours">>).filter(
              (row) => releaseDateToCours(row.release_date) === cours,
            ) as ReleaseRow[];
          }
        } else {
          console.error("Failed to fetch season lineup:", releaseError);
          mappedRows = [];
        }
      }

      setItems(mappedRows);

      if (mappedRows.length > 0) {
        const ids = mappedRows.map((item) => item.id);
        const { data: voteRows } = await supabase
          .from("season_lineup_votes")
          .select("release_item_id, intent")
          .in("release_item_id", ids);

        const byItem: Record<string, VoteCount> = {};
        for (const row of (voteRows ?? []) as LineupVote[]) {
          if (!byItem[row.release_item_id]) {
            byItem[row.release_item_id] = { watch: 0, maybe: 0, skip: 0 };
          }
          byItem[row.release_item_id][row.intent] += 1;
        }
        setVotesByItem(byItem);
      } else {
        setVotesByItem({});
      }

      if (currentUserId) {
        const followed = await fetchFollowedReleaseIds(currentUserId).catch(
          () => new Set<string>(),
        );
        setFollowedIds(followed);

        if (mappedRows.length > 0) {
          const { data: myVoteRows } = await supabase
            .from("season_lineup_votes")
            .select("release_item_id, intent")
            .eq("user_id", currentUserId)
            .in(
              "release_item_id",
              mappedRows.map((item) => item.id),
            );

          const mine: Record<string, LineupVote["intent"] | null> = {};
          for (const row of (myVoteRows ?? []) as LineupVote[]) {
            mine[row.release_item_id] = row.intent;
          }
          setMyVotes(mine);
        } else {
          setMyVotes({});
        }
      } else {
        setFollowedIds(new Set());
        setMyVotes({});
      }

      setLoading(false);
    };

    void run();
  }, [cours]);

  async function toggleFollow(releaseId: string) {
    if (!userId) {
      alert("로그인 후 관심 등록이 가능합니다.");
      return;
    }

    const nextValue = !followedIds.has(releaseId);
    setFollowedIds((current) => {
      const next = new Set(current);
      if (nextValue) next.add(releaseId);
      else next.delete(releaseId);
      return next;
    });

    try {
      await setReleaseFollow(userId, releaseId, nextValue);
    } catch (error) {
      setFollowedIds((current) => {
        const next = new Set(current);
        if (nextValue) next.delete(releaseId);
        else next.add(releaseId);
        return next;
      });
      const message = error instanceof Error ? error.message : "알 수 없는 오류";
      alert(`관심 등록 변경 실패: ${message}`);
    }
  }

  async function voteLineup(releaseId: string, intent: LineupVote["intent"]) {
    if (!userId) {
      alert("로그인 후 투표가 가능합니다.");
      return;
    }
    if (cours && !isLineupVoteAllowed(cours)) {
      alert(
        "라인업 투표(볼래·고민·패스)는 이번 분기 시작일부터 7일 동안만 열립니다. 지난 분기 화면에서는 언제든 기록할 수 있습니다.",
      );
      return;
    }

    const previous = myVotes[releaseId] ?? null;
    const nextIntent = previous === intent ? null : intent;

    setMyVotes((current) => ({ ...current, [releaseId]: nextIntent }));
    setVotesByItem((current) => {
      const prevCounts = current[releaseId] ?? { watch: 0, maybe: 0, skip: 0 };
      const next = { ...prevCounts };
      if (previous) next[previous] = Math.max(0, next[previous] - 1);
      if (nextIntent) next[nextIntent] += 1;
      return { ...current, [releaseId]: next };
    });

    try {
      if (!nextIntent) {
        await supabase
          .from("season_lineup_votes")
          .delete()
          .eq("user_id", userId)
          .eq("release_item_id", releaseId);
      } else {
        await supabase
          .from("season_lineup_votes")
          .upsert(
            { user_id: userId, release_item_id: releaseId, intent: nextIntent },
            { onConflict: "user_id,release_item_id" },
          );
      }
    } catch (error) {
      setMyVotes((current) => ({ ...current, [releaseId]: previous }));
      setVotesByItem((current) => {
        const prevCounts = current[releaseId] ?? { watch: 0, maybe: 0, skip: 0 };
        const next = { ...prevCounts };
        if (nextIntent) next[nextIntent] = Math.max(0, next[nextIntent] - 1);
        if (previous) next[previous] += 1;
        return { ...current, [releaseId]: next };
      });
      const message = error instanceof Error ? error.message : "알 수 없는 오류";
      alert(`투표 변경 실패: ${message}`);
    }
  }

  if (!cours) {
    return null;
  }

  return (
    <main className="flex w-full flex-col gap-4">
      <header className="border border-dashed border-gray-500 bg-white/80 p-4">
        <p className="text-[11px] font-semibold tracking-[0.2em] text-gray-500 uppercase">
          이번 분기 신작
        </p>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">
          {formatCoursShort(cours)} 신작
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          {isPastSeason
            ? "지난 분기 라인업입니다. 관심 등록과 라인업 투표는 언제든 기록할 수 있습니다."
            : "이번 분기 신작을 확인하고 관심 작품을 등록해 보세요."}
        </p>
        {cours && !isPastSeason && (
          <p className="mt-2 text-xs text-gray-700">
            {calendarPhase === "upcoming" && "아직 이 분기가 시작되지 않았습니다."}
            {calendarPhase === "lineup" && "지금은 라인업 투표 주간입니다. 볼래·고민·패스를 남겨 주세요."}
            {calendarPhase === "ongoing" && "방영 중입니다. 라인업 투표는 분기 첫 주에만 열립니다."}
            {calendarPhase === "retro" && "분기 막주입니다. 채널에서 회고 글을 남겨 주세요."}
            {calendarPhase === "archived" && "이 분기는 종료되었습니다."}
          </p>
        )}
        {cours && calendarPhase === "retro" && retroBoardSlug && (
          <p className="mt-2">
            <Link
              href={`/board/${retroBoardSlug}`}
              className="inline-flex border border-dashed border-gray-600 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-gray-100"
            >
              회고 채널로 이동
            </Link>
          </p>
        )}
      </header>

      {/* 시즌 셀렉터 */}
      <section className="border border-dashed border-gray-500 bg-white/70 p-3">
        <p className="mb-2 text-[11px] font-semibold tracking-widest text-gray-400 uppercase">
          분기 선택
        </p>
        <div className="flex flex-wrap gap-2">
          {recentCoursList.map((c) => {
            const isSelected = c === cours;
            const isCurrent = c === currentCours;
            return (
              <Link
                key={c}
                href={`/season/${c.toLowerCase()}`}
                className={`inline-flex items-center gap-1 border border-dashed px-3 py-1.5 text-sm font-semibold transition-colors ${
                  isSelected
                    ? "border-gray-800 bg-gray-300 text-gray-950"
                    : "border-gray-500 bg-white text-gray-600 hover:bg-gray-100"
                }`}
              >
                {formatCoursShort(c)}
                {isCurrent && (
                  <span className="text-[10px] font-bold text-pink-500">NOW</span>
                )}
              </Link>
            );
          })}
        </div>
      </section>

      {/* 그룹 보기 */}
      <section className="border border-dashed border-gray-500 bg-white/70 p-3">
        <p className="mb-2 text-[11px] font-semibold tracking-widest text-gray-400 uppercase">
          정렬
        </p>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["popular", "인기순"],
              ["weekday", "요일별"],
            ] as const
          ).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              onClick={() => setGroupMode(mode)}
              className={`border border-dashed px-3 py-1.5 text-sm font-semibold transition-colors ${
                groupMode === mode
                  ? "border-gray-800 bg-gray-300 text-gray-950"
                  : "border-gray-500 bg-white text-gray-600 hover:bg-gray-100"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-gray-500">
          인기순은 라인업 투표(볼래·고민·패스) 반응을 기준으로 합니다. 요일은 첫 방송일 기준이며, 미입력 시
          &quot;방송일 미정&quot;으로 묶입니다.
        </p>
      </section>

      {/* 콘텐츠 */}
      {loading ? (
        <section className="border border-dashed border-gray-500 bg-white/70 p-6 text-sm text-gray-500">
          불러오는 중...
        </section>
      ) : items.length === 0 ? (
        <section className="border border-dashed border-gray-500 bg-white/70 p-6">
          <p className="text-sm text-gray-500">이 분기에 등록된 애니 신작이 없습니다.</p>
        </section>
      ) : (
        <div className="flex flex-col gap-6">
          {groupedSections.map((section) => (
            <section key={section.key} className="flex flex-col gap-3">
              {section.heading ? (
                <h2 className="border-b border-dashed border-gray-400 pb-1 text-sm font-bold text-gray-800">
                  {section.heading}
                  <span className="ml-2 font-normal text-gray-500">{section.items.length}작</span>
                </h2>
              ) : null}
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {section.items.map((item) => {
                  const counts = votesByItem[item.id] ?? { watch: 0, maybe: 0, skip: 0 };
                  const myVote = myVotes[item.id] ?? null;
                  const followed = followedIds.has(item.id);
                  const voteLocked = !lineupVoteAllowed;

                  return (
                    <article
                      key={item.id}
                      className="overflow-hidden border border-dashed border-gray-500 bg-white/80"
                    >
                      <div className="grid grid-cols-[112px_1fr] gap-3 p-3">
                        <Link
                          href={`/releases/${item.id}`}
                          className="block aspect-[3/4] overflow-hidden bg-gray-100"
                        >
                          <img
                            src={item.poster_url || EMPTY_IMAGE}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        </Link>
                        <div className="min-w-0">
                          <div className="mb-1 flex flex-wrap items-center gap-2">
                            {item.release_date && (
                              <span className="text-xs text-gray-500">{item.release_date}</span>
                            )}
                            {releaseDateToWeekdayKo(item.release_date) && (
                              <span className="text-[10px] text-gray-500">
                                {releaseDateToWeekdayKo(item.release_date)}요일
                              </span>
                            )}
                          </div>
                          <Link
                            href={`/releases/${item.id}`}
                            className="line-clamp-2 text-sm font-bold text-gray-900 hover:underline"
                          >
                            {item.title}
                          </Link>
                          <p className="mt-1 line-clamp-2 text-xs leading-5 text-gray-600">
                            {item.synopsis}
                          </p>
                          <button
                            type="button"
                            onClick={() => void toggleFollow(item.id)}
                            className={`mt-2 inline-flex items-center gap-1 border border-dashed px-2 py-1 text-xs transition-colors ${
                              followed
                                ? "border-pink-300 bg-pink-50 text-pink-700"
                                : "border-gray-500 bg-white text-gray-700 hover:bg-gray-100"
                            }`}
                          >
                            {followed ? <BellRing size={12} /> : <Bell size={12} />}
                            {followed ? "관심중" : "관심 등록"}
                          </button>
                        </div>
                      </div>
                      <div className="border-t border-dashed border-gray-300 bg-gray-50 px-3 py-2">
                        <div className="flex flex-wrap gap-2 text-xs">
                          <VoteChip
                            label={`볼래 ${counts.watch}`}
                            active={myVote === "watch"}
                            disabled={voteLocked}
                            onClick={() => void voteLineup(item.id, "watch")}
                          />
                          <VoteChip
                            label={`고민 ${counts.maybe}`}
                            active={myVote === "maybe"}
                            disabled={voteLocked}
                            onClick={() => void voteLineup(item.id, "maybe")}
                          />
                          <VoteChip
                            label={`패스 ${counts.skip}`}
                            active={myVote === "skip"}
                            disabled={voteLocked}
                            onClick={() => void voteLineup(item.id, "skip")}
                          />
                        </div>
                        {voteLocked && !isPastSeason && (
                          <p className="mt-1 text-[10px] text-gray-500">
                            라인업 투표는 분기 첫 주에만 열립니다.
                          </p>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}

function releaseDateToCours(dateValue: string | null): string | null {
  if (!dateValue) return null;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;
  const month = date.getMonth() + 1;
  const quarter = month <= 3 ? 1 : month <= 6 ? 2 : month <= 9 ? 3 : 4;
  return `${date.getFullYear()}-Q${quarter}`;
}

function VoteChip({
  label,
  active,
  disabled,
  onClick,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`border border-dashed px-2 py-1 transition-colors ${
        disabled
          ? "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400"
          : active
            ? "border-gray-800 bg-gray-300 text-gray-900"
            : "border-gray-400 bg-white text-gray-700 hover:bg-gray-100"
      }`}
    >
      {label}
    </button>
  );
}
