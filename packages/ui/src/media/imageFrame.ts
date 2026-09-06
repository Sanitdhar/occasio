import type { ReactNode } from 'react';

/**
 * The decisions an image frame makes that are worth testing on their own: how the picture is
 * described to a screen reader, whether there is anything overlaid on it, and where the scrim
 * sits.
 *
 * They live here rather than inside `Image.tsx` because this file pulls in no runtime import at
 * all — the one `import type` is erased — so it runs in a plain Jest process. Component render
 * tests are not possible in this repo yet (#110); pulling the judgement out of the JSX is what
 * keeps any of this covered in the meantime.
 */

/* -------------------------------------------------------------------------------------------
 * Alternative text
 * ----------------------------------------------------------------------------------------- */

/**
 * What the accessibility layer needs, expressed structurally so this file stays free of React
 * Native. Every field is assignable to the prop of the same name on a View or an expo-image.
 */
export type ImageAccessibility = {
  readonly accessible: boolean;
  /** Becomes the `alt` attribute on web. Empty string is the correct value for decoration. */
  readonly accessibilityLabel: string;
  readonly accessibilityElementsHidden: boolean;
  readonly importantForAccessibility: 'yes' | 'no-hide-descendants';
  readonly accessibilityRole?: 'image';
};

/**
 * `undefined` means the image was explicitly declared decorative, not that somebody forgot —
 * the component's prop types make the two impossible to confuse.
 *
 * A decorative image is hidden outright rather than announced with an empty label: on web
 * `alt=""` already removes it from the accessibility tree, and on native the two hiding props
 * are what iOS and Android respectively read. Announcing "image" with no description is worse
 * than silence, because the listener has to stop and work out that nothing was said.
 */
export const imageAccessibility = (alt: string | undefined): ImageAccessibility =>
  alt === undefined
    ? {
        accessible: false,
        accessibilityLabel: '',
        accessibilityElementsHidden: true,
        importantForAccessibility: 'no-hide-descendants',
      }
    : {
        accessible: true,
        accessibilityRole: 'image',
        accessibilityLabel: alt,
        accessibilityElementsHidden: false,
        importantForAccessibility: 'yes',
      };

/* -------------------------------------------------------------------------------------------
 * Overlay
 * ----------------------------------------------------------------------------------------- */

/**
 * Whether the `children` slot will actually paint something.
 *
 * `children === undefined` is not enough. `{title && <Text>{title}</Text>}` evaluates to `false`
 * when the title is empty and `{caption ?? null}` to `null` — React renders nothing for either,
 * and both are how a caller writes "sometimes there is a caption". Treating them as content puts
 * a scrim and an empty overlay over a photograph that has no text on it at all.
 */
export const hasOverlay = (children: ReactNode): boolean =>
  children !== undefined && children !== null && typeof children !== 'boolean';

/* -------------------------------------------------------------------------------------------
 * Scrim
 * ----------------------------------------------------------------------------------------- */

/**
 * Which edge the overlay text sits against. Enumerated rather than an angle, because a scrim
 * pointing anywhere other than at the text is decoration that costs contrast for nothing.
 */
export type ScrimPlacement = 'none' | 'top' | 'bottom';

/** Exactly the geometry `expo-linear-gradient` needs, and nothing else. */
export type ScrimGeometry = {
  readonly colors: readonly [string, string];
  readonly locations: readonly [number, number];
  readonly start: { readonly x: number; readonly y: number };
  readonly end: { readonly x: number; readonly y: number };
};

/**
 * Where the transparent end gives way to the tint, as a fraction of the frame.
 *
 * A scrim that starts at the far edge is a wash over the whole photograph; one that starts too
 * late is a hard band with a visible seam. Just past half leaves the subject of the image alone
 * and still ramps up gradually enough that no edge is visible.
 */
const SCRIM_ONSET = 0.55;

/**
 * The theme's gradient, aimed at the text.
 *
 * `theme.image.scrimGradient` is `[transparent, tinted]` — tinted toward the brand rather than
 * flat black (see resolveTheme), so the overlay belongs to the event's palette instead of
 * reading as a generic darkening layer. Only the direction is decided here; the colour and the
 * strength are the tenant's.
 *
 * Returns `null` for 'none' so the caller renders no gradient view at all, rather than a
 * transparent one that still costs a layer on every card in a list.
 */
export const scrimGeometry = (
  gradient: readonly [string, string],
  placement: ScrimPlacement,
): ScrimGeometry | null => {
  switch (placement) {
    case 'none':
      return null;
    case 'top':
      return {
        colors: gradient,
        locations: [SCRIM_ONSET, 1],
        start: { x: 0.5, y: 1 },
        end: { x: 0.5, y: 0 },
      };
    case 'bottom':
      return {
        colors: gradient,
        locations: [SCRIM_ONSET, 1],
        start: { x: 0.5, y: 0 },
        end: { x: 0.5, y: 1 },
      };
  }
};
