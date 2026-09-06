import { Image as ExpoImage, type ImageSource } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { createStyles } from '../theme/createStyles';
import { useTheme } from '../theme/useTheme';
import { hasOverlay, imageAccessibility, scrimGeometry, type ScrimPlacement } from './imageFrame';

/**
 * The only image component in Occasio. Reaching for `react-native`'s `Image` is a bug.
 *
 * Three things are non-negotiable here, and each is a specific way user-generated event sites go
 * wrong:
 *
 *  1. **The ratio comes from the theme, not from the upload.** Mixed aspect ratios are the single
 *     biggest thing that makes a photo-driven site look amateur, and an admin uploading from a
 *     phone camera roll will never produce a consistent set. `theme.image.heroAspect` decides the
 *     frame and `contentFit="cover"` crops the photograph into it — which is why there is no
 *     `contentFit` prop: `contain` would letterbox, and a letterboxed image is the enforcement
 *     quietly turned off.
 *  2. **A blurhash, never a spinner.** A spinner on a hero image is the difference between
 *     "loading" and "broken", and it costs a layout jump when it goes away. The placeholder is
 *     the picture's own colours, at the picture's own size, from the first frame.
 *  3. **Alt text is not optional.** `alt` is required; `decorative` is the only way to omit it,
 *     and the prop types make writing neither impossible.
 *
 * It wraps `expo-image` rather than `Image` for the caching (D20 wants photographs to survive a
 * cold start on venue wifi) and for the blurhash decoding, neither of which React Native's
 * component has.
 */

/** Ratio of the frame. Named, not numeric — a free number is how a design system loses a grid. */
export type ImageAspect =
  /** `theme.image.heroAspect`: the tenant's ratio, and the default for anything editorial. */
  | 'hero'
  /** For grid cells, avatars and thumbnails, where the square is the layout's, not the photo's. */
  | 'square';

/** Corner treatment. `hero` is `theme.image.radius`; `none` is for full-bleed. */
export type ImageRadius = 'hero' | 'none';

type ImageFrameProps = {
  /** A remote URL, a `require()`d asset, or an expo-image source. */
  readonly source: string | number | ImageSource;
  /**
   * The blurhash stored alongside the image, shown until the real pixels decode.
   *
   * Optional only because third-party avatars arrive without one. When it is missing the frame
   * still shows its tonal fill rather than a spinner — the placeholder is worse, never absent.
   */
  readonly blurhash?: string | undefined;
  readonly aspect?: ImageAspect | undefined;
  readonly radius?: ImageRadius | undefined;
  /**
   * Where the theme's scrim gradient sits. Defaults to `bottom` when there is overlay content
   * and `none` when there is not, because a scrim exists to make text legible and one over a
   * bare photograph is just contrast thrown away.
   */
  readonly scrim?: ScrimPlacement | undefined;
  /** Raise it for the one image above the fold; leave it alone for everything in a list. */
  readonly priority?: 'low' | 'normal' | 'high' | undefined;
  /**
   * Blanks the view when it changes, so a recycled row in a long list never shows the previous
   * row's photograph for a frame. Pass the id of the thing being pictured.
   */
  readonly recyclingKey?: string | undefined;
  /** Rendered over the scrim, pinned to the bottom of the frame. */
  readonly children?: ReactNode;
  /**
   * Margins, width, position — the frame's place in its parent.
   *
   * `aspectRatio`, `borderRadius` and `overflow` are not assignable, and are applied after this
   * style so that a value smuggled past the type through a variable still loses. The ratio and
   * the crop are the token's decision; use `aspect` and `radius` to choose between the values
   * the system has.
   */
  readonly style?:
    StyleProp<Omit<ViewStyle, 'aspectRatio' | 'borderRadius' | 'overflow'>> | undefined;
};

/**
 * Alternative text, or an explicit statement that there is none to give.
 *
 * A union rather than an optional string: `<Image source={…} />` does not compile, so the
 * decision has to be made rather than skipped. `decorative` is for images that repeat what the
 * adjacent text already says — a section's background photograph, a pattern behind a card.
 */
type ImageAltProps =
  | {
      /** What the photograph shows, in a sentence someone who cannot see it would want. */
      readonly alt: string;
      readonly decorative?: false | undefined;
    }
  | {
      readonly alt?: undefined;
      /** The image adds nothing the surrounding text does not already say. */
      readonly decorative: true;
    };

export type ImageProps = ImageFrameProps & ImageAltProps;

/**
 * Written out rather than taken from `StyleSheet.absoluteFill`, which is not the same thing on
 * both platforms: React Native exports a plain frozen object, react-native-web exports a
 * compiled class handle. Spreading the web one into a style object produces something that
 * looks right and positions nothing.
 */
const FILL = { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 } as const;

const useStyles = createStyles((t) => ({
  /* Defaults, applied BEFORE the caller's style so both can be overridden: a thumbnail in a
     row may want its own width, and a frame over a photographic background may want no fill. */
  frame: {
    width: '100%',
    /* Ramp step 4 is a component background — visible against both `bg` and `surface` in either
       scheme. It shows for the moment before a blurhash decodes, and for the whole life of an
       image that has none. Never a spinner. */
    backgroundColor: t.color.ramp.neutral[3],
  },
  /* `overflow: hidden` is not a default. It is what makes the ratio a crop rather than a
     suggestion, and what clips the corners — so it goes after the caller's style, with the
     aspect and the radius. */
  crop: { overflow: 'hidden' },
  aspectHero: { aspectRatio: t.image.heroAspect },
  aspectSquare: { aspectRatio: 1 },
  radiusHero: { borderRadius: t.image.radius },
  radiusNone: { borderRadius: 0 },
  /* Absolute rather than `flex: 1`: the frame's aspect ratio is the layout, and an image that
     contributed its own intrinsic size would fight it. */
  image: { ...FILL },
  scrim: { ...FILL },
  overlay: {
    ...FILL,
    justifyContent: 'flex-end',
    padding: t.space(4),
  },
}));

export function Image({
  source,
  blurhash,
  alt,
  /* Read at runtime, not only at the type level. `imageAccessibility` has to tell a deliberate
     "there is nothing to describe" apart from a forgotten `alt`, and `decorative` is the only
     thing that carries the difference once the types are gone. */
  decorative = false,
  aspect = 'hero',
  radius = 'hero',
  scrim,
  priority,
  recyclingKey,
  children,
  style,
}: ImageProps) {
  const theme = useTheme();
  const styles = useStyles();

  const overlaid = hasOverlay(children);
  const geometry = scrimGeometry(
    theme.image.scrimGradient,
    scrim ?? (overlaid ? 'bottom' : 'none'),
  );

  return (
    <View
      /* Order is the enforcement. The caller's style sits between the defaults it may
         override and the three properties it may not: an escape hatch that can put back a
         second aspect ratio is the rule with an opt-out, not an escape hatch. */
      style={[
        styles.frame,
        style,
        styles.crop,
        aspect === 'hero' ? styles.aspectHero : styles.aspectSquare,
        radius === 'hero' ? styles.radiusHero : styles.radiusNone,
      ]}
    >
      <ExpoImage
        source={typeof source === 'string' ? { uri: source } : source}
        placeholder={blurhash === undefined ? null : { blurhash }}
        /* Matching the image's own fit: a placeholder scaled differently flickers as it is
           swapped out, which is the one thing a placeholder must not do. */
        contentFit="cover"
        placeholderContentFit="cover"
        /* From the theme, so the OS "reduce motion" setting turns the cross-fade off rather
           than leaving one animation nobody asked for. */
        transition={theme.motion.enabled ? theme.motion.base : 0}
        /* D20 — read-offline. The disk half is what survives a cold start on venue wifi. */
        cachePolicy="memory-disk"
        priority={priority ?? null}
        recyclingKey={recyclingKey ?? null}
        style={styles.image}
        {...imageAccessibility(alt, decorative)}
      />
      {geometry === null ? null : (
        <LinearGradient
          colors={geometry.colors}
          locations={geometry.locations}
          start={geometry.start}
          end={geometry.end}
          /* Decoration over a picture: it must never eat a tap meant for the card beneath it,
             and it must never be announced. */
          pointerEvents="none"
          aria-hidden
          style={styles.scrim}
        />
      )}
      {overlaid ? <View style={styles.overlay}>{children}</View> : null}
    </View>
  );
}
