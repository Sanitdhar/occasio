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

  for (const [name, value] of Object.entries(theme.border)) {
    vars[`${PREFIX}-border-${name}`] = `${String(value)}px`;
  }

  /* The full type scale, so CSS can set text without duplicating the numbers. Families are
     emitted with a fallback stack, since a tenant font may still be loading (#31). */
  vars[`${PREFIX}-font-display`] = `${theme.type.family.display}, Georgia, serif`;
  vars[`${PREFIX}-font-body`] = `${theme.type.family.body}, system-ui, sans-serif`;
  vars[`${PREFIX}-font-mono`] = `${theme.type.family.mono}, ui-monospace, monospace`;
  for (const role of [
    'display1',
    'display2',
    'title1',
    'title2',
    'body',
    'bodyStrong',
    'caption',
    'overline',
  ] as const) {
    const token = theme.type[role];
    vars[`${PREFIX}-type-${role}-size`] = `${String(token.fontSize)}px`;
    vars[`${PREFIX}-type-${role}-line-height`] = `${String(token.lineHeight)}px`;
    vars[`${PREFIX}-type-${role}-tracking`] = `${String(token.letterSpacing)}px`;
    vars[`${PREFIX}-type-${role}-weight`] = token.fontWeight;
  }

  /* Unitless on purpose: this is a CSS `aspect-ratio`, which takes a number. */
  vars[`${PREFIX}-image-hero-aspect`] = String(theme.image.heroAspect);
  vars[`${PREFIX}-image-radius`] = `${String(theme.image.radius)}px`;
  vars[`${PREFIX}-image-treatment`] = theme.image.treatment;
  vars[`${PREFIX}-scrim-from`] = theme.image.scrimGradient[0];
  vars[`${PREFIX}-scrim-to`] = theme.image.scrimGradient[1];

  /* Durations collapse to 0ms when motion is off, so a CSS transition honours reduced motion
     without every rule having to check a flag. */
  vars[`${PREFIX}-motion-enabled`] = theme.motion.enabled ? '1' : '0';
  vars[`${PREFIX}-motion-fast`] = `${String(theme.motion.fast)}ms`;
  vars[`${PREFIX}-motion-base`] = `${String(theme.motion.base)}ms`;
  vars[`${PREFIX}-motion-slow`] = `${String(theme.motion.slow)}ms`;

  vars[`${PREFIX}-max-content-width`] = `${String(theme.layout.maxContentWidth)}px`;
  for (const [name, value] of Object.entries(theme.layout.breakpoints)) {
    vars[`${PREFIX}-breakpoint-${name}`] = `${String(value)}px`;
  }

  return vars;
};
