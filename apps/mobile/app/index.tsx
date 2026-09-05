import { resolveTheme, themeInputFromPreset } from '@occasio/theme';
import { ScaffoldScreen } from '../src/features/scaffold/ScaffoldScreen';

/**
 * Route files are adapters: they read params, compose providers, and render a screen.
 *
 * Resolving the theme here stands in for `<ThemeProvider>`, which arrives with #22. Once it
 * exists this becomes a provider wrapping the same screen, and the screen itself does not
 * change — which is the point of keeping it pure.
 */
export default function IndexRoute() {
  const theme = resolveTheme(themeInputFromPreset('romantic', '#7C3A5A'), {
    forceScheme: 'light',
  });

  return <ScaffoldScreen theme={theme} />;
}
