import type {
  Announcement,
  ApprovalRequest,
  Assignment,
  DeviceToken,
  GossipPost,
  MediaAsset,
  Membership,
  NotificationDelivery,
  NotificationPreferences,
  Person,
  Rsvp,
  Session,
  SessionPerson,
  Task,
  Tenant,
  TenantConfigRecord,
  Unit,
  User,
  Venue,
} from './domain';
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
  RsvpRow,
  SessionPersonRow,
  SessionRow,
  TaskRow,
  TenantConfigRow,
  TenantRow,
  UnitRow,
  UserRow,
  VenueRow,
} from './rows';

/**
 * The one place `snake_case` rows meet camelCase domain objects.
 *
 * Every adapter — the mock today, Supabase later — returns rows and hands them straight here, so
 * a column rename touches this file and nothing else. That is the whole reason the boundary is
 * a single module rather than a convention: renaming `starts_at` in a schema that has leaked
 * into forty components is not a refactor, it is a rewrite.
 *
 * This is also one of only two files where a type assertion is allowed (`ids.ts` is the other),
 * because it is the seam where untyped database output becomes branded, checked data. There are
 * no casts in it today: rows arrive already typed, so every mapper below is total and checked by
 * the compiler. The exemption stays for the Supabase adapter, whose driver hands back
 * `Record<string, unknown>` and has to brand it exactly once, here.
 *
 * Mappers are pure and synchronous. Nothing here fetches, logs or throws — a mapper that can
 * fail is a parser, and a parser belongs in the adapter that owns the untrusted input.
 */

export const toTenant = (row: TenantRow): Tenant => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  kind: row.kind,
  status: row.status,
  timezone: row.timezone,
  visibility: row.visibility,
  joinCode: row.join_code,
  startsOn: row.starts_on,
  endsOn: row.ends_on,
  createdBy: row.created_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/**
 * Collapses `published_config` / `published_at` / `published_by` into one nullable object.
 *
 * A row is only treated as published when both the document and the timestamp are present.
 * Either alone is a half-written publish, and reading it as live would put a config on the
 * public site that nobody can say was ever published — `published_by` stays nullable because a
 * migration or a super-admin action legitimately has no user behind it.
 */
export const toTenantConfigRecord = (row: TenantConfigRow): TenantConfigRecord => ({
  tenantId: row.tenant_id,
  version: row.version,
  draft: row.draft_config,
  published:
    row.published_config !== null && row.published_at !== null
      ? { config: row.published_config, at: row.published_at, by: row.published_by }
      : null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const toUser = (row: UserRow): User => ({
  id: row.id,
  email: row.email,
  displayName: row.display_name,
  avatarMediaId: row.avatar_media_id,
  locale: row.locale,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const toMembership = (row: MembershipRow): Membership => ({
  id: row.id,
  tenantId: row.tenant_id,
  userId: row.user_id,
  invitedEmail: row.invited_email,
  invitedPhone: row.invited_phone,
  role: row.role,
  status: row.status,
  invitedBy: row.invited_by,
  invitedAt: row.invited_at,
  acceptedAt: row.accepted_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const toApprovalRequest = (row: ApprovalRequestRow): ApprovalRequest => ({
  id: row.id,
  tenantId: row.tenant_id,
  status: row.status,
  requestedBy: row.requested_by,
  requestedAt: row.requested_at,
  reviewedBy: row.reviewed_by,
  reviewedAt: row.reviewed_at,
  note: row.note,
});

/** Half a coordinate pair is not a location, so one null null-s the pair. */
export const toVenue = (row: VenueRow): Venue => ({
  id: row.id,
  tenantId: row.tenant_id,
  name: row.name,
  address: row.address,
  coords: row.lat !== null && row.lng !== null ? { lat: row.lat, lng: row.lng } : null,
  mapUrl: row.map_url,
  notes: row.notes,
  sortOrder: row.sort_order,
});

export const toSession = (row: SessionRow): Session => ({
  id: row.id,
  tenantId: row.tenant_id,
  title: row.title,
  description: row.description,
  startsAt: row.starts_at,
  endsAt: row.ends_at,
  venueId: row.venue_id,
  heroMediaId: row.hero_media_id,
  track: row.track,
  sortOrder: row.sort_order,
  status: row.status,
});

export const toPerson = (row: PersonRow): Person => ({
  id: row.id,
  tenantId: row.tenant_id,
  userId: row.user_id,
  name: row.name,
  roleLabel: row.role_label,
  bio: row.bio,
  photoMediaId: row.photo_media_id,
  sortOrder: row.sort_order,
});

export const toSessionPerson = (row: SessionPersonRow): SessionPerson => ({
  tenantId: row.tenant_id,
  sessionId: row.session_id,
  personId: row.person_id,
  roleLabel: row.role_label,
  sortOrder: row.sort_order,
});

/** Dimensions pair the same way coordinates do: an aspect ratio needs both numbers. */
export const toMediaAsset = (row: MediaAssetRow): MediaAsset => ({
  id: row.id,
  tenantId: row.tenant_id,
  storagePath: row.storage_path,
  kind: row.kind,
  mimeType: row.mime_type,
  dimensions:
    row.width !== null && row.height !== null ? { width: row.width, height: row.height } : null,
  blurhash: row.blurhash,
  dominantColor: row.dominant_color,
  alt: row.alt,
  byteSize: row.byte_size,
  uploadedBy: row.uploaded_by,
  status: row.status,
  createdAt: row.created_at,
});

/**
 * **Drops `author_device_hash` and never restores it.** D31 needs the hash server-side to rate
 * limit and block a device; D12 promises that nobody — attendee or admin — can tell who posted.
 * Both hold only if the value stops here. This mapper is the enforcement point, and
 * `mappers.test.ts` fails if the field ever reappears on the returned object.
 */
export const toGossipPost = (row: GossipPostRow): GossipPost => ({
  id: row.id,
  tenantId: row.tenant_id,
  body: row.body,
  mediaId: row.media_id,
  personaId: row.persona_id,
  status: row.status,
  moderatedBy: row.moderated_by,
  moderatedAt: row.moderated_at,
  rejectionReason: row.rejection_reason,
  reactionCounts: row.reaction_counts,
  reportCount: row.report_count,
  createdAt: row.created_at,
});

export const toTask = (row: TaskRow): Task => ({
  id: row.id,
  tenantId: row.tenant_id,
  title: row.title,
  notes: row.notes,
  assigneeUserId: row.assignee_user_id,
  createdBy: row.created_by,
  sessionId: row.session_id,
  dueAt: row.due_at,
  remindBeforeMinutes: row.remind_before_minutes,
  status: row.status,
  visibility: row.visibility,
  priority: row.priority,
  sortOrder: row.sort_order,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const toUnit = (row: UnitRow): Unit => ({
  id: row.id,
  tenantId: row.tenant_id,
  kind: row.kind,
  label: row.label,
  capacity: row.capacity,
  venueId: row.venue_id,
  meta: row.meta,
  sortOrder: row.sort_order,
});

export const toAssignment = (row: AssignmentRow): Assignment => ({
  id: row.id,
  tenantId: row.tenant_id,
  unitId: row.unit_id,
  userId: row.user_id,
  note: row.note,
  assignedBy: row.assigned_by,
  createdAt: row.created_at,
});

export const toAnnouncement = (row: AnnouncementRow): Announcement => ({
  id: row.id,
  tenantId: row.tenant_id,
  title: row.title,
  body: row.body,
  publishedAt: row.published_at,
  pinned: row.pinned,
  createdBy: row.created_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const toRsvp = (row: RsvpRow): Rsvp => ({
  tenantId: row.tenant_id,
  userId: row.user_id,
  sessionId: row.session_id,
  status: row.status,
  guestCount: row.guest_count,
  respondedAt: row.responded_at,
});

/** Quiet hours are a window: one end without the other cannot be evaluated, so it is no window. */
export const toNotificationPreferences = (
  row: NotificationPreferenceRow,
): NotificationPreferences => ({
  tenantId: row.tenant_id,
  userId: row.user_id,
  channels: row.channels,
  mutedCategories: row.muted_categories,
  defaultReminderMinutes: row.default_reminder_minutes,
  quietHours:
    row.quiet_hours_start !== null && row.quiet_hours_end !== null
      ? { start: row.quiet_hours_start, end: row.quiet_hours_end }
      : null,
});

export const toDeviceToken = (row: DeviceTokenRow): DeviceToken => ({
  id: row.id,
  userId: row.user_id,
  platform: row.platform,
  token: row.token,
  lastSeenAt: row.last_seen_at,
  revokedAt: row.revoked_at,
});

export const toNotificationDelivery = (row: NotificationDeliveryRow): NotificationDelivery => ({
  id: row.id,
  tenantId: row.tenant_id,
  userId: row.user_id,
  category: row.category,
  channel: row.channel,
  dedupeKey: row.dedupe_key,
  sessionId: row.session_id,
  taskId: row.task_id,
  announcementId: row.announcement_id,
  status: row.status,
  failureReason: row.failure_reason,
  scheduledFor: row.scheduled_for,
  sentAt: row.sent_at,
});
