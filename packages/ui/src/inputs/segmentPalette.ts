import type { ResolvedTheme } from '@occasio/theme';
import { surfacePalette, tonalPalette, type TonalPalette } from '../primitives/tones';

/**
 * What one segment is painted with.
 *
 * Its own module because the interesting property is a colour relationship, and a colour
 * relationship is checkable across every preset and seed without rendering anything — the same
 * reason tones.ts is free of React.
 *
 * The selected segment is the brand fill and the rest are the group's own sunken surface, so
 * the choice is legible without relying on a hue difference between two similar greys.
 *
 * `neutral` is what this reached for first, and it was wrong in a way a comment hid: that tone
 * is `surfaceRaised`, so every unselected segment rendered as a card standing *above* the
 * sunken track it sits in — three raised buttons in a well, which is the row-of-buttons look
 * the control exists to avoid. The comment above it claimed the background was overridden. It
 * was not; nothing in the component set one.
 */
export const segmentPalette = (theme: ResolvedTheme, selected: boolean): TonalPalette =>
  selected ? tonalPalette(theme, 'brandSolid') : surfacePalette(theme, 'sunken', 'hairline');
