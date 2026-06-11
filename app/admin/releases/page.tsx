"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Plus, Search, Sparkles, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { CATEGORY_LABELS, type OtakuCategory } from "@/lib/otaku/hub";
import {
  formatCoursShort,
  getCoursRange,
  getCurrentCours,
  normalizeCours,
} from "@/lib/otaku/cours";
import { buildNamuwikiSeasonCategoryUrl } from "@/lib/otaku/namuwikiSeason";

type AdminReleaseRow = {
  id: string;
  category: Exclude<OtakuCategory, "all">;
  title: string;
  original_title: string | null;
  poster_url: string | null;
  season: string | null;
  cours: string | null;
  episode_count: number | null;
  status: string;
  release_date: string | null;
  official_works?: { title: string } | { title: string }[] | null;
};

type BulkReleaseStatus = "DRAFT" | "PUBLISHED";

const UNASSIGNED = "__unassigned__";

export default function AdminReleasesPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-500">로딩 중...</div>}>
      <AdminReleasesInner />
    </Suspense>
  );
}

function AdminReleasesInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentCours = useMemo(() => getCurrentCours(), []);
  const queryCours = useMemo(() => {
    const raw = searchParams.get("cours");
    if (raw === UNASSIGNED) return UNASSIGNED;
    return normalizeCours(raw) ?? currentCours;
  }, [searchParams, currentCours]);

  const [items, setItems] = useState<AdminReleaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchMessage, setBatchMessage] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkStatusUpdating, setBulkStatusUpdating] = useState<BulkReleaseStatus | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const defaultNamuwikiUrl = useMemo(
    () => (queryCours === UNASSIGNED ? "" : buildNamuwikiSeasonCategoryUrl(queryCours) ?? ""),
    [queryCours],
  );
  const [namuwikiUrl, setNamuwikiUrl] = useState(defaultNamuwikiUrl);

  const fetchItems = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("release_items")
      .select("id, category, title, original_title, poster_url, season, cours, episode_count, status, release_date, official_works(title)")
      .order("release_date", { ascending: true, nullsFirst: false });

    if (error) {
      console.error("Failed to load release_items:", error);
      setItems([]);
    } else {
      setItems((data as AdminReleaseRow[] | null) ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    void fetchItems();
  }, []);

  useEffect(() => {
    setSearchQuery("");
    setSelectedIds(new Set());
  }, [queryCours]);

  useEffect(() => {
    setNamuwikiUrl(defaultNamuwikiUrl);
  }, [defaultNamuwikiUrl]);

  const coursTabs = useMemo(() => {
    const base = getCoursRange(4, 2);
    const extras = items.map((item) => item.cours).filter((value): value is string => Boolean(value));
    return Array.from(new Set([...base, ...extras])).sort((a, b) => b.localeCompare(a));
  }, [items]);

  const countByCours = useMemo(() => {
    const map = new Map<string, number>();
    let unassigned = 0;
    for (const item of items) {
      if (item.cours) {
        map.set(item.cours, (map.get(item.cours) ?? 0) + 1);
      } else {
        unassigned += 1;
      }
    }
    return { map, unassigned };
  }, [items]);

  const visibleItems = useMemo(() => {
    const scopedItems =
      queryCours === UNASSIGNED
        ? items.filter((item) => !item.cours)
        : items.filter((item) => item.cours === queryCours);

    return sortAdminReleaseItems(scopedItems);
  }, [items, queryCours]);

  const scheduleCheckItems = useMemo(
    () =>
      visibleItems
        .filter((item) => item.status !== "HIDDEN")
        .map((item) => ({ item, issue: getKoreanScheduleIssue(item) }))
        .filter((entry) => entry.issue),
    [visibleItems],
  );

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return visibleItems;

    return visibleItems.filter((item) => {
      const haystack = [
        item.title,
        item.original_title,
        getOfficialWorkTitle(item.official_works),
        item.status,
        getCategoryLabel(item.category),
        item.season,
        item.release_date,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [visibleItems, searchQuery]);

  const filteredIds = useMemo(() => filteredItems.map((item) => item.id), [filteredItems]);
  const allFilteredSelected =
    filteredIds.length > 0 && filteredIds.every((id) => selectedIds.has(id));
  const someFilteredSelected = filteredIds.some((id) => selectedIds.has(id));

  const createHref =
    queryCours === UNASSIGNED
      ? "/admin/releases/create"
      : `/admin/releases/create?cours=${queryCours}`;

  const handleSelectCours = (value: string) => {
    router.push(`/admin/releases?cours=${value}`);
  };

  const getAccessToken = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    return sessionData.session?.access_token ?? null;
  };

  const handleBatchFill = async () => {
    if (queryCours === UNASSIGNED) {
      alert("분기를 먼저 선택해 주세요.");
      return;
    }
    if (!namuwikiUrl.trim()) {
      alert("나무위키 분기 분류 URL을 입력해 주세요.");
      return;
    }

    const accessToken = await getAccessToken();
    if (!accessToken) {
      alert("로그인이 필요합니다.");
      return;
    }

    setBatchRunning(true);
    setBatchMessage(null);

    try {
      const response = await fetch("/api/admin/releases/ai-fill", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ cours: queryCours, namuwikiUrl: namuwikiUrl.trim() }),
      });

      const payload = (await response.json().catch(() => null)) as
        | {
            error?: string;
            totalCandidates?: number;
            insertedCount?: number;
            skippedCount?: number;
            anilistMatchedCount?: number;
            aiFilledCount?: number;
          }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "AI 일괄 채우기에 실패했습니다.");
      }

      setBatchMessage(
        `총 ${payload?.totalCandidates ?? 0}개 / 신규 ${payload?.insertedCount ?? 0}개 / 스킵 ${
          payload?.skippedCount ?? 0
        }개로 처리했습니다. AniList 보강 ${payload?.anilistMatchedCount ?? 0}개, AI 소개 재작성 ${
          payload?.aiFilledCount ?? 0
        }개.`,
      );
      await fetchItems();
    } catch (error) {
      const message = error instanceof Error ? error.message : "알 수 없는 오류";
      alert(message);
    } finally {
      setBatchRunning(false);
    }
  };

  const toggleSelectItem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllFiltered = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        for (const id of filteredIds) next.delete(id);
      } else {
        for (const id of filteredIds) next.add(id);
      }
      return next;
    });
  };

  const handleBulkDelete = async () => {
    const ids = filteredIds.filter((id) => selectedIds.has(id));
    if (ids.length === 0) return;

    const tabLabel =
      queryCours === UNASSIGNED ? "분기 미정" : formatCoursShort(queryCours);
    if (
      !confirm(
        `${tabLabel} 탭에서 선택한 ${ids.length}개 릴리즈를 삭제할까요? 이 작업은 되돌릴 수 없습니다.`,
      )
    ) {
      return;
    }

    setBulkDeleting(true);
    try {
      const { error } = await supabase.from("release_items").delete().in("id", ids);
      if (error) throw error;
      setSelectedIds(new Set());
      await fetchItems();
    } catch (error) {
      const message = error instanceof Error ? error.message : "알 수 없는 오류";
      alert(`일괄 삭제 실패: ${message}`);
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleBulkStatusUpdate = async (status: BulkReleaseStatus) => {
    const ids = filteredIds.filter((id) => selectedIds.has(id));
    if (ids.length === 0) return;

    setBulkStatusUpdating(status);
    try {
      const { error } = await supabase.from("release_items").update({ status }).in("id", ids);
      if (error) throw error;
      setSelectedIds(new Set());
      await fetchItems();
    } catch (error) {
      const message = error instanceof Error ? error.message : "알 수 없는 오류";
      alert(`상태 일괄 변경 실패: ${message}`);
    } finally {
      setBulkStatusUpdating(null);
    }
  };

  const handleDeleteItem = async (item: AdminReleaseRow) => {
    const label = item.original_title || item.title;
    if (!confirm(`'${label}' 작품을 삭제할까요? 이 작업은 되돌릴 수 없습니다.`)) {
      return;
    }

    setDeletingId(item.id);
    try {
      const { error } = await supabase.from("release_items").delete().eq("id", item.id);
      if (error) {
        throw error;
      }
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
      await fetchItems();
    } catch (error) {
      const message = error instanceof Error ? error.message : "알 수 없는 오류";
      alert(`삭제 실패: ${message}`);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-dashed border-gray-500 pb-4">
        <div>
          <h2 className="text-xl font-bold">릴리즈 관리</h2>
          <p className="mt-1 text-sm text-gray-600">
            분기를 선택한 뒤 나무위키 분류 URL 기준으로 작품을 한 번에 등록합니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleBatchFill()}
            disabled={loading || batchRunning || queryCours === UNASSIGNED || !namuwikiUrl.trim()}
            className="inline-flex items-center gap-1 rounded border border-dashed border-emerald-400 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-900 transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {batchRunning ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {batchRunning ? "일괄 채우는 중" : "나무위키 일괄 채우기"}
          </button>
          <Link
            href={createHref}
            className="inline-flex items-center gap-1 rounded bg-black px-4 py-2 text-sm text-white transition-opacity hover:opacity-80"
          >
            <Plus size={16} />
            {queryCours === UNASSIGNED ? "신작 추가" : `${formatCoursShort(queryCours)} 신작 추가`}
          </Link>
        </div>
      </div>

      {batchMessage && (
        <div className="rounded border border-dashed border-emerald-400 bg-emerald-50 p-3 text-sm text-emerald-900">
          {batchMessage}
        </div>
      )}

      {!loading && queryCours !== UNASSIGNED && scheduleCheckItems.length > 0 && (
        <section className="rounded border border-dashed border-amber-400 bg-amber-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-amber-950">한국 편성 확인 필요</h3>
              <p className="mt-1 text-xs text-amber-800">
                한국 방영/스트리밍 기준일이 없거나 일본 편성과 구분이 애매한 항목입니다.
              </p>
            </div>
            <span className="rounded border border-dashed border-amber-500 bg-white px-2 py-1 text-xs font-bold text-amber-900">
              {scheduleCheckItems.length}개
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {scheduleCheckItems.map(({ item, issue }) => (
              <Link
                key={item.id}
                href={`/admin/releases/${item.id}`}
                className="inline-flex max-w-full items-center gap-2 rounded border border-dashed border-amber-300 bg-white px-2.5 py-1.5 text-xs text-amber-950 hover:bg-amber-100"
              >
                <span className="truncate font-semibold">{item.title}</span>
                <span className="shrink-0 text-amber-700">{issue}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <p className="text-[11px] font-semibold tracking-widest text-gray-400 uppercase">분기 선택</p>
        <div className="flex flex-wrap gap-2">
          {coursTabs.map((cours) => {
            const isActive = cours === queryCours;
            const isCurrent = cours === currentCours;
            const count = countByCours.map.get(cours) ?? 0;
            return (
              <button
                key={cours}
                type="button"
                onClick={() => handleSelectCours(cours)}
                className={`inline-flex items-center gap-1 rounded border border-dashed px-3 py-1.5 text-sm transition-colors ${
                  isActive
                    ? "border-gray-800 bg-gray-300 text-gray-950"
                    : "border-gray-500 bg-white text-gray-600 hover:bg-gray-100"
                }`}
              >
                <span className="font-semibold">{formatCoursShort(cours)}</span>
                <span className="text-xs text-gray-500">({count})</span>
                {isCurrent && <span className="text-[10px] font-bold text-pink-500">NOW</span>}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => handleSelectCours(UNASSIGNED)}
            className={`inline-flex items-center gap-1 rounded border border-dashed px-3 py-1.5 text-sm transition-colors ${
              queryCours === UNASSIGNED
                ? "border-gray-800 bg-gray-300 text-gray-950"
                : "border-gray-500 bg-white text-gray-600 hover:bg-gray-100"
            }`}
          >
            <span className="font-semibold">분기 미정</span>
            <span className="text-xs text-gray-500">({countByCours.unassigned})</span>
          </button>
        </div>
        {queryCours !== UNASSIGNED && (
          <label className="mt-2 flex flex-col gap-1 rounded border border-dashed border-gray-400 bg-white px-3 py-2 text-sm sm:flex-row sm:items-center">
            <span className="shrink-0 text-xs font-semibold text-gray-500">나무위키 URL</span>
            <input
              value={namuwikiUrl}
              onChange={(event) => setNamuwikiUrl(event.target.value)}
              placeholder={defaultNamuwikiUrl}
              className="min-w-0 flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
            />
          </label>
        )}
      </section>

      <section className="rounded border border-dashed border-gray-500 bg-white/70 p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-gray-900">
              {queryCours === UNASSIGNED ? "분기 미정 릴리즈 목록" : `${formatCoursShort(queryCours)} 릴리즈 목록`}
            </h3>
            <p className="mt-1 text-xs text-gray-500">
              {searchQuery.trim()
                ? `${filteredItems.length}개 검색됨 / ${visibleItems.length}개`
                : `${visibleItems.length}개`}
            </p>
          </div>
          {visibleItems.length > 0 ? (
            <label className="flex min-w-[220px] flex-1 items-center gap-2 rounded border border-dashed border-gray-400 bg-white px-3 py-2 text-sm sm:max-w-sm">
              <Search size={16} className="shrink-0 text-gray-400" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="제목, 원제, 상태 검색"
                className="min-w-0 flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
              />
            </label>
          ) : null}
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">로딩 중...</p>
        ) : visibleItems.length === 0 ? (
          <div className="flex flex-col items-start gap-3 rounded border border-dashed border-gray-400 bg-white p-6">
            <p className="text-sm text-gray-500">
              {queryCours === UNASSIGNED
                ? "분기 미정 릴리즈가 없습니다."
                : `${formatCoursShort(queryCours)}에 등록된 릴리즈가 없습니다.`}
            </p>
            <Link
              href={createHref}
              className="inline-flex items-center gap-1 rounded bg-black px-3 py-2 text-xs text-white transition-opacity hover:opacity-80"
            >
              <Plus size={14} />
              {queryCours === UNASSIGNED ? "신작 추가" : `${formatCoursShort(queryCours)} 신작 추가`}
            </Link>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="rounded border border-dashed border-gray-400 bg-white p-6 text-sm text-gray-500">
            검색 결과가 없습니다.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-dashed border-gray-300 bg-gray-50 px-3 py-2">
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  ref={(node) => {
                    if (node) node.indeterminate = someFilteredSelected && !allFilteredSelected;
                  }}
                  onChange={toggleSelectAllFiltered}
                  className="h-4 w-4 rounded border-gray-400"
                />
                <span className="font-medium">
                  {allFilteredSelected ? "전체 해제" : "전체 선택"}
                  {searchQuery.trim() ? " (검색 결과)" : ""}
                </span>
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-gray-500">{selectedIds.size}개 선택됨</span>
                <button
                  type="button"
                  onClick={() => void handleBulkStatusUpdate("DRAFT")}
                  disabled={
                    selectedIds.size === 0 ||
                    bulkDeleting ||
                    bulkStatusUpdating !== null ||
                    deletingId !== null
                  }
                  className="inline-flex items-center gap-1 rounded border border-dashed border-gray-400 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {bulkStatusUpdating === "DRAFT" && <Loader2 size={14} className="animate-spin" />}
                  DRAFT로 변경
                </button>
                <button
                  type="button"
                  onClick={() => void handleBulkStatusUpdate("PUBLISHED")}
                  disabled={
                    selectedIds.size === 0 ||
                    bulkDeleting ||
                    bulkStatusUpdating !== null ||
                    deletingId !== null
                  }
                  className="inline-flex items-center gap-1 rounded border border-dashed border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {bulkStatusUpdating === "PUBLISHED" && <Loader2 size={14} className="animate-spin" />}
                  PUBLISHED로 변경
                </button>
                <button
                  type="button"
                  onClick={() => void handleBulkDelete()}
                  disabled={
                    selectedIds.size === 0 ||
                    bulkDeleting ||
                    bulkStatusUpdating !== null ||
                    deletingId !== null
                  }
                  className="inline-flex items-center gap-1 rounded border border-dashed border-red-300 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {bulkDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  선택 삭제
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b">
                <tr>
                  <th className="w-10 p-3" />
                  <th className="w-20 p-3 font-semibold">썸네일</th>
                  <th className="p-3 font-semibold">작품</th>
                  <th className="p-3 font-semibold">유형</th>
                  <th className="p-3 font-semibold">작품 허브</th>
                  <th className="p-3 font-semibold">출시일</th>
                  <th className="p-3 font-semibold">화수</th>
                  <th className="p-3 font-semibold">상태</th>
                  <th className="p-3 font-semibold text-right">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dashed">
                {filteredItems.map((item) => (
                  <ReleaseTableRow
                    key={item.id}
                    item={item}
                    selected={selectedIds.has(item.id)}
                    deleting={deletingId === item.id}
                    bulkBusy={bulkDeleting || bulkStatusUpdating !== null}
                    onToggleSelect={toggleSelectItem}
                    onDelete={handleDeleteItem}
                  />
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function ReleaseTableRow({
  item,
  selected,
  deleting,
  bulkBusy,
  onToggleSelect,
  onDelete,
}: {
  item: AdminReleaseRow;
  selected: boolean;
  deleting: boolean;
  bulkBusy: boolean;
  onToggleSelect: (id: string) => void;
  onDelete: (item: AdminReleaseRow) => void;
}) {
  const scheduleIssue = getKoreanScheduleIssue(item);

  return (
    <tr
      className={`transition-colors hover:bg-gray-100 ${selected ? "bg-violet-50/60" : ""}`}
    >
      <td className="p-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect(item.id)}
          className="h-4 w-4 rounded border-gray-400"
        />
      </td>
      <td className="p-3">
        <div className="h-[74px] w-[54px] overflow-hidden rounded border border-dashed border-gray-400 bg-gray-100">
          {item.poster_url ? (
            <img src={item.poster_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center px-1 text-center text-[10px] font-bold leading-3 text-gray-400">
              NO IMAGE
            </div>
          )}
        </div>
      </td>
      <td className="p-3">
        <div className="font-medium">{item.title}</div>
        <div className="text-xs text-gray-500">{item.original_title}</div>
        {scheduleIssue && (
          <div className="mt-1 inline-flex rounded border border-dashed border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800">
            {scheduleIssue}
          </div>
        )}
      </td>
      <td className="p-3 text-gray-600">{getCategoryLabel(item.category)}</td>
      <td className="p-3 text-gray-600">{getOfficialWorkTitle(item.official_works)}</td>
      <td className="p-3 text-gray-600">{item.release_date ?? "미정"}</td>
      <td className="p-3 text-gray-600">
        {item.episode_count ? `${item.episode_count}화` : "미정"}
      </td>
      <td className="p-3 text-gray-600">{item.status}</td>
      <td className="p-3 text-right">
        <div className="flex justify-end gap-2">
          <Link href={`/releases/${item.id}`} className="text-gray-600 hover:underline">
            보기
          </Link>
          <Link href={`/admin/releases/${item.id}`} className="text-blue-600 hover:underline">
            수정
          </Link>
          <button
            type="button"
            onClick={() => void onDelete(item)}
            disabled={deleting || bulkBusy}
            className="inline-flex items-center gap-1 text-red-600 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
          >
            {deleting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Trash2 size={14} />
            )}
            삭제
          </button>
        </div>
      </td>
    </tr>
  );
}

function sortAdminReleaseItems(items: AdminReleaseRow[]): AdminReleaseRow[] {
  return [...items].sort((a, b) => {
    const groupDiff = getTitleSortGroup(a.title) - getTitleSortGroup(b.title);
    if (groupDiff !== 0) return groupDiff;

    const aTitle = normalizeTitleForSort(a.title);
    const bTitle = normalizeTitleForSort(b.title);
    const locale = getTitleSortGroup(a.title) === 2 ? "ko-KR" : "en-US";
    const titleDiff = aTitle.localeCompare(bTitle, locale, {
      numeric: true,
      sensitivity: "base",
    });
    if (titleDiff !== 0) return titleDiff;

    const dateDiff = (a.release_date ?? "").localeCompare(b.release_date ?? "");
    if (dateDiff !== 0) return dateDiff;

    return a.id.localeCompare(b.id);
  });
}

function getTitleSortGroup(title: string): number {
  const head = getTitleSortHead(title);
  if (/^[0-9]$/.test(head)) return 0;
  if (/^[A-Za-z]$/.test(head)) return 1;
  if (/^[가-힣ㄱ-ㅎㅏ-ㅣ]$/.test(head)) return 2;
  return 3;
}

function normalizeTitleForSort(title: string): string {
  return title.normalize("NFKC").trim().replace(/^[^0-9A-Za-z가-힣ㄱ-ㅎㅏ-ㅣ]+/, "");
}

function getTitleSortHead(title: string): string {
  return normalizeTitleForSort(title).charAt(0);
}

function getCategoryLabel(category: string) {
  const key = category.toLowerCase() as keyof typeof CATEGORY_LABELS;
  return CATEGORY_LABELS[key] ?? category;
}

function getOfficialWorkTitle(value: AdminReleaseRow["official_works"]) {
  if (Array.isArray(value)) return value[0]?.title ?? "-";
  return value?.title ?? "-";
}

function getKoreanScheduleIssue(item: AdminReleaseRow): string | null {
  if (!item.release_date) return "출시일 없음";
  return null;
}
