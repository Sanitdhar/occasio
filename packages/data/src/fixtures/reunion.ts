import { themeInputFromPreset } from '@occasio/theme';
import type { TenantConfig } from '../config';
import type { MockTables } from '../mock/tables';
import type { TenantConfigRow, TenantRow } from '../rows';
import {
  FIXTURE_NOW,
  announcement,
  at,
  ids,
  image,
  membership,
  person,
  session,
  task,
  unit,
  user,
  venue,
} from './builders';

/**
 * A school reunion: small, private, and the fixture where most things are switched off.
 *
 * Every other event turns features on. This one turns them off — no gossip board, no media
 * gallery, two tabs — because a config that only ever adds is a config whose subtraction path
 * has never rendered. An empty `personas` and `gossipPosts` here is the point rather than an
 * omission: it is what a tenant with the board disabled actually looks like, and the screens
 * have to survive it.
 *
 * It is also the only `private` tenant and the only one still `pending_approval`, so the
 * super-admin queue (D25) has something in it.
 */

const T = ids.tenant('maple-1999');
const DAY = '2026-08-15';
/** British Summer Time. */
const BST = 1;

export const REUNION_TENANT: TenantRow = {
  id: T,
  slug: 'maple-1999',
  name: 'Maple Grove, Class of 1999',
  kind: 'reunion',
  status: 'pending_approval',
  timezone: 'Europe/London',
  visibility: 'private',
  join_code: 'MAPLE99',
  starts_on: DAY,
  ends_on: DAY,
  created_by: ids.user('harriet'),
  created_at: FIXTURE_NOW,
  updated_at: FIXTURE_NOW,
};

const config: TenantConfig = {
  version: 1,
  theme: {
    ...themeInputFromPreset('minimal', '#C2410C'),
    mode: { support: 'system', default: 'light' },
    imagery: { heroAspect: '3:2', treatment: 'mono', scrim: 'light' },
    /* The accessible end of D11, chosen by the tenant rather than forced by the device — which
       is a different path through the resolver from the reduce-motion one. */
    motion: { level: 'none' },
    density: 'comfortable',
    shape: { corner: 'sharp' },
  },
  features: {
    schedule: { enabled: true, defaultView: 'list', tracks: false },
    gossips: { enabled: false, requireApproval: true, allowMedia: false },
    media: { enabled: false },
    info: { enabled: true },
    game: { enabled: false },
  },
  nav: { tabs: ['schedule', 'info'] },
  copy: {},
};

export const REUNION_CONFIG: TenantConfigRow = {
  tenant_id: T,
  /* Draft ahead of published: the theme editor's unsaved state, and the reason the column is
     split. A screen reading the wrong one shows guests a colour nobody approved. */
  draft_config: { ...config, theme: { ...config.theme, brand: { seed: '#166534' } } },
  published_config: config,
  published_at: FIXTURE_NOW,
  published_by: ids.user('harriet'),
  created_at: FIXTURE_NOW,
  updated_at: FIXTURE_NOW,
};

export const REUNION: Partial<MockTables> = {
  tenants: [REUNION_TENANT],
  tenantConfigs: [REUNION_CONFIG],
  users: [user('harriet', 'Harriet Bell'), user('george', 'George Amankwah')],
  memberships: [
    membership(T, 'reu_harriet', ids.user('harriet'), 'event_admin'),
    membership(T, 'reu_george', ids.user('george'), 'attendee'),
  ],
  venues: [
    venue(T, 'reu_hall', 'The Old Assembly Hall', {
      address: 'Maple Grove School, Bristol',
      lat: 51.4545,
      lng: -2.5879,
      notes: 'The side door by the bike sheds is unlocked from six.',
      sort_order: 1,
    }),
  ],
  sessions: [
    session(T, 'reu_drinks', 'Drinks in the hall', at(DAY, 18, 30, BST), {
      ends_at: at(DAY, 20, 0, BST),
      venue_id: ids.venue('reu_hall'),
      hero_media_id: ids.media('reu_hall'),
      sort_order: 1,
    }),
    session(T, 'reu_dinner', 'Dinner', at(DAY, 20, 0, BST), {
      ends_at: at(DAY, 22, 30, BST),
      venue_id: ids.venue('reu_hall'),
      sort_order: 2,
    }),
  ],
  people: [
    person(T, 'reu_harriet', 'Harriet Bell', {
      user_id: ids.user('harriet'),
      role_label: 'Organiser',
      bio: 'Has been organising this since 2019.',
      sort_order: 1,
    }),
  ],
  sessionPeople: [],
  mediaAssets: [
    image(
      T,
      'reu_hall',
      'The assembly hall, set for dinner',
      'LEHV6nWB2yk8pyoJadR*.7kCMdnj',
      '#6b4636',
    ),
  ],
  /* Empty on purpose: the board is off for this tenant, and a screen that assumed at least one
     persona would break on the first event that turned gossips off. */
  personas: [],
  gossipPosts: [],
  tasks: [
    task(
      T,
      'reu_nametags',
      'Print the name tags with the 1999 photos',
      ids.user('harriet'),
      'doing',
      {
        assignee_user_id: ids.user('harriet'),
        due_at: at(DAY, 12, 0, BST),
        visibility: 'private',
        sort_order: 1,
      },
    ),
  ],
  units: [
    unit(T, 'reu_t1', 'table', 'Long table', { capacity: 24, venue_id: ids.venue('reu_hall') }),
  ],
  announcements: [
    announcement(
      T,
      'reu_parking',
      'Park on the road, not the field',
      'The field is soft after the rain and the school has asked us to keep off it.',
      ids.user('harriet'),
    ),
  ],
  approvalRequests: [
    {
      id: ids.approvalRequest('reu_1'),
      tenant_id: T,
      status: 'pending',
      requested_by: ids.user('harriet'),
      requested_at: FIXTURE_NOW,
      reviewed_by: null,
      reviewed_at: null,
      note: 'First event on the platform — happy to answer anything.',
      created_at: FIXTURE_NOW,
    },
  ],
};
