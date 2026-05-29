"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  CatalogRequestError,
  CatalogRequestField,
  CatalogRequestInput,
  CatalogRequestSelect,
  CatalogRequestShell,
  CatalogRequestSubmitButton,
  CatalogRequestSuccess,
} from "@/components/catalog-request/CatalogRequestUi";
import {
  CATALOG_REQUEST_REASONS,
  type CatalogRequestReason,
  type CatalogRequestSource,
} from "@/lib/catalogRequest";
import { submitWorkAddRequest } from "@/lib/supabase/catalogRequest";
import { useAuthUser } from "@/lib/supabase/useAuthUser";
import { OFFICIAL_WORK_CATEGORY_OPTIONS } from "@/lib/official/catalog";
import type { OfficialWorkCategory } from "@/types/official";

function WorkAddRequestForm() {
  const searchParams = useSearchParams();
  const user = useAuthUser();

  const from = searchParams.get("from") ?? undefined;
  const returnTo = searchParams.get("returnTo") ?? (from === "oshi-analysis" ? "/play/oshi-analysis" : null);
  const initialTitle = searchParams.get("work") ?? searchParams.get("q") ?? "";

  const [workTitle, setWorkTitle] = useState(initialTitle);
  const [originalTitle, setOriginalTitle] = useState("");
  const [category, setCategory] = useState<OfficialWorkCategory>("anime");
  const [sourceUrl, setSourceUrl] = useState("");
  const [reason, setReason] = useState<CatalogRequestReason>("missing_work");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const canSubmit = workTitle.trim().length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setBusy(true);
    setError(null);

    const result = await submitWorkAddRequest({
      workTitle: workTitle.trim(),
      originalTitle: originalTitle.trim(),
      category,
      sourceUrl,
      reason,
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

  if (done) {
    return (
      <CatalogRequestSuccess
        title="작품 추가 요청을 보냈습니다"
        message="검수 후 DB에 반영되면 해당 작품의 캐릭터도 순차적으로 등록할 수 있습니다."
        returnTo={returnTo}
        returnLabel={from === "oshi-analysis" ? "최애 분석으로 돌아가기" : "돌아가기"}
      />
    );
  }

  return (
    <CatalogRequestShell
      title="작품 추가 요청"
      description="캐릭터 없이 작품만 먼저 DB에 넣어 달라고 요청합니다. 나중에 캐릭터 추가 요청을 따로 보낼 수 있습니다."
      returnTo={returnTo}
      returnLabel={from === "oshi-analysis" ? "최애 분석으로 돌아가기" : undefined}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 border border-dashed border-gray-500 bg-white p-5">
        <CatalogRequestField label="작품명" required>
          <CatalogRequestInput
            value={workTitle}
            onChange={(e) => setWorkTitle(e.target.value)}
            placeholder="예: 주술회전"
            required
          />
        </CatalogRequestField>

        <CatalogRequestField label="원제 / 영문명" hint="있으면 검수에 도움이 됩니다.">
          <CatalogRequestInput
            value={originalTitle}
            onChange={(e) => setOriginalTitle(e.target.value)}
            placeholder="예: Jujutsu Kaisen"
          />
        </CatalogRequestField>

        <CatalogRequestField label="작품 분류" required>
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

        <CatalogRequestField label="참고 링크" hint="위키, 공식 페이지 등 (선택)">
          <CatalogRequestInput
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://..."
            type="url"
          />
        </CatalogRequestField>

        <CatalogRequestField label="요청 사유" required>
          <CatalogRequestSelect
            value={reason}
            onChange={(e) => setReason(e.target.value as CatalogRequestReason)}
          >
            {CATALOG_REQUEST_REASONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </CatalogRequestSelect>
        </CatalogRequestField>

        {!user && (
          <p className="text-xs leading-5 text-gray-500">
            로그인 없이도 요청할 수 있습니다. 로그인하면 승인 후 기여도·배지 추적이 가능합니다.
          </p>
        )}

        {error && <CatalogRequestError message={error} />}

        <CatalogRequestSubmitButton busy={busy} disabled={!canSubmit}>
          작품 추가 요청 보내기
        </CatalogRequestSubmitButton>
      </form>
    </CatalogRequestShell>
  );
}

export default function WorkAddRequestPage() {
  return (
    <Suspense
      fallback={
        <main className="flex items-center justify-center py-24">
          <div className="h-6 w-6 animate-spin border-2 border-gray-400 border-t-transparent" />
        </main>
      }
    >
      <WorkAddRequestForm />
    </Suspense>
  );
}
