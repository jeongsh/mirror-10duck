"use client";

import { ExternalLink, Loader2, Plus, Save, X } from "lucide-react";
import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import {
  NO_OFFICIAL_SOURCE_MESSAGE,
  URL_DRAFT_EMPTY_MESSAGE,
  type SourceItem,
  type SourcedTopicDraft,
  type SourcedTopicDraftResult,
  type TopicCardStatus,
} from "@/lib/topics/topicCards";
import { SourceBadge, RiskBadge } from "@/components/topics/TopicBadges";
import EmptyState from "@/components/topics/EmptyState";
import { storeApprovedSourcedTopicDraft } from "@/components/topics/topicDraftStorage";

type DraftResponse = {
  ok?: boolean;
  result?: SourcedTopicDraftResult;
  error?: string;
};

export default function AdminUrlDraftForm() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SourcedTopicDraftResult | null>(null);
  const [draft, setDraft] = useState<SourcedTopicDraft | null>(null);
  const [reviewMessage, setReviewMessage] = useState<string | null>(null);

  const mergedResult = useMemo(() => {
    if (!result || !draft) return null;
    return { ...result, draft };
  }, [draft, result]);

  const hasOfficialSources = (mergedResult?.officialSources.length ?? 0) > 0;
  const approveDisabled = !mergedResult || !hasOfficialSources || mergedResult.status === "blocked";

  async function getAccessToken(): Promise<string | null> {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setReviewMessage(null);
    setResult(null);
    setDraft(null);

    const token = await getAccessToken();
    if (!token) {
      setError("로그인이 필요합니다.");
      setLoading(false);
      return;
    }

    const response = await fetch("/api/admin/topics/source-draft", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url }),
    });
    const json = (await response.json().catch(() => null)) as DraftResponse | null;

    if (!response.ok || !json?.result) {
      setError(json?.error ?? "URL 초안 생성에 실패했습니다.");
    } else {
      setResult(json.result);
      setDraft(json.result.draft);
      if (json.result.officialSources.length === 0) {
        setReviewMessage(NO_OFFICIAL_SOURCE_MESSAGE);
      }
    }

    setLoading(false);
  }

  function updateDraft<K extends keyof SourcedTopicDraft>(key: K, value: SourcedTopicDraft[K]) {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  }

  function updateStatus(status: TopicCardStatus) {
    if (!mergedResult) return;

    if (status === "approved") {
      if (!hasOfficialSources) {
        setReviewMessage(NO_OFFICIAL_SOURCE_MESSAGE);
        return;
      }
      storeApprovedSourcedTopicDraft({ ...mergedResult, status: "approved" });
      setResult((current) => (current ? { ...current, status: "approved" } : current));
      setReviewMessage("승인된 초안이 오늘의 떡밥 임시 피드에 추가되었습니다.");
      return;
    }

    setResult((current) => (current ? { ...current, status } : current));
    setReviewMessage(
      status === "pending_review"
        ? "초안을 보류 상태로 표시했습니다. 공식 출처와 문구를 더 확인해 주세요."
        : "초안을 거절 상태로 표시했습니다.",
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="border border-dashed border-gray-500 bg-white/80 p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
          <label className="flex flex-col gap-1 text-xs font-bold text-gray-500">
            입력 URL
            <input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://www.crunchyroll.com/news/..."
              className="h-11 border border-dashed border-gray-400 bg-white px-3 text-sm font-normal text-gray-900 outline-none focus:border-gray-800"
            />
          </label>
          <button
            type="button"
            onClick={() => void handleGenerate()}
            disabled={loading || !url.trim()}
            className="inline-flex h-11 items-center justify-center gap-2 border border-dashed border-gray-700 bg-gray-900 px-4 text-sm font-bold text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {loading ? "공식 출처 찾는 중" : "공식 출처 찾기"}
          </button>
        </div>
        <p className="mt-2 text-xs leading-5 text-gray-500">
          입력 URL은 참고 링크로만 저장합니다. 공식 출처가 없으면 승인할 수 없습니다.
        </p>
        {error ? <p className="mt-3 text-sm font-semibold text-red-600">{error}</p> : null}
      </section>

      {!mergedResult && !loading ? <EmptyState message={URL_DRAFT_EMPTY_MESSAGE} /> : null}

      {mergedResult ? (
        <section className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <AdminSourceReviewPanel result={mergedResult} inputUrl={url} />
          <AdminTopicDraftEditor
            result={mergedResult}
            draft={draft}
            onDraftChange={updateDraft}
            onStatusChange={updateStatus}
            approveDisabled={approveDisabled}
            reviewMessage={reviewMessage}
          />
        </section>
      ) : null}
    </div>
  );
}

function AdminSourceReviewPanel({
  result,
  inputUrl,
}: {
  result: SourcedTopicDraftResult;
  inputUrl: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <section className="border border-dashed border-gray-500 bg-white/80 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <RiskBadge risk={result.riskLevel} />
          <span className="border border-dashed border-gray-300 bg-white px-2 py-1 text-[11px] font-bold text-gray-600">
            상태 {result.status}
          </span>
        </div>
        <dl className="mt-4 grid gap-3 text-sm">
          <InfoRow label="입력 URL" value={inputUrl} isUrl />
          <InfoRow label="감지된 주제" value={result.detectedTopic} />
          <InfoRow label="관련 작품명" value={result.relatedWorkName ?? "미확인"} />
          <InfoRow label="카테고리" value={result.category} />
        </dl>
      </section>

      <SourceList title="공식 출처 목록" badgeLabel="공식 출처" badgeType="official" sources={result.officialSources} />
      <SourceList title="참고 출처 목록" badgeLabel="참고" badgeType="reference" sources={result.referenceSources} />

      <section className="border border-dashed border-gray-500 bg-white/80 p-4">
        <h3 className="text-sm font-black text-gray-900">확인된 사실 목록</h3>
        {result.facts.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">공식 출처에서 확인된 사실이 없습니다.</p>
        ) : (
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-gray-700">
            {result.facts.map((fact) => (
              <li key={fact}>{fact}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function AdminTopicDraftEditor({
  result,
  draft,
  onDraftChange,
  onStatusChange,
  approveDisabled,
  reviewMessage,
}: {
  result: SourcedTopicDraftResult;
  draft: SourcedTopicDraft | null;
  onDraftChange: <K extends keyof SourcedTopicDraft>(key: K, value: SourcedTopicDraft[K]) => void;
  onStatusChange: (status: TopicCardStatus) => void;
  approveDisabled: boolean;
  reviewMessage: string | null;
}) {
  if (!draft) return null;

  return (
    <section className="border border-dashed border-gray-500 bg-white/80 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-dashed border-gray-300 pb-3">
        <div>
          <h3 className="text-base font-black text-gray-950">AI 초안 및 관리자 수정 영역</h3>
          <p className="mt-1 text-xs leading-5 text-gray-500">
            2문장 이하 요약, 질문, 투표 선택지만 노출합니다. 기사 제목이나 기사 본문 문체는 쓰지 마세요.
          </p>
        </div>
        <span className="border border-dashed border-gray-300 bg-white px-2 py-1 text-xs font-bold text-gray-600">
          현재 {result.status}
        </span>
      </div>

      <div className="mt-4 grid gap-3">
        <label className="flex flex-col gap-1 text-xs font-bold text-gray-500">
          제목
          <input
            value={draft.title}
            onChange={(event) => onDraftChange("title", event.target.value)}
            className="h-10 border border-dashed border-gray-400 bg-white px-3 text-sm font-normal text-gray-900 outline-none focus:border-gray-800"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs font-bold text-gray-500">
          요약
          <textarea
            value={draft.summary}
            onChange={(event) => onDraftChange("summary", event.target.value)}
            rows={3}
            className="resize-none border border-dashed border-gray-400 bg-white px-3 py-2 text-sm font-normal leading-6 text-gray-900 outline-none focus:border-gray-800"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs font-bold text-gray-500">
          오늘의 질문
          <input
            value={draft.question}
            onChange={(event) => onDraftChange("question", event.target.value)}
            className="h-10 border border-dashed border-gray-400 bg-white px-3 text-sm font-normal text-gray-900 outline-none focus:border-gray-800"
          />
        </label>

        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold text-gray-500">투표 선택지</p>
            <button
              type="button"
              onClick={() => onDraftChange("pollOptions", [...draft.pollOptions, ""])}
              disabled={draft.pollOptions.length >= 6}
              className="inline-flex h-8 items-center gap-1 border border-dashed border-gray-400 bg-white px-2 text-xs font-bold text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-400"
            >
              <Plus size={12} />
              추가
            </button>
          </div>
          {draft.pollOptions.map((option, index) => (
            <div key={`${index}-${option}`} className="grid grid-cols-[1fr_auto] gap-2">
              <input
                value={option}
                onChange={(event) => {
                  const next = [...draft.pollOptions];
                  next[index] = event.target.value;
                  onDraftChange("pollOptions", next);
                }}
                className="h-10 border border-dashed border-gray-400 bg-white px-3 text-sm text-gray-900 outline-none focus:border-gray-800"
              />
              <button
                type="button"
                onClick={() =>
                  onDraftChange(
                    "pollOptions",
                    draft.pollOptions.filter((_, optionIndex) => optionIndex !== index),
                  )
                }
                disabled={draft.pollOptions.length <= 2}
                className="inline-flex h-10 w-10 items-center justify-center border border-dashed border-gray-400 bg-white text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-300"
                aria-label="선택지 삭제"
              >
                <X size={15} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {!result.officialSources.length ? (
        <p className="mt-4 border border-dashed border-red-300 bg-red-50 p-3 text-sm font-semibold leading-6 text-red-700">
          {NO_OFFICIAL_SOURCE_MESSAGE}
        </p>
      ) : null}

      {reviewMessage ? (
        <p className="mt-4 border border-dashed border-gray-300 bg-gray-50 p-3 text-sm font-semibold leading-6 text-gray-700">
          {reviewMessage}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-dashed border-gray-300 pt-4">
        <button
          type="button"
          onClick={() => onStatusChange("rejected")}
          className="inline-flex h-10 items-center border border-dashed border-red-300 bg-white px-4 text-sm font-bold text-red-600 hover:bg-red-50"
        >
          거절
        </button>
        <button
          type="button"
          onClick={() => onStatusChange("pending_review")}
          className="inline-flex h-10 items-center border border-dashed border-amber-300 bg-white px-4 text-sm font-bold text-amber-700 hover:bg-amber-50"
        >
          보류
        </button>
        <button
          type="button"
          onClick={() => onStatusChange("approved")}
          disabled={approveDisabled}
          className="inline-flex h-10 items-center border border-dashed border-gray-700 bg-gray-900 px-4 text-sm font-bold text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:border-gray-300 disabled:bg-gray-300"
        >
          승인
        </button>
      </div>
    </section>
  );
}

function SourceList({
  title,
  badgeLabel,
  badgeType,
  sources,
}: {
  title: string;
  badgeLabel: string;
  badgeType: SourceItem["sourceType"];
  sources: SourceItem[];
}) {
  return (
    <section className="border border-dashed border-gray-500 bg-white/80 p-4">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-black text-gray-900">{title}</h3>
        <SourceBadge type={badgeType} label={badgeLabel} />
      </div>
      {sources.length === 0 ? (
        <p className="mt-3 text-sm text-gray-500">없음</p>
      ) : (
        <div className="mt-3 grid gap-2">
          {sources.map((source) => (
            <a
              key={`${title}-${source.url}`}
              href={source.url}
              target="_blank"
              rel="noreferrer"
              className="flex min-w-0 items-center gap-2 border border-dashed border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50"
            >
              <span className="min-w-0 flex-1 truncate">{source.title}</span>
              <ExternalLink size={14} className="shrink-0" />
            </a>
          ))}
        </div>
      )}
    </section>
  );
}

function InfoRow({ label, value, isUrl = false }: { label: string; value: string; isUrl?: boolean }) {
  return (
    <div className="grid gap-1">
      <dt className="text-xs font-bold text-gray-500">{label}</dt>
      <dd className="min-w-0 text-sm font-semibold text-gray-900">
        {isUrl ? (
          <a href={value} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1 text-blue-600 hover:underline">
            <span className="truncate">{value}</span>
            <ExternalLink size={13} className="shrink-0" />
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}
