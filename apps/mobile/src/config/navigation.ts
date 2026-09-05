/**
 * D2 — the tab bar is generated from config, never hardcoded.
 *
 * A conference turns off gossips and renames it; a wedding drops tracks entirely. If tabs were
 * written into the layout, every one of those would be a code change, and the promise that a
 * new event is a new row would already be broken.
 *
 * ⚠️ TEMPORARY: `FIXTURE_NAV` stands in for the tenant config row until the data layer lands
 * (#23). The shape is what matters — it mirrors `TenantConfig.nav` / `.features` from the
 * design doc, so swapping the source is a one-line change, not a rewrite of this layout.
 */

export const FEATURE_KEYS = ['home', 'schedule', 'gossips', 'tasks', 'info'] as const;
export type FeatureKey = (typeof FEATURE_KEYS)[number];

export type NavConfig = {
  /** Which tabs render, in what order. */
  readonly tabs: readonly FeatureKey[];
  /** Whether the feature exists for this event at all. */
  readonly features: Readonly<Record<FeatureKey, boolean>>;
};

/** Maps a feature to the route segment that implements it, and its default label. */
export const TAB_ROUTES: Readonly<
  Record<FeatureKey, { readonly name: string; readonly title: string }>
> = {
  home: { name: 'index', title: 'Home' },
  schedule: { name: 'schedule', title: 'Schedule' },
  gossips: { name: 'gossips', title: 'Gossips' },
  tasks: { name: 'tasks', title: 'Tasks' },
  info: { name: 'info', title: 'Info' },
};

export const FIXTURE_NAV: NavConfig = {
  tabs: ['home', 'schedule', 'gossips', 'tasks', 'info'],
  features: { home: true, schedule: true, gossips: true, tasks: true, info: true },
};

/** The tabs an event actually shows: configured order, minus anything switched off. */
export const visibleTabs = (nav: NavConfig): readonly FeatureKey[] =>
  nav.tabs.filter((key) => nav.features[key]);
