import type {
  AnnouncementId,
  AssignmentId,
  Branded,
  GossipPostId,
  MediaId,
  MembershipId,
  PersonId,
  PersonaId,
  SessionId,
  TaskId,
  TenantId,
  UnitId,
  UserId,
  VenueId,
} from '@occasio/core';
import type { TenantConfig } from './config';

/**
 * Row types — the eventual Postgres tables, spelled exactly as Postgres will spell them.
 *
 * Three properties are deliberate, and all three are expensive to change later:
 *
 *  1. **`snake_case`, always.** A row type is a description of a table, not of a TypeScript
 *     object. When the Supabase adapter lands it returns these shapes verbatim, so any
 *     renaming happens in exactly one file — `mappers.ts` — instead of being smeared across
 *     every query. Domain objects (`domain.ts`) are the camelCase side of that boundary.
 *  2. **Branded ids, never bare `string`.** `TenantId` and `SessionId` are both strings at
 *     runtime; branding turns a transposed argument into a compile error rather than one
 *     event's data appearing inside another (D16, `@occasio/core/ids`).
 *  3. **`| null`, never `?`.** A nullable column is a column that is present and null. The repo
 *     runs with `exactOptionalPropertyTypes`, so `field?: T` and `field: T | null` are genuinely
 *     different types, and only the second one describes a table.
 *
 * Fields flagged in the design doc as impossible to retrofit are present from the first commit:
 * `author_device_hash` on gossip posts, `draft_config`/`published_config` on the tenant config
 * row, `blurhash` and `dominant_color` on media assets, and `timezone` on the tenant. Each is
 * either a privacy guarantee or a rendering guarantee that a later migration cannot recover —
 * see the notes on each table.
 */

/* ---------------------------------------------------------------------------------------------
 * Scalar aliases
 * ------------------------------------------------------------------------------------------- */

/** `timestamptz`, serialised as an ISO 8601 string with an explicit offset. */
export type Timestamptz = string;

/** `date`, serialised as `YYYY-MM-DD`. */
export type DateOnly = string;

/**
 * An IANA time zone name such as `Europe/London`. Not a UTC offset: an event that spans a DST
 * boundary needs the zone to render "7pm" correctly on both days.
 */
export type IanaTimeZone = string;

/**
 * A `jsonb` column with no fixed shape. `unknown` rather than `any` so every read has to narrow
 * first — these values come from the database, and Phase 2 lets admins write into some of them.
 */
export type JsonObject = Readonly<Record<string, unknown>>;

/* ---------------------------------------------------------------------------------------------
 * Ids that do not exist in @occasio/core yet
 *
 * The other thirteen ids live in `packages/core/src/ids.ts` and belong there. These three are
 * declared here only because the rows that need them arrive with this change; they are plain
 * `Branded` aliases over the same machinery, so moving them into core later is a cut-and-paste
 * with no call-site changes. See the PR discussion.
 * ------------------------------------------------------------------------------------------- */

export type ApprovalRequestId = Branded<'ApprovalRequest'>;
export type DeviceTokenId = Branded<'DeviceToken'>;
export type NotificationDeliveryId = Branded<'NotificationDelivery'>;

/* ---------------------------------------------------------------------------------------------
 * Enumerations
 *
 * Each of these becomes a Postgres enum type. They are `as const` tuples so the union and the
 * runtime list stay one declaration — a mock adapter, a `<Segmented>` control and a `CHECK`
 * constraint all need the values, and three hand-maintained copies drift.
 * ------------------------------------------------------------------------------------------- */

export const TENANT_KINDS = ['wedding', 'festival', 'conference', 'reunion'] as const;
export type TenantKind = (typeof TENANT_KINDS)[number];

/**
 * D25 — the full provisioning machine exists from day one even though only a super admin drives
 * it, so opening self-serve signup later is a screen and a permission change, not a migration.
 */
export const TENANT_STATUSES = ['draft', 'pending_approval', 'approved', 'suspended'] as const;
export type TenantStatus = (typeof TENANT_STATUSES)[number];

/** `unlisted` is reachable by link but absent from discovery — the common case for a wedding. */
export const TENANT_VISIBILITIES = ['public', 'unlisted', 'private'] as const;
export type TenantVisibility = (typeof TENANT_VISIBILITIES)[number];

export const SESSION_STATUSES = ['draft', 'published', 'cancelled'] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

/** D15 — every actor has a role, and it is the role that gates the admin and crew surfaces. */
export const MEMBERSHIP_ROLES = ['event_admin', 'moderator', 'crew', 'vendor', 'attendee'] as const;
export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];

/**
 * `invited` rows exist before the person does: an admin invites by email or phone, and the row
 * is claimed on first sign-in. That is why a crew member's tasks are already waiting for them.
 */
export const MEMBERSHIP_STATUSES = ['invited', 'active', 'revoked'] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

/**
 * D3 — one moderation vocabulary for every piece of attendee-authored content. Gossip posts and
 * uploaded photos share this enum because they share the queue; splitting it would mean two
 * moderation screens the moment the gallery ships.
 *
 * `rejected` is a decision, `hidden` is a retraction of an approval (D31's report threshold
 * auto-hides pending review). Collapsing them loses the audit trail of what an admin actually
 * did.
 */
export const MODERATION_STATUSES = ['pending', 'approved', 'rejected', 'hidden'] as const;
export type ModerationStatus = (typeof MODERATION_STATUSES)[number];

export const MEDIA_KINDS = ['image', 'video'] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

export const TASK_STATUSES = ['todo', 'doing', 'done', 'blocked'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

/** `visibility` is what keeps a vendor's task off the attendee-facing action item list. */
export const TASK_VISIBILITIES = ['private', 'crew', 'public'] as const;
export type TaskVisibility = (typeof TASK_VISIBILITIES)[number];

export const TASK_PRIORITIES = ['low', 'normal', 'high'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

/**
 * D24 — seating and accommodation are the same shape, so a shuttle is a config entry rather than
 * a feature. Adding a kind here is the whole cost of the next one.
 */
export const UNIT_KINDS = ['table', 'room', 'shuttle'] as const;
export type UnitKind = (typeof UNIT_KINDS)[number];

export const APPROVAL_REQUEST_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type ApprovalRequestStatus = (typeof APPROVAL_REQUEST_STATUSES)[number];

export const RSVP_STATUSES = ['going', 'not_going', 'maybe'] as const;
export type RsvpStatus = (typeof RSVP_STATUSES)[number];

/**
 * Which surfaces a reminder may arrive on. `push` is mocked in Phase 1 — it needs a dev build and
 * credentials — but the column exists now so Phase 2 is additive.
 */
export const NOTIFICATION_CHANNELS = ['in_app', 'local', 'push', 'email'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_CATEGORIES = [
  'schedule',
  'tasks',
  'gossips',
  'announcements',
  'assignments',
] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export const DEVICE_PLATFORMS = ['ios', 'android', 'web'] as const;
export type DevicePlatform = (typeof DEVICE_PLATFORMS)[number];

export const NOTIFICATION_DELIVERY_STATUSES = ['queued', 'sent', 'failed', 'suppressed'] as const;
export type NotificationDeliveryStatus = (typeof NOTIFICATION_DELIVERY_STATUSES)[number];

/* ---------------------------------------------------------------------------------------------
 * Tables
 * ------------------------------------------------------------------------------------------- */

/**
 * `tenants` — one row per event. D2: a new event is a new row, never new code.
 *
 * **`timezone` cannot be retrofitted.** Every `timestamptz` in the schema is an absolute instant;
 * the zone is what turns it into the local wall-clock time a guest reads on the schedule. Rows
 * written before the column exists have no way to recover which zone they were entered in, so
 * backfilling means guessing — and guessing wrong shifts a ceremony by hours.
 */
export type TenantRow = {
  readonly id: TenantId;
  /** D9 — the `/e/[slug]/…` segment. Stable forever; custom domains map onto it. */
  readonly slug: string;
  readonly name: string;
  readonly kind: TenantKind;
  readonly status: TenantStatus;
  readonly timezone: IanaTimeZone;
  readonly visibility: TenantVisibility;
  /** Printed on the invite or a QR code; null once an event stops accepting new guests. */
  readonly join_code: string | null;
  readonly starts_on: DateOnly | null;
  readonly ends_on: DateOnly | null;
  readonly created_by: UserId | null;
  readonly created_at: Timestamptz;
  readonly updated_at: Timestamptz;
};

/**
 * `tenant_configs` — the JSON document that drives look *and* behaviour (D2). One row per tenant,
 * so `tenant_id` is the primary key rather than a foreign key beside a surrogate one.
 *
 * **`draft_config` / `published_config` cannot be retrofitted.** A single `config` column forces
 * every keystroke in the theme editor to be live for guests, and splitting it later has no
 * correct migration: the existing value is simultaneously the draft and the published document,
 * so whichever way it is copied, one of the two is wrong for every tenant that had unpublished
 * work in flight.
 *
 * `published_config` is null until the first publish; that null is what "never been live" means,
 * and it is the state the site-review queue (D25) reads.
 *
 * **There is deliberately no row-level `version` column.** Each document carries its own
 * `version` (§2), and the two are genuinely independent: migrating a tenant's draft to a new
 * config schema while its published site stays on the old one is the normal shape of a rollout,
 * and a single column on the row cannot express it. A column duplicating
 * `draft_config->>'version'` could only agree with it by convention, and would be the thing that
 * disagrees. Finding un-migrated rows is an index on the jsonb path, not a second copy.
 */
export type TenantConfigRow = {
  readonly tenant_id: TenantId;
  readonly draft_config: TenantConfig;
  readonly published_config: TenantConfig | null;
  readonly published_at: Timestamptz | null;
  readonly published_by: UserId | null;
  readonly created_at: Timestamptz;
  readonly updated_at: Timestamptz;
};

/**
 * `users` — D15: sign-in is required for the whole event, so every actor has one of these.
 * Gossip posts are the single deliberate exception and never reference it.
 *
 * D28 — Google OAuth only for now, so `email` is always present and is what an invitation is
 * matched on at claim time.
 */
export type UserRow = {
  readonly id: UserId;
  readonly email: string;
  readonly display_name: string;
  readonly avatar_media_id: MediaId | null;
  /** BCP 47 tag. D21 — the catalogue is English only today, the column is not. */
  readonly locale: string | null;
  readonly created_at: Timestamptz;
  readonly updated_at: Timestamptz;
};

/**
 * `memberships` — which people are in which event, and as what (D15).
 *
 * `user_id` is nullable because the row is created by the invitation, before the person has an
 * account: an admin invites `chef@…`, the row lands with `status: 'invited'`, and first sign-in
 * matches on `invited_email` and fills `user_id` in. Requiring a user first would mean an
 * invitation had nowhere to live.
 */
export type MembershipRow = {
  readonly id: MembershipId;
  readonly tenant_id: TenantId;
  readonly user_id: UserId | null;
  readonly invited_email: string | null;
  readonly invited_phone: string | null;
  readonly role: MembershipRole;
  readonly status: MembershipStatus;
  readonly invited_by: UserId | null;
  readonly invited_at: Timestamptz | null;
  readonly accepted_at: Timestamptz | null;
  readonly created_at: Timestamptz;
  readonly updated_at: Timestamptz;
};

/**
 * `approval_requests` — D25's `draft → pending_approval → approved` machine, as data. A super
 * admin reviews a site before it goes live; the row is the audit trail of who decided what and
 * why, which a `status` column on `tenants` alone cannot hold.
 */
export type ApprovalRequestRow = {
  readonly id: ApprovalRequestId;
  readonly tenant_id: TenantId;
  readonly status: ApprovalRequestStatus;
  readonly requested_by: UserId;
  readonly requested_at: Timestamptz;
  readonly reviewed_by: UserId | null;
  readonly reviewed_at: Timestamptz | null;
  /** The reviewer's note. Shown to the requesting admin, so it is written for them. */
  readonly note: string | null;
  readonly created_at: Timestamptz;
};

/**
 * `venues` — D14: there is no in-app map. `lat`/`lng`/`map_url` exist so the directions button
 * can hand off to the OS maps app, which costs no SDK, no API key and no billing account.
 */
export type VenueRow = {
  readonly id: VenueId;
  readonly tenant_id: TenantId;
  readonly name: string;
  readonly address: string | null;
  readonly lat: number | null;
  readonly lng: number | null;
  /** An explicit override — a Plus Code or a venue's own map link beats derived coordinates. */
  readonly map_url: string | null;
  readonly notes: string | null;
  readonly sort_order: number;
  readonly created_at: Timestamptz;
  readonly updated_at: Timestamptz;
};

/**
 * `sessions` — one entry on the schedule (D6/D11).
 *
 * `sort_order` exists alongside `starts_at` because two things at the same minute still have a
 * correct order, and an admin dragging rows in the schedule editor needs somewhere to persist
 * that choice.
 */
export type SessionRow = {
  readonly id: SessionId;
  readonly tenant_id: TenantId;
  readonly title: string;
  readonly description: string | null;
  readonly starts_at: Timestamptz;
  readonly ends_at: Timestamptz | null;
  readonly venue_id: VenueId | null;
  /** Null is a supported design, not a gap: type-only story cards use the neutral ramp. */
  readonly hero_media_id: MediaId | null;
  /** Conference tracks. Null for events whose config has `features.schedule.tracks: false`. */
  readonly track: string | null;
  readonly sort_order: number;
  readonly status: SessionStatus;
  readonly created_at: Timestamptz;
  readonly updated_at: Timestamptz;
};

/**
 * `people` — the hosts, speakers and couple shown on the home screen. Separate from `users`
 * because most of them never sign in: the bride's father appears on the site without an account,
 * and a speaker exists before their invitation is claimed. `user_id` links the two when both are
 * true.
 */
export type PersonRow = {
  readonly id: PersonId;
  readonly tenant_id: TenantId;
  readonly user_id: UserId | null;
  readonly name: string;
  /** Free text, because "Maid of Honour" and "Keynote Speaker" are the same column. */
  readonly role_label: string | null;
  readonly bio: string | null;
  readonly photo_media_id: MediaId | null;
  readonly sort_order: number;
  readonly created_at: Timestamptz;
  readonly updated_at: Timestamptz;
};

/**
 * `session_people` — who appears on which session. A join table with a composite primary key
 * (`session_id`, `person_id`) and no surrogate id, because there is nothing to reference it by.
 *
 * `tenant_id` is denormalised onto it so the row-level security policy can check membership from
 * the row itself rather than joining back to `sessions` on every read.
 */
export type SessionPersonRow = {
  readonly tenant_id: TenantId;
  readonly session_id: SessionId;
  readonly person_id: PersonId;
  /** Overrides `people.role_label` for this session — "Panellist" here, "Speaker" elsewhere. */
  readonly role_label: string | null;
  readonly sort_order: number;
  readonly created_at: Timestamptz;
};

/**
 * `media_assets` — D27: bytes live behind a `StorageAdapter`, and this row is the metadata.
 * `storage_path` is bucket-relative and starts `tenant/{tenant_id}/`, which is what the storage
 * policy matches on.
 *
 * **`blurhash` and `dominant_color` cannot be retrofitted.** They are computed from the original
 * upload at ingest. Adding the columns later means either re-downloading every original to
 * backfill — which for a photo-heavy event is the whole bucket — or shipping placeholders that
 * are permanently absent for existing media. Without them a photo-first app pops grey rectangles
 * on every scroll, and there is no token-driven fallback that looks intentional.
 *
 * `status` is the shared moderation vocabulary: attendee uploads enter the same queue as gossip
 * posts, so the gallery ships without a second moderation screen.
 */
export type MediaAssetRow = {
  readonly id: MediaId;
  readonly tenant_id: TenantId;
  readonly storage_path: string;
  readonly kind: MediaKind;
  readonly mime_type: string;
  readonly width: number | null;
  readonly height: number | null;
  /** A blurhash string — the placeholder rendered before the bytes arrive. */
  readonly blurhash: string | null;
  /** Hex, e.g. `#7C3A5A`. Tints the frame and the scrim so a load reads as intentional. */
  readonly dominant_color: string | null;
  /** D21/accessibility — alt text is a column, not an afterthought. */
  readonly alt: string | null;
  readonly byte_size: number | null;
  readonly uploaded_by: UserId | null;
  readonly status: ModerationStatus;
  readonly created_at: Timestamptz;
  readonly updated_at: Timestamptz;
};

/**
 * `personas` — the mask a poster wears (ADR-0006). `gossip_posts.persona_id` resolves here, and
 * without the table that column points at nothing: the board has to render "Golden Peacock" and
 * an avatar, and neither is derivable from a uuid.
 *
 * A persona is a row rather than a pure function of the id because it accrues state. ADR-0006
 * keeps the gamification seam open by letting points attach to something persistent that nobody,
 * admin included, can map to a person — and a streak is not something an id derivation can hold.
 *
 * **Reset issues a new row, it does not edit this one.** "New mask" sets `retired_at` and inserts
 * a fresh persona, so posts made under the old mask keep their old `persona_id` and stay grouped
 * as they were. Mutating the label in place would silently rewrite the author of every past post.
 *
 * `device_hash` is the same salted value as `gossip_posts.author_device_hash` and carries the same
 * absolute rule: **it is never exposed, to anyone.** It is here because assignment and reset need
 * to find the mask a device is currently wearing, and a device that has not posted yet has no row
 * in `gossip_posts` to find it from. `rows.test.ts` pins the set of tables allowed to hold it.
 *
 * The repository contract for lookup and reset is #33 and #55, not this file.
 */
export type PersonaRow = {
  readonly id: PersonaId;
  readonly tenant_id: TenantId;
  /** The generated name shown on every post — "Golden Peacock". */
  readonly label: string;
  /** Seed for the generated avatar, so the mask renders identically on every device. */
  readonly avatar_key: string;
  readonly device_hash: string;
  /** Set by "new mask". Non-null means this persona is history, and its posts stay as they are. */
  readonly retired_at: Timestamptz | null;
  readonly created_at: Timestamptz;
};

/**
 * `gossip_posts` — D3's anonymous board. **This table stores no `user_id`, and that is a schema
 * guarantee rather than a consequence of being logged out** (D15).
 *
 * **`author_device_hash` cannot be retrofitted.** It is a salted hash of the device, and it is
 * the only handle the system has on a poster. Without it there is no per-device rate limit, no
 * silent block for an abusive device, and no way to let someone delete their own post (D31).
 * Adding it later is worse than late: the salt would differ, so old posts stay unattributable
 * while new ones are not, and any backfill attempt would have to reach for the one identifier
 * this table exists to never hold.
 *
 * **It is never exposed** — not to attendees, not to admins. `mappers.ts` drops it, and
 * `mappers.test.ts` fails if it ever reappears on the domain object.
 */
export type GossipPostRow = {
  readonly id: GossipPostId;
  readonly tenant_id: TenantId;
  readonly body: string;
  readonly media_id: MediaId | null;
  /** D12 — a system-assigned "Golden Peacock", resettable by the poster at any time. */
  readonly persona_id: PersonaId;
  readonly author_device_hash: string;
  readonly status: ModerationStatus;
  readonly moderated_by: UserId | null;
  readonly moderated_at: Timestamptz | null;
  readonly rejection_reason: string | null;
  /** `jsonb` keyed by reaction, e.g. `{ "heart": 12 }`. Denormalised: the board reads it hot. */
  readonly reaction_counts: Readonly<Record<string, number>>;
  /** D31 — sorts the moderation queue, and a threshold auto-hides pending admin review. */
  readonly report_count: number;
  readonly created_at: Timestamptz;
};

/**
 * `tasks` — D13: one engine, two audiences. An attendee's action items and the crew board are
 * the same rows read through different filters, which is why there is no second entity here.
 *
 * `session_id` is what makes a reminder personal: "your speech is in 30 minutes" is this row
 * plus an offset, not a separate personalisation system.
 */
export type TaskRow = {
  readonly id: TaskId;
  readonly tenant_id: TenantId;
  readonly title: string;
  readonly notes: string | null;
  /** Null is "unassigned" on the crew board — a real state, not a missing value. */
  readonly assignee_user_id: UserId | null;
  readonly created_by: UserId;
  readonly session_id: SessionId | null;
  readonly due_at: Timestamptz | null;
  /** Per-task override of the event default in `notifications.defaultReminderMinutes`. */
  readonly remind_before_minutes: number | null;
  readonly status: TaskStatus;
  readonly visibility: TaskVisibility;
  readonly priority: TaskPriority;
  readonly sort_order: number;
  readonly created_at: Timestamptz;
  readonly updated_at: Timestamptz;
};

/**
 * `units` — D24: a table, a room, a bus. Seating and accommodation are the same shape, so the
 * admin screen, the attendee card and the occupancy maths are written once.
 */
export type UnitRow = {
  readonly id: UnitId;
  readonly tenant_id: TenantId;
  readonly kind: UnitKind;
  /** What a guest is told to look for: "Table 6", "Room 214". */
  readonly label: string;
  /** Null means uncapped. Zero would mean "nobody fits", which is a different statement. */
  readonly capacity: number | null;
  readonly venue_id: VenueId | null;
  /** `jsonb` for kind-specific detail — floor, block, bed type — that no other kind shares. */
  readonly meta: JsonObject;
  readonly sort_order: number;
  readonly created_at: Timestamptz;
  readonly updated_at: Timestamptz;
};

/**
 * `assignments` — D24: a guest placed in a unit. One row per placement, so a guest at Table 6
 * and in Room 214 has two rows and the attendee card renders both from one query.
 */
export type AssignmentRow = {
  readonly id: AssignmentId;
  readonly tenant_id: TenantId;
  readonly unit_id: UnitId;
  readonly user_id: UserId;
  /** "Window bed", "wheelchair access" — the reason a placement is not interchangeable. */
  readonly note: string | null;
  readonly assigned_by: UserId;
  readonly created_at: Timestamptz;
};

/**
 * `announcements` — D22: live announcements as an in-app banner plus a notification centre entry.
 * Remote push is Phase 2; `published_at` is null while an admin is still drafting.
 */
export type AnnouncementRow = {
  readonly id: AnnouncementId;
  readonly tenant_id: TenantId;
  readonly title: string;
  readonly body: string;
  readonly published_at: Timestamptz | null;
  readonly pinned: boolean;
  readonly created_by: UserId;
  readonly created_at: Timestamptz;
  readonly updated_at: Timestamptz;
};

/**
 * `rsvps` — D22. Composite primary key (`tenant_id`, `user_id`, `session_id`): a person has one
 * answer per session, and the key says so rather than an application-level uniqueness check.
 *
 * This is also what makes reminders relevant to guests with no assigned task — an RSVP is a
 * stake in a session.
 */
export type RsvpRow = {
  readonly tenant_id: TenantId;
  readonly user_id: UserId;
  readonly session_id: SessionId;
  readonly status: RsvpStatus;
  readonly guest_count: number;
  readonly responded_at: Timestamptz;
};

/**
 * `notification_preferences` — the per-user overrides of the event's defaults. Composite primary
 * key (`tenant_id`, `user_id`): preferences are per event, because being on the crew of one and a
 * guest at another are different appetites for interruption.
 *
 * Quiet hours are stored as local `HH:MM` against the tenant's `timezone`, not as instants —
 * "no pings after 22:00" is a wall-clock statement and must survive a DST change.
 */
export type NotificationPreferenceRow = {
  readonly tenant_id: TenantId;
  readonly user_id: UserId;
  readonly channels: readonly NotificationChannel[];
  readonly muted_categories: readonly NotificationCategory[];
  readonly default_reminder_minutes: number | null;
  readonly quiet_hours_start: string | null;
  readonly quiet_hours_end: string | null;
  readonly created_at: Timestamptz;
  readonly updated_at: Timestamptz;
};

/**
 * `device_tokens` — Phase 2's FCM/APNs registry, added now so remote push is additive rather
 * than a migration. Phase 1 writes nothing to it.
 *
 * Not scoped to a tenant: a device belongs to a person across every event they attend, and
 * duplicating it per tenant would mean revoking a stale token in several places.
 */
export type DeviceTokenRow = {
  readonly id: DeviceTokenId;
  readonly user_id: UserId;
  readonly platform: DevicePlatform;
  readonly token: string;
  readonly last_seen_at: Timestamptz;
  /** Set when the provider reports the token dead; the row is kept as an audit trail. */
  readonly revoked_at: Timestamptz | null;
  readonly created_at: Timestamptz;
};

/**
 * `notification_deliveries` — what was actually sent, and why it was not.
 *
 * Two jobs, both needed on the first day push exists: `dedupe_key` makes delivery idempotent, so
 * a retried outbox job (D26) cannot notify someone twice; and a `suppressed` row with a reason
 * is the only way to answer "why did I not get my reminder?" without guessing.
 */
export type NotificationDeliveryRow = {
  readonly id: NotificationDeliveryId;
  readonly tenant_id: TenantId;
  readonly user_id: UserId;
  readonly category: NotificationCategory;
  readonly channel: NotificationChannel;
  /** Unique per (user, channel): the idempotency key the outbox job retries against. */
  readonly dedupe_key: string;
  readonly session_id: SessionId | null;
  readonly task_id: TaskId | null;
  readonly announcement_id: AnnouncementId | null;
  readonly status: NotificationDeliveryStatus;
  /** Populated for `failed` and `suppressed` — "quiet hours", "token revoked". */
  readonly failure_reason: string | null;
  readonly scheduled_for: Timestamptz;
  readonly sent_at: Timestamptz | null;
  readonly created_at: Timestamptz;
};
