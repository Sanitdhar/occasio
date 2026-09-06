import AsyncStorage from '@react-native-async-storage/async-storage';
import { isSlug } from './tenantResolution';

/**
 * Native: the last event this device opened.
 *
 * There is no URL bar to read, so without this a returning attendee lands on a join screen
 * holding a code they were given once, weeks ago — the app forgetting where it was every time it
 * is closed. It is the second source native tries, behind a deep link, because a link the person
 * just followed is a stronger statement of intent than where they happened to be last.
 *
 * `AsyncStorage` rather than something securable: a slug is public — it is in the URL on web —
 * so this is a convenience, not a credential. The web implementation is in recentTenant.web.ts.
 */

const KEY = 'occasio.recentTenant';

/**
 * Reads are validated, not trusted.
 *
 * What comes back was written by an older build of this app, or by a hand-edited simulator
 * store, and it is about to become a path segment. Treating a bad value as absent lands on the
 * join screen, which is recoverable; passing it on is a request built from whatever was in
 * storage.
 */
export const readRecentTenant = async (): Promise<string | null> => {
  try {
    const stored = await AsyncStorage.getItem(KEY);
    return stored !== null && isSlug(stored) ? stored : null;
  } catch {
    /* Storage being unavailable is not worth failing a launch over — it costs the shortcut. */
    return null;
  }
};

export const writeRecentTenant = async (slug: string): Promise<void> => {
  if (!isSlug(slug)) return;
  try {
    await AsyncStorage.setItem(KEY, slug);
  } catch {
    /* Nothing to do and nothing to say: the app works, it just will not remember. */
  }
};
