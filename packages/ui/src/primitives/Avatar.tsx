import { isValidElement, type ReactElement } from 'react';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Image, type ImageProps } from '../media/Image';
import { createStyles } from '../theme/createStyles';
import { useTheme } from '../theme/useTheme';
import { initialsFrom } from './initials';
import { tonalPalette, type TonalTone } from './tones';

/**
 * A guest's face, or their initials when there is no photo.
 *
 * **The image is a child, not a prop.** `<Avatar name="…"><Image …/></Avatar>` rather than
 * `source={…}`, for two reasons: the avatar never has to grow props for blurhash, priority,
 * caching and transition as the image component gains them, and it stays free of any image
 * dependency, so it renders in a plain React tree. The circle clips whatever it is given.
 *
 * Nothing a name can contain is allowed to change the size of the circle — see initials.ts.
 * Sizes come from the space scale, so an avatar tracks the tenant's density like everything
 * else, and the initials are capped against OS font scaling so a 200% accessibility setting
 * cannot burst the circle. The full name always reaches a screen reader.
 */

const useAvatarStyles = createStyles((t) => ({
  box: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: t.border.hairline,
    borderRadius: t.radius.pill,
    /* Clips a child image to the circle. */
    overflow: 'hidden',
  },

  sizeXs: { width: t.space(6), height: t.space(6) },
  sizeSm: { width: t.space(8), height: t.space(8) },
  sizeMd: { width: t.space(10), height: t.space(10) },
  sizeLg: { width: t.space(14), height: t.space(14) },

  labelXs: { ...t.type.overline },
  labelSm: { ...t.type.caption },
  labelMd: { ...t.type.bodyStrong },
  labelLg: { ...t.type.title2 },
}));

type AvatarStyles = ReturnType<typeof useAvatarStyles>;

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg';

const SIZE_STYLE = {
  xs: 'sizeXs',
  sm: 'sizeSm',
  md: 'sizeMd',
  lg: 'sizeLg',
} as const satisfies Record<AvatarSize, keyof AvatarStyles>;

const LABEL_STYLE = {
  xs: 'labelXs',
  sm: 'labelSm',
  md: 'labelMd',
  lg: 'labelLg',
} as const satisfies Record<AvatarSize, keyof AvatarStyles>;

/**
 * The circle is a fixed size, so unbounded OS font scaling would push the initials outside it.
 * Capped rather than disabled: a reader who scales text still gets larger initials, up to a
 * point the circle can hold.
 */
const MAX_FONT_SCALE = 1.3;

export type AvatarProps = {
  /** Used for the initials fallback and as the accessible name. Required for both reasons. */
  readonly name: string;
  readonly size?: AvatarSize | undefined;
  readonly tone?: TonalTone | undefined;
  /**
   * The avatar's photograph, clipped to the circle. Nothing is rendered behind it.
   *
   * Typed as an element taking `ImageProps` rather than a bare `ReactNode`, which had accepted
   * react-native's `Image` — the one this package bans — and with it a photograph that shows a
   * spinner instead of a blurhash and has no alternative text.
   *
   * The type constrains the props and not the component. `ReactElement<ImageProps, typeof
   * Image>` looks like it would fix that and does not: JSX produces `React.JSX.Element`, which
   * is `ReactElement<any, any>` and assignable to anything — I checked, and `<Text>` satisfies
   * it. Rather than keep a type parameter that reads as an enforcement and is not one, the
   * identity is checked at runtime below.
   */
  readonly children?: ReactElement<ImageProps> | undefined;
  readonly style?: StyleProp<ViewStyle> | undefined;
  readonly testID?: string | undefined;
};

/**
 * Complains in development and stays silent in a shipped build. Metro replaces
 * `process.env.NODE_ENV` at build time, so the branch leaves the production bundle entirely.
 */
const warnInDevelopment = (message: string): void => {
  if (process.env.NODE_ENV !== 'production') {
    console.warn(`<Avatar>: ${message}`);
  }
};

export function Avatar({
  name,
  size = 'md',
  tone = 'neutral',
  children,
  style,
  testID,
}: AvatarProps) {
  const theme = useTheme();
  const styles = useAvatarStyles();
  const palette = tonalPalette(theme, tone);

  /*
   * The check the prop type cannot make. Anything can satisfy `ReactElement<ImageProps>` — a
   * component of one's own taking the same props and rendering react-native's `Image` reaches
   * here happily, which puts a spinner and no alternative text inside the circle.
   *
   * A warning rather than a refusal: a wrong image element is a defect, not a reason to blank
   * a guest's face, and this is exactly the shape of mistake that gets made once and copied.
   */
  if (children !== undefined && isValidElement(children) && children.type !== Image) {
    warnInDevelopment(
      'children should be the `Image` from @occasio/ui, which is what guarantees a blurhash placeholder and alternative text.',
    );
  }

  return (
    <View
      /* ARIA spellings: react-native-web 0.21 marks the `accessibility*` ones deprecated, and
         React Native maps these back to the native roles. `img` is the ARIA name for it. */
      role="img"
      aria-label={name}
      testID={testID}
      style={[
        styles.box,
        styles[SIZE_STYLE[size]],
        { backgroundColor: palette.background, borderColor: palette.border },
        style,
      ]}
    >
      {children ?? (
        /* Hidden from assistive technology: the circle already carries the full name, and
           without this a screen reader reads "Ada Lovelace, A L". */
        <Text
          aria-hidden
          numberOfLines={1}
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          style={[styles[LABEL_STYLE[size]], { color: palette.content }]}
        >
          {initialsFrom(name)}
        </Text>
      )}
    </View>
  );
}
