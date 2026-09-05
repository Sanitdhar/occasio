import { ThemeProvider, useTheme } from '@occasio/ui';
import { Stack } from 'expo-router';
import { APP_THEME } from '../../../../src/theme/inputs';
import { useDeviceScheme } from '../../../../src/theme/useDeviceScheme';

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
 * Nests the app theme back over the tenant theme: editing a dark festival theme inside a
 * dark editor is unusable. Only the preview pane will wear the tenant theme.
 */
export default function AdminLayout() {
  const systemScheme = useDeviceScheme();
  return (
    <ThemeProvider input={APP_THEME} systemScheme={systemScheme}>
      <Chrome />
    </ThemeProvider>
  );
}
