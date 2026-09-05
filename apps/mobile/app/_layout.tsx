import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

/**
 * The root layout is an adapter, not a screen: it composes providers and hands off to routes.
 *
 * Providers arrive as their epics land — the theme provider with #22, tenant resolution with
 * the tenancy epic, session with identity. Screens stay pure so the theme editor can render
 * them under an overridden provider later.
 */
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaProvider>
  );
}
