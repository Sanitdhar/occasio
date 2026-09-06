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

export const readRecentTenants = async (): Promise<RecentTenant[]> => {
  try {
    const { value, legacy } = await readRaw();
    const parsed = parseRecentTenants(value);
    /* Migrated on the spot rather than read through the old key forever — otherwise every read
       for the rest of this installation's life pays for a version nobody runs any more. */
    if (legacy && parsed.length > 0) {
      await serialise(async () => {
        await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(parsed));
        await AsyncStorage.removeItem(LEGACY_KEY);
      });
    }
    return parsed;
  } catch {
    /* Storage being unavailable is not worth failing a launch over — it costs the shortcut. */
    return [];
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
