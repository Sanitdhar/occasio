import { Tabs } from 'expo-router';
import {
  FEATURE_KEYS,
  FIXTURE_NAV,
  TAB_ROUTES,
  visibleTabs,
} from '../../../../src/config/navigation';
import { useScaffoldTheme } from '../../../../src/theme/useScaffoldTheme';

/**
 * The attendee tab bar is generated from tenant config (D2), never hardcoded: a conference
 * switches gossips off, a wedding drops tasks, and neither is a code change.
 *
 * Tabs are declared for every configured feature and hidden — rather than omitted — when a
 * feature is off, because expo-router still needs the route to exist for deep links into it to
 * resolve rather than 404.
 */
export default function AttendeeTabsLayout() {
  const theme = useScaffoldTheme();
  const shown = visibleTabs(FIXTURE_NAV);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.color.brand,
        tabBarInactiveTintColor: theme.color.textFaint,
        tabBarStyle: {
          backgroundColor: theme.color.surface,
          borderTopColor: theme.color.border,
        },
      }}
    >
      {FEATURE_KEYS.map((key) => {
        const route = TAB_ROUTES[key];
        /* `href: null` hides a tab without removing the route, so a deep link into a disabled
           feature still resolves instead of 404ing. Options are built conditionally rather
           than passing `href: undefined`, which exactOptionalPropertyTypes rejects. */
        return (
          <Tabs.Screen
            key={key}
            name={route.name}
            options={
              shown.includes(key) ? { title: route.title } : { title: route.title, href: null }
            }
          />
        );
      })}
    </Tabs>
  );
}
