"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Download, Pencil, Plus, RotateCcw, Share2, Sparkles, X } from "lucide-react";
import type { OshiAnalysisCharacter, OshiAnalysisWork } from "@/lib/supabase/oshiAnalysis";
import type {
  DangerGauge,
  HexStat,
  OshiAnalysisResult,
  PartyJudgment,
  Resonance,
} from "@/lib/oshiAnalysis";
import { resolveImageSrc } from "@/lib/imageDataUrl";
import { catalogRequestPath } from "@/lib/catalogRequest";

const MAX_SELECT = 10;
const REQUEST_CTX = {
  from: "oshi-analysis" as const,
  returnTo: "/play/oshi-analysis",
};

const NARRATIVE_ICON: Record<string, string> = {
  pain: "💔",
  devotion: "💗",
  brain: "🧠",
  power: "⚡",
  chaos: "🔥",
  moe: "✨",
};

function NoDragImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      draggable={false}
      onDragStart={(event) => event.preventDefault()}
      className={className}
    />
  );
}

function ResultAvatarButton({
  name,
  src,
  onClick,
  size = 56,
}: {
  name: string;
  src: string | null;
  onClick: () => void;
  size?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-w-0 shrink-0 flex-col items-center text-center transition hover:opacity-80"
      aria-label={`${name} 정보 보기`}
    >
      <div
        className="overflow-hidden rounded-full border-2 border-gray-900 bg-gray-100 ring-offset-2 hover:ring-2 hover:ring-gray-400"
        style={{ width: size, height: size }}
      >
        {src ? (
          <NoDragImage
            src={src}
            alt={name}
            className="pointer-events-none h-full w-full object-cover object-top"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="text-[10px] font-bold text-gray-400">?</span>
          </div>
        )}
      </div>
      <span className="mt-1 line-clamp-2 w-full max-w-[4.5rem] text-[9px] font-black leading-tight text-gray-800">
        {name}
      </span>
    </button>
  );
}

function RadarChart({ stats, size = 220 }: { stats: HexStat[]; size?: number }) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.34;
  const n = stats.length;
  const angleAt = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const pointAt = (i: number, r: number) => {
    const a = angleAt(i);
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
  };
  const gridLevels = [0.25, 0.5, 0.75, 1];
  const gridPolys = gridLevels.map((level) =>
    stats.map((_, i) => pointAt(i, radius * level).join(",")).join(" "),
  );
  const valuePoly = stats
    .map((s, i) => pointAt(i, radius * Math.max(0.06, s.value / 100)).join(","))
    .join(" ");

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="mx-auto block">
      {gridPolys.map((poly, idx) => (
        <polygon key={idx} points={poly} fill="none" stroke="#e5e7eb" strokeWidth={1} />
      ))}
      {stats.map((_, i) => {
        const [x, y] = pointAt(i, radius);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#e5e7eb" strokeWidth={1} />;
      })}
      <polygon points={valuePoly} fill="rgba(17,24,39,0.12)" stroke="#111827" strokeWidth={2} />
      {stats.map((s, i) => {
        const [x, y] = pointAt(i, radius * Math.max(0.06, s.value / 100));
        return <circle key={i} cx={x} cy={y} r={3} fill="#111827" />;
      })}
      {stats.map((s, i) => {
        const [lx, ly] = pointAt(i, radius + 18);
        const anchor = Math.abs(lx - cx) < 4 ? "middle" : lx > cx ? "start" : "end";
        return (
          <g key={i}>
            <text
              x={lx}
              y={ly - 2}
              textAnchor={anchor}
              className="fill-gray-900"
              style={{ fontSize: 11, fontWeight: 800 }}
            >
              {s.label}
            </text>
            <text
              x={lx}
              y={ly + 10}
              textAnchor={anchor}
              className="fill-gray-400"
              style={{ fontSize: 10, fontWeight: 700 }}
            >
              {s.value}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function buildPositionDistribution(chars: OshiAnalysisCharacter[]) {
  const counts = new Map<string, number>();
  for (const c of chars) {
    for (const p of c.positions ?? []) {
      counts.set(p, (counts.get(p) ?? 0) + 1);
    }
  }
  const entries = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, n]) => sum + n, 0) || chars.length || 1;
  return entries.slice(0, 5).map(([label, count]) => ({
    label,
    pct: Math.round((count / total) * 100),
  }));
}

function formatAnalyzedAt(date: Date | null) {
  if (!date) return "—";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${y}.${m}.${d} ${h}:${min}`;
}

function CharacterSilhouette() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-gray-100">
      <svg viewBox="0 0 60 80" className="h-3/4 w-3/4 fill-gray-300">
        <circle cx="30" cy="22" r="14" />
        <path d="M6 75 Q6 50 30 50 Q54 50 54 75Z" />
      </svg>
    </div>
  );
}

function SelectedCharacterCard({
  char,
  imageDataUrls,
}: {
  char: OshiAnalysisCharacter;
  imageDataUrls: Record<string, string>;
}) {
  const topTags = [...(char.tags ?? []), ...(char.meme_tags ?? [])].slice(0, 6);
  const imageSrc = resolveImageSrc(char.profile_image_url, imageDataUrls);

  return (
    <article className="flex flex-col border border-dashed border-gray-300 bg-white">
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-gray-100">
        {imageSrc ? (
          <NoDragImage
            src={imageSrc}
            alt={char.name}
            className="pointer-events-none h-full w-full object-cover object-top"
          />
        ) : (
          <CharacterSilhouette />
        )}
      </div>
      <div className="flex flex-1 flex-col p-2">
        <p className="truncate text-xs font-black text-gray-900">{char.name}</p>
        <p className="truncate text-[10px] font-bold text-gray-500">{char.official_works.title}</p>
        {topTags.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {topTags.map((tag) => (
              <span
                key={tag}
                className="border border-dashed border-gray-300 px-1 py-0.5 text-[9px] font-bold text-gray-500"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
        <Link
          href={catalogRequestPath("character-edit", {
            id: char.id,
            from: REQUEST_CTX.from,
            returnTo: REQUEST_CTX.returnTo,
          })}
          className="mt-2 inline-flex w-full items-center justify-center gap-1 border border-dashed border-gray-400 px-2 py-1.5 text-[10px] font-bold text-gray-700 hover:bg-gray-50"
        >
          <Pencil size={11} />
          내용·태그 수정 요청
        </Link>
      </div>
    </article>
  );
}

function CharacterDetailModal({
  char,
  imageDataUrls,
  onClose,
}: {
  char: OshiAnalysisCharacter;
  imageDataUrls: Record<string, string>;
  onClose: () => void;
}) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[10050] flex items-center justify-center overflow-x-hidden bg-black/55 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-[280px] min-w-0 flex-col overflow-hidden border border-dashed border-gray-500 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${char.name} 정보`}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-dashed border-gray-300 px-3 py-2">
          <p className="text-xs font-black text-gray-900">선택한 최애</p>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center text-gray-500 hover:bg-gray-100"
            aria-label="닫기"
          >
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto p-3">
          <SelectedCharacterCard char={char} imageDataUrls={imageDataUrls} />
        </div>
      </div>
    </div>,
    document.body,
  );
}

function LayoutCard({
  title,
  children,
  action,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`flex min-h-0 flex-col border border-dashed border-gray-400 bg-white p-4 ${className}`}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-xs font-black text-gray-900">{title}</h3>
        {action}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}

export default function OshiAnalysisResultLayout({
  result,
  selected,
  resonance,
  partyJudgment,
  dangerGauges,
  recommendations,
  recommendedWorks,
  imageDataUrls,
  analyzedAt,
  busy,
  copied = false,
  onShare,
  onDownload,
  onReselect,
  onReset,
}: {
  result: OshiAnalysisResult;
  selected: OshiAnalysisCharacter[];
  resonance: Resonance | null;
  partyJudgment: PartyJudgment | null;
  dangerGauges: DangerGauge[];
  recommendations: OshiAnalysisCharacter[];
  recommendedWorks: OshiAnalysisWork[];
  imageDataUrls: Record<string, string>;
  analyzedAt: Date | null;
  busy: boolean;
  copied?: boolean;
  onShare: () => void;
  onDownload: () => void;
  onReselect: () => void;
  onReset: () => void;
}) {
  const heroChar = selected[0];
  const heroSrc = heroChar
    ? resolveImageSrc(heroChar.profile_image_url, imageDataUrls)
    : null;
  const positionDist = buildPositionDistribution(selected);
  const coreStats =
    dangerGauges.length > 0
      ? dangerGauges.map((g) => ({ label: g.label, value: g.value }))
      : [...result.hexStats].sort((a, b) => b.value - a.value).slice(0, 6);
  const keywords = [
    ...result.signatureTags.map((s) => s.tag),
    ...(resonance?.items.map((i) => i.tag) ?? []),
  ].filter((tag, i, arr) => arr.indexOf(tag) === i);
  const visibleKeywords = keywords.slice(0, 12);
  const narrativeStats = [...result.hexStats].sort((a, b) => b.value - a.value);
  const typeTags = result.signatureTags.slice(0, 4).map((s) => s.tag);
  const canSelectMore = selected.length < MAX_SELECT;
  const [detailChar, setDetailChar] = useState<OshiAnalysisCharacter | null>(null);

  const closeDetail = useCallback(() => setDetailChar(null), []);

  useEffect(() => {
    if (!detailChar) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDetail();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [detailChar, closeDetail]);

  return (
    <div className="flex w-full flex-col gap-4 lg:gap-5">
      {/* 1. Hero */}
      <section className="grid gap-4 border border-dashed border-gray-500 bg-white p-5 lg:grid-cols-[minmax(0,1fr)_minmax(160px,240px)_auto] lg:items-start">
        <div className="min-w-0">
          <Link href="/play" className="text-xs font-bold text-gray-500 hover:underline">
            바이럴 허브로 돌아가기
          </Link>
          <h1 className="mt-3 flex items-center gap-2 text-2xl font-black text-gray-900 lg:text-3xl">
            <Sparkles size={22} className="shrink-0 text-gray-400" />
            취향 분석 결과
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-gray-600">
            선택한 최애 캐릭터를 바탕으로 당신의 취향을 분석했어요.
          </p>

          <div className="mt-4 border-t border-dashed border-gray-200 pt-4">
            <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">
              당신은 이런 타입!
            </p>
            <h2 className="mt-1 text-xl font-black text-gray-900 lg:text-2xl">{result.typeName}</h2>
            <p className="mt-2 max-w-xl whitespace-pre-line text-sm leading-6 text-gray-600">
              {result.summary}
            </p>
            {typeTags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {typeTags.map((tag) => (
                  <span
                    key={tag}
                    className="border border-dashed border-gray-400 bg-gray-50 px-2 py-0.5 text-[10px] font-bold text-gray-700"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="relative mx-auto aspect-[3/4] w-full max-w-[240px] overflow-hidden border border-dashed border-gray-300 bg-gray-100 lg:mx-0 lg:justify-self-end">
          {heroSrc ? (
            <NoDragImage
              src={heroSrc}
              alt={heroChar?.name ?? ""}
              className="pointer-events-none h-full w-full object-cover object-top"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs font-bold text-gray-400">
              대표 캐릭터
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 lg:min-w-[168px] lg:items-stretch">
          <p className="text-[10px] font-bold text-gray-500">
            분석 일시 {formatAnalyzedAt(analyzedAt)}
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={onShare}
            className="inline-flex items-center justify-center gap-2 border border-dashed border-gray-700 bg-gray-900 px-4 py-2.5 text-sm font-black text-white hover:bg-gray-800 disabled:opacity-50"
          >
            <Share2 size={16} />
            {copied ? "링크 복사됨" : "공유하기"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onDownload}
            className="inline-flex items-center justify-center gap-2 border border-dashed border-pink-500 bg-pink-50 px-4 py-2.5 text-sm font-black text-pink-700 hover:bg-pink-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download size={16} />
            이미지 저장
          </button>
          <button
            type="button"
            onClick={onReselect}
            className="inline-flex items-center justify-center border border-dashed border-gray-400 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50"
          >
            다시 선택하기
          </button>
        </div>
      </section>

      {/* 2. 선택한 최애 */}
      <LayoutCard
        title={`선택한 최애 (${selected.length}/${MAX_SELECT})`}
        action={
          <span className="text-[10px] font-bold text-gray-500">
            캐릭터 상세보기
          </span>
        }
      >
        <div className="flex flex-wrap items-start gap-3">
          {selected.map((char) => (
            <ResultAvatarButton
              key={char.id}
              name={char.name}
              src={resolveImageSrc(char.profile_image_url, imageDataUrls)}
              onClick={() => setDetailChar(char)}
            />
          ))}
          {canSelectMore && (
            <button
              type="button"
              onClick={onReselect}
              className="flex shrink-0 flex-col items-center gap-1"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed border-gray-400 bg-gray-50 text-gray-600">
                <Plus size={20} />
              </span>
              <span className="text-[9px] font-bold text-gray-500">더 선택하기</span>
            </button>
          )}
        </div>
      </LayoutCard>

      {detailChar && (
        <CharacterDetailModal
          char={detailChar}
          imageDataUrls={imageDataUrls}
          onClose={closeDetail}
        />
      )}

      {/* 3. 중단 3열 */}
      <section className="grid gap-4 lg:grid-cols-3">
        <LayoutCard title="취향 레이더">
          <RadarChart stats={result.hexStats} />
          <p className="mt-1 text-center text-[10px] font-bold text-gray-400">
            전체 평균 = 50 · 높을수록 그 취향에 쏠림
          </p>
        </LayoutCard>

        <LayoutCard title="핵심 성향">
          <ul className="flex flex-col gap-3">
            {coreStats.map((item) => (
              <li key={item.label}>
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <span className="text-xs font-bold text-gray-700">{item.label}</span>
                  <span className="text-xs font-black text-gray-900">{item.value}%</span>
                </div>
                <div className="h-2 bg-gray-100">
                  <div
                    className="h-full bg-gray-900"
                    style={{ width: `${Math.min(100, item.value)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </LayoutCard>

        <LayoutCard
          title="선호 키워드"
          action={
            keywords.length > visibleKeywords.length ? (
              <span className="text-[10px] font-bold text-gray-500">
                + {keywords.length - visibleKeywords.length}개 더
              </span>
            ) : undefined
          }
        >
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {visibleKeywords.map((tag) => (
              <span
                key={tag}
                className="flex items-center justify-center border border-dashed border-gray-300 px-2 py-2 text-center text-[10px] font-bold text-gray-700"
              >
                {tag}
              </span>
            ))}
          </div>
        </LayoutCard>
      </section>

      {/* 4. 하단 2열 */}
      <section className="grid gap-4 lg:grid-cols-2">
        <LayoutCard title="캐릭터 분포">
          {positionDist.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] sm:items-center">
              <div
                className="mx-auto flex h-32 w-32 items-center justify-center rounded-full border-4 border-dashed border-gray-300 text-center text-xs font-black text-gray-500"
                aria-hidden
              >
                포지션
                <br />
                분포
              </div>
              <ul className="flex flex-col gap-2">
                {positionDist.map((item) => (
                  <li key={item.label} className="flex items-center gap-2 text-xs">
                    <span className="w-20 shrink-0 font-bold text-gray-700">{item.label}</span>
                    <div className="h-2 flex-1 bg-gray-100">
                      <div className="h-full bg-gray-700" style={{ width: `${item.pct}%` }} />
                    </div>
                    <span className="w-10 text-right font-black text-gray-900">{item.pct}%</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-xs text-gray-500">포지션 태그가 있는 캐릭터가 없습니다.</p>
          )}
        </LayoutCard>

        <LayoutCard title="선호 서사 유형">
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
            {narrativeStats.map((stat) => (
              <div key={stat.key} className="flex flex-col items-center text-center">
                <span className="text-2xl leading-none" aria-hidden>
                  {NARRATIVE_ICON[stat.key] ?? "📖"}
                </span>
                <span className="mt-1 text-[10px] font-bold text-gray-700">{stat.label}</span>
                <span className="text-xs font-black text-gray-900">{stat.value}%</span>
              </div>
            ))}
          </div>
          {partyJudgment?.verdict && (
            <p className="mt-3 border-l-2 border-gray-900 pl-2 text-[11px] font-bold text-gray-600">
              {partyJudgment.verdict}
            </p>
          )}
        </LayoutCard>
      </section>

      {/* 5. 추천 2열 */}
      <section className="grid gap-4 lg:grid-cols-2">
        <LayoutCard
          title="추천 캐릭터"
          action={
            <Link href="/play" className="text-[10px] font-bold text-gray-500 hover:underline">
              더 보기 &gt;
            </Link>
          }
        >
          {recommendations.length > 0 ? (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
              {recommendations.map((char) => (
                <article key={char.id} className="flex min-w-0 flex-col items-center text-center">
                  <div className="aspect-[3/4] w-full overflow-hidden border border-dashed border-gray-300 bg-gray-100">
                    {char.profile_image_url ? (
                      <NoDragImage
                        src={resolveImageSrc(char.profile_image_url, imageDataUrls) ?? ""}
                        alt={char.name}
                        className="pointer-events-none h-full w-full object-cover object-top"
                      />
                    ) : null}
                  </div>
                  <p className="mt-1 truncate text-xs font-black text-gray-900">{char.name}</p>
                  <p className="line-clamp-2 text-[9px] font-bold text-gray-500">
                    {char.official_works.title}
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-500">추천 캐릭터를 불러오는 중이거나 없습니다.</p>
          )}
        </LayoutCard>

        <LayoutCard
          title="추천 작품"
          action={
            <Link href="/play" className="text-[10px] font-bold text-gray-500 hover:underline">
              더 보기 &gt;
            </Link>
          }
        >
          {recommendedWorks.length > 0 ? (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
              {recommendedWorks.map((work) => (
                <article key={work.id} className="flex min-w-0 flex-col">
                  <div className="aspect-[3/4] w-full overflow-hidden border border-dashed border-gray-300 bg-gray-100">
                    {work.cover_image_url ? (
                      <NoDragImage
                        src={work.cover_image_url}
                        alt={work.title}
                        className="pointer-events-none h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <p className="mt-1 truncate text-xs font-black text-gray-900">{work.title}</p>
                  {work.genres?.[0] && (
                    <p className="truncate text-[9px] font-bold text-gray-500">{work.genres[0]}</p>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-500">
              취향 태그와 맞는 작품을 불러오는 중이거나 없습니다.
            </p>
          )}
        </LayoutCard>
      </section>

      {/* 6. 하단 CTA */}
      <section className="flex flex-col gap-3">
        <Link
          href="/play"
          className="flex w-full items-center justify-center gap-2 border border-dashed border-gray-700 bg-gray-900 px-4 py-4 text-sm font-black text-white hover:bg-gray-800"
        >
          추천 더 보기 ✨
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10px] text-gray-400">{result.confidenceLabel}</p>
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1 text-[10px] font-bold text-gray-500 hover:text-gray-800"
          >
            <RotateCcw size={12} />
            처음부터
          </button>
        </div>
      </section>

      {result.confidence < 50 && (
        <section className="border border-dashed border-red-300 bg-red-50 p-4">
          <p className="text-xs font-bold text-red-700">
            선택한 캐릭터 중 태그가 부족한 캐릭터가 많습니다. 최애 목록에서 캐릭터를 눌러
            수정 요청으로 분석 정확도를 높일 수 있습니다.
          </p>
        </section>
      )}
    </div>
  );
}
