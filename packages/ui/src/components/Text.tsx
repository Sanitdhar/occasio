import { Text as RNText, type StyleProp, type TextProps as RNTextProps } from 'react-native';
import { createStyles } from '../theme/createStyles';
import type { LayoutTextStyle } from './layoutStyle';
import {
  textPalette,
  type BodyTextTone,
  type LargeTextVariant,
  type SmallTextVariant,
  type TextTone,
} from './textTokens';

/**
 * Every piece of text in the app.
 *
 * `variant` names a type role the resolver already produced — there is no size prop, because a
 * size prop is how a design system acquires a 17px heading that exists on one screen. The
 * theme's typography scale, density and font set therefore reach every string for free.
 *
 * Anything React Native's Text accepts still works (`numberOfLines`, `onPress`, `selectable`,
 * accessibility props). `style` is narrowed to layout: a component whose contrast is proved
 * cannot also let the caller repaint it.
 */

const useTextStyles = createStyles((theme) => {
  const tone = textPalette(theme);

  return {
    /* Spread rather than referenced: StyleSheet.create takes ownership of what it is given,
       and these token objects belong to the theme. */
    display1: { ...theme.type.display1 },
    display2: { ...theme.type.display2 },
    title1: { ...theme.type.title1 },
    title2: { ...theme.type.title2 },
    body: { ...theme.type.body },
    bodyStrong: { ...theme.type.bodyStrong },
    caption: { ...theme.type.caption },
    overline: { ...theme.type.overline },

    /* Tone names never collide with variant names, so one flat sheet indexes both. */
    default: { color: tone.default },
    muted: { color: tone.muted },
    faint: { color: tone.faint },
    inverse: { color: tone.inverse },
    onBrand: { color: tone.onBrand },
    onAccent: { color: tone.onAccent },
  };
});

/**
 * The variant and tone are a pair, not two independent props: `faint` is only legal on a variant
 * that reaches WCAG's large-text threshold, so the union makes an inaccessible combination fail
 * to compile. Everything else is the same for both arms.
 */
export type TextProps = Omit<RNTextProps, 'style'> & {
  readonly style?: StyleProp<LayoutTextStyle> | undefined;
} & (
    | { readonly variant: LargeTextVariant; readonly tone?: TextTone | undefined }
    | { readonly variant?: SmallTextVariant | undefined; readonly tone?: BodyTextTone | undefined }
  );

export function Text({ variant = 'body', tone = 'default', style, ...rest }: TextProps) {
  const styles = useTextStyles();
  return <RNText {...rest} style={[styles[variant], styles[tone], style]} />;
}
