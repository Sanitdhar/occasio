import { resolveTheme, themeInputFromPreset } from '@occasio/theme';
import { ScrollView, Text, View } from 'react-native';

/**
 * A placeholder home screen that earns its place by proving two things the scaffold has to get
 * right: Metro resolves the `@occasio/*` workspace packages from apps/mobile, and the theming
 * engine's tokens drive real rendered output.
 *
 * Every value below comes from the resolver — there is not a literal colour or spacing number
 * here, which is what the design-system lint rule enforces from now on.
 *
 * Replaced by the real attendee home screen in the v0.2 milestone.
 */
export default function ScaffoldScreen() {
  const theme = resolveTheme(themeInputFromPreset('romantic', '#7C3A5A'), {
    forceScheme: 'light',
  });
  const { color, type, space, radius } = theme;

  return (
    <ScrollView
      style={{ backgroundColor: color.bg }}
      contentContainerStyle={{ padding: space(6), gap: space(4) }}
    >
      <View style={{ gap: space(2) }}>
        <Text style={{ ...type.overline, color: color.textMuted }}>OCCASIO</Text>
        <Text style={{ ...type.display2, color: color.text }}>The app shell is up</Text>
        <Text style={{ ...type.body, color: color.textMuted }}>
          One Expo tree rendering iOS, Android and web. This screen is a placeholder — the real
          attendee experience arrives in the v0.2 milestone.
        </Text>
      </View>

      <View
        style={{
          backgroundColor: color.surfaceRaised,
          borderColor: color.border,
          borderWidth: theme.border.hairline,
          borderRadius: radius.lg,
          padding: space(4),
          gap: space(2),
        }}
      >
        <Text style={{ ...type.title2, color: color.text }}>Resolved from one seed colour</Text>
        <Text style={{ ...type.body, color: color.textMuted }}>
          The palette below was derived by the theming engine, not written down. Contrast is
          guaranteed by the resolver rather than checked in review.
        </Text>
        <View style={{ flexDirection: 'row', gap: space(2), flexWrap: 'wrap' }}>
          {theme.color.ramp.brand.map((swatch) => (
            <View
              key={swatch}
              style={{
                width: space(8),
                height: space(8),
                borderRadius: radius.sm,
                backgroundColor: swatch,
                borderColor: color.border,
                borderWidth: theme.border.hairline,
              }}
            />
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
