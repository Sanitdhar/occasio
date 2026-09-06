import { type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { LayoutViewStyle } from '../components/layoutStyle';
import { createStyles } from '../theme/createStyles';
import { useTheme } from '../theme/useTheme';

/**
 * The frame every screen sits in: safe area, a maximum line length, and a centred column.
 *
 * The centring is the part that matters and the part that is easy to leave out. Without it a
 * phone layout on a desktop browser is a single column stretched to 1600 pixels, where the eye
 * cannot find the start of the next line — and it looks *finished*, so nobody files it.
 * `theme.layout.maxContentWidth` is the tenant's, because an editorial preset wants a narrower
 * measure than a conference schedule.
 *
 * Safe area comes from the provider rather than from constants: a notch is not a number anyone
 * should be typing, and the value differs between a phone, a tablet in landscape and a browser.
 */

type Props = {
  readonly children: ReactNode;
  /**
   * Scrolls by default, because most screens are longer than a phone. `false` is for a screen
   * that manages its own scrolling — a list, a map — where nesting two scroll views produces a
   * subtly broken one.
   */
  readonly scroll?: boolean;
  /** Horizontal breathing room. Off for a screen whose children are full-bleed images. */
  readonly padded?: boolean;
  readonly testID?: string;
  readonly style?: LayoutViewStyle | undefined;
};

const useStyles = createStyles((t) => ({
  fill: { flex: 1, backgroundColor: t.color.bg },
  /* `alignItems: center` is what centres the column; `width: 100%` with a max is what keeps it
     from collapsing to its content on a wide window. */
  centre: { alignItems: 'center' },
  column: { width: '100%', maxWidth: t.layout.maxContentWidth },
  padded: { paddingHorizontal: t.space(4) },
  grow: { flexGrow: 1 },
}));

export function Screen({ children, scroll = true, padded = true, testID, style }: Props) {
  const styles = useStyles();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  /* Insets are applied here rather than by each screen so that a screen added later cannot
     forget them — which on a notched phone means text under the notch. */
  const safeArea = {
    paddingTop: insets.top,
    paddingBottom: insets.bottom,
    paddingLeft: insets.left,
    paddingRight: insets.right,
  };

  const column = (
    <View style={[styles.column, padded ? styles.padded : null, style]}>{children}</View>
  );

  if (!scroll) {
    return (
      <View style={[styles.fill, safeArea]} testID={testID}>
        <View style={[styles.grow, styles.centre]}>{column}</View>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.fill]}
      contentContainerStyle={[styles.grow, styles.centre, safeArea]}
      /* The scrollbar belongs to the window on web, and a second one inside the column reads as
         a nested pane rather than a page. */
      showsVerticalScrollIndicator={false}
      testID={testID}
      /* Keyboard dismissal on drag is the behaviour a form screen wants and a reader never
         notices, and setting it once here is cheaper than remembering it per screen. */
      keyboardDismissMode={theme.motion.enabled ? 'on-drag' : 'none'}
    >
      {column}
    </ScrollView>
  );
}
