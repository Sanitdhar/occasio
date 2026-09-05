import { Stack } from 'expo-router';
import { useAppTheme } from '../../../../src/theme/useScaffoldTheme';

/**
 * The admin console deliberately does NOT wear the tenant's theme: editing a dark festival
 * theme inside a dark editor is unusable, and the preview pane is where the tenant theme
 * belongs. RoleGate mounts here once identity lands.
 */
export default function AdminLayout() {
  const theme = useAppTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.color.surface },
        headerTintColor: theme.color.text,
        contentStyle: { backgroundColor: theme.color.bg },
      }}
    />
  );
}
