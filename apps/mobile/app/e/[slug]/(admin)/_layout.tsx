import { useTheme } from '@occasio/ui';
import { Stack } from 'expo-router';
import { AppThemeProvider } from '../../../../src/theme/AppThemeProvider';
import { APP_THEME } from '../../../../src/theme/inputs';

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
  return (
    <AppThemeProvider input={APP_THEME}>
      <Chrome />
    </AppThemeProvider>
  );
}
