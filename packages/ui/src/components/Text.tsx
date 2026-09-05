import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { createStyles } from '../theme/createStyles';
import { textPalette, type TextTone, type TextVariant } from './textTokens';

/**
 * Every piece of text in the app.
 *
 * `variant` names a type role the resolver already produced — there is no size prop, because a
 * size prop is how a design system acquires a 17px heading that exists on one screen. The
 * theme's typography scale, density and font set therefore reach every string for free.
 *
 * Anything React Native's Text accepts still works (`numberOfLines`, `onPress`, `selectable`,
 * accessibility props), and `style` is applied last so a caller can override — layout, not
 * colour or size, is the intended use.
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

export type TextProps = RNTextProps & {
  readonly variant?: TextVariant | undefined;
  readonly tone?: TextTone | undefined;
};

export function Text({ variant = 'body', tone = 'default', style, ...rest }: TextProps) {
  const styles = useTextStyles();
  return <RNText {...rest} style={[styles[variant], styles[tone], style]} />;
}
