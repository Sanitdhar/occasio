import { describe, expect, it } from '@jest/globals';
import { ThemeInputSchema, resolveTheme } from '@occasio/theme';
import { FEATURE_KEYS } from '../config';
import { FIXTURE_SEED } from './index';

/**
 * The fixtures are data, and data rots quietly.
 *
 * Types catch a missing column. They do not catch a `venue_id` pointing at a venue that was
 * renamed, a session belonging to one tenant and a venue belonging to another, or two rows
 * sharing an id — and every one of those renders as a blank space or the wrong event's content
 * rather than as an error. These are the checks that would otherwise be performed by a person
 * noticing something looked odd in a screenshot.
 */

const seed = FIXTURE_SEED;

/** Every row in a tenant-scoped table, paired with the id it claims to belong to. */
const scoped = [
  ...seed.venues.map((r) => ({ table: 'venues', id: String(r.id), tenant: r.tenant_id })),
  ...seed.sessions.map((r) => ({ table: 'sessions', id: String(r.id), tenant: r.tenant_id })),
  ...seed.people.map((r) => ({ table: 'people', id: String(r.id), tenant: r.tenant_id })),
  ...seed.mediaAssets.map((r) => ({ table: 'mediaAssets', id: String(r.id), tenant: r.tenant_id })),
  ...seed.personas.map((r) => ({ table: 'personas', id: String(r.id), tenant: r.tenant_id })),
  ...seed.gossipPosts.map((r) => ({ table: 'gossipPosts', id: String(r.id), tenant: r.tenant_id })),
  ...seed.tasks.map((r) => ({ table: 'tasks', id: String(r.id), tenant: r.tenant_id })),
  ...seed.units.map((r) => ({ table: 'units', id: String(r.id), tenant: r.tenant_id })),
];

const tenantIds = new Set(seed.tenants.map((t) => String(t.id)));
const userIds = new Set(seed.users.map((u) => String(u.id)));
const tenantOf = new Map(scoped.map((row) => [row.id, String(row.tenant)]));

describe('the fixture set', () => {
  it('has the four events the architecture is meant to be proved on', () => {
    expect(seed.tenants.map((t) => t.slug).sort()).toEqual([
      'anandhara',
      'devcon-25',
      'maple-1999',
      'sanit-riyanks',
    ]);
    expect(new Set(seed.tenants.map((t) => t.kind)).size).toBe(4);
  });

  it('gives every tenant exactly one config, and no config an orphan tenant', () => {
    expect(seed.tenantConfigs).toHaveLength(seed.tenants.length);

    const owners = seed.tenantConfigs.map((row) => String(row.tenant_id));
    expect(new Set(owners).size).toBe(owners.length);
    for (const owner of owners) expect(tenantIds.has(owner)).toBe(true);
  });

  it("keeps the decisions that are not a tenant's to make", () => {
    /* D3 — every gossip post goes through the moderation queue; an event cannot opt out,
       because that guarantee is what makes an anonymous board defensible at all. D12 — the game
       is a seam, not a feature: the config key exists and the answer is always no in Phase 1.
       Both are typed as literals, so this is belt and braces — but a fixture is exactly where a
       literal type gets widened by a careless edit. */
    for (const row of seed.tenantConfigs) {
      for (const config of [row.draft_config, row.published_config]) {
        if (config === null) continue;
        expect(config.features.gossips.requireApproval).toBe(true);
        expect(config.features.game.enabled).toBe(false);
        expect(config.version).toBe(1);
      }
    }
  });

  it('never lists a tab that is not a feature', () => {
    /* The nav filters on `features[k].enabled` at render, so listing a disabled feature is
       legitimate and deliberate here. Listing something that is not a feature at all is not:
       it renders as nothing, in a bar where a missing tab looks like a bug in the app. */
    for (const row of seed.tenantConfigs) {
      const tabs = (row.published_config ?? row.draft_config).nav.tabs;
      expect(new Set(tabs).size).toBe(tabs.length);
      for (const tab of tabs) expect(FEATURE_KEYS).toContain(tab);
    }
  });

  it('gives every tenant a theme input the schema accepts', () => {
    /* The theme half of the config does have a schema, and it is the half an admin edits, so a
       fixture that drifted from it would be the first thing to break when the editor lands. */
    for (const row of seed.tenantConfigs) {
      for (const config of [row.draft_config, row.published_config]) {
        if (config === null) continue;
        expect(ThemeInputSchema.safeParse(config.theme).success).toBe(true);
      }
    }
  });

  it('resolves every published theme without throwing', () => {
    /* The resolver enforces contrast by construction, so this also asserts that no fixture
       ships a palette a guest could not read. */
    for (const row of seed.tenantConfigs) {
      const config = row.published_config ?? row.draft_config;
      for (const scheme of ['light', 'dark'] as const) {
        const theme = resolveTheme(config.theme, { forceScheme: scheme });
        expect(theme.color.text).toBeTruthy();
      }
    }
  });

  it('makes the four events genuinely unalike', () => {
    /* The fixture set exists to prove one codebase renders four different-looking events. Four
       identical configs would satisfy every other test here and prove nothing. */
    const themes = seed.tenantConfigs.map((r) => (r.published_config ?? r.draft_config).theme);

    expect(new Set(themes.map((t) => t.presetId)).size).toBe(4);
    expect(new Set(themes.map((t) => t.brand.seed)).size).toBe(4);
    /* Light-pinned, dark-pinned and system, so the resolver's three mode paths all render. */
    expect(new Set(themes.map((t) => t.mode.support)).size).toBe(3);
    expect(new Set(themes.map((t) => t.imagery.heroAspect)).size).toBeGreaterThan(1);
    expect(new Set(themes.map((t) => t.motion.level)).size).toBeGreaterThan(1);
  });

  it('gives no two rows the same id', () => {
    /* An id collision across tenants is how one event's content appears inside another, and it
       is invisible until it happens on a screen. */
    const ids = scoped.map((row) => row.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('never points a row at another tenant', () => {
    /* The failure this guards is the one the whole architecture is about: a wedding rendering a
       conference's room because a fixture wired the ids across. */
    const crossings: string[] = [];
    const sameTenant = (from: { tenant: string; table: string }, ref: string | null): void => {
      if (ref === null) return;
      const owner = tenantOf.get(ref);
      if (owner !== undefined && owner !== from.tenant) {
        crossings.push(`${from.table} in ${from.tenant} references ${ref} in ${owner}`);
      }
    };

    for (const row of seed.sessions) {
      const from = { tenant: String(row.tenant_id), table: 'session' };
      sameTenant(from, row.venue_id === null ? null : String(row.venue_id));
      sameTenant(from, row.hero_media_id === null ? null : String(row.hero_media_id));
    }
    for (const row of seed.sessionPeople) {
      const from = { tenant: String(row.tenant_id), table: 'sessionPerson' };
      sameTenant(from, String(row.session_id));
      sameTenant(from, String(row.person_id));
    }
    for (const row of seed.gossipPosts) {
      sameTenant({ tenant: String(row.tenant_id), table: 'gossip' }, String(row.persona_id));
    }
    for (const row of seed.tasks) {
      sameTenant(
        { tenant: String(row.tenant_id), table: 'task' },
        row.session_id === null ? null : String(row.session_id),
      );
    }
    for (const row of seed.units) {
      sameTenant(
        { tenant: String(row.tenant_id), table: 'unit' },
        row.venue_id === null ? null : String(row.venue_id),
      );
    }
    for (const row of seed.assignments) {
      sameTenant({ tenant: String(row.tenant_id), table: 'assignment' }, String(row.unit_id));
    }

    expect(crossings).toEqual([]);
  });

  it('points every reference at something that exists', () => {
    const missing: string[] = [];
    const exists = (label: string, ref: string | null): void => {
      if (ref !== null && !tenantOf.has(ref)) missing.push(`${label} -> ${ref}`);
    };

    for (const row of seed.sessions) {
      exists('session.venue_id', row.venue_id === null ? null : String(row.venue_id));
      exists(
        'session.hero_media_id',
        row.hero_media_id === null ? null : String(row.hero_media_id),
      );
    }
    for (const row of seed.sessionPeople) {
      exists('sessionPerson.session_id', String(row.session_id));
      exists('sessionPerson.person_id', String(row.person_id));
    }
    for (const row of seed.assignments) exists('assignment.unit_id', String(row.unit_id));

    expect(missing).toEqual([]);
  });

  it('points every user reference at a real user', () => {
    const missing: string[] = [];
    const isUser = (label: string, ref: string | null): void => {
      if (ref !== null && !userIds.has(ref)) missing.push(`${label} -> ${ref}`);
    };

    for (const row of seed.memberships) {
      isUser('membership.user_id', row.user_id === null ? null : String(row.user_id));
    }
    for (const row of seed.tasks) {
      isUser('task.created_by', String(row.created_by));
      isUser('task.assignee', row.assignee_user_id === null ? null : String(row.assignee_user_id));
    }
    for (const row of seed.assignments) isUser('assignment.user_id', String(row.user_id));
    for (const row of seed.rsvps) isUser('rsvp.user_id', String(row.user_id));
    for (const row of seed.announcements) isUser('announcement.created_by', String(row.created_by));

    expect(missing).toEqual([]);
  });

  it('gives every tenant an admin who can actually administer it', () => {
    /* An event whose only membership is an attendee is one nobody can moderate or publish, and
       every admin screen would render a ForbiddenError instead of itself. */
    for (const tenant of seed.tenants) {
      const admins = seed.memberships.filter(
        (m) => m.tenant_id === tenant.id && m.role === 'event_admin' && m.status === 'active',
      );
      expect(admins.length).toBeGreaterThan(0);
    }
  });

  it('covers every moderation state at least once', () => {
    /* The moderation queue is a screen. A fixture set that only contained approved posts would
       render it empty and test nothing. */
    expect(new Set(seed.gossipPosts.map((g) => g.status))).toEqual(
      new Set(['approved', 'pending', 'rejected', 'hidden']),
    );
  });

  it('gives every image a blurhash', () => {
    /* `Image` treats a missing blurhash as the third-party-avatar case and falls back to a
       tonal fill. A fixture set without them would screenshot the fallback everywhere and
       quietly stop exercising the real path. */
    for (const asset of seed.mediaAssets) {
      expect(asset.blurhash).toBeTruthy();
      expect(asset.alt).toBeTruthy();
    }
  });

  it('does not move with the clock', () => {
    /* The visual gate diffs screenshots. A fixture built from `Date.now()` would fail it every
       midnight, for a reason nobody would attribute to the fixture. */
    const dates = [
      ...seed.sessions.map((s) => s.starts_at),
      ...seed.tenants.flatMap((t) => [t.starts_on, t.ends_on]),
    ];
    for (const value of dates) {
      expect(value).not.toBeNull();
      expect(String(value)).toMatch(/^20\d\d-/);
    }
  });
});
