"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  CatalogRequestError,
  CatalogRequestField,
  CatalogRequestInput,
  CatalogRequestSelect,
  CatalogRequestShell,
  CatalogRequestSubmitButton,
  CatalogRequestSuccess,
  CatalogRequestTextarea,
  WorkSearchPicker,
} from "@/components/catalog-request/CatalogRequestUi";
import {
  CATALOG_REQUEST_REASONS,
  type CatalogRequestReason,
  type CatalogRequestSource,
} from "@/lib/catalogRequest";
import {
  searchOshiAnalysisWorks,
  submitCharacterAddRequest,
  submitCharacterWithNewWorkRequest,
  type OshiAnalysisWork,
} from "@/lib/supabase/catalogRequest";
import { useAuthUser } from "@/lib/supabase/useAuthUser";
import { OFFICIAL_WORK_CATEGORY_OPTIONS } from "@/lib/official/catalog";
import type { OfficialWorkCategory } from "@/types/official";

function SectionHeading({ step, title }: { step?: number; title: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-dashed border-gray-300 pb-2">
      {step !== undefined && (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center border border-dashed border-gray-400 bg-gray-100 text-xs font-black text-gray-700">
          {step}
        </span>
      )}
      <h2 className="text-sm font-black text-gray-900">{title}</h2>
    </div>
  );
}

function CharacterAddRequestForm() {
  const searchParams = useSearchParams();
  const user = useAuthUser();

  const from = searchParams.get("from") ?? undefined;
  const returnTo = searchParams.get("returnTo") ?? (from === "oshi-analysis" ? "/play/oshi-analysis" : null);
  const initialName = searchParams.get("q") ?? "";
  const initialWork = searchParams.get("work") ?? "";

  const [workQuery, setWorkQuery] = useState(initialWork);
  const [workResults, setWorkResults] = useState<OshiAnalysisWork[]>([]);
  const [selectedWork, setSelectedWork] = useState<{ id: string; title: string } | null>(null);
  const [requestNewWork, setRequestNewWork] = useState(Boolean(initialWork));

  const [newWorkTitle, setNewWorkTitle] = useState(initialWork);
  const [newWorkOriginalTitle, setNewWorkOriginalTitle] = useState("");
  const [newWorkCategory, setNewWorkCategory] = useState<OfficialWorkCategory>("webtoon");
  const [workSourceUrl, setWorkSourceUrl] = useState("");

  const [characterName, setCharacterName] = useState(initialName);
  const [characterOriginalName, setCharacterOriginalName] = useState("");
  const [characterSourceUrl, setCharacterSourceUrl] = useState("");
  const [characterNote, setCharacterNote] = useState("");

  const [reason, setReason] = useState<CatalogRequestReason>("analysis");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (requestNewWork || selectedWork || !workQuery.trim()) {
      setWorkResults([]);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      const results = await searchOshiAnalysisWorks(workQuery, 8);
      if (!cancelled) setWorkResults(results);
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [workQuery, selectedWork, requestNewWork]);

  const workTitle = requestNewWork ? newWorkTitle.trim() : (selectedWork?.title ?? "");

  const workReady = requestNewWork ? newWorkTitle.trim().length > 0 : selectedWork !== null;

  const characterReady = characterName.trim().length > 0;

  const canSubmit = workReady && characterReady;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setBusy(true);
    setError(null);

    const source = (from as CatalogRequestSource | undefined) ?? "play-hub";
    const requesterId = user?.id ?? null;

    const result = requestNewWork
      ? await submitCharacterWithNewWorkRequest({
          workTitle: newWorkTitle.trim(),
          workOriginalTitle: newWorkOriginalTitle.trim(),
          workCategory: newWorkCategory,
          workSourceUrl: workSourceUrl.trim(),
          characterName: characterName.trim(),
          characterOriginalName: characterOriginalName.trim(),
          characterNote: characterNote.trim(),
          characterSourceUrl: characterSourceUrl.trim() || workSourceUrl.trim(),
          reason,
          source,
          requesterId,
        })
      : await submitCharacterAddRequest({
          characterName: characterName.trim(),
          characterOriginalName: characterOriginalName.trim(),
          workTitle,
          officialWorkId: selectedWork?.id,
          requestNewWork: false,
          sourceUrl: characterSourceUrl.trim(),
          reason,
          source,
          requesterId,
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
        title={requestNewWork ? "작품 · 캐릭터 추가 요청을 보냈습니다" : "캐릭터 추가 요청을 보냈습니다"}
        message={
          requestNewWork
            ? `「${newWorkTitle.trim()}」 작품 추가와 「${characterName.trim()}」 캐릭터 추가 요청이 각각 접수되었습니다. 검수 후 DB에 반영되면 분석·월드컵 등에서 사용할 수 있습니다.`
            : "검수 후 DB에 반영되면 분석·월드컵 등에서 사용할 수 있습니다."
        }
        returnTo={returnTo}
        returnLabel={from === "oshi-analysis" ? "최애 분석으로 돌아가기" : "돌아가기"}
      />
    );
  }

  return (
    <CatalogRequestShell
      title="캐릭터 추가 요청"
      description="소속 작품을 먼저 정한 뒤 캐릭터 정보를 입력하세요. 작품이 DB에 없으면 작품 정보와 캐릭터 정보를 함께 요청할 수 있습니다."
      returnTo={returnTo}
      returnLabel={from === "oshi-analysis" ? "최애 분석으로 돌아가기" : undefined}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5 border border-dashed border-gray-500 bg-white p-5">
        {/* ── 1. 작품 ── */}
        <section className="flex flex-col gap-3">
          <SectionHeading step={1} title="소속 작품" />

          <label className="flex cursor-pointer items-center gap-2 border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-xs font-bold text-gray-700">
            <input
              type="checkbox"
              checked={requestNewWork}
              onChange={(e) => {
                setRequestNewWork(e.target.checked);
                if (e.target.checked) {
                  setSelectedWork(null);
                  if (!newWorkTitle && workQuery) setNewWorkTitle(workQuery);
                } else {
                  setWorkQuery(newWorkTitle || workQuery);
                }
              }}
              className="h-4 w-4"
            />
            작품이 DB에 없어요 — 작품도 같이 추가 요청
          </label>

          {requestNewWork ? (
            <div className="flex flex-col gap-3 border border-dashed border-amber-300 bg-amber-50/50 p-4">
              <p className="text-xs font-bold text-amber-800">
                예: 「신의탑」이 없을 때 작품 정보와 「밤」 캐릭터 정보를 함께 보냅니다.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <CatalogRequestField label="작품명" required>
                  <CatalogRequestInput
                    value={newWorkTitle}
                    onChange={(e) => setNewWorkTitle(e.target.value)}
                    placeholder="예: 신의탑"
                    required
                  />
                </CatalogRequestField>
                <CatalogRequestField label="작품 분류">
                  <CatalogRequestSelect
                    value={newWorkCategory}
                    onChange={(e) => setNewWorkCategory(e.target.value as OfficialWorkCategory)}
                  >
                    {OFFICIAL_WORK_CATEGORY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </CatalogRequestSelect>
                </CatalogRequestField>
              </div>
              <CatalogRequestField label="작품 원제 / 영문명" hint="있으면 검수에 도움이 됩니다.">
                <CatalogRequestInput
                  value={newWorkOriginalTitle}
                  onChange={(e) => setNewWorkOriginalTitle(e.target.value)}
                  placeholder="예: Tower of God"
                />
              </CatalogRequestField>
              <CatalogRequestField label="작품 참고 링크" hint="나무위키, 공식 페이지 등 (선택)">
                <CatalogRequestInput
                  value={workSourceUrl}
                  onChange={(e) => setWorkSourceUrl(e.target.value)}
                  placeholder="https://..."
                  type="url"
                />
              </CatalogRequestField>
            </div>
          ) : (
            <CatalogRequestField
              label="등록된 작품 검색"
              required
              hint="캐릭터가 속한 작품을 선택하세요. 없으면 위 체크박스를 켜세요."
            >
              <WorkSearchPicker
                query={workQuery}
                onQueryChange={setWorkQuery}
                results={workResults}
                selected={selectedWork}
                onSelect={(work) => {
                  setSelectedWork(work);
                  setWorkQuery("");
                  setWorkResults([]);
                }}
                onClear={() => {
                  setSelectedWork(null);
                  setWorkQuery("");
                }}
              />
            </CatalogRequestField>
          )}
        </section>

        {/* ── 2. 캐릭터 ── */}
        <section
          className={`flex flex-col gap-3 ${!workReady && !requestNewWork ? "opacity-50" : ""}`}
          aria-disabled={!workReady && !requestNewWork}
        >
          <SectionHeading step={2} title="추가할 캐릭터" />

          {!workReady && !requestNewWork && (
            <p className="text-xs text-gray-500">먼저 소속 작품을 선택하거나, 작품도 같이 추가를 켜주세요.</p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <CatalogRequestField label="캐릭터명" required>
              <CatalogRequestInput
                value={characterName}
                onChange={(e) => setCharacterName(e.target.value)}
                placeholder="예: 밤"
                required
                disabled={!workReady && !requestNewWork}
              />
            </CatalogRequestField>
            <CatalogRequestField label="캐릭터 원명" hint="한자·영문 등 (선택)">
              <CatalogRequestInput
                value={characterOriginalName}
                onChange={(e) => setCharacterOriginalName(e.target.value)}
                placeholder="예: Baam"
                disabled={!workReady && !requestNewWork}
              />
            </CatalogRequestField>
          </div>

          <CatalogRequestField label="캐릭터 참고 링크" hint="위키, 공식 설정 등 (선택)">
            <CatalogRequestInput
              value={characterSourceUrl}
              onChange={(e) => setCharacterSourceUrl(e.target.value)}
              placeholder="https://..."
              type="url"
              disabled={!workReady && !requestNewWork}
            />
          </CatalogRequestField>

          {requestNewWork && (
            <CatalogRequestField label="캐릭터 설명 / 메모" hint="역할, 외모 특징 등 검수에 도움이 되는 내용">
              <CatalogRequestTextarea
                value={characterNote}
                onChange={(e) => setCharacterNote(e.target.value)}
                placeholder="예: 신의탑 주인공. 검은 머리, 초록 눈."
                disabled={!workReady && !requestNewWork}
              />
            </CatalogRequestField>
          )}
        </section>

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
          {requestNewWork ? "작품 · 캐릭터 추가 요청 보내기" : "캐릭터 추가 요청 보내기"}
        </CatalogRequestSubmitButton>
      </form>
    </CatalogRequestShell>
  );
}

export default function CharacterAddRequestPage() {
  return (
    <Suspense
      fallback={
        <main className="flex items-center justify-center py-24">
          <div className="h-6 w-6 animate-spin border-2 border-gray-400 border-t-transparent" />
        </main>
      }
    >
      <CharacterAddRequestForm />
    </Suspense>
  );
}
