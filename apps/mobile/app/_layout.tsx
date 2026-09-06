import { resolveTheme } from '@occasio/theme';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppAdapterProvider } from '../src/data/AppAdapterProvider';
import { ErrorFallback } from '../src/features/errors/ErrorFallback';
import { AppAuthProvider } from '../src/auth/AppAuthProvider';
import { TenantProvider } from '../src/tenant/TenantProvider';
import { AppThemeProvider } from '../src/theme/AppThemeProvider';
import { APP_THEME } from '../src/theme/inputs';

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
 * Providers arrive as their epics land: the theme provider with #22, tenant resolution with
 * #39, session with the rest of the v0.2 milestone. Screens stay pure so the theme editor can
 * render them under an overridden provider later.
 */
export default function RootLayout() {
  // Created once per app instance rather than per render, so the cache is not thrown away.
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: queryDefaults }));

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <AppAuthProvider>
          <AppAdapterProvider>
            {/* No slug: the root is where the platform gets asked, once. Inside /e/[slug] the
              route already knows, and its own provider says so rather than resolving again. */}
            <TenantProvider>
              <AppThemeProvider input={APP_THEME}>
                <SafeAreaProvider>
                  <StatusBar style="auto" />
                  <Stack screenOptions={{ headerShown: false }} />
                </SafeAreaProvider>
              </AppThemeProvider>
            </TenantProvider>
          </AppAdapterProvider>
        </AppAuthProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
