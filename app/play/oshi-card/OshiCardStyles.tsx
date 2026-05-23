const CSS = `
.oshi-holo-card {
  background:
    linear-gradient(115deg, transparent 0%, rgba(255,255,255,.20) var(--glare-x), transparent 58%),
    radial-gradient(farthest-corner circle at var(--glare-x) var(--glare-y), rgba(255,255,255,.34) 0%, rgba(255,255,255,.10) 22%, transparent 44%),
    linear-gradient(135deg, var(--card-accent), var(--card-bg) 44%, var(--card-sub));
}
.holo-foil {
  background:
    radial-gradient(circle at var(--glare-x) var(--glare-y), color-mix(in srgb, white 23%, var(--card-accent)) 0%, transparent 34%),
    url("/viral/sparkles.gif") var(--glare-x) var(--glare-y) / cover,
    url("/viral/holo.png") center / cover,
    repeating-linear-gradient(115deg, transparent 0 10px, rgba(255,255,255,.10) 11px 12px, transparent 13px 24px),
    conic-gradient(from 180deg at var(--glare-x) var(--glare-y), rgba(255,0,128,.16), rgba(255,140,0,.12), rgba(255,255,0,.10), rgba(0,255,132,.12), rgba(0,194,255,.18), rgba(139,92,246,.14), rgba(255,0,128,.16));
  background-blend-mode: screen, screen, screen, overlay, normal;
  mix-blend-mode: screen;
  filter: brightness(.82) contrast(1.18) saturate(1.25);
  opacity: .22;
  transition: opacity 160ms ease, filter 160ms ease;
}
.holo-glare {
  background:
    linear-gradient(115deg, transparent 16%, rgba(255,255,255,.10) calc(var(--glare-x) - 12%), rgba(255,255,255,.16) var(--glare-x), rgba(255,255,255,.12) calc(var(--glare-x) + 12%), transparent 84%),
    radial-gradient(circle at var(--glare-x) var(--glare-y), rgba(255,255,255,.15), rgba(255,255,255,.05) 16%, transparent 38%);
  mix-blend-mode: screen;
  opacity: 0;
  transition: opacity 160ms ease;
}
.holo-type-tint {
  background:
    linear-gradient(115deg, transparent 8%, var(--card-accent) 38%, var(--card-foil) 58%, transparent 86%),
    radial-gradient(circle at var(--glare-x) var(--glare-y), var(--card-sub), transparent 42%);
  mix-blend-mode: color-dodge;
  transition: opacity 160ms ease;
}
.oshi-holo-card[data-hovering="true"] .holo-foil { opacity: .56; filter: brightness(1.08) contrast(1.36) saturate(1.6); }
.oshi-holo-card[data-hovering="true"] .holo-glare { opacity: .34; }
.oshi-bottom-fade {
  background:
    linear-gradient(180deg, transparent 0%, rgba(0,0,0,.18) 12%, rgba(0,0,0,.74) 54%, rgba(0,0,0,.94) 100%),
    radial-gradient(110% 80% at 18% 32%, color-mix(in srgb, var(--card-accent) 42%, transparent) 0%, transparent 58%),
    radial-gradient(90% 70% at 88% 74%, color-mix(in srgb, var(--card-sub) 38%, transparent) 0%, transparent 62%);
  mix-blend-mode: normal;
}
.oshi-title-stroke {
  text-shadow:
    -2px -2px 0 #111827, 2px -2px 0 #111827,
    -2px  2px 0 #111827, 2px  2px 0 #111827,
     0   -2px 0 #111827, 0    2px 0 #111827,
    -2px  0   0 #111827, 2px  0   0 #111827,
     0    2px 6px rgba(0,0,0,.55);
}
.oshi-glow-text {
  color: #fff;
  text-shadow:
    -2px -2px 0 color-mix(in srgb, var(--card-accent) 72%, #111827),
     2px -2px 0 color-mix(in srgb, var(--card-accent) 72%, #111827),
    -2px  2px 0 color-mix(in srgb, var(--card-accent) 72%, #111827),
     2px  2px 0 color-mix(in srgb, var(--card-accent) 72%, #111827),
     0   -2px 0 color-mix(in srgb, var(--card-accent) 72%, #111827),
     0    2px 0 color-mix(in srgb, var(--card-accent) 72%, #111827),
    -2px  0   0 color-mix(in srgb, var(--card-accent) 72%, #111827),
     2px  0   0 color-mix(in srgb, var(--card-accent) 72%, #111827),
    0 0 10px var(--card-accent),
    0 0 24px color-mix(in srgb, var(--card-accent) 72%, transparent);
}
.oshi-soft-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  width: fit-content;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,.42);
  background: linear-gradient(135deg, color-mix(in srgb, var(--card-accent) 68%, rgba(0,0,0,.2)), rgba(255,255,255,.12));
  box-shadow: 0 4px 14px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.28);
  color: #fff;
  text-shadow: 0 1px 2px rgba(0,0,0,.65);
}
.oshi-avatar-circle {
  position: relative;
  display: flex;
  width: 80px;
  height: 80px;
  flex: 0 0 auto;
  overflow: visible;
  border-radius: 999px;
  background: rgba(0,0,0,.5);
  box-shadow: 0 10px 26px rgba(0,0,0,.55), 0 0 0 3px color-mix(in srgb, var(--card-accent) 72%, white 28%);
}
.oshi-avatar-circle > img, .oshi-avatar-circle > svg {
  width: 100%;
  height: 100%;
  border-radius: 999px;
  object-fit: cover;
}
.oshi-avatar-circle::after {
  content: "";
  position: absolute;
  inset: -5px;
  border-radius: inherit;
  border: 1px solid rgba(255,255,255,.55);
  pointer-events: none;
}
.oshi-main-name {
  font-size: 42px;
  line-height: 1;
  font-weight: 1000;
  letter-spacing: 0;
}
.oshi-main-input {
  width: 100%;
  min-width: 0;
  border: 0;
  border-bottom: 2px solid rgba(255,255,255,.45);
  background: transparent;
  outline: none;
}
.oshi-soft-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border-radius: 7px;
  border: 1px solid rgba(255,255,255,.48);
  background: rgba(18,18,24,.42);
  padding: 4px 9px;
  color: #fff;
  font-size: 12px;
  font-weight: 900;
  text-shadow: 0 1px 2px rgba(0,0,0,.75);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.14);
}
.oshi-soft-chip::before {
  content: "✦";
  color: var(--card-foil);
  text-shadow: 0 0 7px var(--card-accent);
}
.oshi-grade-divider {
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,.34), transparent);
}
.oshi-info-plate {
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(0,0,0,.78) 0%, rgba(20,20,32,.72) 50%, rgba(0,0,0,.82) 100%);
  border: 1.5px solid rgba(255,255,255,.55);
  box-shadow: 0 10px 26px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.2), inset 0 -1px 0 rgba(0,0,0,.45);
  isolation: isolate;
}
.oshi-info-plate::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  padding: 1.5px;
  background: linear-gradient(135deg, var(--card-accent), var(--card-foil) 50%, var(--card-sub));
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
  z-index: 1;
}
.oshi-info-plate::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: radial-gradient(120% 60% at 0% 0%, var(--card-accent) 0%, transparent 55%), radial-gradient(120% 60% at 100% 100%, var(--card-sub) 0%, transparent 55%);
  mix-blend-mode: overlay;
  opacity: .55;
  pointer-events: none;
  z-index: 0;
}
.oshi-info-plate > * { position: relative; z-index: 2; }
.oshi-ribbon {
  display: inline-flex;
  align-items: center;
  gap: .55rem;
  padding: 3px 16px;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: .22em;
  color: #1a1208;
  text-shadow: 0 1px 0 rgba(255,255,255,.55);
  background: linear-gradient(180deg, rgba(255,255,255,.55) 0%, rgba(255,255,255,0) 55%), linear-gradient(90deg, var(--card-accent) 0%, var(--card-foil) 50%, var(--card-accent) 100%);
  border-radius: 999px;
  border: 1.5px solid rgba(255,255,255,.9);
  box-shadow: 0 6px 16px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.7), inset 0 -1px 0 rgba(0,0,0,.3);
}
.oshi-tag {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 1.5px 8px;
  font-size: 9.5px;
  font-weight: 900;
  letter-spacing: .12em;
  color: #fff;
  text-shadow: 0 1px 1px rgba(0,0,0,.55);
  background: linear-gradient(95deg, var(--card-accent), var(--card-sub));
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,.55);
  box-shadow: 0 2px 6px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.35);
  width: fit-content;
  white-space: nowrap;
}
.oshi-chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 900;
  color: #fff;
  text-shadow: -1.5px -1.5px 0 #111, 1.5px -1.5px 0 #111, -1.5px 1.5px 0 #111, 1.5px 1.5px 0 #111;
  background: linear-gradient(135deg, rgba(255,255,255,.22), rgba(255,255,255,.08));
  border: 1px solid rgba(255,255,255,.5);
  border-radius: 6px;
  box-shadow: 0 2px 4px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.3);
}
.oshi-chip::before { content: "✦"; font-size: 9px; color: var(--card-foil); text-shadow: 0 0 4px var(--card-accent); }
.oshi-avatar-frame {
  position: relative;
  display: flex;
  height: 5rem;
  width: 5rem;
  flex-shrink: 0;
  overflow: visible;
  border-radius: 14px;
  background: rgba(0,0,0,.4);
  isolation: isolate;
}
.oshi-avatar-frame > img, .oshi-avatar-frame > svg { border-radius: 12px; overflow: hidden; }
.oshi-avatar-frame > img { height: 100%; width: 100%; object-fit: cover; }
.oshi-avatar-frame::before {
  content: "";
  position: absolute;
  inset: -2px;
  border-radius: 16px;
  padding: 2.5px;
  background: linear-gradient(135deg, var(--card-accent), var(--card-foil), var(--card-sub));
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
  box-shadow: 0 6px 14px rgba(0,0,0,.4);
}
.oshi-avatar-frame::after {
  content: "";
  position: absolute;
  inset: 2px;
  border-radius: 12px;
  border: 1.5px solid rgba(255,255,255,.7);
  pointer-events: none;
}
.oshi-ex-badge {
  position: absolute;
  right: -6px;
  bottom: -6px;
  z-index: 5;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 1.5px 6px;
  font-size: 10px;
  font-weight: 900;
  font-style: italic;
  letter-spacing: .04em;
  color: #1a1208;
  background: linear-gradient(135deg, #fde047, #fbbf24 55%, #fde047);
  border: 1.5px solid #fff;
  border-radius: 999px;
  box-shadow: 0 3px 8px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.6);
}
.oshi-star { font-size: 14px; line-height: 1; }
.oshi-star-on { color: #fde047; text-shadow: 0 0 6px rgba(253,224,71,.65), 0 0 2px rgba(253,224,71,.95), 0 1px 0 rgba(0,0,0,.6); }
.oshi-star-off { color: rgba(255,255,255,.22); text-shadow: 0 1px 0 rgba(0,0,0,.45); }
`;

export default function OshiCardStyles() {
  // eslint-disable-next-line react/no-danger
  return <style dangerouslySetInnerHTML={{ __html: CSS }} />;
}
