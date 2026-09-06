import * as Linking from 'expo-linking';
import { readRecentTenant } from './recentTenant';
import { firstResolved, slugFromPath, type TenantResolution } from './tenantResolution';

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
  const recent = await readRecentTenant();

  return firstResolved([
    ['link', initialUrl === null ? null : slugFromPath(pathOf(initialUrl))],
    ['recent', recent],
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
 * `occasio://e/lila-and-sam` and `https://occasio.app/e/lila-and-sam` have to reach the same
 * slug, and they parse differently: a custom scheme puts `e` in the host and `lila-and-sam` in
 * the path. `Linking.parse` normalises that, and its `path` is returned without a leading slash,
 * which `slugFromPath` would otherwise read as a first empty segment.
 */
const pathOf = (url: string): string => {
  try {
    const { path } = Linking.parse(url);
    return path === null ? '' : `/${path}`;
  } catch {
    return '';
  }
};
