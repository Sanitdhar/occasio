import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  parseRecentTenants,
  withMostRecent,
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

export const readRecentTenants = async (): Promise<RecentTenant[]> => {
  try {
    return parseRecentTenants(await AsyncStorage.getItem(RECENT_KEY));
  } catch {
    /* Storage being unavailable is not worth failing a launch over — it costs the shortcut. */
    return [];
  }
};

export const rememberTenant = async (entry: RecentTenant): Promise<void> => {
  try {
    const next = withMostRecent(await readRecentTenants(), entry);
    await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* Nothing to do and nothing to say: the app works, it just will not remember. */
  }
};
