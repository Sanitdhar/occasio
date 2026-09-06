import type {
  AnnouncementRow,
  ApprovalRequestRow,
  AssignmentRow,
  DeviceTokenRow,
  GossipPostRow,
  MediaAssetRow,
  MembershipRow,
  NotificationDeliveryRow,
  NotificationPreferenceRow,
  PersonRow,
  PersonaRow,
  RsvpRow,
  SessionPersonRow,
  SessionRow,
  TaskRow,
  TenantConfigRow,
  TenantRow,
  UnitRow,
  UserRow,
  VenueRow,
} from '../rows';

/**
 * The mock's whole database: one array per table in `rows.ts`, holding rows verbatim.
 *
 * Rows, not domain objects. The adapter stores exactly what Postgres will store and maps on the
 * way out through `mappers.ts`, which is what makes the Supabase swap a change of where the rows
 * come from rather than a change of what the repositories return. A mock that cached domain
 * objects would be a mock whose bugs all live on the far side of the boundary the contract suite
 * checks.
 *
 * The keys are the table names in camelCase, and this type is the seam the fixtures (#35) are
 * written against: a fixture dataset is a `MockSeed`, and `createMockAdapter({ seed })` takes it
 * with no adaptation.
 */
export type MockTables = {
  readonly tenants: readonly TenantRow[];
  readonly tenantConfigs: readonly TenantConfigRow[];
  readonly users: readonly UserRow[];
  readonly memberships: readonly MembershipRow[];
  readonly approvalRequests: readonly ApprovalRequestRow[];
  readonly venues: readonly VenueRow[];
  readonly sessions: readonly SessionRow[];
  readonly people: readonly PersonRow[];
  readonly sessionPeople: readonly SessionPersonRow[];
  readonly mediaAssets: readonly MediaAssetRow[];
  readonly personas: readonly PersonaRow[];
  readonly gossipPosts: readonly GossipPostRow[];
  readonly tasks: readonly TaskRow[];
  readonly units: readonly UnitRow[];
  readonly assignments: readonly AssignmentRow[];
  readonly announcements: readonly AnnouncementRow[];
  readonly rsvps: readonly RsvpRow[];
  readonly notificationPreferences: readonly NotificationPreferenceRow[];
  readonly deviceTokens: readonly DeviceTokenRow[];
  readonly notificationDeliveries: readonly NotificationDeliveryRow[];
};

/** What `createMockAdapter` is seeded from. The fixture events in #35 produce one of these. */
export type MockSeed = MockTables;

/**
 * Derived from `MockTables` rather than from the list below, so the two cannot disagree. It is
 * what ties `ROW_SHAPES` in `mock/mappers.ts` to this type: adding a table there and forgetting
 * to describe it is then a compile error rather than an `undefined` at runtime.
 */
export type MockTableName = keyof MockTables;

/**
 * The table names as a runtime list, for anything that has to iterate them — a reset summary, a
 * dev-menu row count. Snapshot parsing iterates `ROW_SHAPES` instead, because that is the list
 * the compiler checks.
 */
export const MOCK_TABLE_NAMES: readonly MockTableName[] = [
  'tenants',
  'tenantConfigs',
  'users',
  'memberships',
  'approvalRequests',
  'venues',
  'sessions',
  'people',
  'sessionPeople',
  'mediaAssets',
  'personas',
  'gossipPosts',
  'tasks',
  'units',
  'assignments',
  'announcements',
  'rsvps',
  'notificationPreferences',
  'deviceTokens',
  'notificationDeliveries',
];

/** A seed with nothing in it. Every event a demo shows has to be put here deliberately. */
export const EMPTY_TABLES: MockTables = {
  tenants: [],
  tenantConfigs: [],
  users: [],
  memberships: [],
  approvalRequests: [],
  venues: [],
  sessions: [],
  people: [],
  sessionPeople: [],
  mediaAssets: [],
  personas: [],
  gossipPosts: [],
  tasks: [],
  units: [],
  assignments: [],
  announcements: [],
  rsvps: [],
  notificationPreferences: [],
  deviceTokens: [],
  notificationDeliveries: [],
};

/**
 * The persisted document.
 *
 * `version` is what makes "reset demo data" unnecessary after a schema change: a snapshot written
 * by an older shape is discarded and reseeded rather than loaded into code that expects columns
 * it does not have. Bump it whenever `rows.ts` changes shape.
 *
 * `deviceId` and `nextId` are persisted alongside the tables because both are identity. A device
 * that got a new id on every reload would get a new gossip persona with it (ADR-0006), and an id
 * counter that restarted would mint a second `gp_7` on top of the first.
 */
export type MockSnapshot = {
  readonly version: number;
  readonly deviceId: string;
  readonly nextId: number;
  readonly tables: MockTables;
};

/**
 * Bumped whenever a row shape changes. See `parseSnapshot` for what this buys: it is the
 * difference between a stale snapshot being reseeded and a stale snapshot being loaded.
 */
export const MOCK_SNAPSHOT_VERSION = 1;

/** The one key the mock owns in whichever store it was handed. */
export const MOCK_STORAGE_KEY = 'occasio.mock.snapshot';
