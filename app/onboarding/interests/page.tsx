"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useAuthUser } from "@/lib/supabase/useAuthUser";
import {
  fetchFollowedOfficialWorkIds,
  setOfficialWorkFollow,
} from "@/lib/supabase/officialWorkFollows";
import type { OfficialWork } from "@/types/official";

export default function InterestOnboardingPage() {
  const router = useRouter();
  const user = useAuthUser();
  const [works, setWorks] = useState<OfficialWork[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (user === undefined) return;
    if (user === null) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const [worksResponse, followed] = await Promise.all([
        supabase
          .from("official_works")
          .select("*")
          .eq("status", "PUBLISHED")
          .order("sort_order", { ascending: true })
          .order("title", { ascending: true }),
        fetchFollowedOfficialWorkIds(user.id).catch(() => new Set<string>()),
      ]);

      if (cancelled) return;
      setWorks((worksResponse.data ?? []) as OfficialWork[]);
      setSelectedIds(followed);
      setLoading(false);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const filteredWorks = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const base = normalized
      ? works.filter((work) =>
          [work.title, work.original_title ?? "", work.slug]
            .join(" ")
            .toLowerCase()
            .includes(normalized),
        )
      : works;

    return base.slice(0, normalized ? 24 : 18);
  }, [query, works]);

  const selectedWorks = useMemo(
    () => works.filter((work) => selectedIds.has(work.id)),
    [selectedIds, works],
  );

  const toggleWork = (workId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(workId)) next.delete(workId);
      else next.add(workId);
      return next;
    });
    setMessage("");
  };

  const save = async () => {
    if (!user) return;
    setSaving(true);
    setMessage("");
    try {
      const currentIds = await fetchFollowedOfficialWorkIds(user.id).catch(() => new Set<string>());
      const nextIds = selectedIds;
      const allIds = new Set([...Array.from(currentIds), ...Array.from(nextIds)]);

      await Promise.all(
        Array.from(allIds).map((id) =>
          setOfficialWorkFollow(user.id, id, nextIds.has(id)),
        ),
      );

      await supabase.auth.updateUser({
        data: {
          interest_onboarded_at: new Date().toISOString(),
          interest_count: nextIds.size,
        },
      });

      router.push("/profile?tab=oshi");
      router.refresh();
    } catch (error) {
      const errMessage = error instanceof Error ? error.message : "알 수 없는 오류";
      setMessage(`관심작 저장 실패: ${errMessage}`);
    } finally {
      setSaving(false);
    }
  };

  if (user === undefined || loading) {
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <div className="border border-dashed border-gray-500 bg-white/70 p-8 text-center text-sm text-gray-500">
          관심작 목록을 불러오는 중...
        </div>
      </main>
    );
  }

  if (user === null) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <section className="border border-dashed border-gray-500 bg-white/80 p-6 text-center">
          <h1 className="text-xl font-bold text-gray-900">로그인이 필요합니다</h1>
          <p className="mt-2 text-sm text-gray-600">
            관심작을 저장하면 캘린더, 신작, 공개 프로필에 같은 기준이 반영됩니다.
          </p>
          <Link
            href="/auth"
            className="mt-4 inline-flex border border-dashed border-gray-700 bg-gray-900 px-4 py-2 text-sm font-bold text-white"
          >
            로그인하러 가기
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <header className="border border-dashed border-gray-500 bg-white/80 p-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-500">
          Interest setup
        </p>
        <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-950">관심작을 골라주세요</h1>
            <p className="mt-1 text-sm text-gray-600">
              원하면 지금 골라도 되고, 나중에 프로필에서 언제든 설정할 수 있습니다.
            </p>
          </div>
          <div className="border border-dashed border-gray-400 bg-white px-4 py-2 text-sm font-bold text-gray-800">
            선택 {selectedIds.size}개
          </div>
        </div>
      </header>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="border border-dashed border-gray-500 bg-white/75 p-4">
          <label className="mb-4 flex items-center gap-2 border border-dashed border-gray-400 bg-white px-3 py-2">
            <Search size={16} className="text-gray-400" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="작품명, 원제, 슬러그로 검색"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
          </label>

          {works.length === 0 ? (
            <div className="border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-sm text-gray-500">
              공개된 공식 작품이 아직 없습니다. 관리자에서 공식 작품을 먼저 등록해야 합니다.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filteredWorks.map((work) => {
                const selected = selectedIds.has(work.id);
                return (
                  <button
                    key={work.id}
                    type="button"
                    onClick={() => toggleWork(work.id)}
                    className={`flex min-h-24 gap-3 border border-dashed p-3 text-left transition-colors ${
                      selected
                        ? "border-pink-400 bg-pink-50"
                        : "border-gray-300 bg-white hover:border-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    <div className="h-16 w-12 shrink-0 overflow-hidden border border-dashed border-gray-300 bg-gray-100">
                      {work.cover_image_url ? (
                        <img
                          src={work.cover_image_url}
                          alt={work.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-[10px] font-bold text-gray-400">
                          NO
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="line-clamp-2 text-sm font-bold text-gray-950">{work.title}</p>
                        {selected ? (
                          <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-pink-500 text-white">
                            <Check size={13} strokeWidth={3} />
                          </span>
                        ) : null}
                      </div>
                      {work.original_title ? (
                        <p className="mt-1 truncate text-xs text-gray-500">{work.original_title}</p>
                      ) : null}
                      <p className="mt-2 text-[10px] font-bold uppercase text-gray-400">
                        {work.category}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <aside className="border border-dashed border-gray-500 bg-white/75 p-4">
          <h2 className="text-sm font-bold text-gray-900">선택한 관심작</h2>
          <div className="mt-3 flex flex-col gap-2">
            {selectedWorks.length === 0 ? (
              <p className="border border-dashed border-gray-300 bg-gray-50 p-3 text-xs text-gray-500">
                아직 선택한 작품이 없습니다.
              </p>
            ) : (
              selectedWorks.map((work) => (
                <button
                  key={work.id}
                  type="button"
                  onClick={() => toggleWork(work.id)}
                  className="truncate border border-dashed border-pink-300 bg-pink-50 px-3 py-2 text-left text-xs font-bold text-pink-800"
                >
                  {work.title}
                </button>
              ))
            )}
          </div>

          {message ? (
            <p className="mt-3 border border-dashed border-red-300 bg-red-50 p-3 text-xs font-bold text-red-700">
              {message}
            </p>
          ) : null}

          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="mt-4 w-full border border-dashed border-gray-800 bg-gray-900 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "저장 중..." : "관심작 저장"}
          </button>
          <Link
            href="/profile?tab=oshi"
            className="mt-2 block w-full border border-dashed border-gray-400 bg-white px-4 py-2 text-center text-xs font-bold text-gray-600 hover:bg-gray-100"
          >
            나중에 설정
          </Link>
        </aside>
      </section>
    </main>
  );
}
