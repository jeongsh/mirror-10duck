"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import {
  CatalogRequestError,
  CatalogRequestField,
  CatalogRequestInput,
  CatalogRequestSelect,
  CatalogRequestShell,
  CatalogRequestSubmitButton,
  CatalogRequestSuccess,
  CatalogRequestTextarea,
} from "@/components/catalog-request/CatalogRequestUi";
import { catalogRequestPath, type CatalogRequestSource } from "@/lib/catalogRequest";
import { getFullWorkForEdit, submitCatalogEditRequest } from "@/lib/supabase/catalogRequest";
import { useAuthUser } from "@/lib/supabase/useAuthUser";
import { OFFICIAL_WORK_CATEGORY_OPTIONS, joinList, splitList } from "@/lib/official/catalog";
import type { OfficialWork, OfficialWorkCategory } from "@/types/official";

function WorkEditRequestForm() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const user = useAuthUser();
  const workId = params.id;

  const from = searchParams.get("from") ?? undefined;
  const returnTo =
    searchParams.get("returnTo") ?? (from === "oshi-analysis" ? "/play/oshi-analysis" : null);

  const [loading, setLoading] = useState(true);
  const [work, setWork] = useState<OfficialWork | null>(null);

  const [title, setTitle] = useState("");
  const [originalTitle, setOriginalTitle] = useState("");
  const [category, setCategory] = useState<OfficialWorkCategory>("anime");
  const [genres, setGenres] = useState("");
  const [coverImageNote, setCoverImageNote] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const row = await getFullWorkForEdit(workId);
      if (cancelled) return;
      setWork(row);
      if (row) {
        setTitle(row.title);
        setOriginalTitle(row.original_title ?? "");
        setCategory(row.category);
        setGenres(joinList(row.genres));
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [workId]);

  const hasChanges = useMemo(() => {
    if (!work) return false;
    const genreList = splitList(genres);
    const currentGenres = work.genres ?? [];
    const genresChanged =
      genreList.length !== currentGenres.length ||
      genreList.some((g, i) => g !== currentGenres[i]);
    return (
      title.trim() !== work.title ||
      originalTitle.trim() !== (work.original_title ?? "") ||
      category !== work.category ||
      genresChanged ||
      coverImageNote.trim().length > 0
    );
  }, [work, title, originalTitle, category, genres, coverImageNote]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!work || !hasChanges) return;

    setBusy(true);
    setError(null);

    const changes: Record<string, unknown> = {};
    if (title.trim() !== work.title) changes.title = title.trim();
    if (originalTitle.trim() !== (work.original_title ?? ""))
      changes.original_title = originalTitle.trim();
    if (category !== work.category) changes.category = category;
    const genreList = splitList(genres);
    const currentGenres = work.genres ?? [];
    if (
      genreList.length !== currentGenres.length ||
      genreList.some((g, i) => g !== currentGenres[i])
    ) {
      changes.genres = genreList;
    }
    if (coverImageNote.trim()) changes.cover_image_note = coverImageNote.trim();

    const result = await submitCatalogEditRequest({
      targetType: "work",
      workId: work.id,
      changes,
      reason: reason.trim() || undefined,
      source: (from as CatalogRequestSource | undefined) ?? "play-hub",
      requesterId: user?.id ?? null,
    });

    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setDone(true);
  };

  if (loading) {
    return (
      <main className="flex items-center justify-center py-24">
        <div className="h-6 w-6 animate-spin border-2 border-gray-400 border-t-transparent" />
      </main>
    );
  }

  if (!work) {
    return (
      <CatalogRequestShell
        title="작품을 찾을 수 없습니다"
        description="등록되지 않았거나 비공개 상태인 작품입니다."
        returnTo={returnTo}
      >
        <section className="border border-dashed border-gray-300 bg-gray-50 p-4">
          <Link
            href={catalogRequestPath("work-add", { from, returnTo: returnTo ?? undefined })}
            className="text-xs font-bold text-gray-700 underline"
          >
            작품 추가 요청하기
          </Link>
        </section>
      </CatalogRequestShell>
    );
  }

  if (done) {
    return (
      <CatalogRequestSuccess
        title="작품 수정 요청을 보냈습니다"
        message="검수 후 반영되면 작품명·장르 등이 업데이트됩니다."
        returnTo={returnTo}
        returnLabel={from === "oshi-analysis" ? "최애 분석으로 돌아가기" : "돌아가기"}
      />
    );
  }

  return (
    <CatalogRequestShell
      title={`${work.title} 수정 요청`}
      description="작품명, 원제, 분류, 장르, 표지 등 틀린 정보를 제안합니다."
      returnTo={returnTo}
      returnLabel={from === "oshi-analysis" ? "최애 분석으로 돌아가기" : undefined}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 border border-dashed border-gray-500 bg-white p-5">
        <CatalogRequestField label="작품명">
          <CatalogRequestInput value={title} onChange={(e) => setTitle(e.target.value)} />
        </CatalogRequestField>

        <CatalogRequestField label="원제 / 영문명">
          <CatalogRequestInput
            value={originalTitle}
            onChange={(e) => setOriginalTitle(e.target.value)}
          />
        </CatalogRequestField>

        <CatalogRequestField label="분류">
          <CatalogRequestSelect
            value={category}
            onChange={(e) => setCategory(e.target.value as OfficialWorkCategory)}
          >
            {OFFICIAL_WORK_CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </CatalogRequestSelect>
        </CatalogRequestField>

        <CatalogRequestField label="장르" hint="쉼표로 구분">
          <CatalogRequestInput
            value={genres}
            onChange={(e) => setGenres(e.target.value)}
            placeholder="예: 액션, 판타지"
          />
        </CatalogRequestField>

        <CatalogRequestField label="표지/이미지 오류 메모">
          <CatalogRequestInput
            value={coverImageNote}
            onChange={(e) => setCoverImageNote(e.target.value)}
            placeholder="예: 다른 작품 표지가 들어가 있음"
          />
        </CatalogRequestField>

        <CatalogRequestField label="추가 설명">
          <CatalogRequestTextarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="왜 수정이 필요한지 간단히 적어주세요."
          />
        </CatalogRequestField>

        {!user && (
          <p className="text-xs leading-5 text-gray-500">로그인 없이도 제안할 수 있습니다.</p>
        )}

        {error && <CatalogRequestError message={error} />}

        <CatalogRequestSubmitButton busy={busy} disabled={!hasChanges}>
          수정 제안 보내기
        </CatalogRequestSubmitButton>
      </form>
    </CatalogRequestShell>
  );
}

export default function WorkEditRequestPage() {
  return (
    <Suspense
      fallback={
        <main className="flex items-center justify-center py-24">
          <div className="h-6 w-6 animate-spin border-2 border-gray-400 border-t-transparent" />
        </main>
      }
    >
      <WorkEditRequestForm />
    </Suspense>
  );
}
