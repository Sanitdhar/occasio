import {
  announcementId,
  assignmentId,
  gossipPostId,
  membershipId,
  mediaId,
  personaId,
  personId,
  sessionId,
  taskId,
  tenantId,
  unitId,
  userId,
  type MediaId,
  type PersonId,
  type SessionId,
  type TenantId,
  type UnitId,
  type UserId,
  type VenueId,
} from '@occasio/core';
import { venueId } from '@occasio/core';
import { approvalRequestId } from '../mock/mappers';
import type {
  AnnouncementRow,
  ApprovalRequestId,
  AssignmentRow,
  GossipPostRow,
  MediaAssetRow,
  MembershipRole,
  MembershipRow,
  MembershipStatus,
  ModerationStatus,
  PersonaRow,
  PersonRow,
  SessionPersonRow,
  SessionRow,
  TaskRow,
  TaskStatus,
  Timestamptz,
  UnitKind,
  UnitRow,
  UserRow,
  VenueRow,
} from '../rows';

/**
 * The scaffolding the four fixture events are written on.
 *
 * Fixtures are read far more often than they are written -- every screenshot, every demo and
 * every "why does this look wrong" starts here -- so the goal is that an event reads as an
 * event rather than as two hundred object literals. Each builder supplies the columns nobody
 * makes a decision about (timestamps, sort order, moderation defaults) and leaves the ones that
 * carry meaning to the caller.
 *
 * Everything is deterministic. No `Date.now()`, no random ids: the visual gate diffs
 * screenshots, and a fixture that moved with the clock would fail it every midnight for reasons
 * nobody would attribute to the fixture.
 */

/** A fixed instant the fixtures are written relative to, so "two days before" is a real date. */
export const FIXTURE_NOW = '2026-07-01T09:00:00.000Z';

/** Ids are readable on purpose: a failing screenshot names `s_wed_ceremony`, not `s_00417`. */
export const ids = {
  tenant: (slug: string): TenantId => tenantId(`t_${slug}`),
  user: (name: string): UserId => userId(`u_${name}`),
  venue: (name: string): VenueId => venueId(`v_${name}`),
  session: (name: string): SessionId => sessionId(`s_${name}`),
  person: (name: string): PersonId => personId(`p_${name}`),
  media: (name: string): MediaId => mediaId(`m_${name}`),
  unit: (name: string): UnitId => unitId(`un_${name}`),
  approvalRequest: (name: string): ApprovalRequestId => approvalRequestId(`ap_${name}`),
} as const;

/**
 * An instant, expressed as an offset from the event's own day.
 *
 * Written this way because a schedule is read as "the ceremony is at four", not as an ISO
 * string — and because an event that starts at 09:00 local is a different instant in Kolkata
 * and in Lisbon, which is exactly the mistake a hardcoded `Z` timestamp hides.
 */
export const at = (day: string, hour: number, minute = 0, offsetHours = 0): Timestamptz => {
  /*
   * Arithmetic in milliseconds, not string surgery on the hour field.
   *
   * The first version subtracted the offset from the hour and formatted the result, which is
   * fine until the offset is not a whole number: India is +5:30, so 16:00 became
   * `T10.5:00:00.000Z` — a string that looks like a timestamp, parses as `Invalid Date`, and
   * had made every wedding and festival time in this fixture set invalid. Milliseconds carry
   * the half hour without anyone having to remember it exists.
   */
  const localMs = Date.parse(`${day}T00:00:00.000Z`) + (hour * 60 + minute) * 60_000;
  return new Date(localMs - offsetHours * 3_600_000).toISOString();
};

export const user = (name: string, displayName: string, over: Partial<UserRow> = {}): UserRow => ({
  id: ids.user(name),
  email: `${name}@example.test`,
  display_name: displayName,
  avatar_media_id: null,
  locale: null,
  created_at: FIXTURE_NOW,
  updated_at: FIXTURE_NOW,
  ...over,
});

export const membership = (
  tenant: TenantId,
  /**
   * The row's own name, not the member's.
   *
   * Deriving the id from `user_id` collided the moment a tenant had both an active membership
   * for someone and an unaccepted invitation from them, because an invitation's `user_id` is
   * null and both rows landed on the same id. An id that depends on another column changes
   * meaning when that column does.
   */
  key: string,
  who: UserId | null,
  role: MembershipRole,
  status: MembershipStatus = 'active',
  over: Partial<MembershipRow> = {},
): MembershipRow => ({
  id: membershipId(`mb_${key}`),
  tenant_id: tenant,
  user_id: who,
  invited_email: null,
  invited_phone: null,
  role,
  status,
  invited_by: null,
  invited_at: null,
  accepted_at: status === 'active' ? FIXTURE_NOW : null,
  created_at: FIXTURE_NOW,
  updated_at: FIXTURE_NOW,
  ...over,
});

export const venue = (
  tenant: TenantId,
  name: string,
  label: string,
  over: Partial<VenueRow> = {},
): VenueRow => ({
  id: ids.venue(name),
  tenant_id: tenant,
  name: label,
  address: null,
  lat: null,
  lng: null,
  map_url: null,
  notes: null,
  sort_order: 0,
  created_at: FIXTURE_NOW,
  updated_at: FIXTURE_NOW,
  ...over,
});

export const session = (
  tenant: TenantId,
  name: string,
  title: string,
  startsAt: Timestamptz,
  over: Partial<SessionRow> = {},
): SessionRow => ({
  id: ids.session(name),
  tenant_id: tenant,
  title,
  description: null,
  starts_at: startsAt,
  ends_at: null,
  venue_id: null,
  hero_media_id: null,
  track: null,
  sort_order: 0,
  status: 'published',
  created_at: FIXTURE_NOW,
  updated_at: FIXTURE_NOW,
  ...over,
});

export const person = (
  tenant: TenantId,
  name: string,
  label: string,
  over: Partial<PersonRow> = {},
): PersonRow => ({
  id: ids.person(name),
  tenant_id: tenant,
  user_id: null,
  name: label,
  role_label: null,
  bio: null,
  photo_media_id: null,
  sort_order: 0,
  created_at: FIXTURE_NOW,
  updated_at: FIXTURE_NOW,
  ...over,
});

export const sessionPerson = (
  tenant: TenantId,
  s: SessionId,
  p: PersonId,
  over: Partial<SessionPersonRow> = {},
): SessionPersonRow => ({
  tenant_id: tenant,
  session_id: s,
  person_id: p,
  role_label: null,
  sort_order: 0,
  created_at: FIXTURE_NOW,
  ...over,
});

/**
 * An image, with a blurhash.
 *
 * Never null here, and that is deliberate rather than thorough: the `Image` component treats a
 * missing blurhash as the third-party-avatar case and falls back to a tonal fill, so a fixture
 * set without them would screenshot the fallback everywhere and quietly stop testing the real
 * path.
 */
export const image = (
  tenant: TenantId,
  name: string,
  alt: string,
  blurhash: string,
  /** The colour a frame paints before the blurhash decodes, and behind an image that fails. */
  dominantColor: string,
  over: Partial<MediaAssetRow> = {},
): MediaAssetRow => ({
  id: ids.media(name),
  tenant_id: tenant,
  storage_path: `fixtures/${name}.jpg`,
  kind: 'image',
  mime_type: 'image/jpeg',
  width: 1600,
  height: 1067,
  blurhash,
  dominant_color: dominantColor,
  alt,
  byte_size: 384_000,
  uploaded_by: null,
  status: 'approved',
  created_at: FIXTURE_NOW,
  updated_at: FIXTURE_NOW,
  ...over,
});

export const persona = (
  tenant: TenantId,
  name: string,
  label: string,
  deviceHash: string,
): PersonaRow => ({
  id: personaId(`pa_${name}`),
  tenant_id: tenant,
  label,
  avatar_key: `avatar-${name}`,
  device_hash: deviceHash,
  retired_at: null,
  created_at: FIXTURE_NOW,
});

export const gossip = (
  tenant: TenantId,
  name: string,
  body: string,
  authorPersona: PersonaRow,
  status: ModerationStatus,
  over: Partial<GossipPostRow> = {},
): GossipPostRow => ({
  id: gossipPostId(`g_${name}`),
  tenant_id: tenant,
  body,
  media_id: null,
  persona_id: authorPersona.id,
  author_device_hash: authorPersona.device_hash,
  status,
  moderated_by: null,
  moderated_at: status === 'pending' ? null : FIXTURE_NOW,
  rejection_reason: null,
  reaction_counts: {},
  report_count: 0,
  created_at: FIXTURE_NOW,
  ...over,
});

export const task = (
  tenant: TenantId,
  name: string,
  title: string,
  createdBy: UserId,
  status: TaskStatus,
  over: Partial<TaskRow> = {},
): TaskRow => ({
  id: taskId(`tk_${name}`),
  tenant_id: tenant,
  title,
  notes: null,
  assignee_user_id: null,
  created_by: createdBy,
  session_id: null,
  due_at: null,
  remind_before_minutes: null,
  status,
  visibility: 'crew',
  priority: 'normal',
  sort_order: 0,
  created_at: FIXTURE_NOW,
  updated_at: FIXTURE_NOW,
  ...over,
});

export const unit = (
  tenant: TenantId,
  name: string,
  kind: UnitKind,
  label: string,
  over: Partial<UnitRow> = {},
): UnitRow => ({
  id: ids.unit(name),
  tenant_id: tenant,
  kind,
  label,
  capacity: null,
  venue_id: null,
  meta: {},
  sort_order: 0,
  created_at: FIXTURE_NOW,
  updated_at: FIXTURE_NOW,
  ...over,
});

export const assignment = (
  tenant: TenantId,
  name: string,
  u: UnitId,
  who: UserId,
  assignedBy: UserId,
  over: Partial<AssignmentRow> = {},
): AssignmentRow => ({
  id: assignmentId(`as_${name}`),
  tenant_id: tenant,
  unit_id: u,
  user_id: who,
  note: null,
  assigned_by: assignedBy,
  created_at: FIXTURE_NOW,
  ...over,
});

export const announcement = (
  tenant: TenantId,
  name: string,
  title: string,
  body: string,
  createdBy: UserId,
  over: Partial<AnnouncementRow> = {},
): AnnouncementRow => ({
  id: announcementId(`an_${name}`),
  tenant_id: tenant,
  title,
  body,
  published_at: FIXTURE_NOW,
  pinned: false,
  created_by: createdBy,
  created_at: FIXTURE_NOW,
  updated_at: FIXTURE_NOW,
  ...over,
});
