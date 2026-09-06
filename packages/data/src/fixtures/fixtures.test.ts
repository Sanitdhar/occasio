import { describe, expect, it } from '@jest/globals';
import type { TenantId } from '@occasio/core';
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

/**
 * One map per table, not one map of everything.
 *
 * A single id-to-tenant map answers "does this id exist somewhere in this tenant", which is not
 * the question a foreign key asks. `session.venue_id` pointing at a person in the same tenant
 * passed that check and renders as a session with no venue — the failure the check was written
 * to catch.
 */
const byId = (
  rows: readonly {
    readonly id: { readonly toString: () => string };
    readonly tenant_id: TenantId;
  }[],
): ReadonlyMap<string, string> => new Map(rows.map((r) => [String(r.id), String(r.tenant_id)]));

const venues = byId(seed.venues);
const sessions = byId(seed.sessions);
const people = byId(seed.people);
const mediaAssets = byId(seed.mediaAssets);
const personas = byId(seed.personas);
const units = byId(seed.units);
const tasks = byId(seed.tasks);
const gossipPosts = byId(seed.gossipPosts);

const ALL_SCOPED: readonly ReadonlyMap<string, string>[] = [
  venues,
  sessions,
  people,
  mediaAssets,
  personas,
  units,
  tasks,
  gossipPosts,
];

const tenantIds = new Set(seed.tenants.map((t) => String(t.id)));
const userIds = new Set(seed.users.map((u) => String(u.id)));

/** Every foreign key in the fixture set, with the table it must point into. */
type Reference = {
  readonly label: string;
  readonly from: TenantId;
  readonly ref: string | null;
  readonly target: ReadonlyMap<string, string>;
};

const references = (): readonly Reference[] => {
  const out: Reference[] = [];
  const add = (
    label: string,
    from: TenantId,
    ref: { toString: () => string } | null,
    target: ReadonlyMap<string, string>,
  ): void => {
    out.push({ label, from, ref: ref === null ? null : String(ref), target });
  };

  for (const row of seed.sessions) {
    add('session.venue_id', row.tenant_id, row.venue_id, venues);
    add('session.hero_media_id', row.tenant_id, row.hero_media_id, mediaAssets);
  }
  for (const row of seed.sessionPeople) {
    add('sessionPerson.session_id', row.tenant_id, row.session_id, sessions);
    add('sessionPerson.person_id', row.tenant_id, row.person_id, people);
  }
  for (const row of seed.gossipPosts) {
    add('gossip.persona_id', row.tenant_id, row.persona_id, personas);
    add('gossip.media_id', row.tenant_id, row.media_id, mediaAssets);
  }
  for (const row of seed.tasks) add('task.session_id', row.tenant_id, row.session_id, sessions);
  for (const row of seed.units) add('unit.venue_id', row.tenant_id, row.venue_id, venues);
  for (const row of seed.assignments) add('assignment.unit_id', row.tenant_id, row.unit_id, units);
  for (const row of seed.rsvps) add('rsvp.session_id', row.tenant_id, row.session_id, sessions);
  for (const row of seed.people) {
    add('person.photo_media_id', row.tenant_id, row.photo_media_id, mediaAssets);
  }

  return out;
};

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
       is invisible until it happens on a screen. Memberships are included because their ids
       used to be derived from `user_id`, and an unaccepted invitation has none. */
    const ids = [
      ...ALL_SCOPED.flatMap((table) => [...table.keys()]),
      ...seed.memberships.map((m) => String(m.id)),
    ];

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('points every reference into the right table, in the right tenant', () => {
    /*
     * Both halves in one pass, because separately each misses what the other assumes. Existence
     * alone accepts a `venue_id` holding a person's id; tenant alone accepts it too, as long as
     * the person is in the same event. Either way the screen renders a session with no venue and
     * nobody can see why.
     *
     * The tenant half is the one the whole architecture is about: a wedding showing a
     * conference's room because a fixture wired the ids across.
     */
    const problems: string[] = [];

    for (const { label, from, ref, target } of references()) {
      if (ref === null) continue;
      const owner = target.get(ref);
      if (owner === undefined) {
        const elsewhere = ALL_SCOPED.some((table) => table.has(ref));
        problems.push(
          elsewhere
            ? `${label} -> ${ref} exists, but not in the table this column points into`
            : `${label} -> ${ref} does not exist`,
        );
        continue;
      }
      if (owner !== String(from)) {
        problems.push(`${label} in ${String(from)} points at ${ref}, which belongs to ${owner}`);
      }
    }

    expect(problems).toEqual([]);
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
    /*
     * `^20\\d\\d-` was the first version of this, and it was worth nothing: a value from
     * `new Date()` matches it, and so did `2026-11-20T10.5:00:00.000Z` — the invalid string a
     * fractional timezone offset produced, which made every wedding and festival time in this
     * set unparseable while the test stayed green.
     *
     * So: exact values, and a parse. The visual gate diffs screenshots, and a fixture that
     * moved with the clock would fail it every midnight for a reason nobody would attribute to
     * the fixture.
     */
    const bySlug = new Map(seed.tenants.map((t) => [t.slug, t]));
    expect(bySlug.get('sanit-riyanks')?.starts_on).toBe('2026-11-20');
    expect(bySlug.get('devcon-25')?.ends_on).toBe('2026-10-07');

    const byId = new Map(seed.sessions.map((row) => [String(row.id), row]));
    /* 16:00 in Asia/Kolkata is 10:30Z — the half-hour offset the broken helper could not
       express, pinned here so it cannot silently become 10:00 or an invalid string again. */
    expect(byId.get('s_wed_mehendi')?.starts_at).toBe('2026-11-20T10:30:00.000Z');
    /* 09:30 in Europe/Berlin is 07:30Z, a whole-hour offset for contrast. */
    expect(byId.get('s_con_keynote')?.starts_at).toBe('2026-10-06T07:30:00.000Z');

    for (const row of seed.sessions) {
      expect(Number.isNaN(Date.parse(row.starts_at))).toBe(false);
      if (row.ends_at !== null) expect(Number.isNaN(Date.parse(row.ends_at))).toBe(false);
    }
    for (const row of seed.tasks) {
      if (row.due_at !== null) expect(Number.isNaN(Date.parse(row.due_at))).toBe(false);
    }
  });

  it('gives every image a dominant colour to paint before it loads', () => {
    /* The frame shows this while the blurhash decodes and behind an image that never arrives.
       Null everywhere would have made that path render the neutral fallback in every fixture. */
    for (const asset of seed.mediaAssets) {
      expect(asset.dominant_color).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});
