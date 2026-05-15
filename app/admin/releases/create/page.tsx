"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ReleaseForm,
  csvToArray,
  emptyReleaseForm,
  emptyToNull,
  numberOrNull,
  parseDetails,
} from "@/components/releases/AdminReleaseForm";
import { supabase } from "@/lib/supabase/client";
import { formatCoursShort, normalizeCours } from "@/lib/otaku/cours";

export default function CreateReleasePage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-500">로딩 중...</div>}>
      <CreateReleaseInner />
    </Suspense>
  );
}

function CreateReleaseInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCours = useMemo(
    () => normalizeCours(searchParams.get("cours")),
    [searchParams],
  );

  const [form, setForm] = useState(() =>
    initialCours ? { ...emptyReleaseForm, cours: initialCours } : emptyReleaseForm,
  );

  useEffect(() => {
    if (initialCours) {
      setForm((prev) => (prev.cours ? prev : { ...prev, cours: initialCours }));
    }
  }, [initialCours]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.title.trim() || !form.synopsis.trim()) {
      alert("제목과 시놉시스는 필수입니다.");
      return;
    }
    if (!form.cours) {
      alert("분기를 선택해 주세요.");
      return;
    }

    const { error } = await supabase.from("release_items").insert([
      {
        category: form.category.toUpperCase(),
        status: form.status,
        title: form.title.trim(),
        original_title: emptyToNull(form.originalTitle),
        synopsis: form.synopsis.trim(),
        poster_url: emptyToNull(form.posterUrl),
        banner_url: emptyToNull(form.bannerUrl),
        genres: csvToArray(form.genres),
        studios: csvToArray(form.studios),
        season: emptyToNull(form.season),
        cours: form.cours,
        episode_count: numberOrNull(form.episodeCount),
        details_json: parseDetails(form.details),
        release_date: emptyToNull(form.releaseDate),
      },
    ]);

    if (error) {
      alert("신작 생성 실패: " + error.message);
      return;
    }

    router.push(`/admin/releases?cours=${form.cours}`);
  };

  const handleCancel = () => {
    if (initialCours) {
      router.push(`/admin/releases?cours=${initialCours}`);
    } else {
      router.push("/admin/releases");
    }
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="border-b border-dashed border-gray-500 pb-4">
        <h2 className="text-xl font-bold">새 신작 추가</h2>
        <p className="mt-1 text-sm text-gray-600">
          {initialCours ? (
            <>
              <span className="font-semibold text-gray-900">{formatCoursShort(initialCours)}</span>{" "}
              분기에 등록합니다. 다른 분기로 변경하려면 폼의 분기 셀렉터를 사용하세요.
            </>
          ) : (
            "신작 알림에 필요한 정보를 직접 입력합니다. 분기는 필수입니다."
          )}
        </p>
      </div>

      <ReleaseForm
        form={form}
        setForm={setForm}
        submitLabel="추가하기"
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
    </div>
  );
}
