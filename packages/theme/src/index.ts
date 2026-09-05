/**
 * The theming engine (D7, D10) — resolves a tenant's ~25-field ThemeInput into ~150
 * contrast-guaranteed tokens. Implemented in build-order step 2, before any UI exists,
 * because it is the riskiest part of the system and the easiest to test in isolation.
 *
 * See docs/decisions.md and the design doc for the token model.
 */
export const THEME_SCHEMA_VERSION = 1 as const;
