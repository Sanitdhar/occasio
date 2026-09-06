import type { ReactNode } from 'react';
import { Pressable, View, type Role, type StyleProp, type ViewStyle } from 'react-native';
import { createStyles } from '../theme/createStyles';
import { useTheme } from '../theme/useTheme';
import { DISABLED_OPACITY, interactiveFill } from './interaction';
import type { TonalPalette } from './tones';
import { usePressState } from './usePressState';

/**
 * The one place a box becomes pressable.
 *
 * Internal on purpose — it is not exported from the package. Surface, Card and Chip differ in
 * shape and palette, not in what "pressed" means, so the four states live here once. Adding a
 * sixth primitive should not mean writing a fifth hover implementation.
 *
 * `palette` carries resolved colour strings rather than token names. That is the one deliberate
 * exception to "components read tokens directly": the caller has already chosen its palette from
 * the theme (see tones.ts), and threading token names through would only move the switch
 * statement one level down. Nothing here invents a colour.
 *
 * Accessibility uses the ARIA spellings throughout, for the reason #127 established for the
 * feedback components: react-native-web 0.21's forwarded-prop table
 * (`dist/modules/forwardedProps/index.js`) does not contain `accessibilityState` at all, and
 * marks `accessibilityRole` and `accessibilityLabel` deprecated. A chip's selected state written
 * the `accessibility*` way is dropped silently on web. React Native maps `role`, `aria-label`,
 * `aria-checked` and `aria-disabled` back to the native equivalents, so nothing is lost on iOS
 * or Android — and web, which ships first (D30), gets props it actually reads.
 */

const useStyles = createStyles((t) => ({
  /* An outline rather than a border, so focus does not resize the box. */
  focusRing: {
    outlineColor: t.color.interactive.focusRing,
    outlineStyle: 'solid',
    outlineWidth: t.border.standard,
    outlineOffset: t.border.standard,
  },
  disabled: { opacity: DISABLED_OPACITY },
}));

/** The accessibility props a primitive forwards. ARIA spellings — see the note above. */
export type BoxAccessibilityProps = {
  readonly role?: Role | undefined;
  readonly 'aria-label'?: string | undefined;
  /** For a chip that toggles. Left undefined by anything that is not a toggle. */
  readonly 'aria-checked'?: boolean | undefined;
};

export type InteractiveBoxProps = BoxAccessibilityProps & {
  readonly palette: TonalPalette;
  /** The primitive's own computed styles. Caller overrides go in `style`, which lands last. */
  readonly boxStyle: StyleProp<ViewStyle>;
  readonly onPress?: (() => void) | undefined;
  readonly disabled?: boolean | undefined;
  readonly testID?: string | undefined;
  readonly style?: StyleProp<ViewStyle> | undefined;
  readonly children?: ReactNode;
};

export function InteractiveBox({
  palette,
  boxStyle,
  onPress,
  disabled = false,
  role,
  'aria-label': ariaLabel,
  'aria-checked': ariaChecked,
  testID,
  style,
  children,
}: InteractiveBoxProps) {
  const theme = useTheme();
  const styles = useStyles();
  const { hovered, focused, handlers } = usePressState();

  /* Omitted rather than false: "not disabled" on every box is noise a screen reader reads out. */
  const ariaDisabled = disabled ? true : undefined;
  const fill = { backgroundColor: palette.background, borderColor: palette.border };

  if (onPress === undefined) {
    return (
      <View
        role={role}
        aria-label={ariaLabel}
        aria-checked={ariaChecked}
        aria-disabled={ariaDisabled}
        testID={testID}
        /* A box with no onPress still honours `disabled`: a chip that reads as available but
           silently does nothing is worse than one that looks switched off. */
        style={[boxStyle, fill, disabled ? styles.disabled : null, style]}
      >
        {children}
      </View>
    );
  }

  return (
    <Pressable
      role={role ?? 'button'}
      aria-label={ariaLabel}
      aria-checked={ariaChecked}
      aria-disabled={ariaDisabled}
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      onHoverIn={handlers.onHoverIn}
      onHoverOut={handlers.onHoverOut}
      onFocus={handlers.onFocus}
      onBlur={handlers.onBlur}
      style={({ pressed }) => [
        boxStyle,
        {
          backgroundColor: interactiveFill(theme, palette, {
            hovered,
            pressed,
            focused,
            disabled,
          }),
          borderColor: palette.border,
        },
        focused && !disabled ? styles.focusRing : null,
        disabled ? styles.disabled : null,
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}
