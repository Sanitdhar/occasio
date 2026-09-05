import { describe, expect, it } from '@jest/globals';
import {
  announcementId,
  assignmentId,
  gossipPostId,
  mediaId,
  membershipId,
  personId,
  personaId,
  sessionId,
  taskId,
  tenantId,
  unitId,
  userId,
  venueId,
} from '@occasio/core';
import { themeInputFromPreset } from '@occasio/theme';
import type { TenantConfig } from './config';
import {
  toAnnouncement,
  toAssignment,
  toGossipPost,
  toMediaAsset,
  toMembership,
  toNotificationPreferences,
  toPerson,
  toRsvp,
  toSession,
  toSessionPerson,
  toTask,
  toTenant,
  toTenantConfigRecord,
  toUnit,
  toUser,
  toVenue,
} from './mappers';
import type {
  AnnouncementRow,
  AssignmentRow,
  GossipPostRow,
  MediaAssetRow,
  MembershipRow,
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
 * Every sample below gives each column a *distinct* value, deliberately. A mapper that reads
 * `created_at` where it meant `updated_at` is the most likely mistake in a file of forty renames,
 * and it is invisible to a test whose fixture uses the same timestamp twice.
 *
 * Three mappers have no sample here — `toApprovalRequest`, `toDeviceToken` and
 * `toNotificationDelivery`. Their branded ids have no constructor in `@occasio/core` yet, and
 * casting one into existence is a lint error everywhere but this package's `mappers.ts`. They are
 * covered structurally by `rows.test.ts` instead. See the PR: those three ids want moving into
 * core, which would let these tests be written the same way as the rest.
 */

const T = tenantId('santi-riyanks');
const ADMIN = userId('u_admin');

describe('toTenant', () => {
  const row: TenantRow = {
    id: T,
    slug: 'santi-riyanks',
    name: 'Santi & Riyank',
    kind: 'wedding',
    status: 'approved',
    timezone: 'Asia/Kolkata',
    visibility: 'unlisted',
    join_code: 'PEACOCK',
    starts_on: '2026-02-14',
    ends_on: '2026-02-16',
    created_by: ADMIN,
    created_at: '2025-11-01T09:00:00Z',
    updated_at: '2025-12-02T10:30:00Z',
  };

  it('renames every column and keeps the timezone that cannot be recovered later', () => {
    expect(toTenant(row)).toEqual({
      id: T,
      slug: 'santi-riyanks',
      name: 'Santi & Riyank',
      kind: 'wedding',
      status: 'approved',
      timezone: 'Asia/Kolkata',
      visibility: 'unlisted',
      joinCode: 'PEACOCK',
      startsOn: '2026-02-14',
      endsOn: '2026-02-16',
      createdBy: ADMIN,
      createdAt: '2025-11-01T09:00:00Z',
      updatedAt: '2025-12-02T10:30:00Z',
    });
  });
});

describe('toTenantConfigRecord', () => {
  const draft: TenantConfig = {
    version: 1,
    theme: themeInputFromPreset('romantic', '#7C3A5A'),
    features: {
      schedule: { enabled: true, defaultView: 'stories', tracks: false },
      gossips: { enabled: true, requireApproval: true, allowMedia: true },
      media: { enabled: true },
      info: { enabled: true },
      game: { enabled: false },
    },
    nav: { tabs: ['schedule', 'gossips', 'media', 'info'] },
    copy: { 'gossips.title': 'Whispers' },
  };
  const published: TenantConfig = { ...draft, copy: {} };

  const row: TenantConfigRow = {
    tenant_id: T,
    version: 1,
    draft_config: draft,
    published_config: published,
    published_at: '2025-12-01T08:00:00Z',
    published_by: ADMIN,
    created_at: '2025-11-01T09:00:00Z',
    updated_at: '2025-12-02T10:30:00Z',
  };

  it('collapses the published triple into one object', () => {
    expect(toTenantConfigRecord(row)).toEqual({
      tenantId: T,
      version: 1,
      draft,
      published: { config: published, at: '2025-12-01T08:00:00Z', by: ADMIN },
      createdAt: '2025-11-01T09:00:00Z',
      updatedAt: '2025-12-02T10:30:00Z',
    });
  });

  it('reports never-published when the config is absent', () => {
    const neverPublished: TenantConfigRow = {
      ...row,
      published_config: null,
      published_at: null,
      published_by: null,
    };
    expect(toTenantConfigRecord(neverPublished).published).toBeNull();
  });

  it('refuses a half-written publish rather than putting it live', () => {
    const noTimestamp: TenantConfigRow = { ...row, published_at: null };
    expect(toTenantConfigRecord(noTimestamp).published).toBeNull();
  });

  it('still publishes when nobody is recorded as the publisher', () => {
    const systemPublished: TenantConfigRow = { ...row, published_by: null };
    expect(toTenantConfigRecord(systemPublished).published).toEqual({
      config: published,
      at: '2025-12-01T08:00:00Z',
      by: null,
    });
  });

  it('keeps draft and published as separate documents', () => {
    const record = toTenantConfigRecord(row);
    expect(record.draft.copy).toEqual({ 'gossips.title': 'Whispers' });
    expect(record.published?.config.copy).toEqual({});
  });
});

describe('toUser', () => {
  const row: UserRow = {
    id: ADMIN,
    email: 'admin@example.com',
    display_name: 'Riyank',
    avatar_media_id: mediaId('m_avatar'),
    locale: 'en-GB',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-02-02T00:00:00Z',
  };

  it('renames every column', () => {
    expect(toUser(row)).toEqual({
      id: ADMIN,
      email: 'admin@example.com',
      displayName: 'Riyank',
      avatarMediaId: mediaId('m_avatar'),
      locale: 'en-GB',
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-02-02T00:00:00Z',
    });
  });
});

describe('toMembership', () => {
  const row: MembershipRow = {
    id: membershipId('mem_1'),
    tenant_id: T,
    user_id: null,
    invited_email: 'chef@example.com',
    invited_phone: '+44 7700 900000',
    role: 'vendor',
    status: 'invited',
    invited_by: ADMIN,
    invited_at: '2025-11-10T12:00:00Z',
    accepted_at: null,
    created_at: '2025-11-10T12:00:01Z',
    updated_at: '2025-11-10T12:00:02Z',
  };

  it('carries an unclaimed invitation, which is a membership with no user yet', () => {
    expect(toMembership(row)).toEqual({
      id: membershipId('mem_1'),
      tenantId: T,
      userId: null,
      invitedEmail: 'chef@example.com',
      invitedPhone: '+44 7700 900000',
      role: 'vendor',
      status: 'invited',
      invitedBy: ADMIN,
      invitedAt: '2025-11-10T12:00:00Z',
      acceptedAt: null,
      createdAt: '2025-11-10T12:00:01Z',
      updatedAt: '2025-11-10T12:00:02Z',
    });
  });
});

describe('toVenue', () => {
  const row: VenueRow = {
    id: venueId('v_1'),
    tenant_id: T,
    name: 'Taj Falaknuma',
    address: 'Engine Bowli, Hyderabad',
    lat: 17.3313,
    lng: 78.4675,
    map_url: 'https://maps.example/falaknuma',
    notes: 'Gate 2 after 18:00',
    sort_order: 1,
    created_at: '2025-11-01T09:00:00Z',
    updated_at: '2025-11-02T09:00:00Z',
  };

  it('pairs the coordinates and drops the row timestamps the UI has no use for', () => {
    expect(toVenue(row)).toEqual({
      id: venueId('v_1'),
      tenantId: T,
      name: 'Taj Falaknuma',
      address: 'Engine Bowli, Hyderabad',
      coords: { lat: 17.3313, lng: 78.4675 },
      mapUrl: 'https://maps.example/falaknuma',
      notes: 'Gate 2 after 18:00',
      sortOrder: 1,
    });
  });

  it.each([
    ['latitude', { lat: null }],
    ['longitude', { lng: null }],
    ['both', { lat: null, lng: null }],
  ])('has no location when %s is missing, because half a pair is not a place', (_label, patch) => {
    expect(toVenue({ ...row, ...patch }).coords).toBeNull();
  });

  it('keeps a zero coordinate, which is a real place off the coast of Ghana', () => {
    expect(toVenue({ ...row, lat: 0, lng: 0 }).coords).toEqual({ lat: 0, lng: 0 });
  });
});

describe('toSession', () => {
  const row: SessionRow = {
    id: sessionId('s_1'),
    tenant_id: T,
    title: 'Mehndi',
    description: 'Courtyard, bring flat shoes',
    starts_at: '2026-02-14T11:00:00+05:30',
    ends_at: '2026-02-14T15:00:00+05:30',
    venue_id: venueId('v_1'),
    hero_media_id: mediaId('m_hero'),
    track: 'main',
    sort_order: 3,
    status: 'published',
    created_at: '2025-11-03T09:00:00Z',
    updated_at: '2025-11-04T09:00:00Z',
  };

  it('renames every column', () => {
    expect(toSession(row)).toEqual({
      id: sessionId('s_1'),
      tenantId: T,
      title: 'Mehndi',
      description: 'Courtyard, bring flat shoes',
      startsAt: '2026-02-14T11:00:00+05:30',
      endsAt: '2026-02-14T15:00:00+05:30',
      venueId: venueId('v_1'),
      heroMediaId: mediaId('m_hero'),
      track: 'main',
      sortOrder: 3,
      status: 'published',
    });
  });

  it('leaves timestamps as strings so the persisted query cache round-trips them', () => {
    expect(toSession(row).startsAt).toBe('2026-02-14T11:00:00+05:30');
  });
});

describe('toPerson and toSessionPerson', () => {
  const person: PersonRow = {
    id: personId('p_1'),
    tenant_id: T,
    user_id: null,
    name: 'Dr Anand',
    role_label: 'Officiant',
    bio: 'Family friend of thirty years',
    photo_media_id: mediaId('m_p1'),
    sort_order: 2,
    created_at: '2025-11-05T09:00:00Z',
    updated_at: '2025-11-06T09:00:00Z',
  };

  const link: SessionPersonRow = {
    tenant_id: T,
    session_id: sessionId('s_1'),
    person_id: personId('p_1'),
    role_label: 'Panellist',
    sort_order: 0,
    created_at: '2025-11-07T09:00:00Z',
  };

  it('maps a person who has no account', () => {
    expect(toPerson(person)).toEqual({
      id: personId('p_1'),
      tenantId: T,
      userId: null,
      name: 'Dr Anand',
      roleLabel: 'Officiant',
      bio: 'Family friend of thirty years',
      photoMediaId: mediaId('m_p1'),
      sortOrder: 2,
    });
  });

  it('keeps the per-session role label, which overrides the person-level one', () => {
    expect(toSessionPerson(link)).toEqual({
      tenantId: T,
      sessionId: sessionId('s_1'),
      personId: personId('p_1'),
      roleLabel: 'Panellist',
      sortOrder: 0,
    });
  });
});

describe('toMediaAsset', () => {
  const row: MediaAssetRow = {
    id: mediaId('m_1'),
    tenant_id: T,
    storage_path: 'tenant/santi-riyanks/gallery/m_1.jpg',
    kind: 'image',
    mime_type: 'image/jpeg',
    width: 3000,
    height: 2000,
    blurhash: 'LEHV6nWB2yk8pyo0adR*.7kCMdnj',
    dominant_color: '#7C3A5A',
    alt: 'The couple under the mandap',
    byte_size: 2_400_000,
    uploaded_by: ADMIN,
    status: 'approved',
    created_at: '2026-02-14T12:00:00Z',
    updated_at: '2026-02-14T12:05:00Z',
  };

  it('carries the placeholder fields through, since a screen is where they are used', () => {
    expect(toMediaAsset(row)).toEqual({
      id: mediaId('m_1'),
      tenantId: T,
      storagePath: 'tenant/santi-riyanks/gallery/m_1.jpg',
      kind: 'image',
      mimeType: 'image/jpeg',
      dimensions: { width: 3000, height: 2000 },
      blurhash: 'LEHV6nWB2yk8pyo0adR*.7kCMdnj',
      dominantColor: '#7C3A5A',
      alt: 'The couple under the mandap',
      byteSize: 2_400_000,
      uploadedBy: ADMIN,
      status: 'approved',
      createdAt: '2026-02-14T12:00:00Z',
    });
  });

  it('has no dimensions when only one side is known, so no aspect ratio is invented', () => {
    expect(toMediaAsset({ ...row, height: null }).dimensions).toBeNull();
  });
});

describe('toGossipPost', () => {
  const row: GossipPostRow = {
    id: gossipPostId('g_1'),
    tenant_id: T,
    body: 'The best man has notes. Many notes.',
    media_id: null,
    persona_id: personaId('persona_golden_peacock'),
    author_device_hash: 'sha256:5f2b…never-leaves-the-row',
    status: 'approved',
    moderated_by: ADMIN,
    moderated_at: '2026-02-14T13:00:00Z',
    rejection_reason: null,
    reaction_counts: { heart: 12, laugh: 3 },
    report_count: 1,
    created_at: '2026-02-14T12:59:00Z',
  };

  it('maps the post without the device hash', () => {
    expect(toGossipPost(row)).toEqual({
      id: gossipPostId('g_1'),
      tenantId: T,
      body: 'The best man has notes. Many notes.',
      mediaId: null,
      personaId: personaId('persona_golden_peacock'),
      status: 'approved',
      moderatedBy: ADMIN,
      moderatedAt: '2026-02-14T13:00:00Z',
      rejectionReason: null,
      reactionCounts: { heart: 12, laugh: 3 },
      reportCount: 1,
      createdAt: '2026-02-14T12:59:00Z',
    });
  });

  /**
   * D12/D31 — the hash is how a device is rate-limited and blocked, and it is also the one value
   * that would deanonymise a poster if it ever reached a screen or the query cache. This asserts
   * on the actual value, not just the key name: a mapper that smuggled it through under any
   * spelling would still fail here.
   */
  it('never lets the device hash out of the data layer, under any key', () => {
    const post = toGossipPost(row);
    expect(Object.values(post)).not.toContain(row.author_device_hash);
    expect(JSON.stringify(post)).not.toContain('never-leaves-the-row');
    expect(Object.keys(post).filter((key) => /device|hash/i.test(key))).toEqual([]);
  });
});

describe('toTask', () => {
  const row: TaskRow = {
    id: taskId('t_1'),
    tenant_id: T,
    title: 'Speech',
    notes: 'Three minutes, no anecdotes about Goa',
    assignee_user_id: userId('u_brother'),
    created_by: ADMIN,
    session_id: sessionId('s_1'),
    due_at: '2026-02-15T19:00:00+05:30',
    remind_before_minutes: 30,
    status: 'todo',
    visibility: 'private',
    priority: 'high',
    sort_order: 4,
    created_at: '2025-12-01T09:00:00Z',
    updated_at: '2025-12-05T09:00:00Z',
  };

  it('keeps the session link and the reminder offset that make a reminder personal', () => {
    expect(toTask(row)).toEqual({
      id: taskId('t_1'),
      tenantId: T,
      title: 'Speech',
      notes: 'Three minutes, no anecdotes about Goa',
      assigneeUserId: userId('u_brother'),
      createdBy: ADMIN,
      sessionId: sessionId('s_1'),
      dueAt: '2026-02-15T19:00:00+05:30',
      remindBeforeMinutes: 30,
      status: 'todo',
      visibility: 'private',
      priority: 'high',
      sortOrder: 4,
      createdAt: '2025-12-01T09:00:00Z',
      updatedAt: '2025-12-05T09:00:00Z',
    });
  });

  it('treats an unassigned task as a real state rather than a missing value', () => {
    expect(toTask({ ...row, assignee_user_id: null }).assigneeUserId).toBeNull();
  });
});

describe('toUnit and toAssignment', () => {
  const unit: UnitRow = {
    id: unitId('un_1'),
    tenant_id: T,
    kind: 'room',
    label: 'Room 214',
    capacity: 2,
    venue_id: venueId('v_1'),
    meta: { floor: 2, bed: 'twin' },
    sort_order: 14,
    created_at: '2025-12-10T09:00:00Z',
    updated_at: '2025-12-11T09:00:00Z',
  };

  const assignment: AssignmentRow = {
    id: assignmentId('as_1'),
    tenant_id: T,
    unit_id: unitId('un_1'),
    user_id: userId('u_guest'),
    note: 'Window bed',
    assigned_by: ADMIN,
    created_at: '2025-12-12T09:00:00Z',
  };

  it('maps a unit, keeping the kind-specific meta as an opaque object', () => {
    expect(toUnit(unit)).toEqual({
      id: unitId('un_1'),
      tenantId: T,
      kind: 'room',
      label: 'Room 214',
      capacity: 2,
      venueId: venueId('v_1'),
      meta: { floor: 2, bed: 'twin' },
      sortOrder: 14,
    });
  });

  it('keeps an uncapped unit distinct from one nobody fits in', () => {
    expect(toUnit({ ...unit, capacity: null }).capacity).toBeNull();
    expect(toUnit({ ...unit, capacity: 0 }).capacity).toBe(0);
  });

  it('maps an assignment', () => {
    expect(toAssignment(assignment)).toEqual({
      id: assignmentId('as_1'),
      tenantId: T,
      unitId: unitId('un_1'),
      userId: userId('u_guest'),
      note: 'Window bed',
      assignedBy: ADMIN,
      createdAt: '2025-12-12T09:00:00Z',
    });
  });
});

describe('toAnnouncement', () => {
  const row: AnnouncementRow = {
    id: announcementId('an_1'),
    tenant_id: T,
    title: 'Shuttle delayed',
    body: 'The 18:00 shuttle now leaves at 18:20.',
    published_at: '2026-02-15T12:30:00Z',
    pinned: true,
    created_by: ADMIN,
    created_at: '2026-02-15T12:29:00Z',
    updated_at: '2026-02-15T12:31:00Z',
  };

  it('renames every column', () => {
    expect(toAnnouncement(row)).toEqual({
      id: announcementId('an_1'),
      tenantId: T,
      title: 'Shuttle delayed',
      body: 'The 18:00 shuttle now leaves at 18:20.',
      publishedAt: '2026-02-15T12:30:00Z',
      pinned: true,
      createdBy: ADMIN,
      createdAt: '2026-02-15T12:29:00Z',
      updatedAt: '2026-02-15T12:31:00Z',
    });
  });

  it('distinguishes a draft from a live announcement', () => {
    expect(toAnnouncement({ ...row, published_at: null }).publishedAt).toBeNull();
  });
});

describe('toRsvp', () => {
  const row: RsvpRow = {
    tenant_id: T,
    user_id: userId('u_guest'),
    session_id: sessionId('s_1'),
    status: 'going',
    guest_count: 2,
    responded_at: '2026-01-04T09:00:00Z',
  };

  it('renames every column of a composite-key row', () => {
    expect(toRsvp(row)).toEqual({
      tenantId: T,
      userId: userId('u_guest'),
      sessionId: sessionId('s_1'),
      status: 'going',
      guestCount: 2,
      respondedAt: '2026-01-04T09:00:00Z',
    });
  });
});

describe('toNotificationPreferences', () => {
  const row: NotificationPreferenceRow = {
    tenant_id: T,
    user_id: userId('u_guest'),
    channels: ['in_app', 'local'],
    muted_categories: ['gossips'],
    default_reminder_minutes: 45,
    quiet_hours_start: '22:00',
    quiet_hours_end: '07:30',
    created_at: '2026-01-05T09:00:00Z',
    updated_at: '2026-01-06T09:00:00Z',
  };

  it('pairs the quiet hours into a window', () => {
    expect(toNotificationPreferences(row)).toEqual({
      tenantId: T,
      userId: userId('u_guest'),
      channels: ['in_app', 'local'],
      mutedCategories: ['gossips'],
      defaultReminderMinutes: 45,
      quietHours: { start: '22:00', end: '07:30' },
    });
  });

  it('has no window when one end is missing, since it could not be evaluated', () => {
    expect(toNotificationPreferences({ ...row, quiet_hours_end: null }).quietHours).toBeNull();
  });
});
