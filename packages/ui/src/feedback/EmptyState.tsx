import { type ReactNode } from 'react';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { createStyles } from '../theme/createStyles';

/**
 * What a list says when it is empty on purpose.
 *
 * Distinct from a skeleton, which says "not yet", and from the error fallback, which says
 * "something broke". This one says "nothing here, and here is what to do about it" — and the
 * last clause is the part that gets skipped. An empty gossips board that only reads "No posts
 * yet" is a dead end at an event where the whole point is that an attendee can post one.
 *
 * The illustration and the action are slots rather than typed props: what fills them is an
 * image for one event and an icon for another, and a button here, a link there. Taking a
 * `ReactNode` keeps this component from owning either decision, and keeps this file from
 * depending on the button component to render an empty list.
 */

type Props = {
  /**
   * Decorative only — it is hidden from screen readers, because the title and message already
   * carry the meaning and a described picture of nothing is noise. Anything load-bearing
   * belongs in `title` or `message`.
   */
  readonly illustration?: ReactNode;
  /** The state, in the attendee's words: "No photos yet", not "Empty". */
  readonly title: string;
  /** Why it is empty, or what fills it. One sentence. */
  readonly message?: string | undefined;
  /** The one thing to do about it. Omitted when there genuinely is nothing to do. */
  readonly action?: ReactNode;
  readonly style?: StyleProp<ViewStyle> | undefined;
};

const useStyles = createStyles((t) => ({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: t.space(12),
    paddingHorizontal: t.space(6),
    gap: t.space(3),
  },
  title: { ...t.type.title2, color: t.color.text, textAlign: 'center' },
  /* Capped rather than left to the container: an empty state is one sentence, and one sentence
     across the full width of a tablet is a line nobody's eye can track back from. */
  message: { ...t.type.body, color: t.color.textMuted, textAlign: 'center', maxWidth: t.space(80) },
  action: { marginTop: t.space(2) },
}));

export function EmptyState({ illustration, title, message, action, style }: Props) {
  const styles = useStyles();

  return (
    <View style={[styles.root, style]}>
      {illustration === undefined ? null : (
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {illustration}
        </View>
      )}
      {/* `header` rather than nothing: it is how a screen reader user skims to "what is this
          screen showing me", which for an empty list is the only content there is. */}
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      {message === undefined ? null : <Text style={styles.message}>{message}</Text>}
      {action === undefined ? null : <View style={styles.action}>{action}</View>}
    </View>
  );
}
