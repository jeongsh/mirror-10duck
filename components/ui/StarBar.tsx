"use client";

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/** 평균 0~5를 별 문자로 표시 */
export function StarBar({
  avg,
  count,
  className = "",
  size = "md",
}: {
  avg: number;
  count: number;
  className?: string;
  size?: "sm" | "md";
}) {
  const safe = Number.isFinite(avg) ? clamp(avg, 0, 5) : 0;
  const rounded = Math.round(safe);
  const textSize = size === "sm" ? "text-sm" : "text-lg";

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <span className={`flex shrink-0 gap-0.5 ${textSize} leading-none`} aria-hidden>
        {[1, 2, 3, 4, 5].map((i) => (
          <span key={i} className={i <= rounded ? "text-amber-500" : "text-gray-300"}>
            ★
          </span>
        ))}
      </span>
      <span className="text-sm font-semibold text-gray-900">{safe.toFixed(1)}</span>
      <span className="text-xs text-gray-500">/ 5</span>
      {count > 0 && <span className="text-xs text-gray-500">({count}명)</span>}
    </div>
  );
}
