import { useTheme } from '@occasio/ui';
import { Stack, router } from 'expo-router';
import { EventAdminGate } from '../../../../src/features/access/EventAdminGate';
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
 *
 * One gate here covers every admin screen, which is the whole point of gating at a layout — a
 * screen added under this directory is gated by existing rather than by somebody remembering to
 * gate it. Which roles are allowed, and how the tenant is resolved, live in `EventAdminGate`;
 * this file keeps the router callback, which is the part that belongs to a route.
 */
export default function AdminLayout() {
  return (
    <AppThemeProvider input={APP_THEME}>
      <EventAdminGate
        onLeave={(slug) => {
          router.replace(`/e/${slug}`);
        }}
      >
        <Chrome />
      </EventAdminGate>
    </AppThemeProvider>
  );
}
