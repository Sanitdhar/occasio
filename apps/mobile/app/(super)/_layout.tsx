import { Stack } from 'expo-router';
import { useAppTheme } from '../../src/theme/useScaffoldTheme';

/**
 * Super admin sits OUTSIDE e/[slug] on purpose: it is cross-tenant, so it must never inherit
 * an event's theme or be reachable through an event's route tree.
 */
export default function SuperAdminLayout() {
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
