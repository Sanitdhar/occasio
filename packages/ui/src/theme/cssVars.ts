import type { ResolvedTheme } from '@occasio/theme';

/**
 * Flattens a resolved theme into CSS custom properties.
 *
 * React Native styles cannot express gradients, `backdrop-filter`, `::selection`, scrollbar
 * styling or print rules. Mirroring the tokens into CSS variables costs almost nothing and
 * unlocks all of that on web without a second source of truth — the values still come from the
 * resolver, they are merely also readable from CSS.
 *
 * Pure and DOM-free so the mapping is testable directly rather than through a rendered tree.
 */

const PREFIX = '--occasio';

export const toCssVars = (theme: ResolvedTheme): Readonly<Record<string, string>> => {
  const vars: Record<string, string> = {};

  for (const [name, value] of Object.entries(theme.color)) {
    if (typeof value === 'string') vars[`${PREFIX}-color-${name}`] = value;
  }
  for (const [name, value] of Object.entries(theme.color.interactive)) {
    vars[`${PREFIX}-color-interactive-${name}`] = value;
  }
  theme.color.ramp.brand.forEach((step, i) => {
    vars[`${PREFIX}-ramp-brand-${String(i + 1)}`] = step;
  });
  theme.color.ramp.neutral.forEach((step, i) => {
    vars[`${PREFIX}-ramp-neutral-${String(i + 1)}`] = step;
  });
  theme.color.ramp.accent.forEach((step, i) => {
    vars[`${PREFIX}-ramp-accent-${String(i + 1)}`] = step;
  });

  for (const [name, value] of Object.entries(theme.radius)) {
    vars[`${PREFIX}-radius-${name}`] = `${String(value)}px`;
  }
  /* space() is a function, so the scale is emitted as the steps a stylesheet can actually use. */
  for (const step of [1, 2, 3, 4, 5, 6, 8, 10, 12]) {
    vars[`${PREFIX}-space-${String(step)}`] = `${String(theme.space(step))}px`;
  }

  vars[`${PREFIX}-font-display`] = theme.type.family.display;
  vars[`${PREFIX}-font-body`] = theme.type.family.body;
  vars[`${PREFIX}-scrim-from`] = theme.image.scrimGradient[0];
  vars[`${PREFIX}-scrim-to`] = theme.image.scrimGradient[1];
  vars[`${PREFIX}-motion-base`] = `${String(theme.motion.base)}ms`;
  vars[`${PREFIX}-max-content-width`] = `${String(theme.layout.maxContentWidth)}px`;

  return vars;
};
