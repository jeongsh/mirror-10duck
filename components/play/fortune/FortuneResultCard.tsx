import type { FortuneResult } from "@/lib/fortune/dailyFortune";
import { formatDisplayDate } from "@/lib/fortune/dailyFortune";
import { resolveImageSrc } from "@/lib/imageDataUrl";

/** 모달·PNG·공유 뷰 공통 카드 너비 */
export const FORTUNE_CARD_W = 420;

function ScoreRow({
  label,
  score,
  stars,
  text,
  accent,
}: {
  label: string;
  score: number;
  stars: string;
  text: string;
  accent: string;
}) {
  return (
    <div className="rounded-md border border-white/10 bg-black/15 p-2.5">
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-[10px] font-black text-violet-200/90">{label}</p>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] tracking-tight text-amber-200/90">{stars}</span>
          <span className="text-[10px] font-black text-white">{score}</span>
        </div>
      </div>
      <div className="mb-1.5 h-1 overflow-hidden rounded-full bg-black/30">
        <div className="h-full rounded-full" style={{ width: `${score}%`, background: accent }} />
      </div>
      <p className="break-words text-[10px] leading-4 text-violet-100/75">{text}</p>
    </div>
  );
}

export function FortuneResultCard({
  result,
  innerRef,
  className = "",
  imageDataUrls = {},
}: {
  result: FortuneResult;
  innerRef?: React.RefObject<HTMLDivElement | null>;
  className?: string;
  imageDataUrls?: Record<string, string>;
}) {
  const displayName = result.nickname.trim() || "오늘의 나";
  const characterImageSrc = resolveImageSrc(result.recommendedCharacter?.imageUrl, imageDataUrls);

  return (
    <div
      ref={innerRef}
      className={`relative min-w-0 overflow-hidden rounded-2xl border p-5 ${className}`}
      style={{
        width: "100%",
        background: "linear-gradient(180deg, #2b2150 0%, #1c1438 100%)",
        borderColor: "rgba(201,168,95,0.45)",
      }}
    >
      <div className="flex min-w-0 items-center justify-between gap-2">
        <p className="min-w-0 truncate text-[9px] font-bold uppercase tracking-[0.28em] text-amber-200/60">
          10DUCK · 오늘의 캐릭터 운세
        </p>
        <p className="shrink-0 text-[10px] font-bold text-violet-200/55">{formatDisplayDate(result.dateKey)}</p>
      </div>

      <div className="mt-4 flex flex-col items-center text-center">
        <span className="text-3xl">{result.zodiac.emoji}</span>
        <h2 className="mt-1 text-base font-black text-white">{result.zodiac.name}</h2>
        <p className="mt-1 text-[11px] font-bold text-violet-200/75">{displayName}님의 오늘</p>
        <p className="mt-2 break-words text-[11px] leading-5 text-violet-50/90">{result.zodiacMessage}</p>
      </div>

      <div className="mt-4 space-y-2">
        <ScoreRow
          label="종합운"
          score={result.scores.overall}
          stars={result.starRatings.overall}
          text={result.fortuneTexts.overall}
          accent="#e6c27a"
        />
        <div className="grid grid-cols-2 gap-2">
          <ScoreRow
            label="연애운"
            score={result.scores.love}
            stars={result.starRatings.love}
            text={result.fortuneTexts.love}
            accent="#e0789f"
          />
          <ScoreRow
            label="금전운"
            score={result.scores.money}
            stars={result.starRatings.money}
            text={result.fortuneTexts.money}
            accent="#6fa8e0"
          />
          <ScoreRow
            label="일·학업운"
            score={result.scores.work}
            stars={result.starRatings.work}
            text={result.fortuneTexts.work}
            accent="#5fc6a0"
          />
          <ScoreRow
            label="건강운"
            score={result.scores.health}
            stars={result.starRatings.health}
            text={result.fortuneTexts.health}
            accent="#a779e6"
          />
        </div>
        <ScoreRow
          label="최애운"
          score={result.scores.oshi}
          stars={result.starRatings.oshi}
          text={result.fortuneTexts.oshi}
          accent="#f59e8b"
        />
      </div>

      <div className="mt-3 rounded-lg border border-amber-400/20 bg-amber-500/10 p-3">
        <p className="text-[9px] font-black uppercase tracking-widest text-amber-200/80">오늘 잘 맞는 캐릭터 타입</p>
        <p className="mt-1 break-words text-[11px] font-bold leading-5 text-amber-50/95">{result.characterType}</p>
      </div>

      {result.recommendedCharacter ? (
        <div className="mt-3 flex gap-3 rounded-lg border border-violet-300/15 bg-black/20 p-3">
          {characterImageSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={characterImageSrc}
              alt={result.recommendedCharacter.name}
              crossOrigin="anonymous"
              draggable={false}
              className="h-16 w-16 shrink-0 rounded-lg object-cover object-top"
            />
          ) : (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-violet-900/40 text-2xl">
              ✨
            </div>
          )}
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-widest text-violet-200/60">추천 캐릭터</p>
            <p className="mt-0.5 truncate text-sm font-black text-white">{result.recommendedCharacter.name}</p>
            <p className="truncate text-[10px] text-violet-200/65">{result.recommendedCharacter.workTitle}</p>
          </div>
        </div>
      ) : null}

      <div className="mt-3 grid grid-cols-3 gap-2">
        {[
          { label: "행운 숫자", value: String(result.luckyNumber) },
          { label: "행운 색", value: result.luckyColor },
          { label: "행운 아이템", value: result.luckyItem },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-md border border-white/10 bg-black/15 p-2 text-center">
            <p className="text-[8px] font-black text-violet-200/55">{label}</p>
            <p className="mt-0.5 break-words text-[10px] font-bold text-white">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-lg border border-white/10 bg-black/15 p-3">
        <p className="text-[9px] font-black uppercase tracking-widest text-sky-200/70">오늘의 한마디</p>
        <p className="mt-1 break-words text-[11px] leading-5 text-violet-50/95">{result.todayMessage}</p>
      </div>

      <p className="mt-4 text-center text-[9px] leading-4 text-violet-300/35">
        재미용 콘텐츠입니다 · ssibduk · /play/fortune
      </p>
    </div>
  );
}
