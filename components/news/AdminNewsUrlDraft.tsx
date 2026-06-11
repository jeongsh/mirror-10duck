"use client";

import { ArrowDownToLine, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import type { NewsFormState } from "@/components/news/AdminNewsForm";
import type { NewsSourceDraftResult } from "@/lib/news/newsDraft";
import { buildNewsEditorBodyJson } from "@/lib/news/newsDraft";
import { supabase } from "@/lib/supabase/client";

type DraftResponse = {
  ok?: boolean;
  result?: NewsSourceDraftResult;
  error?: string;
};

export default function AdminNewsUrlDraft({
  onApply,
}: {
  onApply: (draft: NewsSourceDraftResult) => void;
}) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<NewsSourceDraftResult | null>(null);

  async function getAccessToken(): Promise<string | null> {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setResult(null);

    const token = await getAccessToken();
    if (!token) {
      setError("로그인이 필요합니다.");
      setLoading(false);
      return;
    }

    const response = await fetch("/api/admin/news/source-draft", {
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
    }

    setLoading(false);
  }

  function handleApply() {
    if (!result) return;
    onApply(result);
  }

  return (
    <section className="flex min-w-0 w-full flex-col gap-4 overflow-hidden rounded border border-dashed border-violet-400 bg-violet-50/50 p-4">
      <div>
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-violet-700" />
          <h3 className="text-sm font-black text-gray-900">URL에서 뉴스 초안 생성</h3>
        </div>
        <p className="mt-1 text-xs leading-5 text-gray-600">
          영문 뉴스 URL을 넣으면 나무위키 기준으로 작품·캐릭터·닉네임을 확인한 뒤 요약·재구성한 초안을 만듭니다.
        </p>
      </div>

      <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <label className="flex min-w-0 flex-col gap-1 text-xs font-bold text-gray-500">
          참고 뉴스 URL
          <input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://www.animenewsnetwork.com/news/..."
            className="h-11 min-w-0 w-full rounded border border-dashed border-gray-400 bg-white px-3 text-sm font-normal text-gray-900 outline-none focus:border-gray-800"
          />
        </label>
        <button
          type="button"
          onClick={() => void handleGenerate()}
          disabled={loading || !url.trim()}
          className="inline-flex h-11 items-center justify-center gap-2 rounded border border-dashed border-violet-700 bg-violet-700 px-4 text-sm font-bold text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:bg-gray-400"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {loading ? "나무위키 검색 중..." : "AI 초안 생성"}
        </button>
      </div>

      {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}

      {result ? (
        <div className="grid min-w-0 gap-4 overflow-hidden rounded border border-dashed border-gray-400 bg-white p-4">
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-gray-500">감지된 주제</p>
              <p className="mt-1 break-words text-sm font-semibold text-gray-900">{result.detectedTopic}</p>
            </div>
            <button
              type="button"
              onClick={handleApply}
              className="inline-flex h-9 items-center gap-1 rounded border border-dashed border-gray-700 bg-gray-900 px-3 text-xs font-bold text-white hover:bg-gray-700"
            >
              <ArrowDownToLine size={14} />
              폼에 적용
            </button>
          </div>

          {result.nameMappings.length > 0 ? (
            <div className="min-w-0">
              <p className="text-xs font-bold text-gray-500">이름 치환 목록 (나무위키 기준)</p>
              <div className="mt-2 grid min-w-0 gap-2">
                {result.nameMappings.map((mapping) => (
                  <div
                    key={`${mapping.original}-${mapping.koreanOfficial}`}
                    className="flex min-w-0 flex-col gap-1 rounded border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-xs sm:flex-row sm:items-center sm:gap-3"
                  >
                    <span className="min-w-0 flex-1 break-words font-semibold text-gray-700">
                      {mapping.original}
                    </span>
                    <span className="shrink-0 text-gray-400">
                      {mapping.type}
                      {mapping.namuwikiMatched
                        ? " · 나무위키"
                        : mapping.catalogMatched
                          ? " · 카탈로그"
                          : " · 미확인"}
                    </span>
                    <span className="min-w-0 flex-1 break-words font-bold text-violet-700 sm:text-right">
                      {mapping.koreanOfficial}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <PreviewField label="제목" value={result.title} />
          <PreviewField label="요약" value={result.summary} />
          <PreviewField label="본문" value={result.body} multiline />
          {result.tags.length > 0 ? (
            <PreviewField label="태그" value={result.tags.join(", ")} />
          ) : null}
          {result.notes ? <PreviewField label="메모" value={result.notes} /> : null}
        </div>
      ) : null}
    </section>
  );
}

function PreviewField({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-bold text-gray-500">{label}</p>
      <p
        className={`mt-1 break-words text-sm text-gray-800 ${multiline ? "whitespace-pre-wrap leading-6" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}

export function applyNewsDraftToForm(
  draft: NewsSourceDraftResult,
  setForm: React.Dispatch<React.SetStateAction<NewsFormState>>,
) {
  setForm((prev) => ({
    ...prev,
    category: draft.category,
    title: draft.title,
    summary: draft.summary,
    body: buildNewsEditorBodyJson(draft.body),
    tags: draft.tags.join(", "),
  }));
}
