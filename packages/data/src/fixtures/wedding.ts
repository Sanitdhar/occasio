import { themeInputFromPreset } from '@occasio/theme';
import type { TenantConfig } from '../config';
import type { TenantConfigRow, TenantRow } from '../rows';
import type { MockTables } from '../mock/tables';
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
 * A wedding: two days, one family, and a schedule nobody reads as a list.
 *
 * The theming choices are the point of the fixture rather than decoration. `mode.support:
 * 'light'` pins it — a wedding site that flipped to dark because a guest's phone did would look
 * like a different event — while the conference fixture follows the device and the festival
 * pins dark. Three policies across four events is what proves the resolver is driven by config
 * rather than by whatever the first screen happened to need.
 */

const T = ids.tenant('sanit-riyanks');
const DAY_ONE = '2026-11-20';
const DAY_TWO = '2026-11-21';
/** India Standard Time: +5:30, which is also the half-hour offset worth having in a fixture. */
const IST = 5.5;

export const WEDDING_TENANT: TenantRow = {
  id: T,
  slug: 'sanit-riyanks',
  name: 'Sanit & Riya',
  kind: 'wedding',
  status: 'approved',
  timezone: 'Asia/Kolkata',
  visibility: 'unlisted',
  join_code: 'SANRIY26',
  starts_on: DAY_ONE,
  ends_on: DAY_TWO,
  created_by: ids.user('sanit'),
  created_at: FIXTURE_NOW,
  updated_at: FIXTURE_NOW,
};

const config: TenantConfig = {
  version: 1,
  theme: {
    ...themeInputFromPreset('romantic', '#7C3A5A'),
    mode: { support: 'light', default: 'light' },
    imagery: { heroAspect: '4:5', treatment: 'warm', scrim: 'auto' },
    motion: { level: 'subtle' },
    density: 'comfortable',
    shape: { corner: 'round' },
  },
  features: {
    schedule: { enabled: true, defaultView: 'stories', tracks: false },
    gossips: { enabled: true, requireApproval: true, allowMedia: true },
    media: { enabled: true },
    info: { enabled: true },
    game: { enabled: false },
  },
  nav: { tabs: ['schedule', 'gossips', 'media', 'info'] },
  /* D21 — a wedding calls the board "Whispers". The same key, a different word, no code. */
  copy: { 'gossips.title': 'Whispers', 'gossips.empty': 'No whispers yet. Be the first.' },
};

export const WEDDING_CONFIG: TenantConfigRow = {
  tenant_id: T,
  draft_config: config,
  published_config: config,
  published_at: FIXTURE_NOW,
  published_by: ids.user('sanit'),
  created_at: FIXTURE_NOW,
  updated_at: FIXTURE_NOW,
};

const users = [
  user('sanit', 'Sanit Dhar'),
  user('riya', 'Riya Kapoor'),
  user('meera', 'Meera Kapoor'),
  user('arjun', 'Arjun Rao'),
  user('nisha', 'Nisha Verma'),
];

const venues = [
  venue(T, 'wed_courtyard', 'The Courtyard', {
    address: '14 Rosewood Lane, Bengaluru',
    lat: 12.9716,
    lng: 77.5946,
    notes: 'Enter through the garden gate; the driveway is for vendors.',
    sort_order: 1,
  }),
  venue(T, 'wed_hall', 'Lakeview Hall', {
    address: 'Lakeview Estate, Bengaluru',
    lat: 12.9611,
    lng: 77.6387,
    sort_order: 2,
  }),
];

const media = [
  image(
    T,
    'wed_hero',
    'The couple under the mandap at dusk',
    'LKO2?U%2Tw=w]~RBVZRi};RPxuwH',
    '#7a4a5c',
  ),
  image(T, 'wed_mehendi', 'Hands painted with mehendi', 'LEHV6nWB2yk8pyo0adR*.7kCMdnj', '#8b6f47'),
  image(
    T,
    'wed_sangeet',
    'The family mid-dance under string lights',
    'L6PZfSi_.AyE_3t7t7R**0o#DgR4',
    '#3d2b36',
  ),
];

const people = [
  person(T, 'wed_sanit', 'Sanit Dhar', {
    user_id: ids.user('sanit'),
    role_label: 'Groom',
    bio: 'Grew up two streets from the venue and still gets lost in it.',
    sort_order: 1,
  }),
  person(T, 'wed_riya', 'Riya Kapoor', {
    user_id: ids.user('riya'),
    role_label: 'Bride',
    bio: 'Will be the one telling the band to play one more.',
    sort_order: 2,
  }),
  /* No `user_id`: the reason `people` is a separate table. He is on the site and will never
     sign in, and the schema has to hold that without inventing an account for him. */
  person(T, 'wed_uncle', 'Vikram Kapoor', {
    role_label: "Bride's father",
    bio: 'Master of ceremonies, self-appointed.',
    sort_order: 3,
  }),
];

const sessions = [
  session(T, 'wed_mehendi', 'Mehendi', at(DAY_ONE, 16, 0, IST), {
    description: 'Bring an appetite and sleeves you can push up.',
    ends_at: at(DAY_ONE, 19, 0, IST),
    venue_id: ids.venue('wed_courtyard'),
    hero_media_id: ids.media('wed_mehendi'),
    sort_order: 1,
  }),
  session(T, 'wed_sangeet', 'Sangeet', at(DAY_ONE, 20, 0, IST), {
    description: 'Dancing, and a slideshow nobody has been allowed to preview.',
    ends_at: at(DAY_ONE, 23, 30, IST),
    venue_id: ids.venue('wed_hall'),
    hero_media_id: ids.media('wed_sangeet'),
    sort_order: 2,
  }),
  session(T, 'wed_ceremony', 'The Ceremony', at(DAY_TWO, 10, 30, IST), {
    description: 'Seating from 10:00. It starts on time, which nobody believes.',
    ends_at: at(DAY_TWO, 12, 30, IST),
    venue_id: ids.venue('wed_courtyard'),
    hero_media_id: ids.media('wed_hero'),
    sort_order: 3,
  }),
  session(T, 'wed_reception', 'Reception', at(DAY_TWO, 19, 0, IST), {
    ends_at: at(DAY_TWO, 23, 0, IST),
    venue_id: ids.venue('wed_hall'),
    sort_order: 4,
  }),
  /* Draft, so a screen that forgets to filter shows a session guests should not see. */
  session(T, 'wed_brunch', 'Farewell brunch', at(DAY_TWO, 11, 0, IST), {
    status: 'draft',
    sort_order: 5,
  }),
];

/* Named rather than indexed out of an array: `lantern` is a non-null assertion, which
   this repo bans, and a name reads better in the posts below anyway. */
const lantern = persona(T, 'wed_lantern', 'Curious Lantern', 'dh_wed_a1');
const peacock = persona(T, 'wed_peacock', 'Restless Peacock', 'dh_wed_b2');
const personas = [lantern, peacock];

const gossips = [
  gossip(
    T,
    'wed_1',
    'The groom practised his entrance for an hour. It shows, and not in the way he hoped.',
    lantern,
    'approved',
    { reaction_counts: { '😂': 14, '❤️': 6 } },
  ),
  gossip(T, 'wed_2', 'Whoever made the gulab jamun: marry me instead.', peacock, 'approved', {
    reaction_counts: { '😂': 22 },
  }),
  /* One of each state, because the moderation queue is a screen and an empty queue tests
     nothing. `pending` is also what the attendee sees as "waiting to be approved". */
  gossip(T, 'wed_3', 'Table 4 has started a conga line. It is 6pm.', lantern, 'pending'),
  gossip(T, 'wed_4', 'A post that broke the rules.', peacock, 'rejected', {
    moderated_by: ids.user('meera'),
    rejection_reason: 'Named a guest who has not posted here.',
  }),
  gossip(T, 'wed_5', 'Auto-hidden after reports.', lantern, 'hidden', { report_count: 4 }),
];

const units = [
  unit(T, 'wed_t1', 'table', 'Table 1', {
    capacity: 8,
    venue_id: ids.venue('wed_hall'),
    sort_order: 1,
  }),
  unit(T, 'wed_t2', 'table', 'Table 2', {
    capacity: 8,
    venue_id: ids.venue('wed_hall'),
    sort_order: 2,
  }),
  unit(T, 'wed_shuttle', 'shuttle', 'Hotel shuttle · 09:15', {
    capacity: 14,
    venue_id: ids.venue('wed_courtyard'),
    meta: { departsFrom: 'Rosewood Hotel lobby' },
    sort_order: 3,
  }),
];

export const WEDDING: Partial<MockTables> = {
  tenants: [WEDDING_TENANT],
  tenantConfigs: [WEDDING_CONFIG],
  users,
  memberships: [
    membership(T, 'wed_sanit', ids.user('sanit'), 'event_admin'),
    membership(T, 'wed_riya', ids.user('riya'), 'event_admin'),
    membership(T, 'wed_meera', ids.user('meera'), 'moderator'),
    membership(T, 'wed_arjun', ids.user('arjun'), 'crew'),
    membership(T, 'wed_nisha', ids.user('nisha'), 'attendee'),
  ],
  venues,
  sessions,
  people,
  sessionPeople: [
    sessionPerson(T, ids.session('wed_ceremony'), ids.person('wed_sanit'), { sort_order: 1 }),
    sessionPerson(T, ids.session('wed_ceremony'), ids.person('wed_riya'), { sort_order: 2 }),
    sessionPerson(T, ids.session('wed_sangeet'), ids.person('wed_uncle'), {
      role_label: 'Host',
      sort_order: 1,
    }),
  ],
  mediaAssets: media,
  personas,
  gossipPosts: gossips,
  tasks: [
    task(T, 'wed_flowers', 'Confirm the flowers for the mandap', ids.user('sanit'), 'done', {
      assignee_user_id: ids.user('arjun'),
      due_at: at(DAY_ONE, 9, 0, IST),
      priority: 'high',
      sort_order: 1,
    }),
    task(
      T,
      'wed_shuttle',
      'Chase the shuttle driver for a pickup time',
      ids.user('sanit'),
      'doing',
      {
        assignee_user_id: ids.user('arjun'),
        due_at: at(DAY_TWO, 8, 0, IST),
        remind_before_minutes: 120,
        session_id: ids.session('wed_ceremony'),
        sort_order: 2,
      },
    ),
    task(T, 'wed_speech', 'Write the speech', ids.user('sanit'), 'blocked', {
      assignee_user_id: ids.user('sanit'),
      notes: 'Blocked on remembering how they met.',
      visibility: 'private',
      sort_order: 3,
    }),
    task(T, 'wed_playlist', 'Send the band the do-not-play list', ids.user('riya'), 'todo', {
      assignee_user_id: ids.user('nisha'),
      due_at: at(DAY_ONE, 12, 0, IST),
      priority: 'low',
      visibility: 'public',
      sort_order: 4,
    }),
  ],
  units,
  assignments: [
    assignment(T, 'wed_1', ids.unit('wed_t1'), ids.user('nisha'), ids.user('riya'), {
      note: 'Near the front, away from the speakers.',
    }),
    assignment(T, 'wed_2', ids.unit('wed_shuttle'), ids.user('nisha'), ids.user('arjun')),
  ],
  announcements: [
    announcement(
      T,
      'wed_parking',
      'Parking is behind the temple',
      'The driveway fills by ten. There is space behind the temple, two minutes on foot.',
      ids.user('sanit'),
      { pinned: true },
    ),
    announcement(
      T,
      'wed_rain',
      'Rain plan',
      'If it rains the ceremony moves indoors to Lakeview Hall. We will post here by 08:00.',
      ids.user('riya'),
    ),
  ],
  rsvps: [
    {
      tenant_id: T,
      user_id: ids.user('nisha'),
      session_id: ids.session('wed_ceremony'),
      status: 'going',
      guest_count: 2,
      responded_at: FIXTURE_NOW,
    },
    {
      tenant_id: T,
      user_id: ids.user('nisha'),
      session_id: ids.session('wed_reception'),
      status: 'maybe',
      guest_count: 1,
      responded_at: FIXTURE_NOW,
    },
  ],
  notificationPreferences: [
    {
      tenant_id: T,
      user_id: ids.user('nisha'),
      channels: ['in_app', 'push'],
      muted_categories: ['gossips'],
      default_reminder_minutes: 60,
      quiet_hours_start: '23:00',
      quiet_hours_end: '07:30',
      created_at: FIXTURE_NOW,
      updated_at: FIXTURE_NOW,
    },
  ],
};
