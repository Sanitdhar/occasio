import type { ThemeInput } from '@occasio/theme';

/**
 * The document stored in `tenant_configs.draft_config` and `.published_config`.
 *
 * D2 — tenant config is data that drives design *and* behaviour, so a new event is a new row
 * rather than new code. It is deliberately one JSON document instead of a dozen columns: the
 * theme editor edits it as a whole, publishing is a single atomic copy of draft over published,
 * and adding a feature flag costs a key rather than a migration.
 *
 * This is the only camelCase shape reachable from a row type, and that is on purpose. Its keys
 * are not columns — Postgres never sees inside a `jsonb` value — and it is the same object the
 * theme resolver and the feature registry consume, so a snake_case copy would exist only to be
 * mapped straight back.
 */

/** Which surfaces exist. The tab bar is generated from this, never hard-coded. */
export const FEATURE_KEYS = ['schedule', 'gossips', 'media', 'info', 'game'] as const;
export type FeatureKey = (typeof FEATURE_KEYS)[number];

export type TenantConfig = {
  readonly version: 1;
  /** §3 — the ~25 fields an admin actually edits. The resolver derives ~150 tokens from them. */
  readonly theme: ThemeInput;
  readonly features: {
    readonly schedule: {
      readonly enabled: boolean;
      readonly defaultView: 'stories' | 'list';
      readonly tracks: boolean;
    };
    /**
     * D3 — `requireApproval` is `true`, not `boolean`. Every post goes through the queue; an
     * event cannot opt out, because the moderation guarantee is what makes an anonymous board
     * defensible at all.
     */
    readonly gossips: {
      readonly enabled: boolean;
      readonly requireApproval: true;
      readonly allowMedia: boolean;
    };
    readonly media: { readonly enabled: boolean };
    readonly info: { readonly enabled: boolean };
    /** D12 — the gamification seam. `false` in Phase 1: the config key exists, the feature does not. */
    readonly game: { readonly enabled: false };
  };
  /**
   * Which tabs render, in what order. Filtered by `features[k].enabled` at render time, so
   * disabling a feature never requires editing this list too.
   */
  readonly nav: { readonly tabs: readonly FeatureKey[] };
  /**
   * D21 — per-tenant overrides of catalogue keys, applied before translation so a conference can
   * rename "Gossips" to "Backchannel" in any language. Keyed by i18n catalogue key; the
   * catalogue itself arrives with the `t()` wrapper, so this stays a string map until then.
   */
  readonly copy: Readonly<Record<string, string>>;
};
