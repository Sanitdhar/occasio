import { resolveTheme } from '@occasio/theme';
import { ThemeProvider } from '@occasio/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorFallback } from '../src/features/errors/ErrorFallback';
import { APP_THEME } from '../src/theme/inputs';
import { useDeviceScheme } from '../src/theme/useDeviceScheme';

/**
 * Query defaults tuned for an event, not a dashboard.
 *
 * Attendees are standing in venues with bad signal, so a failed request retries twice rather
 * than giving up immediately, and data stays fresh for a minute so moving between the schedule
 * and a session does not refetch on every tap. Refetch-on-focus is off: a phone coming out of a
 * pocket should show what it already has, instantly.
 */
const queryDefaults = {
  queries: {
    staleTime: 60_000,
    gcTime: 30 * 60_000,
    retry: 2,
    refetchOnWindowFocus: false,
  },
} as const;

/**
 * expo-router renders this instead of the white screen of death when a route throws.
 *
 * It resolves a theme directly because `<ThemeProvider>` does not exist yet (#22) — and because
 * an error boundary that depends on a provider is useless exactly when that provider is what
 * failed. This one keeps working regardless.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const theme = resolveTheme(APP_THEME, { forceScheme: 'light' });
  return (
    <SafeAreaProvider>
      <ErrorFallback
        theme={theme}
        /* expo-router's retry() is async; the fallback wants a void handler, and letting the
           promise float would swallow a second failure silently. */
        onRetry={() => void retry()}
        error={error}
        showDetail={__DEV__}
      />
    </SafeAreaProvider>
  );
}

/**
 * The root layout composes providers and nothing else — no data fetching, no business logic.
 *
 * Providers arrive as their epics land: the theme provider with #22, tenant resolution and
 * session with the v0.2 milestone. Screens stay pure so the theme editor can render them under
 * an overridden provider later.
 */
export default function RootLayout() {
  // Created once per app instance rather than per render, so the cache is not thrown away.
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: queryDefaults }));
  /* Read once, here. ThemeProvider takes the scheme as a prop so it stays free of React Native
     and can render in a plain React test or in server-rendered web output. */
  const systemScheme = useDeviceScheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider input={APP_THEME} systemScheme={systemScheme}>
          <SafeAreaProvider>
            <StatusBar style="auto" />
            <Stack screenOptions={{ headerShown: false }} />
          </SafeAreaProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
