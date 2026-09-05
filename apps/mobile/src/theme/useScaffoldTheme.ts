import { resolveTheme, themeInputFromPreset, type ResolvedTheme } from '@occasio/theme';

/**
 * ⚠️ TEMPORARY — replaced wholesale by `useTheme()` from the real ThemeProvider in #22.
 *
 * It exists so the route skeleton does not repeat theme resolution in fifteen files, and so
 * the migration is a single import swap rather than fifteen edits. It resolves a fixed preset
 * because tenant config does not exist yet.
 */
export const useScaffoldTheme = (): ResolvedTheme =>
  resolveTheme(themeInputFromPreset('romantic', '#7C3A5A'), { forceScheme: 'light' });

/** The admin console never wears a tenant's theme — editing a dark festival theme in a dark
 *  editor is unusable, and a super admin is cross-tenant by definition. */
export const useAppTheme = (): ResolvedTheme =>
  resolveTheme(themeInputFromPreset('minimal', '#3F5B7C'), { forceScheme: 'light' });
