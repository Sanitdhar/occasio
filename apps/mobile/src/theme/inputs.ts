import { themeInputFromPreset, type ThemeInput } from '@occasio/theme';

/**
 * ⚠️ TEMPORARY tenant theme. Replaced by the tenant's `published_config` row when the data
 * layer lands (#23); the shape is already the persisted shape, so the swap is a lookup, not a
 * rewrite.
 */
export const FIXTURE_TENANT_THEME: ThemeInput = themeInputFromPreset('romantic', '#7C3A5A');

/**
 * The console's own theme. Admin and super-admin areas never wear a tenant's theme: editing a
 * dark festival theme inside a dark editor is unusable, and a super admin is cross-tenant by
 * definition. This one is permanent.
 */
export const APP_THEME: ThemeInput = themeInputFromPreset('minimal', '#3F5B7C');
