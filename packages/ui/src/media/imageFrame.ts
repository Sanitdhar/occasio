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
 * Complains in development and stays silent in a shipped build.
 *
 * An unlabelled photograph is a defect, but it is not one worth blanking a hero image over, so
 * this is a warning rather than a throw. Metro replaces `process.env.NODE_ENV` at build time,
 * so the branch is eliminated from the production bundle entirely.
 */
const warnInDevelopment = (message: string): void => {
  if (process.env.NODE_ENV !== 'production') {
    console.warn(`<Image>: ${message}`);
  }
};

/**
 * The description a screen reader will read, or the decision to say nothing.
 *
 * A decorative image is hidden outright rather than announced with an empty label: on web
 * `alt=""` already removes it from the accessibility tree, and on native the two hiding props
 * are what iOS and Android respectively read. Announcing "image" with no description is worse
 * than silence, because the listener has to stop and work out that nothing was said.
 *
 * Both arguments are needed to tell "nothing to describe" apart from "nobody wrote one", and
 * the difference matters: the first is a deliberate choice and the second is a bug that hides a
 * photograph from a reader who has no other way to know it is there. The prop types already
 * make the second impossible in TypeScript, but the types are not what runs — a JavaScript
 * caller, a `JSON.parse`d prop bag or a stale build all reach this function with neither. So
 * does `alt=""`, which is how an empty caption field arrives, and which the type system cannot
 * catch at all.
 */
export const imageAccessibility = (
  alt: string | undefined,
  decorative: boolean,
): ImageAccessibility => {
  if (alt !== undefined && alt !== '') {
    /* Both were given. Describing the image is the safer of the two, so the label wins and the
       contradiction is reported rather than resolved silently. */
    if (decorative) warnInDevelopment('both `alt` and `decorative` were given; using `alt`.');

    return {
      accessible: true,
      accessibilityRole: 'image',
      accessibilityLabel: alt,
      accessibilityElementsHidden: false,
      importantForAccessibility: 'yes',
    };
  }

  if (!decorative) {
    warnInDevelopment(
      alt === ''
        ? '`alt` is an empty string, so this image is invisible to a screen reader. Describe it, or pass `decorative` if there is nothing to describe.'
        : 'neither `alt` nor `decorative` was given. Describe the image, or pass `decorative` if there is nothing to describe.',
    );
  }

  return {
    accessible: false,
    accessibilityLabel: '',
    accessibilityElementsHidden: true,
    importantForAccessibility: 'no-hide-descendants',
  };
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
