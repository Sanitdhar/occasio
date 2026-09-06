import type { TenantId } from '@occasio/core';
import type { Random } from './latency';

/**
 * The anonymous half of ADR-0006, as much of it as a mock can honestly carry.
 *
 * The salted device hash never appears in a repository signature: it is derived here, stored on
 * `personas.device_hash` and `gossip_posts.author_device_hash`, and dropped by `mappers.ts` on
 * the way out. Nothing above the data layer can render it, because nothing above the data layer
 * is ever handed it.
 */

/**
 * **Not a cryptographic hash, and it does not need to be.** The real one is a salted SHA-256
 * computed server-side, where the salt is a secret the client never sees; a hash computed in a
 * browser from a value that same browser stores is reversible by anyone with the code, whatever
 * function it uses. FNV-1a is here to produce a stable, opaque-looking, fixed-length identifier
 * for a fixture dataset — nothing in Phase 1 depends on it resisting anything.
 *
 * What it does have to get right is *shape*, and it does: the same device gets the same hash
 * across reloads (so a persona survives), and a different device gets a different one (so a rate
 * limit and a device block have something to key on).
 */
const fnv1a = (value: string): string => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};

/**
 * The device hash is derived per tenant, not once per device.
 *
 * Two posts by the same person on two different events must not be linkable by comparing their
 * hashes, and they would be if the hash were only a function of the device. Mixing the tenant in
 * is free here and is what the eventual server-side derivation will also do.
 */
export const deviceHashFor = (deviceId: string, tenantId: TenantId): string =>
  `${fnv1a(`occasio:${deviceId}:${tenantId}`)}${fnv1a(`${tenantId}:${deviceId}:occasio`)}`;

/** A new device identity, generated once and persisted alongside the tables. */
export const createDeviceId = (random: Random): string =>
  `dev_${Math.floor(random() * 0xffffffff).toString(36)}${Math.floor(random() * 0xffffffff).toString(36)}`;

/*
 * The persona vocabulary. Deliberately warm and slightly absurd: the mask has to read as a
 * costume rather than as an account, or an anonymous board starts to feel like a pseudonymous
 * one. Both lists are prime-ish in length so the pairings do not visibly cycle.
 */
const ADJECTIVES = [
  'Golden',
  'Velvet',
  'Midnight',
  'Copper',
  'Restless',
  'Marbled',
  'Quiet',
  'Cinnamon',
  'Electric',
  'Saffron',
  'Wandering',
  'Cobalt',
  'Gilded',
] as const;

const CREATURES = [
  'Peacock',
  'Heron',
  'Mongoose',
  'Kingfisher',
  'Otter',
  'Falcon',
  'Pangolin',
  'Magpie',
  'Ibex',
  'Lynx',
  'Hoopoe',
] as const;

const pick = <T>(items: readonly [T, ...T[]], random: Random): T => {
  const index = Math.min(items.length - 1, Math.floor(random() * items.length));
  return items[index] ?? items[0];
};

/** "Golden Peacock" — what the board renders next to a post. */
export const createPersonaLabel = (random: Random): string =>
  `${pick(ADJECTIVES, random)} ${pick(CREATURES, random)}`;

/**
 * The seed the generated avatar is drawn from. Separate from the label so a reset changes both,
 * and so two people who happen to draw the same label still look different.
 */
export const createAvatarKey = (random: Random): string =>
  Math.floor(random() * 0xffffffff).toString(36);
