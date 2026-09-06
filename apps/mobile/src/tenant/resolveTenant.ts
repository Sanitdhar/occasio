import * as Linking from 'expo-linking';
import { readRecentTenants } from './recentTenants';
import {
  firstResolved,
  pathFromLink,
  slugFromPath,
  type TenantResolution,
} from './tenantResolution';

/**
 * Native: the deep link it was opened with, then where this device was last.
 *
 * There is no hostname to read and no URL bar to type into, so these are the only two things the
 * platform can say. A link the person just followed beats the event they happened to open last
 * week, which is the whole of the ordering.
 *
 * When neither answers, the result is `unresolved` rather than an error — a first launch with no
 * link is the ordinary case, and it is what the join-by-code screen (#41) exists for.
 */
export const resolveTenant = async (): Promise<TenantResolution> => {
  const initialUrl = await readInitialUrl();
  /* The head of the list: where this device was last. The rest of it is the join
     screen's picker, which is the same data made visible. */
  const [recent] = await readRecentTenants();

  return firstResolved([
    ['link', initialUrl === null ? null : slugFromPath(pathOf(initialUrl))],
    ['recent', recent?.slug ?? null],
  ]);
};

/** A cold launch with no link resolves to `null`; a failure here must read the same way. */
const readInitialUrl = async (): Promise<string | null> => {
  try {
    return await Linking.getInitialURL();
  } catch {
    return null;
  }
};

/**
 * The path part of a deep link, however the link was spelled.
 *
 * The parsing belongs to expo-linking and the rule about what the parts mean belongs to
 * `pathFromLink`, where it can be run without the native linking runtime. Keeping them apart is
 * the point: the rule was wrong in its first version, and there was nowhere to notice.
 */
const pathOf = (url: string): string => {
  try {
    return pathFromLink(Linking.parse(url));
  } catch {
    return '';
  }
};
