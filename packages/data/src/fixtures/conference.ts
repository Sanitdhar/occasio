import { themeInputFromPreset } from '@occasio/theme';
import type { TenantConfig } from '../config';
import type { MockTables } from '../mock/tables';
import type { TenantConfigRow, TenantRow } from '../rows';
import {
  FIXTURE_NOW,
  announcement,
  assignment,
  at,
  gossip,
  ids,
  image,
  membership,
  person,
  persona,
  session,
  sessionPerson,
  task,
  unit,
  user,
  venue,
} from './builders';

/**
 * A conference: two tracks, rooms rather than tables, and a site that follows the device.
 *
 * The third scheme policy. `mode.support: 'system'` is the one an attendee expects from a work
 * tool, and having a fixture that uses it is what stops the resolver's system path from being
 * exercised only by unit tests.
 *
 * It is also the only fixture with `tracks: true`, which is why `SessionRow.track` is nullable:
 * every other event leaves it null and would render a stray label if the schedule assumed one.
 */

const T = ids.tenant('devcon-25');
const DAY_ONE = '2026-10-06';
const DAY_TWO = '2026-10-07';
/** Central European Summer Time. A whole-hour offset, unlike the wedding's. */
const CEST = 2;

export const CONFERENCE_TENANT: TenantRow = {
  id: T,
  slug: 'devcon-25',
  name: 'DevCon 25',
  kind: 'conference',
  status: 'approved',
  timezone: 'Europe/Berlin',
  visibility: 'public',
  join_code: null,
  starts_on: DAY_ONE,
  ends_on: DAY_TWO,
  created_by: ids.user('paula'),
  created_at: FIXTURE_NOW,
  updated_at: FIXTURE_NOW,
};

const config: TenantConfig = {
  version: 1,
  theme: {
    ...themeInputFromPreset('conference', '#2563EB'),
    mode: { support: 'system', default: 'light' },
    imagery: { heroAspect: '16:9', treatment: 'none', scrim: 'light' },
    motion: { level: 'subtle' },
    density: 'cozy',
    shape: { corner: 'soft' },
  },
  features: {
    schedule: { enabled: true, defaultView: 'list', tracks: true },
    gossips: { enabled: true, requireApproval: true, allowMedia: false },
    media: { enabled: false },
    info: { enabled: true },
    game: { enabled: false },
  },
  /* `media` is disabled, and is deliberately still listed: the nav filters on
     `features[k].enabled` at render time, so a config can turn a tab off without anyone having
     to remember to edit two places. A fixture that only ever listed enabled tabs would leave
     that filter untested. */
  nav: { tabs: ['schedule', 'info', 'gossips', 'media'] },
  copy: { 'gossips.title': 'Backchannel' },
};

export const CONFERENCE_CONFIG: TenantConfigRow = {
  tenant_id: T,
  draft_config: config,
  published_config: config,
  published_at: FIXTURE_NOW,
  published_by: ids.user('paula'),
  created_at: FIXTURE_NOW,
  updated_at: FIXTURE_NOW,
};

const rooms = [
  venue(T, 'con_aula', 'Aula', {
    address: 'Haus der Technik, Berlin',
    lat: 52.52,
    lng: 13.405,
    sort_order: 1,
  }),
  venue(T, 'con_studio', 'Studio 2', { sort_order: 2 }),
];

const speakers = [
  person(T, 'con_ada', 'Ada Okonkwo', {
    role_label: 'Keynote',
    bio: 'Works on type systems and refuses to say which one is best.',
    sort_order: 1,
  }),
  person(T, 'con_tomas', 'Tomás Ferreira', { role_label: 'Speaker', sort_order: 2 }),
  person(T, 'con_yuki', 'Yuki Tanaka', { role_label: 'Speaker', sort_order: 3 }),
];

const sessions = [
  session(T, 'con_keynote', 'Opening keynote', at(DAY_ONE, 9, 30, CEST), {
    description: 'Where the platform goes next, and what we got wrong last year.',
    ends_at: at(DAY_ONE, 10, 30, CEST),
    venue_id: ids.venue('con_aula'),
    hero_media_id: ids.media('con_aula'),
    track: 'Main',
    sort_order: 1,
  }),
  session(T, 'con_types', 'Types at the edges', at(DAY_ONE, 11, 0, CEST), {
    ends_at: at(DAY_ONE, 11, 45, CEST),
    venue_id: ids.venue('con_studio'),
    track: 'Platform',
    sort_order: 2,
  }),
  /* Same minute, different track — the case `sort_order` exists for, since a start time alone
     does not order two talks a reader has to choose between. */
  session(T, 'con_offline', 'Offline-first, actually', at(DAY_ONE, 11, 0, CEST), {
    ends_at: at(DAY_ONE, 11, 45, CEST),
    venue_id: ids.venue('con_aula'),
    track: 'Product',
    sort_order: 3,
  }),
  session(T, 'con_lunch', 'Lunch', at(DAY_ONE, 12, 30, CEST), {
    ends_at: at(DAY_ONE, 13, 30, CEST),
    track: 'Main',
    sort_order: 4,
  }),
  session(T, 'con_workshop', 'Workshop · migrating a monolith', at(DAY_TWO, 10, 0, CEST), {
    description: 'Bring a laptop. Numbers are capped at thirty.',
    ends_at: at(DAY_TWO, 13, 0, CEST),
    venue_id: ids.venue('con_studio'),
    track: 'Platform',
    sort_order: 5,
  }),
  session(T, 'con_close', 'Closing remarks', at(DAY_TWO, 16, 30, CEST), {
    ends_at: at(DAY_TWO, 17, 0, CEST),
    venue_id: ids.venue('con_aula'),
    track: 'Main',
    sort_order: 6,
  }),
];

const kite = persona(T, 'con_kite', 'Quiet Kite', 'dh_con_a1');
const personas = [kite];

export const CONFERENCE: Partial<MockTables> = {
  tenants: [CONFERENCE_TENANT],
  tenantConfigs: [CONFERENCE_CONFIG],
  users: [user('paula', 'Paula Brandt'), user('sam', 'Sam Okafor'), user('ines', 'Inês Costa')],
  memberships: [
    membership(T, ids.user('paula'), 'event_admin'),
    membership(T, ids.user('sam'), 'crew'),
    membership(T, ids.user('ines'), 'attendee'),
    /* An invitation that has not been accepted: a row that exists before the person does, and
       the reason `findActiveMembership` checks status rather than presence. */
    membership(T, ids.user('ines'), 'moderator', 'invited', {
      user_id: null,
      invited_email: 'not-yet@example.test',
      invited_by: ids.user('paula'),
      invited_at: FIXTURE_NOW,
      accepted_at: null,
    }),
  ],
  venues: rooms,
  sessions,
  people: speakers,
  sessionPeople: [
    sessionPerson(T, ids.session('con_keynote'), ids.person('con_ada')),
    sessionPerson(T, ids.session('con_types'), ids.person('con_tomas')),
    sessionPerson(T, ids.session('con_offline'), ids.person('con_yuki')),
    sessionPerson(T, ids.session('con_workshop'), ids.person('con_tomas'), {
      role_label: 'Facilitator',
    }),
  ],
  mediaAssets: [
    image(T, 'con_aula', 'The Aula, filling up before the keynote', 'L9C6M-00~q4n?bxu9FRj00~q%MRj'),
  ],
  personas,
  gossipPosts: [
    gossip(T, 'con_1', 'The coffee is better than last year. Low bar, cleared.', kite, 'approved', {
      reaction_counts: { '☕': 9 },
    }),
    gossip(T, 'con_2', 'Studio 2 is freezing. Bring a jumper.', kite, 'pending'),
  ],
  tasks: [
    task(T, 'con_mics', 'Swap the lapel mic in Studio 2', ids.user('paula'), 'todo', {
      assignee_user_id: ids.user('sam'),
      due_at: at(DAY_ONE, 8, 30, CEST),
      priority: 'high',
      session_id: ids.session('con_types'),
      remind_before_minutes: 30,
      sort_order: 1,
    }),
    task(T, 'con_badges', 'Reprint the badges with the right pronouns', ids.user('paula'), 'done', {
      assignee_user_id: ids.user('sam'),
      sort_order: 2,
    }),
  ],
  units: [
    unit(T, 'con_room_a', 'room', 'Quiet room', {
      capacity: 12,
      venue_id: ids.venue('con_aula'),
      sort_order: 1,
    }),
    unit(T, 'con_room_b', 'room', 'Workshop room', {
      capacity: 30,
      venue_id: ids.venue('con_studio'),
      sort_order: 2,
    }),
  ],
  assignments: [
    assignment(T, 'con_1', ids.unit('con_room_b'), ids.user('ines'), ids.user('paula'), {
      note: 'Workshop seat 14.',
    }),
  ],
  announcements: [
    announcement(
      T,
      'con_wifi',
      'Wi-Fi is devcon / devcon25',
      'One network, no captive portal. If it drops, the schedule works offline.',
      ids.user('paula'),
      { pinned: true },
    ),
    /* Unpublished: a draft an admin is still writing, which the attendee site must not show. */
    announcement(
      T,
      'con_draft',
      'Day two changes',
      'Still confirming the room swap.',
      ids.user('paula'),
      {
        published_at: null,
      },
    ),
  ],
  rsvps: [
    {
      tenant_id: T,
      user_id: ids.user('ines'),
      session_id: ids.session('con_workshop'),
      status: 'going',
      guest_count: 1,
      responded_at: FIXTURE_NOW,
    },
  ],
};
