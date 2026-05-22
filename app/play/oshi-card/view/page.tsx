"use client";

import { CSSProperties, PointerEvent, useEffect, useState } from "react";
import { ImagePlus } from "lucide-react";
import { TYPE_OPTIONS, GRADE_OPTIONS, type CardType } from "../_config";
import OshiCardStyles from "../OshiCardStyles";

type TiltState = { rotateX: number; rotateY: number; glareX: number; glareY: number };

function typeLogoStyle(cardType: CardType): CSSProperties {
  return { backgroundImage: `url(/viral/type-logos/${cardType.id}.svg)` };
}

export default function OshiCardViewPage() {
  const [nickname, setNickname] = useState("");
  const [oshi, setOshi] = useState("");
  const [works, setWorks] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [grade, setGrade] = useState(GRADE_OPTIONS[2]);
  const [typeId, setTypeId] = useState(TYPE_OPTIONS[0].id);
  const [isHoveringCard, setIsHoveringCard] = useState(false);
  const [tilt, setTilt] = useState<TiltState>({ rotateX: 0, rotateY: 0, glareX: 50, glareY: 50 });

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.has("n")) setNickname(p.get("n")!);
    if (p.has("o")) setOshi(p.get("o")!);
    if (p.has("w")) setWorks(p.get("w")!.split(",").filter(Boolean).slice(0, 5));
    if (p.has("tg")) setTags(p.get("tg")!.split(",").filter(Boolean).slice(0, 6));
    if (p.has("g") && GRADE_OPTIONS.includes(p.get("g")!)) setGrade(p.get("g")!);
    if (p.has("t") && TYPE_OPTIONS.some((item) => item.id === p.get("t"))) setTypeId(p.get("t")!);
  }, []);

  const cardType = TYPE_OPTIONS.find((item) => item.id === typeId) ?? TYPE_OPTIONS[0];
  const displayName = nickname.trim() || "이름 없는 오타쿠";
  const gradeStars = Math.max(1, GRADE_OPTIONS.indexOf(grade) + 1);

  const cardStyle = {
    "--card-bg": cardType.bg,
    "--card-accent": cardType.accent,
    "--card-sub": cardType.sub,
    "--card-foil": cardType.foil,
    "--glare-x": `${tilt.glareX}%`,
    "--glare-y": `${tilt.glareY}%`,
    transform: `rotateX(${tilt.rotateX}deg) rotateY(${tilt.rotateY}deg)`,
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

  return (
    <>
      <OshiCardStyles />
      <style>{`
        #oshi-view-root {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          background: radial-gradient(ellipse at 50% 40%, #1e1040 0%, #0a0a14 60%, #000 100%);
          padding: 40px 16px;
          overflow-y: auto;
        }
        #oshi-view-card-wrap {
          perspective: 1200px;
          width: 100%;
          max-width: 380px;
          margin: 0 auto;
        }
      `}</style>
      <div id="oshi-view-root">
        <div id="oshi-view-card-wrap">
          <div
            className="oshi-holo-card relative aspect-[734/1024] w-full overflow-hidden rounded-[4.8%/3.4%] bg-zinc-100 p-[0.9%] text-white shadow-2xl transition-transform duration-150 ease-out"
            style={{ ...cardStyle, transformStyle: "preserve-3d" }}
            data-hovering={isHoveringCard ? "true" : "false"}
            onPointerMove={handleTilt}
            onPointerLeave={resetTilt}
          >
            {/* Card face */}
            <div className="relative z-10 h-full overflow-hidden rounded-[4.2%/3%] border-[4px] border-zinc-950 bg-zinc-100 text-zinc-950">
              <div className="absolute inset-[1.1%] overflow-hidden rounded-[1.2%]">
                <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-[var(--card-accent)] via-[var(--card-bg)] to-[var(--card-sub)] px-6 text-center text-xs font-black text-white/85">
                  <ImagePlus size={28} />
                </div>
              </div>
              <div className="pointer-events-none absolute inset-[1.1%] rounded-[1.2%] bg-gradient-to-b from-black/25 via-transparent to-black/55" />

              <header className="absolute left-[5%] right-[5%] top-[4%] flex items-center justify-between gap-4">
                <h2 className="oshi-title-stroke min-w-0 flex-1 truncate text-xl font-black text-white">{displayName}</h2>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="h-6 w-6 rounded-full bg-center bg-contain bg-no-repeat drop-shadow-[0_2px_5px_rgba(0,0,0,.6)]" style={typeLogoStyle(cardType)} />
                  <span className="oshi-title-stroke text-base font-black text-white">{cardType.label}</span>
                </div>
              </header>

              <div className="absolute inset-x-[5%] bottom-[26%] z-20">
                <div className="pointer-events-none absolute left-1/2 top-0 z-30 -translate-x-1/2 -translate-y-1/2">
                  <div className="oshi-ribbon">
                    <span aria-hidden>✦</span>
                    <span>OTAKU CARD</span>
                    <span aria-hidden>✦</span>
                  </div>
                </div>
                <section className="oshi-info-plate relative flex min-h-[15.5%] items-center gap-3 p-2.5 pt-5">
                  <div className="oshi-avatar-frame pointer-events-none">
                    <ImagePlus className="m-auto text-white/90" size={22} />
                    <span className="oshi-ex-badge" aria-hidden>EX</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="oshi-tag"><span aria-hidden>⚡</span> 최애캐</span>
                    <p className="oshi-title-stroke mt-1 truncate text-2xl font-black text-white">
                      {oshi.trim() || "아직 고르는 중"}
                    </p>
                  </div>
                </section>
              </div>

              <section className="oshi-info-plate absolute inset-x-[5%] bottom-[14%] flex min-h-[9%] flex-col justify-center gap-1 px-2.5 py-2">
                <div className="flex items-center gap-1.5">
                  <span className="oshi-tag"><span aria-hidden>📖</span> 인생작</span>
                  <span className="text-[9px] font-black tracking-widest text-white/55">{works.length}/5</span>
                </div>
                {works.length ? (
                  <div className="flex flex-wrap gap-1">
                    {works.map((work) => (
                      <span key={work} className="oshi-chip">{work}</span>
                    ))}
                  </div>
                ) : (
                  <p className="oshi-title-stroke truncate text-sm font-black italic text-white/80">인생작 미선택</p>
                )}
              </section>

              <section className="oshi-info-plate absolute inset-x-[5%] bottom-[3%] flex min-h-[9%] items-center justify-between gap-2 px-2.5 py-2">
                <div className="flex min-w-0 flex-1 items-center gap-1.5">
                  <span className="oshi-tag"><span aria-hidden>🏅</span> 등급</span>
                  <p className="oshi-title-stroke truncate text-base font-black text-white">{grade}</p>
                </div>
                <div className="flex shrink-0 items-center gap-[1px]">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <span key={i} className={`oshi-star ${i < gradeStars ? "oshi-star-on" : "oshi-star-off"}`} aria-hidden>★</span>
                  ))}
                </div>
              </section>
            </div>

            <div
              className="pointer-events-none absolute inset-0 z-20 holo-foil"
              style={{
                opacity: isHoveringCard ? 0.68 : 0.22,
                filter: isHoveringCard ? "brightness(1.08) contrast(1.36) saturate(1.6)" : undefined,
              }}
            />
            <div className="pointer-events-none absolute inset-0 z-[25] holo-type-tint" style={{ opacity: isHoveringCard ? 0.3 : 0 }} />
            <div className="pointer-events-none absolute inset-0 z-30 holo-glare" style={{ opacity: isHoveringCard ? 0.46 : 0 }} />
            <div className="pointer-events-none absolute inset-0 z-40 rounded-[4.8%/3.4%] ring-2 ring-white/45" />
          </div>
        </div>
      </div>
    </>
  );
}
