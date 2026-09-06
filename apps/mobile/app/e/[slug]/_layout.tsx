import { Platform } from 'react-native';
import { Slot, router, useLocalSearchParams } from 'expo-router';
import { TenantGate } from '../../../src/tenant/TenantGate';
import { TenantProvider } from '../../../src/tenant/TenantProvider';
import { AppThemeProvider } from '../../../src/theme/AppThemeProvider';
import { FIXTURE_TENANT_THEME } from '../../../src/theme/inputs';

/**
 * Everything under /e/[slug] belongs to one event, and wears that event's theme.
 *
 * D9 — this path shape is canonical forever. Subdomains and custom domains are resolved by a
 * rewrite at the hosting layer plus a lookup table, never by routing inside the app.
 *
 * The nested ThemeProvider is the mechanism the theme editor's live preview will use: the
 * subtree below it renders under a different theme without a single duplicated component. The
 * theme is still the fixture — the tenant's own config arrives with its repository read.
 *
 * The nested TenantProvider is not a second resolution. This route already holds the slug, so it
 * says so; the root's provider is what asks the platform, and only where there is no route to
 * read. Resolution is asynchronous, so without this every navigation into an event would pass
 * through a `resolving` frame to arrive at a fact the URL had all along.
 */
/**
 * Where "no event here" leads, which is the one part of it the router owns.
 *
 * Web has a page listing events and native does not — it has a join-by-code screen, because a
 * phone with no URL bar cannot be handed an address. `TenantGate` is told the label and the
 * destination rather than working either out, which is what keeps it renderable in a test and,
 * later, in the theme editor's preview.
 */
const wayOut =
  Platform.OS === 'web'
    ? {
        label: 'Find your event',
        go: () => {
          router.replace('/discover');
        },
      }
    : {
        label: 'Enter your code',
        go: () => {
          router.replace('/join');
        },
      };

export default function TenantLayout() {
  const { slug } = useLocalSearchParams<{ slug: string }>();

  return (
    <TenantProvider slug={slug}>
      <AppThemeProvider input={FIXTURE_TENANT_THEME}>
        <TenantGate onLeave={wayOut.go} leaveLabel={wayOut.label}>
          <Slot />
        </TenantGate>
      </AppThemeProvider>
    </TenantProvider>
  );
}
