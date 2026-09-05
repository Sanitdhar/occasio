import { ThemeProvider, useTheme } from '@occasio/ui';
import { Stack } from 'expo-router';
import { APP_THEME } from '../../src/theme/inputs';
import { useDeviceScheme } from '../../src/theme/useDeviceScheme';

function Chrome() {
  const theme = useTheme();
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

/**
 * Super admin sits outside e/[slug] on purpose -- it is cross-tenant, so it must never
 * inherit an event theme or be reachable through an event route tree.
 */
export default function AdminLayout() {
  const systemScheme = useDeviceScheme();
  return (
    <ThemeProvider input={APP_THEME} systemScheme={systemScheme}>
      <Chrome />
    </ThemeProvider>
  );
}
