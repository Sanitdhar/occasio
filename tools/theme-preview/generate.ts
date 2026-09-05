import { mkdirSync, writeFileSync } from 'node:fs';
import {
  contrast,
  PRESETS,
  resolveTheme,
  runThemeChecks,
  themeInputFromPreset,
} from '@occasio/theme';
import type { PresetId, ResolvedTheme, Scheme } from '@occasio/theme';

/**
 * The swatch dump.
 *
 * The contrast property test proves the engine is *safe*; this proves it is *distinctive* —
 * the same components, the same code, rendering five events that look nothing alike. Run with
 * `npm run preview:theme`, output at .artifacts/theme-preview.html.
 */

type Demo = {
  readonly slug: string;
  readonly name: string;
  readonly kind: string;
  readonly presetId: PresetId;
  readonly seed: string;
  readonly day: string;
  readonly session: string;
  readonly time: string;
  readonly venue: string;
  readonly blurb: string;
  readonly chips: readonly string[];
};

const DEMOS: readonly Demo[] = [
  {
    slug: 'santi-riyanks',
    name: 'Santi & Riyank',
    kind: 'Wedding · 3 days · Asia/Kolkata',
    presetId: 'romantic',
    seed: '#7C3A5A',
    day: 'Day 2 · Saturday 14 February',
    session: 'The Sangeet',
    time: '18:00 — 23:30',
    venue: 'Garden Lawn, Taj Falaknuma',
    blurb: 'Dinner, dancing and far too many rehearsed family performances.',
    chips: ['Dress: festive', 'Dinner served', 'Shuttle 17:30'],
  },
  {
    slug: 'anandhara',
    name: 'Anandhara',
    kind: 'Festival · 2 days · 4 stages',
    presetId: 'festival',
    seed: '#E8582B',
    day: 'Day 1 · Friday 8 May',
    session: 'Peter Cat Recording Co.',
    time: '21:15 — 22:45',
    venue: 'Main Stage',
    blurb: 'Closing the first night. Gates shut at 21:00, so do not dawdle.',
    chips: ['Main Stage', 'Live', '18+'],
  },
  {
    slug: 'devcon-25',
    name: 'DevCon 25',
    kind: 'Conference · 2 days · 3 tracks',
    presetId: 'conference',
    seed: '#2B6CB0',
    day: 'Day 1 · Tuesday 16 September',
    session: 'Shipping multi-tenant themes',
    time: '11:20 — 12:00',
    venue: 'Track B · Hall 2',
    blurb: 'How one codebase renders a thousand events without a per-event branch.',
    chips: ['Track B', '40 min', 'Recorded'],
  },
  {
    slug: 'batch-04-reunion',
    name: 'Batch of 04',
    kind: 'Reunion · 1 day · 120 guests',
    presetId: 'editorial',
    seed: '#3F7A63',
    day: 'Saturday 22 November',
    session: 'Twenty Years On',
    time: '19:00 — late',
    venue: 'The Old Quadrangle',
    blurb: 'Drinks on the lawn, then dinner in hall. Name badges, mercifully, provided.',
    chips: ['Dinner', 'Partners welcome', 'Parking'],
  },
  {
    slug: 'atelier-mono',
    name: 'Atelier Mono',
    kind: 'Launch · achromatic seed',
    presetId: 'minimal',
    seed: '#6B6B6B',
    day: 'Thursday 5 March',
    session: 'Private View',
    time: '18:30 — 21:00',
    venue: 'Studio 4, Bankside',
    blurb: 'A grey seed has no hue, so the whole palette is built from greys.',
    chips: ['Invitation only', 'RSVP'],
  },
];

const CONTRAST_ROWS = [
  {
    label: 'Body text',
    fg: (t: ResolvedTheme) => t.color.text,
    bg: (t: ResolvedTheme) => t.color.surface,
    min: 7,
  },
  {
    label: 'Secondary',
    fg: (t: ResolvedTheme) => t.color.textMuted,
    bg: (t: ResolvedTheme) => t.color.surface,
    min: 4.5,
  },
  {
    label: 'Brand button',
    fg: (t: ResolvedTheme) => t.color.onBrand,
    bg: (t: ResolvedTheme) => t.color.brand,
    min: 4.5,
  },
  {
    label: 'Accent button',
    fg: (t: ResolvedTheme) => t.color.onAccent,
    bg: (t: ResolvedTheme) => t.color.accent,
    min: 4.5,
  },
  {
    label: 'Danger',
    fg: (t: ResolvedTheme) => t.color.onDanger,
    bg: (t: ResolvedTheme) => t.color.danger,
    min: 4.5,
  },
  {
    label: 'Border',
    fg: (t: ResolvedTheme) => t.color.border,
    bg: (t: ResolvedTheme) => t.color.surface,
    min: 1.4,
  },
] as const;

const escape = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const textStyle = (token: {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  fontWeight: string;
}): string =>
  `font-size:${String(token.fontSize)}px;line-height:${String(token.lineHeight)}px;letter-spacing:${String(token.letterSpacing)}px;font-weight:${token.fontWeight}`;

/** The attendee card, rendered purely from resolved tokens — no literal colours anywhere. */
const renderCard = (demo: Demo, theme: ResolvedTheme): string => {
  const t = theme;
  const [scrimFrom, scrimTo] = t.image.scrimGradient;
  return `
<div class="device" style="background:${t.color.bg};border-color:${t.color.border}">
  <div class="card" style="background:${t.color.surface};border-radius:${String(t.radius.lg)}px;border-color:${t.color.border};padding:${String(t.space(4))}px;gap:${String(t.space(3))}px">
    <div class="hero" style="aspect-ratio:${t.image.heroAspect.toFixed(4)};border-radius:${String(t.radius.hero)}px;background:linear-gradient(140deg, ${t.color.ramp.brand[6]}, ${t.color.ramp.accent[7]})">
      <div class="scrim" style="background:linear-gradient(to bottom, ${scrimFrom}, ${scrimTo})"></div>
      <div class="heroText" style="padding:${String(t.space(4))}px;gap:${String(t.space(1))}px">
        <span style="${textStyle(t.type.overline)};color:${t.color.textInverse};text-transform:uppercase;opacity:.85">${escape(demo.day)}</span>
        <span style="${textStyle(t.type.display2)};color:${t.color.textInverse}">${escape(demo.session)}</span>
      </div>
    </div>
    <div class="row" style="gap:${String(t.space(2))}px">
      <span style="${textStyle(t.type.bodyStrong)};color:${t.color.brand}">${escape(demo.time)}</span>
      <span style="${textStyle(t.type.body)};color:${t.color.textMuted}">${escape(demo.venue)}</span>
    </div>
    <p style="${textStyle(t.type.body)};color:${t.color.text};margin:0">${escape(demo.blurb)}</p>
    <div class="chips" style="gap:${String(t.space(2))}px">
      ${demo.chips
        .map(
          (chip) =>
            `<span style="${textStyle(t.type.caption)};color:${t.color.onBrandSubtle};background:${t.color.brandSubtle};border-radius:${String(t.radius.pill)}px;padding:${String(t.space(1))}px ${String(t.space(3))}px">${escape(chip)}</span>`,
        )
        .join('')}
    </div>
    <div class="actions" style="gap:${String(t.space(2))}px">
      <span class="btn" style="${textStyle(t.type.bodyStrong)};background:${t.color.brand};color:${t.color.onBrand};border-radius:${String(t.radius.md)}px;padding:${String(t.space(3))}px ${String(t.space(5))}px">I'll be there</span>
      <span class="btn" style="${textStyle(t.type.bodyStrong)};background:${t.color.accent};color:${t.color.onAccent};border-radius:${String(t.radius.md)}px;padding:${String(t.space(3))}px ${String(t.space(5))}px">Directions</span>
      <span class="btn" style="${textStyle(t.type.bodyStrong)};background:${t.color.interactive.disabled};color:${t.color.interactive.onDisabled};border-radius:${String(t.radius.md)}px;padding:${String(t.space(3))}px ${String(t.space(5))}px">Full</span>
    </div>
  </div>
</div>`;
};

const renderRamp = (label: string, ramp: readonly string[]): string => `
<div class="ramp">
  <span class="rampLabel">${escape(label)}</span>
  <div class="rampStrip">${ramp.map((c) => `<i style="background:${c}" title="${c}"></i>`).join('')}</div>
</div>`;

const renderRatios = (theme: ResolvedTheme): string => `
<table class="ratios">
  <thead><tr><th>Pair</th><th>Ratio</th><th>Target</th></tr></thead>
  <tbody>
    ${CONTRAST_ROWS.map((row) => {
      const ratio = contrast(row.fg(theme), row.bg(theme));
      const ok = ratio >= row.min;
      return `<tr><td>${row.label}</td><td class="num ${ok ? 'ok' : 'bad'}">${ratio.toFixed(2)}</td><td class="num dim">${row.min.toFixed(2)}</td></tr>`;
    }).join('')}
  </tbody>
</table>`;

const renderDemo = (demo: Demo): string => {
  const input = themeInputFromPreset(demo.presetId, demo.seed);
  const preset = PRESETS[demo.presetId];
  const schemes: readonly Scheme[] = ['light', 'dark'];
  const themes = schemes.map((scheme) => ({
    scheme,
    theme: resolveTheme(input, { forceScheme: scheme }),
  }));
  const notes = runThemeChecks(input, { forceScheme: 'light' }).checks.filter(
    (c) => c.status === 'warn' || c.id === 'seed-monochrome',
  );

  return `
<section class="demo">
  <header class="demoHead">
    <div>
      <h2>${escape(demo.name)}</h2>
      <p class="kind">${escape(demo.kind)}</p>
    </div>
    <dl class="meta">
      <div><dt>Route</dt><dd class="mono">/e/${escape(demo.slug)}</dd></div>
      <div><dt>Preset</dt><dd>${escape(preset.label)}</dd></div>
      <div><dt>Seed</dt><dd class="mono"><i class="seedDot" style="background:${demo.seed}"></i>${escape(demo.seed)}</dd></div>
      <div><dt>Scheme</dt><dd>${input.mode.support === 'system' ? 'Follows device' : `Always ${input.mode.support}`}</dd></div>
    </dl>
  </header>

  <div class="panels">
    ${themes
      .map(
        ({ scheme, theme }) => `
      <figure class="panel">
        <figcaption>${scheme}</figcaption>
        ${renderCard(demo, theme)}
      </figure>`,
      )
      .join('')}
  </div>

  <div class="detail">
    <div class="ramps">
      ${renderRamp('Brand', themes[0]?.theme.color.ramp.brand ?? [])}
      ${renderRamp('Neutral', themes[0]?.theme.color.ramp.neutral ?? [])}
      ${renderRamp('Accent', themes[0]?.theme.color.ramp.accent ?? [])}
    </div>
    <div class="ratioWrap">
      ${themes.map(({ scheme, theme }) => `<div class="ratioCol"><span class="rampLabel">${scheme}</span>${renderRatios(theme)}</div>`).join('')}
    </div>
  </div>

  ${
    notes.length > 0
      ? `<ul class="notes">${notes.map((n) => `<li><strong>${escape(n.label)}</strong> ${escape(n.detail)}</li>`).join('')}</ul>`
      : ''
  }
</section>`;
};

const page = `<title>Occasio Theme Engine</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap">
<style>
  :root {
    --paper: #FBFAF8;
    --raised: #FFFFFF;
    --ink: #17161A;
    --ink-soft: #6B6862;
    --ink-faint: #96928B;
    --rule: #E5E2DC;
    --ok: #2F6F4F;
    --bad: #A33A2C;
    --ui: 'Instrument Sans', ui-sans-serif, system-ui, sans-serif;
    --mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, monospace;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --paper: #131316; --raised: #1B1B1F; --ink: #F2F0EC; --ink-soft: #A6A29B;
      --ink-faint: #78746D; --rule: #2C2C31; --ok: #6FBE92; --bad: #E08C7E;
    }
  }
  :root[data-theme="dark"] {
    --paper: #131316; --raised: #1B1B1F; --ink: #F2F0EC; --ink-soft: #A6A29B;
    --ink-faint: #78746D; --rule: #2C2C31; --ok: #6FBE92; --bad: #E08C7E;
  }
  * { box-sizing: border-box; }
  body { background: var(--paper); color: var(--ink); font-family: var(--ui); margin: 0; }
  .wrap { max-width: 1080px; margin: 0 auto; padding: 56px 24px 96px; display: flex; flex-direction: column; gap: 56px; }
  .lede { display: flex; flex-direction: column; gap: 12px; border-bottom: 1px solid var(--rule); padding-bottom: 32px; }
  .lede h1 { font-size: 34px; line-height: 1.1; margin: 0; letter-spacing: -0.02em; text-wrap: balance; }
  .lede p { margin: 0; color: var(--ink-soft); max-width: 62ch; font-size: 15px; line-height: 1.6; }
  .lede .stat { font-family: var(--mono); font-size: 12px; color: var(--ink-faint); letter-spacing: .02em; }
  .demo { display: flex; flex-direction: column; gap: 20px; }
  .demoHead { display: flex; flex-wrap: wrap; gap: 20px; justify-content: space-between; align-items: flex-end; border-bottom: 1px solid var(--rule); padding-bottom: 14px; }
  .demoHead h2 { margin: 0; font-size: 22px; letter-spacing: -0.01em; }
  .kind { margin: 4px 0 0; color: var(--ink-faint); font-size: 13px; }
  .meta { display: flex; flex-wrap: wrap; gap: 22px; margin: 0; }
  .meta div { display: flex; flex-direction: column; gap: 3px; }
  .meta dt { font-size: 10px; text-transform: uppercase; letter-spacing: .09em; color: var(--ink-faint); }
  .meta dd { margin: 0; font-size: 13px; color: var(--ink); display: flex; align-items: center; gap: 6px; }
  .mono { font-family: var(--mono); font-size: 12px; }
  .seedDot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; outline: 1px solid var(--rule); }
  .panels { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 18px; }
  .panel { margin: 0; display: flex; flex-direction: column; gap: 8px; }
  .panel figcaption { font-size: 10px; text-transform: uppercase; letter-spacing: .09em; color: var(--ink-faint); }
  .device { border: 1px solid; border-radius: 14px; padding: 14px; }
  .card { display: flex; flex-direction: column; border: 1px solid; }
  .hero { position: relative; overflow: hidden; display: flex; align-items: flex-end; }
  .scrim { position: absolute; inset: 0; }
  .heroText { position: relative; display: flex; flex-direction: column; width: 100%; }
  .row { display: flex; flex-wrap: wrap; align-items: baseline; }
  .chips, .actions { display: flex; flex-wrap: wrap; }
  .btn { display: inline-flex; }
  .detail { display: grid; grid-template-columns: minmax(240px, 1fr) minmax(300px, 1.1fr); gap: 24px; align-items: start; }
  .ramps { display: flex; flex-direction: column; gap: 10px; }
  .ramp { display: flex; flex-direction: column; gap: 5px; }
  .rampLabel { font-size: 10px; text-transform: uppercase; letter-spacing: .09em; color: var(--ink-faint); }
  .rampStrip { display: flex; border-radius: 5px; overflow: hidden; border: 1px solid var(--rule); }
  .rampStrip i { flex: 1; height: 26px; }
  .ratioWrap { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
  .ratioCol { display: flex; flex-direction: column; gap: 5px; }
  table.ratios { border-collapse: collapse; width: 100%; font-size: 12px; }
  .ratios th { text-align: left; font-weight: 500; color: var(--ink-faint); font-size: 10px; text-transform: uppercase; letter-spacing: .07em; padding-bottom: 5px; border-bottom: 1px solid var(--rule); }
  .ratios td { padding: 4px 0; border-bottom: 1px solid var(--rule); color: var(--ink-soft); }
  .num { font-family: var(--mono); font-variant-numeric: tabular-nums; text-align: right; }
  .ok { color: var(--ok); } .bad { color: var(--bad); } .dim { color: var(--ink-faint); }
  .notes { margin: 0; padding: 12px 16px; list-style: none; display: flex; flex-direction: column; gap: 8px; background: var(--raised); border: 1px solid var(--rule); border-radius: 8px; font-size: 13px; color: var(--ink-soft); line-height: 1.5; }
  .notes strong { color: var(--ink); font-weight: 600; }
  @media (max-width: 820px) { .detail { grid-template-columns: 1fr; } }
</style>
<div class="wrap">
  <header class="lede">
    <h1>Five events, one codebase, zero per-event styling</h1>
    <p>Every card below is the same component reading the same tokens. The only thing that differs is a preset name and one seed colour — the engine derives roughly 150 tokens from that, and guarantees the contrast of each one rather than trusting a reviewer to spot a bad pairing.</p>
    <p class="stat">resolveTheme() · ${String(DEMOS.length)} events × light + dark · ratios measured from the rendered tokens, not asserted</p>
  </header>
  ${DEMOS.map(renderDemo).join('')}
  <footer class="lede" style="border-bottom:none;padding-bottom:0">
    <p class="stat">Generated by tools/theme-preview/generate.ts — npm run preview:theme</p>
  </footer>
</div>`;

mkdirSync('.artifacts', { recursive: true });
writeFileSync('.artifacts/theme-preview.html', page);
console.log(
  `Wrote .artifacts/theme-preview.html (${String(DEMOS.length)} events, ${String(page.length)} bytes)`,
);
