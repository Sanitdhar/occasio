import { ThemeProvider } from '@occasio/ui';
import { Slot } from 'expo-router';
import { FIXTURE_TENANT_THEME } from '../../../src/theme/inputs';
import { useDeviceScheme } from '../../../src/theme/useDeviceScheme';

/**
 * Everything under /e/[slug] belongs to one event, and wears that event's theme.
 *
 * D9 — this path shape is canonical forever. Subdomains and custom domains are resolved by a
 * rewrite at the hosting layer plus a lookup table, never by routing inside the app.
 *
 * The nested ThemeProvider is the mechanism the theme editor's live preview will use: the
 * subtree below it renders under a different theme without a single duplicated component.
 * TenantProvider replaces the fixture input once tenancy lands.
 */
export default function TenantLayout() {
  const systemScheme = useDeviceScheme();
  return (
    <ThemeProvider input={FIXTURE_TENANT_THEME} systemScheme={systemScheme}>
      <Slot />
    </ThemeProvider>
  );
}
