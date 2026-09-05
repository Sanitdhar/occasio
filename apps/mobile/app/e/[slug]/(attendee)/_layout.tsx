import { Tabs } from 'expo-router';
import { FIXTURE_NAV, NON_TAB_ROUTES, planTabs } from '../../../../src/config/navigation';
import { useScaffoldTheme } from '../../../../src/theme/useScaffoldTheme';

/**
 * The attendee tab bar is generated from tenant config (D2), never hardcoded: a conference
 * switches gossips off, a wedding drops tasks, and neither is a code change.
 *
 * The route stays an adapter — the ordering and enabled/disabled logic lives in `planTabs`,
 * which is pure and tested. `<Tabs.Screen>` construction has to stay here rather than moving to
 * features/, because features are forbidden from importing expo-router (that ban is what keeps
 * screens renderable inside the theme editor's preview).
 */
export default function AttendeeTabsLayout() {
  const theme = useScaffoldTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        /* No icon set yet — without this react-navigation renders a default placeholder glyph,
           which looks like a rendering fault. Labels only until the design system lands. */
        tabBarIcon: () => null,
        tabBarActiveTintColor: theme.color.brand,
        tabBarInactiveTintColor: theme.color.textFaint,
        tabBarStyle: {
          backgroundColor: theme.color.surface,
          borderTopColor: theme.color.border,
        },
      }}
    >
      {planTabs(FIXTURE_NAV).map((tab) => (
        <Tabs.Screen
          key={tab.key}
          name={tab.name}
          options={tab.hidden ? { title: tab.title, href: null } : { title: tab.title }}
        />
      ))}
      {NON_TAB_ROUTES.map((name) => (
        <Tabs.Screen key={name} name={name} options={{ href: null }} />
      ))}
    </Tabs>
  );
}
