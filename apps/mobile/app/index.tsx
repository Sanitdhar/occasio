import { useTheme } from '@occasio/ui';
import { ScaffoldScreen } from '../src/features/scaffold/ScaffoldScreen';
import { AppThemeProvider } from '../src/theme/AppThemeProvider';
import { FIXTURE_TENANT_THEME } from '../src/theme/inputs';

/** Reads the nearest theme and hands it to a screen that stays pure. */
function Scaffold() {
  return <ScaffoldScreen theme={useTheme()} />;
}

/**
 * Route files are adapters: they read params, compose providers, and render a screen.
 *
 * This one nests a second ThemeProvider, so the screen below renders under an event's theme
 * while the app around it stays on the console theme from the root layout. That is exactly the
 * mechanism the theme editor's live preview will use — and because it is a real route, the
 * visual gate screenshots it on every run.
 */
export default function IndexRoute() {
  return (
    <AppThemeProvider input={FIXTURE_TENANT_THEME}>
      <Scaffold />
    </AppThemeProvider>
  );
}
