import { useCallback, useRef, useState } from 'react';
import { Pressable, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { createStyles } from '../theme/createStyles';
import { Text } from './Text';
import {
  buttonPalette,
  resolveButtonState,
  showsFocusRing,
  type ButtonTone,
  type ButtonVariant,
  type FocusOrigin,
} from './buttonTokens';

/**
 * A button with the four states a pointer and a keyboard can actually produce.
 *
 * Web is the primary surface (D30), and on the web a control with no hover and no focus ring
 * reads as decoration: nothing acknowledges the pointer, and a keyboard user cannot see where
 * they are. So hover, pressed, disabled and focus are all painted, all from theme tokens.
 *
 * The colour decisions live in buttonTokens.ts, which is testable without a renderer — component
 * rendering is not available yet (#110), and a palette whose only proof is a screenshot is a
 * palette nobody has checked.
 */

const useButtonStyles = createStyles((theme) => {
  const palette = buttonPalette(theme);
  const surface = (tone: ButtonTone): ViewStyle => ({
    backgroundColor: tone.background,
    borderColor: tone.border,
  });
  const label = (tone: ButtonTone): TextStyle => ({ color: tone.label });

  /* The ring is drawn in a gap *outside* the control. It has to be: interactive.focusRing is
     the brand solid, which is also the primary fill — inside the button it would be invisible.
     Outside, it is measured against the page background, where the resolver guarantees 3:1. */
  const ringGap = theme.space(1);

  return {
    base: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      /* Hug the label rather than stretching to the parent's cross axis; a caller that wants a
         full-width button says so in `style`. */
      alignSelf: 'flex-start',
      paddingVertical: theme.space(3),
      paddingHorizontal: theme.space(5),
      borderRadius: theme.radius.md,
      /* Present on every variant and every state, so nothing reflows when the state changes. */
      borderWidth: theme.border.hairline,
    },
    label: { textAlign: 'center' },
    ring: {
      position: 'absolute',
      top: -ringGap,
      right: -ringGap,
      bottom: -ringGap,
      left: -ringGap,
      borderWidth: theme.border.standard,
      borderColor: theme.color.interactive.focusRing,
      borderRadius: theme.radius.md + ringGap,
    },

    /* Keyed `<variant>_<state>` so the component indexes the sheet straight from the resolved
       state, with the template literal checked against these keys at compile time. */
    primary_rest: surface(palette.primary.rest),
    primary_hover: surface(palette.primary.hover),
    primary_pressed: surface(palette.primary.pressed),
    primary_disabled: surface(palette.primary.disabled),
    primary_rest_label: label(palette.primary.rest),
    primary_hover_label: label(palette.primary.hover),
    primary_pressed_label: label(palette.primary.pressed),
    primary_disabled_label: label(palette.primary.disabled),

    secondary_rest: surface(palette.secondary.rest),
    secondary_hover: surface(palette.secondary.hover),
    secondary_pressed: surface(palette.secondary.pressed),
    secondary_disabled: surface(palette.secondary.disabled),
    secondary_rest_label: label(palette.secondary.rest),
    secondary_hover_label: label(palette.secondary.hover),
    secondary_pressed_label: label(palette.secondary.pressed),
    secondary_disabled_label: label(palette.secondary.disabled),
  };
});

export type ButtonProps = {
  readonly label: string;
  readonly onPress?: (() => void) | undefined;
  readonly variant?: ButtonVariant | undefined;
  readonly disabled?: boolean | undefined;
  /** Defaults to `label`; set it when the visible label is not the whole story. */
  readonly accessibilityLabel?: string | undefined;
  readonly testID?: string | undefined;
  /** Layout only — colour and size come from the theme. */
  readonly style?: StyleProp<ViewStyle> | undefined;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  accessibilityLabel,
  testID,
  style,
}: ButtonProps) {
  const styles = useButtonStyles();
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [focusOrigin, setFocusOrigin] = useState<FocusOrigin>('blurred');

  /* A ref rather than state: on the web the pointer is already down when the focus event
     arrives, and a `setPressed(true)` scheduled by onPressIn has not been applied yet — so
     reading `pressed` in the focus handler would report the previous render's value. */
  const pointerDown = useRef(false);

  const handlePressIn = useCallback(() => {
    pointerDown.current = true;
    setPressed(true);
  }, []);
  const handlePressOut = useCallback(() => {
    pointerDown.current = false;
    setPressed(false);
  }, []);
  const handleHoverIn = useCallback(() => {
    setHovered(true);
  }, []);
  const handleHoverOut = useCallback(() => {
    setHovered(false);
  }, []);
  const handleFocus = useCallback(() => {
    setFocusOrigin(pointerDown.current ? 'pointer' : 'keyboard');
  }, []);
  const handleBlur = useCallback(() => {
    pointerDown.current = false;
    setFocusOrigin('blurred');
  }, []);

  const state = resolveButtonState({ disabled, hovered, pressed });

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onBlur={handleBlur}
      onFocus={handleFocus}
      onHoverIn={handleHoverIn}
      onHoverOut={handleHoverOut}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[styles.base, styles[`${variant}_${state}`], style]}
      testID={testID}
    >
      {showsFocusRing(focusOrigin, disabled) ? (
        <View pointerEvents="none" style={styles.ring} />
      ) : null}
      <Text style={[styles.label, styles[`${variant}_${state}_label`]]} variant="bodyStrong">
        {label}
      </Text>
    </Pressable>
  );
}
