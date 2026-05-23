"use client";

import Link from "next/link";
import { CSSProperties, PointerEvent, useEffect, useMemo, useState } from "react";
import { ImagePlus } from "lucide-react";
import { TYPE_OPTIONS, GRADE_OPTIONS, type CardType } from "../_config";
import OshiCardStyles from "../OshiCardStyles";
import { fetchOshiCardShare } from "@/lib/supabase/oshiCardShares";

type TiltState = { rotateX: number; rotateY: number; glareX: number; glareY: number };

function typeLogoStyle(cardType: CardType): CSSProperties {
  return { backgroundImage: `url(/viral/type-logos/${cardType.id}.svg)` };
}

export default function OshiCardViewPage() {
  const [nickname, setNickname] = useState("");
  const [oshi, setOshi] = useState("");
  const [works, setWorks] = useState<string[]>([]);
  const [grade, setGrade] = useState(GRADE_OPTIONS[2]);
  const [typeId, setTypeId] = useState(TYPE_OPTIONS[0].id);
  const [backgroundImageUrl, setBackgroundImageUrl] = useState("");
  const [oshiAvatarUrl, setOshiAvatarUrl] = useState("");
  const [isExpired, setIsExpired] = useState(false);
  const [isHoveringCard, setIsHoveringCard] = useState(false);
  const [tilt, setTilt] = useState<TiltState>({ rotateX: 0, rotateY: 0, glareX: 50, glareY: 50 });

  useEffect(() => {
    const shareId = window.location.pathname.match(/\/play\/oshi-card\/view\/([^/?#]+)/)?.[1];
    if (shareId) {
      fetchOshiCardShare(shareId)
        .then((share) => {
          if (!share) {
            setIsExpired(true);
            return;
          }
          setNickname(share.nickname ?? "");
          setOshi(share.oshi ?? "");
          setWorks(Array.isArray(share.works) ? share.works.slice(0, 5) : []);
          setGrade(share.grade);
          setTypeId(share.type_id);
          setBackgroundImageUrl(share.background_image_url ?? "");
          setOshiAvatarUrl(share.oshi_avatar_url ?? "");
        })
        .catch(() => setIsExpired(true));
      return;
    }

    const p = new URLSearchParams(window.location.search);
    if (p.has("n")) setNickname(p.get("n")!);
    if (p.has("o")) setOshi(p.get("o")!);
    if (p.has("w")) setWorks(p.get("w")!.split(",").filter(Boolean).slice(0, 5));
    if (p.has("g") && GRADE_OPTIONS.includes(p.get("g")!)) setGrade(p.get("g")!);
    if (p.has("t") && TYPE_OPTIONS.some((item) => item.id === p.get("t"))) setTypeId(p.get("t")!);
  }, []);

  const cardType = useMemo(
    () => TYPE_OPTIONS.find((item) => item.id === typeId) ?? TYPE_OPTIONS[0],
    [typeId],
  );
  const displayName = nickname.trim() || "이름 없는 덕후";
  const gradeStars = Math.max(1, GRADE_OPTIONS.indexOf(grade) + 1);

  const cardStyle = {
    "--card-bg": cardType.bg,
    "--card-accent": cardType.accent,
    "--card-sub": cardType.sub,
    "--card-foil": cardType.foil,
    "--glare-x": `${tilt.glareX}%`,
    "--glare-y": `${tilt.glareY}%`,
    transform: `rotateX(${tilt.rotateX}deg) rotateY(${tilt.rotateY}deg)`,
    transformStyle: "preserve-3d",
  } as CSSProperties;

  const pageStyle = {
    "--card-bg": cardType.bg,
    "--card-accent": cardType.accent,
    "--card-sub": cardType.sub,
    "--card-foil": cardType.foil,
    background:
      `radial-gradient(ellipse at 50% 16%, ${cardType.accent}55 0%, transparent 38%), ` +
      `radial-gradient(ellipse at 18% 78%, ${cardType.sub}44 0%, transparent 34%), ` +
      `linear-gradient(145deg, ${cardType.bg} 0%, #07070b 62%, #000 100%)`,
  } as CSSProperties;

  const handleTilt = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    setIsHoveringCard(true);
    setTilt({ rotateX: (0.5 - y) * 16, rotateY: (x - 0.5) * 16, glareX: x * 100, glareY: y * 100 });
  };

  const resetTilt = () => {
    setIsHoveringCard(false);
    setTilt({ rotateX: 0, rotateY: 0, glareX: 50, glareY: 50 });
  };

  const renderCardFace = () => (
    <div className="relative z-10 h-full overflow-hidden rounded-[4.2%/3%] border-[4px] border-zinc-950 bg-zinc-100 text-white">
      <div className="absolute inset-[1.1%] overflow-hidden rounded-[1.2%]">
        {backgroundImageUrl ? (
          <img src={backgroundImageUrl} alt="" className="h-full w-full object-cover object-top" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-[var(--card-accent)] via-[var(--card-bg)] to-[var(--card-sub)] px-6 text-center text-xs font-black text-white/85">
            <ImagePlus size={28} />
          </div>
        )}
      </div>

      <div className="pointer-events-none absolute inset-[1.1%] rounded-[1.2%] bg-gradient-to-b from-black/35 via-transparent to-black/45" />
      <div className="pointer-events-none absolute inset-x-[1.1%] bottom-[1.1%] h-[38%] rounded-b-[1.2%] oshi-bottom-fade" />

      <header className="absolute left-[6%] right-[6%] top-[5%] z-20 flex items-center justify-between gap-4">
        <h2 className="oshi-title-stroke min-w-0 flex-1 text-2xl font-black text-white">{displayName}</h2>
        <div className="flex shrink-0 items-center gap-2">
          <span className="h-8 w-8 rounded-full bg-center bg-contain bg-no-repeat drop-shadow-[0_0_10px_var(--card-accent)]" style={typeLogoStyle(cardType)} />
          <span className="oshi-title-stroke text-lg font-black text-white">{cardType.label}</span>
        </div>
      </header>

      <div className="absolute inset-x-[7%] bottom-[3.7%] z-20 flex max-h-[38%] flex-col justify-end gap-4">
      <section className="flex items-center gap-4">
        <div className="oshi-avatar-circle pointer-events-none">
          {oshiAvatarUrl ? (
            <img src={oshiAvatarUrl} alt="" />
          ) : (
            <ImagePlus className="m-auto text-white/90" size={22} />
          )}
          <span className="oshi-ex-badge" aria-hidden>EX</span>
        </div>
        <div className="min-w-0 flex-1 pb-1">
          <span className="oshi-soft-badge px-3 py-1 text-xs font-black">
            <span aria-hidden>✦</span> 최애캐
          </span>
          <p className="oshi-glow-text oshi-main-name mt-2 break-keep">
            {oshi.trim() || "아직 고르는 중"}
          </p>
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center gap-2 pt-[10px]">
          <span className="oshi-soft-badge px-3 py-1 text-xs font-black">
            <span aria-hidden>📖</span> 인생작
          </span>
          <span className="text-xs font-black text-white/70">{works.length}/5</span>
        </div>
        {works.length ? (
          <div className="flex flex-wrap gap-1.5">
            {works.map((work) => (
              <span key={work} className="oshi-soft-chip">
                {work}
              </span>
            ))}
          </div>
        ) : (
          <p className="oshi-title-stroke text-sm font-black italic text-white/75">인생작 미선택</p>
        )}
      </section>

      <section>
        <div className="oshi-grade-divider mb-3" />
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="oshi-soft-badge px-3 py-1 text-xs font-black">
              <span aria-hidden>🏅</span> 등급
            </span>
            <p className="oshi-glow-text text-base font-black">{grade}</p>
          </div>
          <div className="flex shrink-0 items-center gap-[2px]">
            {[0, 1, 2, 3, 4].map((i) => (
              <span key={i} className={`oshi-star ${i < gradeStars ? "oshi-star-on" : "oshi-star-off"}`} aria-hidden>
                ★
              </span>
            ))}
          </div>
        </div>
      </section>
      </div>
    </div>
  );

  return (
    <>
      <OshiCardStyles />
      <style>{`
        #oshi-view-root {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: flex;
          justify-content: center;
          padding: 32px 16px;
          overflow-y: auto;
        }
        #oshi-view-shell {
          width: min(100%, 420px);
          min-height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 16px;
        }
        #oshi-view-card-wrap {
          perspective: 1200px;
          width: 100%;
        }
        #oshi-view-cta {
          border: 1px solid rgba(255,255,255,.34);
          background: rgba(0,0,0,.48);
          box-shadow: 0 18px 48px rgba(0,0,0,.38), inset 0 1px 0 rgba(255,255,255,.14);
          backdrop-filter: blur(14px);
        }
      `}</style>
      <div id="oshi-view-root" style={pageStyle}>
        <div id="oshi-view-shell">
          <div id="oshi-view-card-wrap">
            <div
              className="oshi-holo-card relative mx-auto aspect-[734/1024] w-full max-w-[420px] overflow-hidden rounded-[4.8%/3.4%] bg-zinc-100 p-[0.9%] text-white shadow-2xl transition-transform duration-150 ease-out"
              style={cardStyle}
              data-hovering={isHoveringCard ? "true" : "false"}
              onPointerMove={handleTilt}
              onPointerLeave={resetTilt}
            >
              {renderCardFace()}

              <div
                className="pointer-events-none absolute inset-0 z-20 holo-foil"
                style={{
                  opacity: isHoveringCard ? 0.35 : 0.22,
                  filter: isHoveringCard ? "brightness(1.08) contrast(1.36) saturate(1.6)" : undefined,
                }}
              />
              <div className="pointer-events-none absolute inset-0 z-[25] holo-type-tint" style={{ opacity: isHoveringCard ? 0.3 : 0 }} />
              <div className="pointer-events-none absolute inset-0 z-30 holo-glare" style={{ opacity: isHoveringCard ? 0.46 : 0 }} />
              <div className="pointer-events-none absolute inset-0 z-40 rounded-[4.8%/3.4%] ring-2 ring-white/45" />
            </div>
          </div>

          <section id="oshi-view-cta" className="rounded-2xl p-4 text-center text-white">
            <p className="text-sm font-black">
              {isExpired ? "이 공유 카드는 30일이 지나 만료됐습니다." : `이 사람의 덕질 타입은 ${cardType.label}`}
            </p>
            <p className="mt-1 text-xs font-bold text-white/72">
              {isExpired ? "새로운 덕질 프로필 카드는 바로 다시 만들 수 있습니다." : "받은 카드가 마음에 들면 내 덕질 프로필 카드도 바로 해보세요."}
            </p>
            <Link
              href="/play/oshi-card"
              className="mt-3 inline-flex items-center justify-center rounded-full border border-white/60 bg-white px-5 py-2 text-sm font-black text-zinc-950 shadow-lg hover:bg-white/90"
            >
              내 덕질 카드 해보기
            </Link>
          </section>
        </div>
      </div>
    </>
  );
}
