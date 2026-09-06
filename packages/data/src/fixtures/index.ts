import { EMPTY_TABLES, type MockSeed, type MockTables } from '../mock/tables';
import { CONFERENCE } from './conference';
import { FESTIVAL } from './festival';
import { REUNION } from './reunion';
import { WEDDING } from './wedding';

/**
 * The four events, as one seed.
 *
 * Four tenants in one dataset rather than four datasets, because that is the shape the product
 * actually has: one adapter, many events, and every read scoped by `tenant_id`. A fixture set
 * with one tenant in it would let a missing scope pass every screen and every test, and the
 * failure would arrive as one event's guest list appearing on another's.
 *
 * They are deliberately unalike. A wedding pinned to light, a festival pinned to dark, a
 * conference following the device, and a reunion with most features switched off — different
 * presets, seeds, densities, corner shapes, aspect ratios and motion levels. Screenshotting the
 * same screens across all four is what turns "tenant config drives look and behaviour" from an
 * intention into something a diff can fail on.
 */

export { WEDDING, WEDDING_TENANT, WEDDING_CONFIG } from './wedding';
export { FESTIVAL, FESTIVAL_TENANT, FESTIVAL_CONFIG } from './festival';
export { CONFERENCE, CONFERENCE_TENANT, CONFERENCE_CONFIG } from './conference';
export { REUNION, REUNION_TENANT, REUNION_CONFIG } from './reunion';
export { FIXTURE_NOW } from './builders';

const EVENTS: readonly Partial<MockTables>[] = [WEDDING, FESTIVAL, CONFERENCE, REUNION];

/**
 * Written out one table at a time rather than merged generically.
 *
 * The generic version was written first and did not survive: a merge over `keyof MockTables`
 * needs a cast to convince the compiler that the value at key `k` belongs at key `k`, and casts
 * are banned outside the mappers for exactly this class of reason. The lint rule caught it,
 * which is the rule working.
 *
 * Spelling the tables out costs twenty lines and buys a compile error the day a table is added
 * to `MockTables` and forgotten here. Without it the failure is a new table silently empty in
 * every fixture, which looks like a feature with no data rather than a fixture with no rows.
 */
export const FIXTURE_SEED: MockSeed = {
  ...EMPTY_TABLES,
  tenants: EVENTS.flatMap((e) => e.tenants ?? []),
  tenantConfigs: EVENTS.flatMap((e) => e.tenantConfigs ?? []),
  users: EVENTS.flatMap((e) => e.users ?? []),
  memberships: EVENTS.flatMap((e) => e.memberships ?? []),
  approvalRequests: EVENTS.flatMap((e) => e.approvalRequests ?? []),
  venues: EVENTS.flatMap((e) => e.venues ?? []),
  sessions: EVENTS.flatMap((e) => e.sessions ?? []),
  people: EVENTS.flatMap((e) => e.people ?? []),
  sessionPeople: EVENTS.flatMap((e) => e.sessionPeople ?? []),
  mediaAssets: EVENTS.flatMap((e) => e.mediaAssets ?? []),
  personas: EVENTS.flatMap((e) => e.personas ?? []),
  gossipPosts: EVENTS.flatMap((e) => e.gossipPosts ?? []),
  tasks: EVENTS.flatMap((e) => e.tasks ?? []),
  units: EVENTS.flatMap((e) => e.units ?? []),
  assignments: EVENTS.flatMap((e) => e.assignments ?? []),
  announcements: EVENTS.flatMap((e) => e.announcements ?? []),
  rsvps: EVENTS.flatMap((e) => e.rsvps ?? []),
  notificationPreferences: EVENTS.flatMap((e) => e.notificationPreferences ?? []),
  deviceTokens: EVENTS.flatMap((e) => e.deviceTokens ?? []),
  notificationDeliveries: EVENTS.flatMap((e) => e.notificationDeliveries ?? []),
};
