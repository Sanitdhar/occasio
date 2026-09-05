import type { Scheme } from '@occasio/theme';
import { useColorScheme } from 'react-native';

/**
 * The device's colour scheme, narrowed to what the theming engine accepts.
 *
 * React Native's `useColorScheme()` can return `null` or `'unspecified'` as well as light and
 * dark. Those mean "no preference", which is not a scheme — `undefined` lets the tenant's own
 * default decide, which is the correct behaviour rather than guessing light.
 */
export const useDeviceScheme = (): Scheme | undefined => {
  const scheme = useColorScheme();
  return scheme === 'light' || scheme === 'dark' ? scheme : undefined;
};
