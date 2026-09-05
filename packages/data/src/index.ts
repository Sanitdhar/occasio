/**
 * The data layer (D5, D29) — repository interfaces, row types matching Postgres exactly, and
 * the adapter swap point. Mock adapters land in build-order step 4; the Supabase adapter lives
 * under ./supabase/ and is the only place `@supabase/*` may be imported.
 */
export const DATA_SCHEMA_VERSION = 1 as const;
