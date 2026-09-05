import { resolveTheme, type ResolvedTheme, type Scheme, type ThemeInput } from '@occasio/theme';
import { createContext, useMemo, type ReactNode } from 'react';

/**
 * Supplies the resolved theme to a subtree.
 *
 * Deliberately takes `systemScheme` as a prop rather than calling React Native's
 * `useColorScheme()` itself. That keeps this component free of React Native, so it renders
 * anywhere — including in a plain React test and, later, in server-rendered web output. The app
 * reads the device scheme once at the root and passes it down.
 *
 * Nesting is the mechanism the theme editor's live preview depends on: wrapping a subtree in a
 * second provider re-themes exactly that subtree, so the editor renders the real screens under
 * a draft theme without duplicating a single component.
 */

export const ThemeContext = createContext<ResolvedTheme | null>(null);

type Props = {
  readonly input: ThemeInput;
  /** The device's scheme, for tenants that follow the system. */
  readonly systemScheme?: Scheme | undefined;
  /** Overrides everything — the editor's light/dark preview toggle. */
  readonly forceScheme?: Scheme | undefined;
  readonly reducedMotion?: boolean | undefined;
  readonly children: ReactNode;
};

export function ThemeProvider({
  input,
  systemScheme,
  forceScheme,
  reducedMotion,
  children,
}: Props) {
  const theme = useMemo(
    () => resolveTheme(input, { systemScheme, forceScheme, reducedMotion }),
    [input, systemScheme, forceScheme, reducedMotion],
  );

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}
