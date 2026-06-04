"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { POST_MEDIA_QUARANTINE_BUCKET } from "@/lib/supabase/postMediaAssets";

type MediaAssetRow = {
  id: string;
  created_at: string;
  uploaded_by: string;
  bucket_id: string;
  object_path: string;
  source: string;
  original_name: string | null;
  mime_type: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  scan_status: string;
  risk_level: string;
  public_url: string | null;
  rejected_reason: string | null;
};

type MediaAssetWithPreview = MediaAssetRow & {
  previewUrl: string | null;
};

function publicExtension(row: MediaAssetRow) {
  const fromPath = row.object_path.split(".").pop()?.toLowerCase();
  if (fromPath && /^[a-z0-9]+$/.test(fromPath)) return fromPath;
  if (row.mime_type === "image/png") return "png";
  if (row.mime_type === "image/webp") return "webp";
  if (row.mime_type === "image/gif") return "gif";
  return "jpg";
}

export default function AdminMediaReviewPage() {
  const [assets, setAssets] = useState<MediaAssetWithPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error: queryError } = await supabase
      .from("post_media_assets")
      .select(
        "id, created_at, uploaded_by, bucket_id, object_path, source, original_name, mime_type, size_bytes, width, height, scan_status, risk_level, public_url, rejected_reason",
      )
      .eq("scan_status", "needs_review")
      .order("created_at", { ascending: true })
      .limit(50);

    if (queryError) {
      setError(queryError.message);
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as MediaAssetRow[];
    const withPreview = await Promise.all(
      rows.map(async (row) => {
        const { data: signed } = await supabase.storage
          .from(row.bucket_id)
          .createSignedUrl(row.object_path, 60 * 10);
        return { ...row, previewUrl: signed?.signedUrl ?? null };
      }),
    );

    setAssets(withPreview);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function approveAsset(row: MediaAssetWithPreview) {
    setSavingId(row.id);
    setError(null);
    try {
      const { data: signed, error: signedError } = await supabase.storage
        .from(row.bucket_id)
        .createSignedUrl(row.object_path, 60 * 5);
      if (signedError || !signed?.signedUrl) throw signedError ?? new Error("원본 이미지를 열 수 없습니다.");

      const response = await fetch(signed.signedUrl);
      if (!response.ok) throw new Error("원본 이미지를 다운로드하지 못했습니다.");
      const blob = await response.blob();
      const publicPath = `approved/${row.id}.${publicExtension(row)}`;

      const { error: uploadError } = await supabase.storage
        .from("post-assets")
        .upload(publicPath, blob, { contentType: row.mime_type, upsert: false });
      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("post-assets").getPublicUrl(publicPath);

      const { error: updateError } = await supabase
        .from("post_media_assets")
        .update({
          scan_status: "approved",
          risk_level: "safe",
          public_url: publicUrl,
          reviewed_at: new Date().toISOString(),
          rejected_reason: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      if (updateError) throw updateError;

      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "승인 처리에 실패했습니다.");
    } finally {
      setSavingId(null);
    }
  }

  async function rejectAsset(row: MediaAssetWithPreview) {
    const reason = window.prompt("반려 사유를 입력해 주세요.", "게시판 이미지 정책 위반");
    if (!reason) return;

    setSavingId(row.id);
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from("post_media_assets")
        .update({
          scan_status: "rejected",
          risk_level: "blocked",
          rejected_reason: reason,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      if (updateError) throw updateError;

      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "반려 처리에 실패했습니다.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <main className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-bold">이미지 예외 검수</h1>
        <p className="mt-1 text-sm text-gray-500">
          자동 검사에서 needs_review로 분류된 이미지만 확인합니다. 일반 업로드는 먼저{" "}
          {POST_MEDIA_QUARANTINE_BUCKET} 비공개 버킷에 저장됩니다.
        </p>
      </header>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-gray-500">예외 검수 {assets.length}건</p>
        <button
          type="button"
          onClick={() => void load()}
          className="border border-dashed border-gray-500 bg-white px-3 py-2 text-sm hover:bg-gray-100"
        >
          새로고침
        </button>
      </div>

      {error ? <p className="border border-dashed border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      {loading ? (
        <p className="text-sm text-gray-500">불러오는 중...</p>
      ) : assets.length === 0 ? (
        <p className="border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-500">
          예외 검수 대상 이미지가 없습니다.
        </p>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {assets.map((row) => (
            <li key={row.id} className="border border-dashed border-gray-400 bg-white p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{row.original_name ?? row.object_path}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    {row.source} · {row.mime_type} · {Math.round(row.size_bytes / 1024)}KB
                    {row.width && row.height ? ` · ${row.width}x${row.height}` : ""}
                  </p>
                  <p className="mt-1 font-mono text-[10px] text-gray-400">{row.id}</p>
                </div>
                <span className="shrink-0 rounded bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
                  {row.scan_status}
                </span>
              </div>

              <div className="flex min-h-60 items-center justify-center overflow-hidden border border-dashed border-gray-300 bg-gray-50">
                {row.previewUrl ? (
                  <img src={row.previewUrl} alt={row.original_name ?? "검수 이미지"} className="max-h-[360px] max-w-full object-contain" />
                ) : (
                  <p className="text-sm text-gray-500">미리보기를 만들 수 없습니다.</p>
                )}
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  disabled={savingId === row.id}
                  onClick={() => void approveAsset(row)}
                  className="border border-dashed border-gray-500 bg-gray-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  승인
                </button>
                <button
                  type="button"
                  disabled={savingId === row.id}
                  onClick={() => void rejectAsset(row)}
                  className="border border-dashed border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 disabled:opacity-50"
                >
                  반려
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
