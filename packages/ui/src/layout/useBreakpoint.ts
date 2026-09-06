import { useWindowDimensions } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { breakpointFor, type Breakpoint } from './breakpoints';

/**
 * The current breakpoint, from the window and the tenant's thresholds.
 *
 * A hook rather than a context value because `useWindowDimensions` already subscribes to
 * changes: a provider would be a second source of the same fact, and the two would disagree for
 * a frame on every rotation.
 */
export const useBreakpoint = (): Breakpoint => {
  const { width } = useWindowDimensions();
  const theme = useTheme();
  return breakpointFor(width, theme.layout.breakpoints);
};
