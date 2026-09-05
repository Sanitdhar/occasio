import { Link } from 'expo-router';
import { Text, View } from 'react-native';
import { useScaffoldTheme } from '../src/theme/useScaffoldTheme';

/**
 * A mistyped slug is the first thing anyone will hit, so this needs to offer a way out rather
 * than a dead end.
 */
export default function NotFound() {
  const { color, type, space } = useScaffoldTheme();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: color.bg,
        padding: space(6),
        gap: space(3),
        justifyContent: 'center',
      }}
    >
      <Text style={{ ...type.display2, color: color.text }}>No such page</Text>
      <Text style={{ ...type.body, color: color.textMuted }}>
        That link may be mistyped, or the event may have been moved.
      </Text>
      <Link href="/discover" style={{ ...type.bodyStrong, color: color.brand }}>
        Browse events
      </Link>
    </View>
  );
}
