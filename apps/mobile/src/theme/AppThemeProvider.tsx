import type { Scheme, ThemeInput } from '@occasio/theme';
import { ThemeProvider } from '@occasio/ui';
import type { ReactNode } from 'react';
import { useDeviceScheme } from './useDeviceScheme';
import { useFontReadyInput } from './useTypeSetFonts';

type Props = {
  readonly input: ThemeInput;
  /** Overrides everything — the editor's light/dark preview toggle. */
  readonly forceScheme?: Scheme | undefined;
  readonly children: ReactNode;
};

/**
 * The app's own binding of `<ThemeProvider>`: it reads the device scheme and starts the theme's
 * fonts loading (#31), so neither is something a route layout has to remember.
 *
 * `ThemeProvider` itself stays free of React Native and of font loading on purpose — it has to
 * render in a plain React test and, later, in server-rendered web output. These two concerns
 * are platform-bound, so they live here, in the app, at every place a theme enters the tree.
 * Doing it here rather than at each of the four call sites is what stops the fifth provider
 * from silently shipping without fonts.
 */
export function AppThemeProvider({ input, forceScheme, children }: Props) {
  const systemScheme = useDeviceScheme();
  const fontReady = useFontReadyInput(input);

  return (
    <ThemeProvider input={fontReady} systemScheme={systemScheme} forceScheme={forceScheme}>
      {children}
    </ThemeProvider>
  );
}
