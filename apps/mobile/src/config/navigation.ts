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

export type TabPlan = {
  readonly key: FeatureKey;
  readonly name: string;
  readonly title: string;
  /** Hidden tabs are still declared so a deep link into a disabled feature resolves. */
  readonly hidden: boolean;
};

/**
 * The ordered list of tabs to declare.
 *
 * Order comes from `nav.tabs`, not from `FEATURE_KEYS` — an event that lists schedule before
 * home must get schedule first, and `href: null` hides a tab without reordering it. Disabled
 * features are appended after the visible ones so they remain routable but never affect the
 * order of what is on screen.
 *
 * Pure and separately tested, because getting this wrong silently produces the right tabs in
 * the wrong sequence, which no type check would catch.
 */
export const planTabs = (nav: NavConfig): readonly TabPlan[] => {
  const shown = visibleTabs(nav);
  const hidden = FEATURE_KEYS.filter((key) => !shown.includes(key));
  return [...shown, ...hidden].map((key) => ({
    key,
    name: TAB_ROUTES[key].name,
    title: TAB_ROUTES[key].title,
    hidden: !shown.includes(key),
  }));
};
