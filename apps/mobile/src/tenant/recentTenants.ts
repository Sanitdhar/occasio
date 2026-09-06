import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  parseRecentTenants,
  serialise,
  withMostRecent,
  LEGACY_KEY,
  RECENT_KEY,
  type RecentTenant,
} from './recentTenants.shared';

/**
 * Native: the events this device has opened.
 *
 * There is no URL bar to read, so this list is most of the answer to "where was I" — it is the
 * second source tenant resolution tries, behind a deep link, and the picker on the join screen
 * is the same data made visible.
 *
 * `AsyncStorage` rather than something securable: a slug is public — it is in the URL on web —
 * so this is a convenience, not a credential.
 */

const readRaw = async (): Promise<{ readonly value: string | null; readonly legacy: boolean }> => {
  const current = await AsyncStorage.getItem(RECENT_KEY);
  if (current !== null) return { value: current, legacy: false };
  return { value: await AsyncStorage.getItem(LEGACY_KEY), legacy: true };
};

/**
 * Move a legacy value under the current key, and report what is actually stored afterwards.
 *
 * Queued, and it re-reads inside the queue rather than trusting what the caller parsed outside
 * it. Between that parse and this task an event can have been remembered — the gate loading one
 * while a deep link resolves another — and writing the parsed legacy list over it would delete
 * the newer event. Every step here is a separate await, so the window is real rather than
 * theoretical. A value that has appeared wins, and this reports that value rather than the stale
 * one it was handed.
 */
const migrate = (entries: readonly RecentTenant[]): Promise<RecentTenant[]> =>
  serialise(async () => {
    const current = await AsyncStorage.getItem(RECENT_KEY);
    if (current !== null) {
      /* Superseded, so the old key is dead either way. */
      await AsyncStorage.removeItem(LEGACY_KEY);
      return parseRecentTenants(current);
    }
    await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(entries));
    await AsyncStorage.removeItem(LEGACY_KEY);
    return [...entries];
  });

export const readRecentTenants = async (): Promise<RecentTenant[]> => {
  let parsed: readonly RecentTenant[];
  let legacy: boolean;
  try {
    const raw = await readRaw();
    parsed = parseRecentTenants(raw.value);
    legacy = raw.legacy;
  } catch {
    /* Storage being unavailable is not worth failing a launch over — it costs the shortcut. */
    return [];
  }

  if (!legacy || parsed.length === 0) return [...parsed];

  try {
    return await migrate(parsed);
  } catch {
    /* The read worked and only the write failed — a full disk, a store not yet unlocked.
       Returning `[]` here would throw away a perfectly good answer and blank the picker; the
       legacy key is left in place so the next read can try the move again. */
    return [...parsed];
  }
};

export const rememberTenant = (entry: RecentTenant): Promise<void> =>
  /*
   * The whole read-modify-write is queued, not just the write. Two of these in flight would
   * otherwise both read the same list and the later one would discard the other's event.
   */
  serialise(async () => {
    try {
      const { value } = await readRaw();
      const next = withMostRecent(parseRecentTenants(value), entry);
      await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next));
      await AsyncStorage.removeItem(LEGACY_KEY);
    } catch {
      /* Nothing to do and nothing to say: the app works, it just will not remember. */
    }
  });
