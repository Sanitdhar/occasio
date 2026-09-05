import type {
  AnnouncementId,
  AssignmentId,
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
import type {
  ApprovalRequestId,
  ApprovalRequestStatus,
  DateOnly,
  DevicePlatform,
  DeviceTokenId,
  IanaTimeZone,
  JsonObject,
  MediaKind,
  MembershipRole,
  MembershipStatus,
  ModerationStatus,
  NotificationCategory,
  NotificationChannel,
  NotificationDeliveryId,
  NotificationDeliveryStatus,
  RsvpStatus,
  SessionStatus,
  TaskPriority,
  TaskStatus,
  TaskVisibility,
  TenantKind,
  TenantStatus,
  TenantVisibility,
  Timestamptz,
  UnitKind,
} from './rows';

/**
 * Domain objects — the camelCase side of the boundary that `rows.ts` describes in `snake_case`.
 *
 * These are what every hook, screen and test above the data layer sees, and they are not a
 * mechanical rename of the rows. Where a table has to spell a fact across several independently
 * nullable columns, the domain object collapses it into a shape that cannot contradict itself:
 *
 *  - `Venue.coords` is both coordinates or neither, because half a coordinate pair is not a
 *    location, and two independently nullable columns can say exactly that.
 *  - `TenantConfigRecord.published` carries the config, the timestamp and the publisher together,
 *    so "published but nobody published it" is unrepresentable rather than merely unlikely.
 *  - `GossipPost` has no device hash at all. See below.
 *
 * Timestamps stay ISO 8601 strings rather than becoming `Date`. D20 persists the TanStack Query
 * cache through JSON, and a `Date` does not survive that round trip — it comes back as a string
 * while the type still claims otherwise, which is exactly the silent-corruption class this repo's
 * strictness exists to prevent. Parsing happens where a date is used, not where it is stored.
 */

/** An event. */
export type Tenant = {
  readonly id: TenantId;
  readonly slug: string;
  readonly name: string;
  readonly kind: TenantKind;
  readonly status: TenantStatus;
  readonly timezone: IanaTimeZone;
  readonly visibility: TenantVisibility;
  readonly joinCode: string | null;
  readonly startsOn: DateOnly | null;
  readonly endsOn: DateOnly | null;
  readonly createdBy: UserId | null;
  readonly createdAt: Timestamptz;
  readonly updatedAt: Timestamptz;
};

/**
 * The draft/published pair, modelled as one nullable object instead of three columns that can
 * disagree. `published === null` is the whole meaning of "this event has never been live", which
 * is the state the super-admin review queue filters on.
 */
export type TenantConfigRecord = {
  readonly tenantId: TenantId;
  readonly version: number;
  readonly draft: TenantConfig;
  readonly published: {
    readonly config: TenantConfig;
    readonly at: Timestamptz;
    readonly by: UserId | null;
  } | null;
  readonly createdAt: Timestamptz;
  readonly updatedAt: Timestamptz;
};

export type User = {
  readonly id: UserId;
  readonly email: string;
  readonly displayName: string;
  readonly avatarMediaId: MediaId | null;
  readonly locale: string | null;
  readonly createdAt: Timestamptz;
  readonly updatedAt: Timestamptz;
};

export type Membership = {
  readonly id: MembershipId;
  readonly tenantId: TenantId;
  readonly userId: UserId | null;
  readonly invitedEmail: string | null;
  readonly invitedPhone: string | null;
  readonly role: MembershipRole;
  readonly status: MembershipStatus;
  readonly invitedBy: UserId | null;
  readonly invitedAt: Timestamptz | null;
  readonly acceptedAt: Timestamptz | null;
  readonly createdAt: Timestamptz;
  readonly updatedAt: Timestamptz;
};

export type ApprovalRequest = {
  readonly id: ApprovalRequestId;
  readonly tenantId: TenantId;
  readonly status: ApprovalRequestStatus;
  readonly requestedBy: UserId;
  readonly requestedAt: Timestamptz;
  readonly reviewedBy: UserId | null;
  readonly reviewedAt: Timestamptz | null;
  readonly note: string | null;
};

/** Latitude and longitude together, or not at all. */
export type Coordinates = { readonly lat: number; readonly lng: number };

export type Venue = {
  readonly id: VenueId;
  readonly tenantId: TenantId;
  readonly name: string;
  readonly address: string | null;
  readonly coords: Coordinates | null;
  readonly mapUrl: string | null;
  readonly notes: string | null;
  readonly sortOrder: number;
};

export type Session = {
  readonly id: SessionId;
  readonly tenantId: TenantId;
  readonly title: string;
  readonly description: string | null;
  readonly startsAt: Timestamptz;
  readonly endsAt: Timestamptz | null;
  readonly venueId: VenueId | null;
  readonly heroMediaId: MediaId | null;
  readonly track: string | null;
  readonly sortOrder: number;
  readonly status: SessionStatus;
};

export type Person = {
  readonly id: PersonId;
  readonly tenantId: TenantId;
  readonly userId: UserId | null;
  readonly name: string;
  readonly roleLabel: string | null;
  readonly bio: string | null;
  readonly photoMediaId: MediaId | null;
  readonly sortOrder: number;
};

/** A person's appearance on one session — the join row, as the schedule screen needs it. */
export type SessionPerson = {
  readonly tenantId: TenantId;
  readonly sessionId: SessionId;
  readonly personId: PersonId;
  readonly roleLabel: string | null;
  readonly sortOrder: number;
};

export type Dimensions = { readonly width: number; readonly height: number };

/**
 * `blurhash` and `dominantColor` survive into the domain object because every image component
 * needs them at render time — they are what makes a loading photo look intentional rather than
 * like a grey hole. Dropping them here would make the un-retrofittable columns useless.
 */
export type MediaAsset = {
  readonly id: MediaId;
  readonly tenantId: TenantId;
  readonly storagePath: string;
  readonly kind: MediaKind;
  readonly mimeType: string;
  readonly dimensions: Dimensions | null;
  readonly blurhash: string | null;
  readonly dominantColor: string | null;
  readonly alt: string | null;
  readonly byteSize: number | null;
  readonly uploadedBy: UserId | null;
  readonly status: ModerationStatus;
  readonly createdAt: Timestamptz;
};

/**
 * A gossip post as anyone above the data layer may ever see it.
 *
 * **`authorDeviceHash` is absent, and its absence is the feature.** The hash exists on the row so
 * the server can rate-limit and block a device (D31); it must never reach a screen, a query cache
 * or an admin's moderation queue, because a value that identifies a device is only anonymous for
 * as long as nothing renders it. Keeping it off this type means a component cannot leak it even
 * by accident — there is nothing to spell.
 *
 * `mappers.test.ts` asserts this, so restoring the field breaks a test rather than a promise.
 */
export type GossipPost = {
  readonly id: GossipPostId;
  readonly tenantId: TenantId;
  readonly body: string;
  readonly mediaId: MediaId | null;
  readonly personaId: PersonaId;
  readonly status: ModerationStatus;
  readonly moderatedBy: UserId | null;
  readonly moderatedAt: Timestamptz | null;
  readonly rejectionReason: string | null;
  readonly reactionCounts: Readonly<Record<string, number>>;
  readonly reportCount: number;
  readonly createdAt: Timestamptz;
};

export type Task = {
  readonly id: TaskId;
  readonly tenantId: TenantId;
  readonly title: string;
  readonly notes: string | null;
  readonly assigneeUserId: UserId | null;
  readonly createdBy: UserId;
  readonly sessionId: SessionId | null;
  readonly dueAt: Timestamptz | null;
  readonly remindBeforeMinutes: number | null;
  readonly status: TaskStatus;
  readonly visibility: TaskVisibility;
  readonly priority: TaskPriority;
  readonly sortOrder: number;
  readonly createdAt: Timestamptz;
  readonly updatedAt: Timestamptz;
};

export type Unit = {
  readonly id: UnitId;
  readonly tenantId: TenantId;
  readonly kind: UnitKind;
  readonly label: string;
  readonly capacity: number | null;
  readonly venueId: VenueId | null;
  readonly meta: JsonObject;
  readonly sortOrder: number;
};

export type Assignment = {
  readonly id: AssignmentId;
  readonly tenantId: TenantId;
  readonly unitId: UnitId;
  readonly userId: UserId;
  readonly note: string | null;
  readonly assignedBy: UserId;
  readonly createdAt: Timestamptz;
};

export type Announcement = {
  readonly id: AnnouncementId;
  readonly tenantId: TenantId;
  readonly title: string;
  readonly body: string;
  readonly publishedAt: Timestamptz | null;
  readonly pinned: boolean;
  readonly createdBy: UserId;
  readonly createdAt: Timestamptz;
  readonly updatedAt: Timestamptz;
};

export type Rsvp = {
  readonly tenantId: TenantId;
  readonly userId: UserId;
  readonly sessionId: SessionId;
  readonly status: RsvpStatus;
  readonly guestCount: number;
  readonly respondedAt: Timestamptz;
};

/** Quiet hours as local wall-clock `HH:MM`, both ends or neither. */
export type QuietHours = { readonly start: string; readonly end: string };

export type NotificationPreferences = {
  readonly tenantId: TenantId;
  readonly userId: UserId;
  readonly channels: readonly NotificationChannel[];
  readonly mutedCategories: readonly NotificationCategory[];
  readonly defaultReminderMinutes: number | null;
  readonly quietHours: QuietHours | null;
};

export type DeviceToken = {
  readonly id: DeviceTokenId;
  readonly userId: UserId;
  readonly platform: DevicePlatform;
  readonly token: string;
  readonly lastSeenAt: Timestamptz;
  readonly revokedAt: Timestamptz | null;
};

export type NotificationDelivery = {
  readonly id: NotificationDeliveryId;
  readonly tenantId: TenantId;
  readonly userId: UserId;
  readonly category: NotificationCategory;
  readonly channel: NotificationChannel;
  readonly dedupeKey: string;
  readonly sessionId: SessionId | null;
  readonly taskId: TaskId | null;
  readonly announcementId: AnnouncementId | null;
  readonly status: NotificationDeliveryStatus;
  readonly failureReason: string | null;
  readonly scheduledFor: Timestamptz;
  readonly sentAt: Timestamptz | null;
};
