import { chromaOf, contrast, hueOf, isAchromatic } from './color';
import { PRESETS } from './presets/index';
import { resolveTheme } from './resolve';
import type { ResolveContext, Scheme, ThemeInput } from './types';

/**
 * The "Checks" panel in the theme editor (D10).
 *
 * The resolver already guarantees contrast, so these are not gates — they explain what the
 * system did. Being transparent about an auto-correction ("we adjusted your brand colour for
 * readability") is the difference between a tool that feels helpful and one that feels broken.
 */

export type CheckStatus = 'pass' | 'warn';

export type ThemeCheck = {
  readonly id: string;
  readonly label: string;
  readonly status: CheckStatus;
  readonly detail: string;
  readonly ratio?: number;
};

export type ThemeCheckReport = {
  readonly scheme: Scheme;
  readonly checks: readonly ThemeCheck[];
};

const MIN_ACCENT_HUE_SEPARATION = 22;
const NEON_CHROMA = 0.16;
const WASHED_CHROMA = 0.045;

const ratioCheck = (
  id: string,
  label: string,
  foreground: string,
  background: string,
  target: number,
): ThemeCheck => {
  const ratio = Math.round(contrast(foreground, background) * 100) / 100;
  return {
    id,
    label,
    status: ratio >= target ? 'pass' : 'warn',
    detail:
      ratio >= target
        ? `Contrast ${String(ratio)}:1, meets ${String(target)}:1.`
        : `Contrast ${String(ratio)}:1, below ${String(target)}:1.`,
    ratio,
  };
};

export const runThemeChecks = (
  input: ThemeInput,
  context: ResolveContext = {},
): ThemeCheckReport => {
  const theme = resolveTheme(input, context);
  const preset = PRESETS[input.presetId];
  const { color } = theme;
  const checks: ThemeCheck[] = [
    ratioCheck('body-text', 'Body text on surface', color.text, color.surface, 7),
    ratioCheck('muted-text', 'Secondary text on surface', color.textMuted, color.surface, 4.5),
    ratioCheck('brand-button', 'Label on a brand button', color.onBrand, color.brand, 4.5),
    ratioCheck('accent-button', 'Label on an accent button', color.onAccent, color.accent, 4.5),
    ratioCheck('borders', 'Borders against surface', color.border, color.surface, 1.4),
  ];

  const seedChroma = chromaOf(input.brand.seed);
  if (seedChroma > NEON_CHROMA) {
    checks.push({
      id: 'seed-clamped',
      label: 'Brand colour adjusted',
      status: 'warn',
      detail:
        'Your brand colour is more saturated than screens can show consistently, so the derived palette uses a slightly calmer version. Your chosen colour is still used for solid brand elements.',
    });
  } else if (isAchromatic(input.brand.seed)) {
    checks.push({
      id: 'seed-monochrome',
      label: 'Monochrome palette',
      status: 'pass',
      detail:
        'Your brand colour has no hue, so the whole palette is built from greys. Any black, white or grey you pick gives this same monochrome result.',
    });
  } else if (seedChroma < WASHED_CHROMA) {
    checks.push({
      id: 'seed-boosted',
      label: 'Brand colour strengthened',
      status: 'warn',
      detail:
        'Your brand colour is close to grey, so the palette adds a little saturation — otherwise buttons and links would be hard to pick out from the background.',
    });
  }

  const accentSeed = input.brand.accent;
  if (accentSeed !== undefined) {
    const separation = Math.abs(((hueOf(accentSeed) - hueOf(input.brand.seed) + 540) % 360) - 180);
    if (separation < MIN_ACCENT_HUE_SEPARATION) {
      checks.push({
        id: 'accent-similarity',
        label: 'Accent is close to your brand colour',
        status: 'warn',
        detail:
          'Attendees will struggle to tell a primary action from a highlight. Pick an accent further round the colour wheel, or leave it unset and we will derive one.',
      });
    }
  }

  if (input.mode.support !== 'system') {
    checks.push({
      id: 'scheme-pinned',
      label: `Always ${input.mode.support}`,
      status: 'pass',
      detail: `Attendees always see the ${input.mode.support} version, whatever their device is set to. The "${preset.label}" preset chose this.`,
    });
  }

  return { scheme: theme.scheme, checks };
};
