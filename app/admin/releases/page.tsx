"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { CATEGORY_LABELS, type OtakuCategory } from "@/lib/otaku/hub";
import {
  formatCoursShort,
  getCoursRange,
  getCurrentCours,
  normalizeCours,
} from "@/lib/otaku/cours";

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
    if (queryCours === UNASSIGNED) {
      return items.filter((item) => !item.cours);
    }
    return items.filter((item) => item.cours === queryCours);
  }, [items, queryCours]);

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
        body: JSON.stringify({ cours: queryCours }),
      });

      const payload = (await response.json().catch(() => null)) as
        | {
            error?: string;
            totalCandidates?: number;
            insertedCount?: number;
          }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "AI 일괄 채우기에 실패했습니다.");
      }

      setBatchMessage(
        `총 ${payload?.totalCandidates ?? 0}개 중 ${payload?.insertedCount ?? 0}개를 추가했습니다.`,
      );
      await fetchItems();
    } catch (error) {
      const message = error instanceof Error ? error.message : "알 수 없는 오류";
      alert(message);
    } finally {
      setBatchRunning(false);
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
            분기를 선택한 뒤 AI 일괄 채우기를 누르면 무료 공개 데이터 기준 인기순으로 작품을 한 번에
            등록합니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleBatchFill()}
            disabled={loading || batchRunning || queryCours === UNASSIGNED}
            className="inline-flex items-center gap-1 rounded border border-dashed border-emerald-400 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-900 transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {batchRunning ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {batchRunning ? "AI 일괄 채우는 중" : "AI 일괄 채우기"}
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
      </section>

      <section className="rounded border border-dashed border-gray-500 bg-white/70 p-6">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-gray-900">
            {queryCours === UNASSIGNED ? "분기 미정 릴리즈 목록" : `${formatCoursShort(queryCours)} 릴리즈 목록`}
          </h3>
          <span className="text-xs text-gray-500">{visibleItems.length}개</span>
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
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b">
                <tr>
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
                {visibleItems.map((item) => (
                  <tr key={item.id} className="transition-colors hover:bg-gray-100">
                    <td className="p-3">
                      <div className="font-medium">{item.title}</div>
                      <div className="text-xs text-gray-500">{item.original_title}</div>
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
                          onClick={() => void handleDeleteItem(item)}
                          disabled={deletingId === item.id}
                          className="inline-flex items-center gap-1 text-red-600 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {deletingId === item.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Trash2 size={14} />
                          )}
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function getCategoryLabel(category: string) {
  const key = category.toLowerCase() as keyof typeof CATEGORY_LABELS;
  return CATEGORY_LABELS[key] ?? category;
}

function getOfficialWorkTitle(value: AdminReleaseRow["official_works"]) {
  if (Array.isArray(value)) return value[0]?.title ?? "-";
  return value?.title ?? "-";
}
