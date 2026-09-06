import { themeInputFromPreset } from '@occasio/theme';
import type { TenantConfig } from '../config';
import type { MockTables } from '../mock/tables';
import type { TenantConfigRow, TenantRow } from '../rows';
import {
  FIXTURE_NOW,
  announcement,
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
 * A festival: three stages, one long day, and a site that lives in the dark.
 *
 * `mode.support: 'dark'` pins it the other way from the wedding. A festival read outdoors at
 * midnight has no business turning white because someone's phone is on auto, and the pairing of
 * `expressive` motion with a dark ground is the loudest the design system is allowed to be.
 */

const T = ids.tenant('anandhara');
const DAY = '2026-09-19';
/** Western Indian Standard time for the fixture's venue; kept whole-hour for contrast with IST. */
const OFFSET = 5.5;

export const FESTIVAL_TENANT: TenantRow = {
  id: T,
  slug: 'anandhara',
  name: 'Anandhara',
  kind: 'festival',
  status: 'approved',
  timezone: 'Asia/Kolkata',
  visibility: 'public',
  join_code: null,
  starts_on: DAY,
  ends_on: DAY,
  created_by: ids.user('devi'),
  created_at: FIXTURE_NOW,
  updated_at: FIXTURE_NOW,
};

const config: TenantConfig = {
  version: 1,
  theme: {
    ...themeInputFromPreset('festival', '#1E6F5C'),
    mode: { support: 'dark', default: 'dark' },
    imagery: { heroAspect: '16:9', treatment: 'duotone', scrim: 'heavy' },
    motion: { level: 'expressive' },
    density: 'airy',
    shape: { corner: 'sharp' },
    typography: {
      setId: themeInputFromPreset('festival', '#1E6F5C').typography.setId,
      scale: 'grand',
    },
  },
  features: {
    schedule: { enabled: true, defaultView: 'list', tracks: false },
    gossips: { enabled: true, requireApproval: true, allowMedia: true },
    media: { enabled: true },
    info: { enabled: true },
    game: { enabled: false },
  },
  nav: { tabs: ['schedule', 'media', 'gossips', 'info'] },
  copy: { 'gossips.title': 'The Wall' },
};

export const FESTIVAL_CONFIG: TenantConfigRow = {
  tenant_id: T,
  draft_config: config,
  published_config: config,
  published_at: FIXTURE_NOW,
  published_by: ids.user('devi'),
  created_at: FIXTURE_NOW,
  updated_at: FIXTURE_NOW,
};

const stages = [
  venue(T, 'fes_main', 'Mainstage', { lat: 15.2993, lng: 74.124, sort_order: 1 }),
  venue(T, 'fes_grove', 'The Grove', { notes: 'Acoustic only. Bring a blanket.', sort_order: 2 }),
  venue(T, 'fes_dome', 'Bass Dome', { notes: 'Ear protection at the door.', sort_order: 3 }),
];

const acts = [
  person(T, 'fes_kavi', 'Kavi & the Long Way Home', { role_label: 'Headliner', sort_order: 1 }),
  person(T, 'fes_moss', 'Moss Telegraph', { role_label: 'Live', sort_order: 2 }),
  person(T, 'fes_ruhi', 'Ruhi', { role_label: 'DJ set', sort_order: 3 }),
];

const sessions = [
  session(T, 'fes_gates', 'Gates open', at(DAY, 12, 0, OFFSET), { sort_order: 1 }),
  session(T, 'fes_moss', 'Moss Telegraph', at(DAY, 15, 30, OFFSET), {
    ends_at: at(DAY, 16, 30, OFFSET),
    venue_id: ids.venue('fes_grove'),
    hero_media_id: ids.media('fes_grove'),
    sort_order: 2,
  }),
  session(T, 'fes_ruhi', 'Ruhi', at(DAY, 18, 0, OFFSET), {
    ends_at: at(DAY, 19, 30, OFFSET),
    venue_id: ids.venue('fes_dome'),
    sort_order: 3,
  }),
  /* Deliberately overlapping the headliner: two things at once is the normal case at a
     festival, and a schedule that assumes otherwise is wrong on its busiest hour. */
  session(T, 'fes_kavi', 'Kavi & the Long Way Home', at(DAY, 21, 0, OFFSET), {
    description: 'The one everybody came for.',
    ends_at: at(DAY, 22, 30, OFFSET),
    venue_id: ids.venue('fes_main'),
    hero_media_id: ids.media('fes_main'),
    sort_order: 4,
  }),
  session(T, 'fes_late', 'Late set · Bass Dome', at(DAY, 21, 30, OFFSET), {
    ends_at: at(DAY, 23, 59, OFFSET),
    venue_id: ids.venue('fes_dome'),
    sort_order: 5,
  }),
  session(T, 'fes_washed', 'Sunset yoga', at(DAY, 7, 0, OFFSET), {
    status: 'cancelled',
    description: 'Cancelled — the field is under water.',
    sort_order: 6,
  }),
];

const owl = persona(T, 'fes_owl', 'Neon Owl', 'dh_fes_a1');
const fern = persona(T, 'fes_fern', 'Damp Fern', 'dh_fes_b2');
const personas = [owl, fern];

export const FESTIVAL: Partial<MockTables> = {
  tenants: [FESTIVAL_TENANT],
  tenantConfigs: [FESTIVAL_CONFIG],
  users: [user('devi', 'Devi Menon'), user('rafi', 'Rafi Ahmed'), user('lena', 'Lena Fischer')],
  memberships: [
    membership(T, 'fes_devi', ids.user('devi'), 'event_admin'),
    membership(T, 'fes_rafi', ids.user('rafi'), 'crew'),
    membership(T, 'fes_lena', ids.user('lena'), 'attendee'),
  ],
  venues: stages,
  sessions,
  people: acts,
  sessionPeople: [
    sessionPerson(T, ids.session('fes_kavi'), ids.person('fes_kavi')),
    sessionPerson(T, ids.session('fes_moss'), ids.person('fes_moss')),
    sessionPerson(T, ids.session('fes_ruhi'), ids.person('fes_ruhi')),
  ],
  mediaAssets: [
    image(T, 'fes_main', 'The mainstage crowd at dusk', 'L36@#=~q00Rj4nWBofof00Rj~qxu', '#1b3b33'),
    image(
      T,
      'fes_grove',
      'Strings of lights through trees',
      'LBB|WA~q00%M9FIU%MRj00IU~q4n',
      '#26483f',
    ),
  ],
  personas,
  gossipPosts: [
    gossip(
      T,
      'fes_1',
      'Whoever is running the chai stall has saved this festival.',
      owl,
      'approved',
      {
        reaction_counts: { '🔥': 31, '☕': 12 },
      },
    ),
    gossip(T, 'fes_2', 'Lost a green jacket at the Grove. It has my keys in it.', fern, 'approved'),
    gossip(T, 'fes_3', 'Queue for water is twenty minutes.', fern, 'pending'),
  ],
  tasks: [
    task(T, 'fes_water', 'Open the second water point', ids.user('devi'), 'doing', {
      assignee_user_id: ids.user('rafi'),
      priority: 'high',
      due_at: at(DAY, 14, 0, OFFSET),
      sort_order: 1,
    }),
    task(T, 'fes_cables', 'Tape the cable run at the Dome', ids.user('devi'), 'todo', {
      assignee_user_id: ids.user('rafi'),
      sort_order: 2,
    }),
  ],
  units: [
    unit(T, 'fes_shuttle_a', 'shuttle', 'Shuttle A · every 20 min', {
      capacity: 30,
      sort_order: 1,
    }),
    unit(T, 'fes_shuttle_b', 'shuttle', 'Shuttle B · last at 01:00', {
      capacity: 30,
      sort_order: 2,
    }),
  ],
  announcements: [
    announcement(
      T,
      'fes_water',
      'Water is free at every bar',
      'Ask at any bar for tap water. You do not need to queue at the water point for it.',
      ids.user('devi'),
      { pinned: true },
    ),
  ],
};
