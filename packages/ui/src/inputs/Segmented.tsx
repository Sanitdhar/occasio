import { View } from 'react-native';
import type { LayoutViewStyle } from '../components/layoutStyle';
import { InteractiveBox } from '../primitives/InteractiveBox';
import { tonalPalette } from '../primitives/tones';
import { createStyles } from '../theme/createStyles';
import { useTheme } from '../theme/useTheme';
import { Text } from '../components/Text';
import { RovingGroup } from './RovingGroup';

/**
 * A small set of mutually exclusive choices, all visible at once.
 *
 * Not a dropdown, and the difference is the point: with three or four options the whole choice
 * fits on screen, so somebody can see what they are choosing between rather than discovering it
 * by opening something. Above about five it stops being one, and the type does not stop you --
 * a limit enforced in code would be a rule about screen width that this component cannot see.
 *
 * The accessibility shape is `radiogroup`, not a row of buttons. A screen reader then says "one
 * of three" and reads the selected one, which is the whole content of the control; a row of
 * buttons announces three unrelated things and never says which is on.
 *
 * Claiming that role is a promise about the keyboard as well as about the announcement: the
 * group is one Tab stop, and the arrow keys move within it. Both halves live here -- the roving
 * `tabIndex` below decides where Tab lands, and RovingGroup handles the arrow keys.
 */

export type SegmentedOption<T extends string> = {
  readonly value: T;
  readonly label: string;
};

type Props<T extends string> = {
  readonly options: readonly SegmentedOption<T>[];
  readonly value: T;
  readonly onChange: (value: T) => void;
  /** Names the group for a screen reader — "Schedule view", not the value it currently holds. */
  readonly label: string;
  readonly disabled?: boolean;
  readonly testID?: string | undefined;
  readonly style?: LayoutViewStyle | undefined;
};

const useStyles = createStyles((t) => ({
  group: {
    flexDirection: 'row',
    backgroundColor: t.color.surfaceSunken,
    borderRadius: t.radius.pill,
    padding: t.space(1),
    gap: t.space(1),
  },
  /* The unselected segments read as the group's own background rather than as raised cards, so
     `neutral`'s surface is overridden here — the palette still supplies the content colour and
     the border, which are the parts that have to stay contrast-checked. */
  segment: {
    flexGrow: 1,
    flexBasis: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: t.space(2),
    paddingHorizontal: t.space(3),
    borderRadius: t.radius.pill,
  },
}));

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  disabled = false,
  testID,
  style,
}: Props<T>) {
  const styles = useStyles();
  const theme = useTheme();

  /* A `value` that is not among the options is a caller's bug, and one that must not cost the
     group its Tab stop: without a fallback no segment would carry `tabIndex={0}`, and a
     keyboard user would find the control unreachable rather than merely showing nothing. */
  const selectedIndex = options.findIndex((option) => option.value === value);
  const activeIndex = selectedIndex === -1 ? 0 : selectedIndex;

  return (
    <View
      role="radiogroup"
      aria-label={label}
      aria-disabled={disabled}
      style={[styles.group, style]}
      testID={testID}
    >
      <RovingGroup
        count={options.length}
        index={activeIndex}
        disabled={disabled}
        onMove={(next) => {
          const moved = options[next];
          if (moved !== undefined) onChange(moved.value);
        }}
      >
        {options.map((option, index) => {
          const selected = option.value === value;
          /* The selected segment is the brand fill and the rest are transparent, so the choice is
           legible without relying on a hue difference between two similar greys. */
          const palette = tonalPalette(theme, selected ? 'brandSolid' : 'neutral');

          return (
            <InteractiveBox
              key={option.value}
              palette={palette}
              disabled={disabled}
              onPress={() => {
                onChange(option.value);
              }}
              /* `radio` rather than `button`, and `aria-checked` rather than `aria-selected`:
               `selected` is only valid on options and tabs, so a screen reader ignores it here
               and the control announces nothing about its state. */
              role="radio"
              aria-checked={selected}
              aria-label={option.label}
              /* Roving: one stop for the group, entered at the option that is selected. */
              tabIndex={index === activeIndex ? 0 : -1}
              boxStyle={styles.segment}
              testID={testID === undefined ? undefined : `${testID}-${option.value}`}
            >
              <Text variant="bodyStrong" tone={selected ? 'onBrand' : 'default'}>
                {option.label}
              </Text>
            </InteractiveBox>
          );
        })}
      </RovingGroup>
    </View>
  );
}
