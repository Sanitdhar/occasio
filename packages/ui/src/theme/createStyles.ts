import type { ResolvedTheme } from '@occasio/theme';
import { useMemo } from 'react';
import { StyleSheet, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native';
import { createStyleCache } from './styleCache';
import { useTheme } from './useTheme';

type Style = ViewStyle | TextStyle | ImageStyle;
type NamedStyles<T> = { readonly [K in keyof T]: Style };

/**
 * Builds a stylesheet from theme tokens, once per theme.
 *
 * Usage:
 *
 *   const useStyles = createStyles((t) => ({
 *     card: { backgroundColor: t.color.surfaceRaised, padding: t.space(4) },
 *   }));
 *
 * The cache is per-factory and bounded (see styleCache), so a colour-picker drag through
 * hundreds of intermediate themes retains only the last few.
 */
export const createStyles = <T extends NamedStyles<T>>(factory: (theme: ResolvedTheme) => T) => {
  const cache = createStyleCache<T>();

  return function useStyles(): T {
    const theme = useTheme();
    return useMemo(() => cache.get(theme.id, () => StyleSheet.create(factory(theme))), [theme]);
  };
};
