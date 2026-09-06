import { useTheme } from '@occasio/ui';
import { Stack, router } from 'expo-router';
import { PlatformGate } from '../../src/access/PlatformGate';
import { AppThemeProvider } from '../../src/theme/AppThemeProvider';
import { APP_THEME } from '../../src/theme/inputs';

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
  return (
    <AppThemeProvider input={APP_THEME}>
      {/* Not a `RoleGate`: memberships are per event and this area is not. See PlatformGate for
          the gap that leaves and why it is an allow-list rather than a schema field. */}
      <PlatformGate
        leaveLabel="Back to your events"
        onLeave={() => {
          router.replace('/discover');
        }}
      >
        <Chrome />
      </PlatformGate>
    </AppThemeProvider>
  );
}
