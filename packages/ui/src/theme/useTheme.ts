import type { ResolvedTheme } from '@occasio/theme';
import { useContext } from 'react';
import { ThemeContext } from './ThemeProvider';

/**
 * The resolved theme for the nearest provider.
 *
 * Throws rather than falling back to a default: a component rendering with silently wrong
 * colours is far harder to notice than one that fails immediately. The error boundary is the
 * deliberate exception — it resolves a theme directly, because a boundary that depends on a
 * provider is useless when that provider is what failed.
 */
export const useTheme = (): ResolvedTheme => {
  const theme = useContext(ThemeContext);
  if (theme === null) {
    throw new Error(
      'useTheme() was called outside a <ThemeProvider>. Wrap the subtree, or resolve a theme directly if this is an error boundary.',
    );
  }
  return theme;
};
