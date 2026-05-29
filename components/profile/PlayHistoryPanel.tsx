"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { fetchLatestOshiAnalysisResult } from "@/lib/supabase/oshiAnalysisResults";
import { fetchOtakuTypeResults, type OtakuTypeResultRow } from "@/lib/supabase/otakuTypeResults";
import { fetchOshiCardSharesForUser, type OshiCardShare } from "@/lib/supabase/oshiCardShares";
import type { OshiAnalysisResultRow } from "@/lib/supabase/oshiAnalysisResults";

type PlayHistoryPanelProps = {
  userId: string;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function EmptyBlock({ message, href, linkLabel }: { message: string; href: string; linkLabel: string }) {
  return (
    <div className="border border-dashed border-gray-300 bg-gray-50/60 px-4 py-6 text-center">
      <p className="text-sm text-gray-500 mb-3">{message}</p>
      <Link
        href={href}
        className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-gray-700 hover:text-gray-900"
      >
        {linkLabel}
        <ChevronRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

function OtakuTypeCard({ row }: { row: OtakuTypeResultRow }) {
  const href = row.test_version === "v2" ? "/play/otaku-type/v2" : "/play/otaku-type";
  const versionLabel = row.test_version === "v2" ? "v2 · 장르형" : "v1 · 8유형";

  return (
    <Link
      href={href}
      className="group block border border-dashed border-gray-400 bg-white p-4 transition-colors hover:border-gray-700"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">
            {versionLabel}
          </p>
          <p className="text-base font-bold text-gray-900">{row.result_title}</p>
          {row.result_badge && (
            <p className="text-xs text-gray-500 mt-1">{row.result_badge}</p>
          )}
          {row.tier_name && (
            <p className="text-[11px] text-gray-400 mt-1">오타쿠력 · {row.tier_name}</p>
          )}
        </div>
        <span className="text-[10px] text-gray-400 shrink-0">{formatDate(row.updated_at)}</span>
      </div>
      <p className="mt-3 text-[11px] font-bold text-gray-500 group-hover:text-gray-800">
        다시 하기 →
      </p>
    </Link>
  );
}

function OshiCardShareItem({ share }: { share: OshiCardShare }) {
  const thumb = share.og_image_url ?? share.oshi_avatar_url ?? share.background_image_url;
  const daysLeft = Math.max(
    0,
    Math.ceil((new Date(share.expires_at).getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
  );

  return (
    <Link
      href={`/play/oshi-card/view/${share.id}`}
      className="group flex flex-col border border-dashed border-gray-400 bg-white overflow-hidden transition-colors hover:border-gray-700"
    >
      <div className="aspect-[734/1024] bg-gray-100 relative">
        {thumb ? (
          <img src={thumb} alt={share.oshi ?? "최애 카드"} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-[10px] text-gray-400">NO IMAGE</div>
        )}
      </div>
      <div className="p-3 space-y-1">
        <p className="text-sm font-bold text-gray-900 truncate">{share.oshi ?? "최애 카드"}</p>
        <p className="text-[10px] text-gray-400">
          {formatDate(share.created_at)} · D-{daysLeft}
        </p>
      </div>
    </Link>
  );
}

export default function PlayHistoryPanel({ userId }: PlayHistoryPanelProps) {
  const [loading, setLoading] = useState(true);
  const [oshiAnalysis, setOshiAnalysis] = useState<OshiAnalysisResultRow | null>(null);
  const [otakuTypes, setOtakuTypes] = useState<OtakuTypeResultRow[]>([]);
  const [cardShares, setCardShares] = useState<OshiCardShare[]>([]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setLoading(true);
      try {
        const [analysis, types, shares] = await Promise.all([
          fetchLatestOshiAnalysisResult(userId),
          fetchOtakuTypeResults(userId),
          fetchOshiCardSharesForUser(userId, 5),
        ]);
        if (cancelled) return;
        setOshiAnalysis(analysis);
        setOtakuTypes(types);
        setCardShares(shares);
      } catch (error) {
        console.error("[PlayHistoryPanel]", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (loading) {
    return <p className="text-sm text-gray-400 py-8 text-center">놀이 기록 불러오는 중...</p>;
  }

  return (
    <div className="space-y-10">
      <section>
        <div className="flex items-end justify-between border-b border-dashed border-gray-300 pb-2 mb-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500">최애 취향분석</h3>
          <Link href="/play/oshi-analysis" className="text-[10px] font-bold text-gray-400 hover:text-gray-700">
            분석하기
          </Link>
        </div>
        {oshiAnalysis ? (
          <Link
            href="/play/oshi-analysis"
            className="group block border border-dashed border-gray-400 bg-white p-5 transition-colors hover:border-gray-700"
          >
            <p className="text-lg font-bold text-gray-900">{oshiAnalysis.result_title}</p>
            <p className="text-sm text-gray-600 mt-2 line-clamp-2">{oshiAnalysis.result_summary}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {oshiAnalysis.signature_tags.slice(0, 4).map((tag) => (
                <span
                  key={tag.tag}
                  className="border border-dashed border-gray-300 px-2 py-0.5 text-[10px] font-bold text-gray-600"
                >
                  {tag.tag} ×{tag.multiplier.toFixed(1)}
                </span>
              ))}
            </div>
            <p className="mt-4 text-[11px] text-gray-400">
              {formatDate(oshiAnalysis.created_at)} · 신뢰도 {oshiAnalysis.confidence}% · 최애 {oshiAnalysis.selected_count}명
            </p>
          </Link>
        ) : (
          <EmptyBlock
            message="아직 저장된 취향분석 결과가 없어요."
            href="/play/oshi-analysis"
            linkLabel="최애 취향분석 하러 가기"
          />
        )}
      </section>

      <section>
        <div className="flex items-end justify-between border-b border-dashed border-gray-300 pb-2 mb-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500">오타쿠 성향 테스트</h3>
        </div>
        {otakuTypes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {otakuTypes.map((row) => (
              <OtakuTypeCard key={row.test_version} row={row} />
            ))}
          </div>
        ) : (
          <EmptyBlock
            message="아직 저장된 성향 테스트 결과가 없어요."
            href="/play/otaku-type"
            linkLabel="성향 테스트 하러 가기"
          />
        )}
      </section>

      <section>
        <div className="flex items-end justify-between border-b border-dashed border-gray-300 pb-2 mb-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500">최애 카드 (30일 보관)</h3>
          <Link href="/play/oshi-card" className="text-[10px] font-bold text-gray-400 hover:text-gray-700">
            카드 만들기
          </Link>
        </div>
        {cardShares.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {cardShares.map((share) => (
              <OshiCardShareItem key={share.id} share={share} />
            ))}
          </div>
        ) : (
          <EmptyBlock
            message="로그인 후 만든 최애 카드가 여기에 표시됩니다."
            href="/play/oshi-card"
            linkLabel="최애 카드 만들기"
          />
        )}
      </section>
    </div>
  );
}
