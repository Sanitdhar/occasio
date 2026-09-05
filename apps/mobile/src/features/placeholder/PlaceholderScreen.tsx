import type { ResolvedTheme } from '@occasio/theme';
import type { ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';

type Props = {
  readonly theme: ResolvedTheme;
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  /** The issue that replaces this placeholder with the real screen. */
  readonly arrivesIn: string;
  /** Anything of the real screen that already exists, rendered below the notice. */
  readonly children?: ReactNode;
};

/**
 * Every route in the skeleton renders this until its own issue lands. It is deliberately
 * explicit about what is missing and when it arrives, so a half-built app reads as a plan
 * rather than as breakage.
 *
 * Pure: theme in, JSX out, no router, no data.
 */
export function PlaceholderScreen({
  theme,
  eyebrow,
  title,
  description,
  arrivesIn,
  children,
}: Props) {
  const { color, type, space, radius, border } = theme;
  return (
    <ScrollView
      style={{ backgroundColor: color.bg }}
      contentContainerStyle={{ padding: space(6), gap: space(3) }}
    >
      <Text style={{ ...type.overline, color: color.textMuted }}>{eyebrow}</Text>
      <Text style={{ ...type.display2, color: color.text }}>{title}</Text>
      <Text style={{ ...type.body, color: color.textMuted }}>{description}</Text>
      <View
        style={{
          alignSelf: 'flex-start',
          backgroundColor: color.brandSubtle,
          borderColor: color.brandBorder,
          borderWidth: border.hairline,
          borderRadius: radius.pill,
          paddingVertical: space(1),
          paddingHorizontal: space(3),
        }}
      >
        <Text style={{ ...type.caption, color: color.onBrandSubtle }}>Arrives in {arrivesIn}</Text>
      </View>
      {children}
    </ScrollView>
  );
}
