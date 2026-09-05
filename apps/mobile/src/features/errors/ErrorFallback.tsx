import type { ResolvedTheme } from '@occasio/theme';
import { Pressable, ScrollView, Text, View } from 'react-native';

type Props = {
  readonly theme: ResolvedTheme;
  readonly error: Error;
  readonly onRetry: () => void;
  /** Stack traces help a developer and frighten a guest, so they are opt-in. */
  readonly showDetail?: boolean;
};

/**
 * What an attendee sees when a screen throws.
 *
 * The default is a blank white screen, which tells someone standing in a venue nothing and
 * gives them nothing to do. This is themed, says what happened in plain language, and offers
 * the one action that usually works.
 *
 * Pure: theme and handlers arrive as props, so it renders anywhere — including under the theme
 * editor's preview.
 */
export function ErrorFallback({ theme, error, onRetry, showDetail = false }: Props) {
  const { color, type, space, radius, border } = theme;

  return (
    <ScrollView
      style={{ backgroundColor: color.bg }}
      contentContainerStyle={{ padding: space(6), gap: space(4), flexGrow: 1 }}
    >
      <View style={{ gap: space(2) }}>
        <Text style={{ ...type.overline, color: color.danger }}>SOMETHING BROKE</Text>
        <Text style={{ ...type.display2, color: color.text }}>This screen didn&apos;t load</Text>
        <Text style={{ ...type.body, color: color.textMuted }}>
          The rest of the event is still fine. Try again, and if it keeps happening, let whoever is
          running the event know.
        </Text>
      </View>

      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel="Try loading this screen again"
        style={({ pressed }) => ({
          alignSelf: 'flex-start',
          backgroundColor: pressed ? color.interactive.pressed : color.interactive.rest,
          borderRadius: radius.md,
          paddingVertical: space(3),
          paddingHorizontal: space(5),
        })}
      >
        <Text style={{ ...type.bodyStrong, color: color.onBrand }}>Try again</Text>
      </Pressable>

      {showDetail ? (
        <View
          style={{
            backgroundColor: color.surfaceRaised,
            borderColor: color.border,
            borderWidth: border.hairline,
            borderRadius: radius.md,
            padding: space(4),
            gap: space(1),
          }}
        >
          <Text style={{ ...type.overline, color: color.textFaint }}>DEVELOPER DETAIL</Text>
          <Text style={{ ...type.caption, color: color.textMuted }}>{error.message}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}
