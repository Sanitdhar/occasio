import { Slot } from 'expo-router';

/**
 * Everything under /e/[slug] belongs to one event.
 *
 * D9 — this path shape is canonical forever. Subdomains and custom domains are resolved by a
 * rewrite at the hosting layer plus a lookup table, never by routing inside the app.
 *
 * TenantProvider and the tenant's ThemeProvider mount here once the tenancy epic lands; until
 * then this is a pass-through so the route shape can be reviewed on its own.
 */
export default function TenantLayout() {
  return <Slot />;
}
