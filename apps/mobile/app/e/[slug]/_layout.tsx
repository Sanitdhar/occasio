import { Slot, useLocalSearchParams } from 'expo-router';
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
export default function TenantLayout() {
  const { slug } = useLocalSearchParams<{ slug: string }>();

  return (
    <TenantProvider slug={slug}>
      <AppThemeProvider input={FIXTURE_TENANT_THEME}>
        <Slot />
      </AppThemeProvider>
    </TenantProvider>
  );
}
