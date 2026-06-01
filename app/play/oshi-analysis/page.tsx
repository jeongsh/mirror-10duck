"use client";

import { Suspense, useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { X, Download, Search, ChevronRight, RotateCcw, Plus } from "lucide-react";
import {
  searchOshiAnalysisCharacters,
  searchOshiAnalysisWorks,
  getOshiRecommendations,
  getOshiAnalysisCharactersByIds,
  type OshiAnalysisCharacter,
  type OshiAnalysisWork,
} from "@/lib/supabase/oshiAnalysis";
import {
  analyzeOshi,
  buildAnalysisLog,
  buildResonance,
  buildPartyJudgment,
  buildDangerGauges,
  oshiAnalysisResultFromSaved,
  type OshiAnalysisResult,
  type HexStat,
  type Resonance,
  type PartyJudgment,
  type DangerGauge,
} from "@/lib/oshiAnalysis";
import {
  fetchOshiAnalysisResultById,
  saveOshiAnalysisResult,
} from "@/lib/supabase/oshiAnalysisResults";
import { useAuthUser } from "@/lib/supabase/useAuthUser";
import { catalogRequestPath } from "@/lib/catalogRequest";
import OshiAnalysisResultLayout from "@/components/play/oshi-analysis/OshiAnalysisResultLayout";
import { mapUrlsToDataUrls, resolveImageSrc } from "@/lib/imageDataUrl";

const MIN_SELECT = 5;
const MAX_SELECT = 10;
const PAGE_SIZE = 30;

const ANALYZING_MESSAGES = [
  "최애들의 공통점을 캐는 중...",
  "서사 취향을 의심하는 중...",
  "반복 등장하는 태그를 모으는 중...",
  "취향 지문을 채취하는 중...",
];

const REQUEST_CTX = {
  from: "oshi-analysis" as const,
  returnTo: "/play/oshi-analysis",
};

type Step = "start" | "select" | "analyzing" | "result";

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

function WorkFilterBadge({
  work,
  onClear,
}: {
  work: OshiAnalysisWork;
  onClear: () => void;
}) {
  return (
    <div className="flex items-center gap-2 border border-dashed border-gray-400 px-3 py-2">
      <span className="flex shrink-0 items-center gap-1 bg-gray-900 px-2 py-0.5 text-xs font-bold text-white">
        {work.title}
        <button type="button" onClick={onClear} className="ml-0.5 text-gray-400 hover:text-white">
          <X size={11} />
        </button>
      </span>
      <Link
        href={catalogRequestPath("work-edit", {
          id: work.id,
          from: REQUEST_CTX.from,
          returnTo: REQUEST_CTX.returnTo,
        })}
        className="ml-auto text-[10px] font-bold text-gray-500 underline hover:text-gray-800"
      >
        작품 수정 요청
      </Link>
    </div>
  );
}

function CharacterCard({
  char,
  selected,
  disabled,
  onClick,
}: {
  char: OshiAnalysisCharacter;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const topTags = [...(char.tags ?? []), ...(char.meme_tags ?? [])].slice(0, 3);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled && !selected}
      className={`group relative flex select-none flex-col border text-left transition-colors ${
        selected
          ? "border-gray-900 bg-gray-900 text-white"
          : disabled
            ? "cursor-not-allowed border-dashed border-gray-200 bg-gray-50 opacity-50"
            : "border-dashed border-gray-300 bg-white hover:border-gray-600"
      }`}
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-gray-100">
        {char.profile_image_url ? (
          <NoDragImage
            src={char.profile_image_url}
            alt={char.name}
            className="pointer-events-none h-full w-full object-cover object-top"
          />
        ) : (
          <CharacterSilhouette />
        )}
        {selected && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <span className="text-2xl font-black text-white">✓</span>
          </div>
        )}
      </div>
      <div className="p-2">
        <p className="truncate text-xs font-black">{char.name}</p>
        <p
          className={`truncate text-[10px] font-bold ${selected ? "text-gray-400" : "text-gray-500"}`}
        >
          {char.official_works.title}
        </p>
        {topTags.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {topTags.map((tag) => (
              <span
                key={tag}
                className={`border px-1 py-0.5 text-[9px] font-bold ${
                  selected
                    ? "border-gray-600 text-gray-300"
                    : "border-dashed border-gray-300 text-gray-500"
                }`}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </button>
  );
}

function ShareAvatar({
  name,
  src,
  size = 56,
}: {
  name: string;
  src: string | null;
  size?: number;
}) {
  return (
    <div className="flex min-w-0 flex-col items-center text-center">
      <div
        className="overflow-hidden rounded-full border-2 border-gray-900 bg-gray-100"
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
      <span className="mt-1 line-clamp-2 w-full text-[9px] font-black leading-tight text-gray-800">
        {name}
      </span>
    </div>
  );
}

function SelectedTray({
  selected,
  onRemove,
}: {
  selected: OshiAnalysisCharacter[];
  onRemove: (id: string) => void;
}) {
  if (selected.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {selected.map((char) => (
        <div
          key={char.id}
          className="flex items-center gap-1.5 border border-dashed border-gray-500 bg-white px-2 py-1"
        >
          {char.profile_image_url ? (
            <NoDragImage
              src={char.profile_image_url}
              alt={char.name}
              className="pointer-events-none h-6 w-6 shrink-0 rounded-full object-cover object-top"
            />
          ) : (
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-200">
              <span className="text-[8px] font-black text-gray-500">?</span>
            </div>
          )}
          <span className="text-xs font-bold text-gray-800">{char.name}</span>
          <button
            type="button"
            onClick={() => onRemove(char.id)}
            className="text-gray-400 hover:text-gray-700"
          >
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}

function RadarChart({ stats, size = 280 }: { stats: HexStat[]; size?: number }) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.34;
  const n = stats.length;

  // 꼭짓점 각도: 12시 방향부터 시계방향
  const angleAt = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const pointAt = (i: number, r: number) => {
    const a = angleAt(i);
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
  };

  const gridLevels = [0.25, 0.5, 0.75, 1];
  const gridPolys = gridLevels.map((level) =>
    stats.map((_, i) => pointAt(i, radius * level).join(",")).join(" ")
  );

  const valuePoly = stats
    .map((s, i) => pointAt(i, radius * Math.max(0.06, s.value / 100)).join(","))
    .join(" ");

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="mx-auto block">
      {/* 그리드 */}
      {gridPolys.map((poly, idx) => (
        <polygon
          key={idx}
          points={poly}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={1}
        />
      ))}
      {/* 축선 */}
      {stats.map((_, i) => {
        const [x, y] = pointAt(i, radius);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#e5e7eb" strokeWidth={1} />;
      })}
      {/* 값 폴리곤 */}
      <polygon points={valuePoly} fill="rgba(17,24,39,0.12)" stroke="#111827" strokeWidth={2} />
      {stats.map((s, i) => {
        const [x, y] = pointAt(i, radius * Math.max(0.06, s.value / 100));
        return <circle key={i} cx={x} cy={y} r={3} fill="#111827" />;
      })}
      {/* 라벨 + 수치 */}
      {stats.map((s, i) => {
        const [lx, ly] = pointAt(i, radius + 22);
        const anchor = Math.abs(lx - cx) < 4 ? "middle" : lx > cx ? "start" : "end";
        return (
          <g key={i}>
            <text
              x={lx}
              y={ly - 4}
              textAnchor={anchor}
              className="fill-gray-900"
              style={{ fontSize: 13, fontWeight: 800 }}
            >
              {s.label}
            </text>
            <text
              x={lx}
              y={ly + 10}
              textAnchor={anchor}
              className="fill-gray-400"
              style={{ fontSize: 11, fontWeight: 700 }}
            >
              {s.value}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function ResultCard({
  result,
  selected,
  resonance,
  partyJudgment,
  dangerGauges,
  recommendations,
  imageDataUrls,
  cardRef,
}: {
  result: OshiAnalysisResult;
  selected: OshiAnalysisCharacter[];
  resonance: Resonance | null;
  partyJudgment: PartyJudgment | null;
  dangerGauges: DangerGauge[];
  recommendations: OshiAnalysisCharacter[];
  imageDataUrls: Record<string, string>;
  cardRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div
      ref={cardRef}
      className="border border-gray-900 bg-white p-6"
      style={{ fontFamily: "sans-serif" }}
    >
      <div className="mb-1 text-[10px] font-black uppercase tracking-widest text-gray-400">
        10duck · 최애 기반 취향분석
      </div>
      <h2 className="mt-2 text-2xl font-black text-gray-900">{result.typeName}</h2>
      <p className="mt-3 whitespace-pre-line text-sm leading-6 text-gray-600">{result.summary}</p>

      {/* 6각형 스탯창 */}
      <div className="mt-4 border border-dashed border-gray-300 bg-gray-50 py-2">
        <RadarChart stats={result.hexStats} />
        <p className="text-center text-[10px] font-bold text-gray-400">
          전체 평균 = 50 · 높을수록 그 취향에 쏠림
        </p>
      </div>

      {/* 선택한 최애 (공유 이미지용) */}
      {selected.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-gray-400">
            선택한 최애 {selected.length}명
          </p>
          <div className="grid grid-cols-5 gap-2">
            {selected.map((char) => (
              <ShareAvatar
                key={char.id}
                name={char.name}
                src={resolveImageSrc(char.profile_image_url, imageDataUrls)}
              />
            ))}
          </div>
        </div>
      )}

      {/* 속성 공명 */}
      {resonance && (resonance.items.length > 0 || resonance.alerts.length > 0) && (
        <div className="mt-5">
          <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-gray-400">
            속성 공명
          </p>
          <div className="flex flex-wrap gap-2">
            {resonance.items.map((item) => (
              <span
                key={item.tag}
                className="flex items-center gap-1 border border-dashed border-gray-700 bg-gray-50 px-2 py-1 text-xs font-black text-gray-900"
              >
                {item.tag}
                <span className="text-indigo-600">Lv.{item.level}</span>
              </span>
            ))}
            {resonance.alerts.map((alert) => (
              <span
                key={alert}
                className="border border-red-400 bg-red-50 px-2 py-1 text-xs font-black text-red-700"
              >
                ⚠ {alert}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 최애 파티 판정 */}
      {partyJudgment && partyJudgment.roles.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-gray-400">
            최애 파티 판정
          </p>
          <div className="flex flex-col gap-1.5">
            {partyJudgment.roles.map((r) => (
              <div key={r.role} className="flex items-baseline gap-2">
                <span className="w-20 shrink-0 text-[10px] font-black text-gray-400">
                  {r.role}
                </span>
                <span
                  className={`text-xs font-black ${
                    r.value === "없음"
                      ? "text-red-600"
                      : r.role === "위험 요소"
                        ? "text-orange-600"
                        : "text-gray-900"
                  }`}
                >
                  {r.value}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-2 border-l-2 border-gray-900 pl-2 text-[11px] font-bold text-gray-700">
            {partyJudgment.verdict}
          </p>
        </div>
      )}

      {/* 취향 위험도 게이지 */}
      {dangerGauges.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-gray-400">
            취향 위험도
          </p>
          <div className="flex flex-col gap-2">
            {dangerGauges.map((g) => (
              <div key={g.label} className="flex items-center gap-3">
                <span className="w-16 shrink-0 text-[10px] font-black text-gray-500">
                  {g.label}
                </span>
                <div className="relative h-2 flex-1 bg-gray-100">
                  <div
                    className={`absolute inset-y-0 left-0 ${
                      g.label === "정상성"
                        ? g.value >= 60
                          ? "bg-green-500"
                          : g.value >= 30
                            ? "bg-yellow-400"
                            : "bg-red-500"
                        : "bg-gray-900"
                    }`}
                    style={{ width: `${g.value}%` }}
                  />
                </div>
                <span className="w-9 text-right text-[10px] font-black text-gray-700">
                  {g.value}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 시그니처 태그 (평균 대비 배수) */}
      {result.signatureTags.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-gray-400">
            평균보다 더 고른 취향
          </p>
          <div className="flex flex-wrap gap-2">
            {result.signatureTags.map((s) => (
              <span
                key={s.tag}
                className="flex items-center gap-1 border border-gray-900 bg-gray-900 px-2 py-1 text-xs font-black text-white"
              >
                {s.tag}
                <span className="text-amber-300">×{s.multiplier}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 다음에 빠질 캐릭터 */}
      {recommendations.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-gray-400">
            당신이 다음에 빠질 캐릭터
          </p>
          <div className="grid grid-cols-3 gap-3">
            {recommendations.map((char) => (
              <div key={char.id} className="min-w-0 text-center">
                <ShareAvatar
                  name={char.name}
                  src={resolveImageSrc(char.profile_image_url, imageDataUrls)}
                  size={64}
                />
                <p className="mt-0.5 truncate text-[10px] font-bold text-gray-400">
                  {char.official_works.title}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div
        className={`mt-5 border border-dashed px-3 py-2 text-[11px] font-bold ${
          result.confidence >= 80
            ? "border-green-400 text-green-700"
            : result.confidence >= 50
              ? "border-gray-400 text-gray-600"
              : "border-red-300 text-red-600"
        }`}
      >
        {result.confidenceLabel}
        {result.taggedCount < result.selectedCount && (
          <span className="ml-2 text-gray-400">
            ({result.taggedCount}/{result.selectedCount}명 태그 있음)
          </span>
        )}
      </div>

      <div className="mt-4 text-[9px] font-bold text-gray-300">10duck.com</div>
    </div>
  );
}

export default function OshiAnalysisPage() {
  return (
    <Suspense
      fallback={
        <main className="flex w-full flex-col items-center justify-center gap-6 py-24">
          <div className="h-8 w-8 animate-spin border-2 border-gray-900 border-t-transparent" />
          <p className="text-sm font-black text-gray-700">불러오는 중...</p>
        </main>
      }
    >
      <OshiAnalysisPageContent />
    </Suspense>
  );
}

function OshiAnalysisPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const savedId = searchParams.get("saved");
  const authUser = useAuthUser();
  const [step, setStep] = useState<Step>(() => (savedId ? "analyzing" : "start"));

  // Character list state
  const [characters, setCharacters] = useState<OshiAnalysisCharacter[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Search / filter state
  const [query, setQuery] = useState("");
  const [workQuery, setWorkQuery] = useState("");
  const [workResults, setWorkResults] = useState<OshiAnalysisWork[]>([]);
  const [selectedWork, setSelectedWork] = useState<OshiAnalysisWork | null>(null);
  const [showWorkDropdown, setShowWorkDropdown] = useState(false);

  // Selection + result
  const [selected, setSelected] = useState<OshiAnalysisCharacter[]>([]);
  const [result, setResult] = useState<OshiAnalysisResult | null>(null);
  const [resonance, setResonance] = useState<Resonance | null>(null);
  const [partyJudgment, setPartyJudgment] = useState<PartyJudgment | null>(null);
  const [dangerGauges, setDangerGauges] = useState<DangerGauge[]>([]);
  const [recommendations, setRecommendations] = useState<OshiAnalysisCharacter[]>([]);
  const [imageDataUrls, setImageDataUrls] = useState<Record<string, string>>({});
  const [imagesReady, setImagesReady] = useState(false);
  const [analyzingMessage, setAnalyzingMessage] = useState(ANALYZING_MESSAGES[0]);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [visibleLogCount, setVisibleLogCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [analyzedAt, setAnalyzedAt] = useState<Date | null>(null);

  const resultRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  // Keep current query context in refs so loadMore always uses up-to-date values
  const currentContextRef = useRef({ query: "", workId: undefined as string | undefined });
  const loadMoreInProgressRef = useRef(false);

  // ── Saved result deep link (?saved=uuid) ─────────────────────────────────
  useEffect(() => {
    if (!savedId) return;
    if (authUser === undefined) {
      setStep("analyzing");
      setAnalyzingMessage("저장된 결과 불러오는 중...");
      return;
    }

    let cancelled = false;

    void (async () => {
      setStep("analyzing");
      setAnalyzingMessage("저장된 결과 불러오는 중...");

      try {
        const row = await fetchOshiAnalysisResultById(savedId);
        if (cancelled) return;

        if (!row) {
          setStep("start");
          return;
        }

        const characters = await getOshiAnalysisCharactersByIds(row.selected_character_ids);
        if (cancelled) return;

        const restored = oshiAnalysisResultFromSaved(row);
        setSelected(characters);
        setResult(restored);
        setResonance(buildResonance(characters));
        setPartyJudgment(buildPartyJudgment(characters, restored));
        setDangerGauges(buildDangerGauges(characters, restored));
        setRecommendations([]);
        setAnalyzedAt(new Date(row.created_at));
        setStep("result");

        void getOshiRecommendations(
          (row.signature_tags ?? []).map((tag) => tag.tag),
          row.selected_character_ids ?? [],
          5,
        )
          .then((recs) => {
            if (!cancelled) setRecommendations(recs);
          })
          .catch(() => {});
      } catch (error) {
        console.error("[oshi-analysis] saved result load failed:", error);
        if (!cancelled) setStep("start");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [savedId, authUser]);

  // ── Unified fetch: runs when query / selectedWork / step changes ─────────
  useEffect(() => {
    if (step !== "select") return;

    const trimmed = query.trim();
    const wid = selectedWork?.id;

    const doFetch = async () => {
      currentContextRef.current = { query: trimmed, workId: wid };
      setLoading(true);
      setOffset(0);
      setHasMore(false);
      setCharacters([]);
      const results = await searchOshiAnalysisCharacters(trimmed, wid, PAGE_SIZE, 0);
      setCharacters(results);
      setHasMore(results.length === PAGE_SIZE);
      setLoading(false);
    };

    // Empty query → immediate fetch (no debounce needed)
    if (!trimmed) {
      void doFetch();
      return;
    }

    // Non-empty → debounce
    const timer = setTimeout(() => void doFetch(), 350);
    return () => clearTimeout(timer);
  }, [query, selectedWork, step]);

  // ── Load more ────────────────────────────────────────────────────────────
  const loadMore = useCallback(async () => {
    if (loadMoreInProgressRef.current || !hasMore || loading) return;
    loadMoreInProgressRef.current = true;
    setLoadingMore(true);
    const { query: q, workId: wid } = currentContextRef.current;
    const newOffset = offset + PAGE_SIZE;
    const results = await searchOshiAnalysisCharacters(q, wid, PAGE_SIZE, newOffset);
    setCharacters((prev) => [...prev, ...results]);
    setHasMore(results.length === PAGE_SIZE);
    setOffset(newOffset);
    setLoadingMore(false);
    loadMoreInProgressRef.current = false;
  }, [hasMore, loading, offset]);

  // ── IntersectionObserver for infinite scroll ─────────────────────────────
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void loadMore();
      },
      { threshold: 0, rootMargin: "200px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  // ── Work search ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!workQuery.trim()) {
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
  }, [workQuery]);

  // PNG 캡처용: 외부 CDN 이미지를 data URL로 미리 변환
  useEffect(() => {
    if (step !== "result") {
      setImageDataUrls({});
      setImagesReady(false);
      return;
    }

    const urls = [
      ...selected.map((c) => c.profile_image_url),
      ...recommendations.map((c) => c.profile_image_url),
    ].filter((url): url is string => Boolean(url));

    let cancelled = false;
    setImagesReady(false);
    void mapUrlsToDataUrls(urls).then((map) => {
      if (cancelled) return;
      setImageDataUrls(map);
      setImagesReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [step, selected, recommendations]);

  const toggleSelect = useCallback((char: OshiAnalysisCharacter) => {
    setSelected((prev) => {
      if (prev.some((c) => c.id === char.id)) return prev.filter((c) => c.id !== char.id);
      if (prev.length >= MAX_SELECT) return prev;
      return [...prev, char];
    });
  }, []);

  const removeSelected = useCallback((id: string) => {
    setSelected((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const handleStartAnalyze = async () => {
    const analyzed = analyzeOshi(selected);
    const log = buildAnalysisLog(selected, analyzed);

    setLogLines(log);
    setVisibleLogCount(0);
    setStep("analyzing");

    const recsPromise = getOshiRecommendations(
      analyzed.signatureTags.map((s) => s.tag),
      selected.map((c) => c.id),
      5,
    ).catch(() => [] as OshiAnalysisCharacter[]);

    // 로그를 한 줄씩 순차 공개 (마지막 결론 줄까지)
    const REVEAL_MS = 360;
    let shown = 0;
    const interval = setInterval(() => {
      shown += 1;
      setVisibleLogCount(shown);
      if (shown >= log.length) clearInterval(interval);
    }, REVEAL_MS);

    // 모든 줄이 공개되고 결론을 잠깐 보여줄 시간 확보 (최소 1.2초)
    const totalRevealMs = log.length * REVEAL_MS + 500;
    const [, recs] = await Promise.all([
      new Promise((resolve) => setTimeout(resolve, Math.max(1200, totalRevealMs))),
      recsPromise,
    ]);
    clearInterval(interval);
    setVisibleLogCount(log.length);

    setResult(analyzed);
    setResonance(buildResonance(selected));
    setPartyJudgment(buildPartyJudgment(selected, analyzed));
    setDangerGauges(buildDangerGauges(selected, analyzed));
    setRecommendations(recs as OshiAnalysisCharacter[]);
    setAnalyzedAt(new Date());
    setStep("result");

    if (authUser?.id) {
      void saveOshiAnalysisResult(
        authUser.id,
        analyzed,
        selected.map((character) => character.id),
      ).catch(console.error);
    }
  };

  const handleDownload = async () => {
    const el = resultRef.current;
    if (!el) return;
    setBusy(true);
    try {
      const urls = [
        ...selected.map((c) => c.profile_image_url),
        ...recommendations.map((c) => c.profile_image_url),
      ].filter((url): url is string => Boolean(url));

      const captureMap = imagesReady ? { ...imageDataUrls } : await mapUrlsToDataUrls(urls);
      if (!imagesReady) setImageDataUrls(captureMap);

      const restores: Array<{ img: HTMLImageElement; src: string }> = [];
      el.querySelectorAll("img").forEach((node) => {
        const img = node as HTMLImageElement;
        const original = img.getAttribute("src") ?? "";
        const inlined = captureMap[original] ?? (original.startsWith("data:") ? original : null);
        if (inlined && inlined !== original) {
          restores.push({ img, src: original });
          img.setAttribute("src", inlined);
        }
      });

      await Promise.all(
        [...el.querySelectorAll("img")].map(
          (img) =>
            new Promise<void>((resolve) => {
              if (img.complete) resolve();
              else {
                img.onload = () => resolve();
                img.onerror = () => resolve();
              }
            })
        )
      );

      const { domToBlob } = await import("modern-screenshot");
      const blob = await domToBlob(el, {
        scale: 2,
        type: "image/png",
        fetchFn: async (url) => captureMap[url] ?? false,
      });

      restores.forEach(({ img, src }) => img.setAttribute("src", src));

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `oshi-analysis-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("download failed:", err);
    } finally {
      setBusy(false);
    }
  };

  const handleReset = () => {
    setSelected([]);
    setResult(null);
    setResonance(null);
    setPartyJudgment(null);
    setDangerGauges([]);
    setRecommendations([]);
    setImageDataUrls({});
    setImagesReady(false);
    setQuery("");
    setWorkQuery("");
    setSelectedWork(null);
    setCharacters([]);
    setLogLines([]);
    setVisibleLogCount(0);
    setAnalyzedAt(null);
    setStep("start");
    router.replace("/play/oshi-analysis");
  };

  const handleSelectWork = (work: OshiAnalysisWork) => {
    setSelectedWork(work);
    setWorkQuery("");
    setWorkResults([]);
    setShowWorkDropdown(false);
    setQuery("");
  };

  // ── START ────────────────────────────────────────────────────────────────
  if (step === "start") {
    return (
      <main className="flex w-full flex-col gap-6">
        <section className="border border-dashed border-gray-500 bg-white p-5">
          <Link href="/play" className="text-xs font-bold text-gray-500 hover:underline">
            바이럴 허브로 돌아가기
          </Link>
          <h1 className="mt-3 text-2xl font-black text-gray-900">최애 기반 취향분석</h1>
          <p className="mt-2 text-sm leading-6 text-gray-600">
            질문에 답하지 않아도 됩니다. 좋아하는 캐릭터만 고르세요.
            <br />
            선택한 최애들의 공통 태그로 취향을 분석합니다.
          </p>
        </section>

        <section className="border border-dashed border-gray-500 bg-white p-5">
          <h2 className="text-base font-black text-gray-900">이렇게 작동합니다</h2>
          <ol className="mt-4 flex flex-col gap-3">
            {[
              "DB에 등록된 캐릭터 중 최애를 5~10명 선택합니다.",
              "각 캐릭터의 태그, 포지션, 작품 정보를 기반으로 점수를 계산합니다.",
              "반복되는 태그를 취합해 취향 유형명과 태그 비율을 만듭니다.",
              "결과 이미지를 저장하거나 공유합니다.",
            ].map((text, i) => (
              <li key={i} className="flex gap-3 text-sm text-gray-700">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center border border-dashed border-gray-400 bg-gray-100 text-xs font-black">
                  {i + 1}
                </span>
                {text}
              </li>
            ))}
          </ol>
        </section>

        <button
          type="button"
          onClick={() => setStep("select")}
          className="inline-flex items-center justify-center gap-2 border border-dashed border-gray-700 bg-gray-900 px-4 py-3 text-sm font-black text-white hover:bg-gray-800"
        >
          분석 시작
          <ChevronRight size={16} />
        </button>

        <section className="border border-dashed border-gray-300 bg-gray-50 p-4">
          <p className="text-xs leading-5 text-gray-500">
            현재 DB에 등록된 캐릭터만 분석에 반영됩니다. 찾는 캐릭터가 없으면 분석 중 추가
            요청을 할 수 있습니다.
          </p>
        </section>
      </main>
    );
  }

  // ── ANALYZING ────────────────────────────────────────────────────────────
  if (step === "analyzing") {
    // 신규 분석: 선택한 최애 기반 실시간 로그 연출
    if (logLines.length > 0) {
      const visible = logLines.slice(0, visibleLogCount);
      return (
        <main className="flex w-full flex-col items-center justify-center py-20">
          <section className="w-full max-w-md border border-dashed border-gray-700 bg-gray-900 p-5">
            <div className="mb-4 flex items-center gap-2 border-b border-dashed border-gray-700 pb-3">
              <div className="h-3.5 w-3.5 animate-spin border-2 border-green-400 border-t-transparent" />
              <span className="text-[11px] font-black uppercase tracking-widest text-green-400">
                취향 분석 중
              </span>
            </div>
            <div className="flex min-h-[160px] flex-col gap-2 font-mono">
              {visible.map((line, i) => {
                const isConclusion = i === logLines.length - 1;
                return (
                  <p
                    key={i}
                    className={
                      isConclusion
                        ? "mt-1 text-sm font-black text-amber-300"
                        : "text-xs font-bold text-green-300"
                    }
                  >
                    {isConclusion ? line : `> ${line}`}
                  </p>
                );
              })}
              {visibleLogCount < logLines.length && (
                <span className="inline-block h-3 w-2 animate-pulse bg-green-400" />
              )}
            </div>
          </section>
        </main>
      );
    }

    // 저장된 결과 불러오는 경우 등
    return (
      <main className="flex w-full flex-col items-center justify-center gap-6 py-24">
        <div className="h-8 w-8 animate-spin border-2 border-gray-900 border-t-transparent" />
        <p className="text-sm font-black text-gray-700">{analyzingMessage}</p>
      </main>
    );
  }

  // ── RESULT ───────────────────────────────────────────────────────────────
  if (step === "result" && result) {
    return (
      <main className="flex w-full flex-col">
        <OshiAnalysisResultLayout
          result={result}
          selected={selected}
          resonance={resonance}
          partyJudgment={partyJudgment}
          dangerGauges={dangerGauges}
          recommendations={recommendations}
          imageDataUrls={imageDataUrls}
          analyzedAt={analyzedAt}
          busy={busy}
          onShare={() => void handleDownload()}
          onReselect={() => {
            router.replace("/play/oshi-analysis");
            setStep("select");
          }}
          onReset={handleReset}
        />

        <div className="pointer-events-none fixed left-[-10000px] top-0 opacity-0" aria-hidden>
          <ResultCard
            result={result}
            selected={selected}
            resonance={resonance}
            partyJudgment={partyJudgment}
            dangerGauges={dangerGauges}
            recommendations={recommendations}
            imageDataUrls={imageDataUrls}
            cardRef={resultRef}
          />
        </div>
      </main>
    );
  }

  // ── SELECT ───────────────────────────────────────────────────────────────
  const isAtMax = selected.length >= MAX_SELECT;
  const canAnalyze = selected.length >= MIN_SELECT;

  return (
    <main className="flex w-full flex-col gap-5 pb-6">
      <section className="border border-dashed border-gray-500 bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Link href="/play" className="text-xs font-bold text-gray-500 hover:underline">
              바이럴 허브로 돌아가기
            </Link>
            <h1 className="mt-2 text-xl font-black text-gray-900">최애 선택</h1>
            <p className="mt-1 text-xs text-gray-500">
              {MIN_SELECT}명 이상 {MAX_SELECT}명 이하로 선택하세요.
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <div className="text-right">
              <span className="text-2xl font-black text-gray-900">{selected.length}</span>
              <span className="text-sm font-bold text-gray-400"> / {MAX_SELECT}</span>
            </div>
            <div className="flex flex-wrap justify-end gap-1.5">
              <Link
                href={catalogRequestPath("character-add", {
                  from: REQUEST_CTX.from,
                  returnTo: REQUEST_CTX.returnTo,
                  q: query.trim() || undefined,
                  work: selectedWork?.title,
                })}
                className="inline-flex items-center gap-1 border border-dashed border-gray-500 bg-white px-2 py-1 text-[10px] font-bold text-gray-700 hover:bg-gray-50"
              >
                <Plus size={11} />
                캐릭터 추가 요청
              </Link>
              {/* <Link
                href={catalogRequestPath("work-add", {
                  from: REQUEST_CTX.from,
                  returnTo: REQUEST_CTX.returnTo,
                  work: workQuery.trim() || selectedWork?.title,
                })}
                className="inline-flex items-center gap-1 border border-dashed border-gray-300 bg-white px-2 py-1 text-[10px] font-bold text-gray-500 hover:bg-gray-50"
              >
                작품 추가
              </Link> */}
            </div>
          </div>
        </div>
      </section>

      {/* Search */}
      <section className="border border-dashed border-gray-500 bg-white p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {/* Character search */}
          <div className="relative">
            <div className="flex items-center gap-2 border border-dashed border-gray-400 px-3 py-2">
              <Search size={14} className="shrink-0 text-gray-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="캐릭터명 검색"
                className="min-w-0 flex-1 text-sm outline-none placeholder:text-gray-400"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="text-gray-400 hover:text-gray-700"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Work filter */}
          <div className="relative">
            {selectedWork ? (
              <WorkFilterBadge work={selectedWork} onClear={() => setSelectedWork(null)} />
            ) : (
              <div className="flex items-center gap-2 border border-dashed border-gray-400 px-3 py-2">
                <Search size={14} className="shrink-0 text-gray-400" />
                <input
                  type="text"
                  value={workQuery}
                  onChange={(e) => {
                    setWorkQuery(e.target.value);
                    setShowWorkDropdown(true);
                  }}
                  onFocus={() => setShowWorkDropdown(true)}
                  placeholder="작품으로 필터"
                  className="min-w-0 flex-1 text-sm outline-none placeholder:text-gray-400"
                />
                {workQuery && (
                  <button
                    type="button"
                    onClick={() => setWorkQuery("")}
                    className="text-gray-400 hover:text-gray-700"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            )}
            {showWorkDropdown && workResults.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-50 mt-1 border border-gray-300 bg-white shadow-lg">
                {workResults.map((work) => (
                  <button
                    key={work.id}
                    type="button"
                    onClick={() => handleSelectWork(work)}
                    className="flex w-full items-center gap-2 border-b border-dashed border-gray-100 px-3 py-2 text-left hover:bg-gray-50 last:border-b-0"
                  >
                    {work.cover_image_url ? (
                      <NoDragImage
                        src={work.cover_image_url}
                        alt=""
                        className="pointer-events-none h-8 w-6 shrink-0 object-cover"
                      />
                    ) : (
                      <div className="h-8 w-6 shrink-0 bg-gray-100" />
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-xs font-black text-gray-900">{work.title}</p>
                      {work.original_title && (
                        <p className="truncate text-[10px] text-gray-400">{work.original_title}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Character grid */}
      <section className="border border-dashed border-gray-500 bg-white p-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-5 w-5 animate-spin border-2 border-gray-400 border-t-transparent" />
          </div>
        ) : characters.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm font-black text-gray-500">
              {query ? `"${query}"` : ""}
              {selectedWork ? ` · ${selectedWork.title}` : ""} 검색 결과가 없습니다.
            </p>
            <p className="mt-2 text-xs text-gray-400">찾는 최애가 없나요?</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <Link
                href={catalogRequestPath("character-add", {
                  from: REQUEST_CTX.from,
                  returnTo: REQUEST_CTX.returnTo,
                  q: query.trim() || undefined,
                  work: selectedWork?.title,
                })}
                className="border border-dashed border-gray-400 px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-50"
              >
                최애 추가 요청하기
              </Link>
              <Link
                href={catalogRequestPath("work-add", {
                  from: REQUEST_CTX.from,
                  returnTo: REQUEST_CTX.returnTo,
                  work: workQuery.trim() || selectedWork?.title,
                })}
                className="border border-dashed border-gray-300 px-3 py-1.5 text-xs font-bold text-gray-500 hover:bg-gray-50"
              >
                작품만 추가 요청
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
              {characters.map((char) => {
                const isSelected = selected.some((c) => c.id === char.id);
                return (
                  <CharacterCard
                    key={char.id}
                    char={char}
                    selected={isSelected}
                    disabled={isAtMax && !isSelected}
                    onClick={() => toggleSelect(char)}
                  />
                );
              })}
            </div>

            {/* Infinite scroll sentinel */}
            <div ref={sentinelRef} className="mt-4 flex justify-center">
              {loadingMore && (
                <div className="h-5 w-5 animate-spin border-2 border-gray-300 border-t-transparent" />
              )}
            </div>
          </>
        )}
      </section>

      <div
        aria-hidden
        className={
          selected.length > 5
            ? "h-48 shrink-0"
            : selected.length > 0
              ? "h-36 shrink-0"
              : "h-20 shrink-0"
        }
      />

      {/* 하단 고정: 선택한 최애 + 분석 CTA */}
      <div className="sticky bottom-0 z-40 border-t border-dashed border-gray-400 bg-white/95 shadow-[0_-8px_24px_rgba(0,0,0,0.06)] backdrop-blur-sm">
        {selected.length > 0 && (
          <div className="border-b border-dashed border-gray-200 px-4 py-3">
            <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-gray-400">
              선택한 최애 {selected.length}/{MAX_SELECT}
            </p>
            <SelectedTray selected={selected} onRemove={removeSelected} />
          </div>
        )}
        <div className="p-4">
          <button
            type="button"
            disabled={!canAnalyze}
            onClick={handleStartAnalyze}
            className="w-full border border-dashed border-gray-700 bg-gray-900 px-4 py-3 text-sm font-black text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {canAnalyze
              ? `취향 분석하기 (${selected.length}명 선택됨)`
              : `최소 ${MIN_SELECT}명 선택하세요 (${selected.length}/${MIN_SELECT})`}
          </button>
        </div>
      </div>
    </main>
  );
}
