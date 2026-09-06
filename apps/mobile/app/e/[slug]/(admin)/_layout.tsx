import { useTheme } from '@occasio/ui';
import { Stack, router } from 'expo-router';
import { RoleGate } from '../../../../src/access/RoleGate';
import { useTenantBySlug } from '../../../../src/data/hooks';
import { useTenantResolution } from '../../../../src/tenant/TenantProvider';
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
 * One `RoleGate` here covers every admin screen, which is the whole point of gating at a layout
 * — a screen added under this directory is gated by existing rather than by somebody remembering
 * to gate it. `event_admin` only: a moderator moderates a queue and does not edit the theme or
 * the schedule, and widening that list is a visible change to this line.
 *
 * It is UX rather than enforcement. What actually stops a guest reading this is row-level
 * security; this stops them being shown a door that will not open.
 */
export default function AdminLayout() {
  const resolution = useTenantResolution();
  const slug = resolution.kind === 'resolved' ? resolution.slug : null;
  /* A cache hit: `TenantGate` above this already loaded the event to decide whether it exists,
     and both reads share a key. The role query is what actually goes out from here. */
  const tenantId = useTenantBySlug(slug).data?.id ?? null;

  return (
    <AppThemeProvider input={APP_THEME}>
      <RoleGate
        tenantId={tenantId}
        allow={['event_admin']}
        leaveLabel="Back to the event"
        onLeave={() => {
          if (slug !== null) router.replace(`/e/${slug}`);
        }}
      >
        <Chrome />
      </RoleGate>
    </AppThemeProvider>
  );
}
