import { type ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { withAlpha } from '@occasio/theme';
import { createStyles } from '../theme/createStyles';
import { toElevationStyle } from '../theme/elevation';
import { useTheme } from '../theme/useTheme';

/**
 * A panel that comes up from the bottom for one focused task: composing a post, editing a
 * session, picking a table.
 *
 * Two things it must get right, and both are invisible until they are wrong.
 *
 * **The keyboard.** A sheet with a text field in it is the one place a keyboard reliably covers
 * the thing being typed into. `KeyboardAvoidingView` needs opposite behaviours per platform —
 * `padding` on iOS, `height` on Android — which is exactly the kind of detail a screen author
 * gets wrong once and copies four times.
 *
 * **The bottom inset.** A sheet is flush with the bottom of the screen, so on a phone with a
 * gesture bar its last control sits under the bar unless the inset is added. It is the control
 * people reach for, because it is the one at the bottom.
 */

type Props = {
  readonly visible: boolean;
  /** Called for the backdrop, the hardware back button and the escape key alike. */
  readonly onDismiss: () => void;
  /** Names the sheet for a screen reader. A sheet without one is announced as "dialog". */
  readonly label: string;
  readonly children: ReactNode;
  readonly testID?: string | undefined;
};

/** Enough to push the page back without hiding what the sheet is about. */
const SCRIM_ALPHA = 0.45;

const useStyles = createStyles((t) => ({
  /*
   * Derived from the tenant's own darkest neutral rather than a literal black.
   *
   * My first version hardcoded `rgba(0, 0, 0, 0.45)` with a comment arguing a scrim is not a
   * palette colour — which is the reasoning D17's lint rule exists to refuse, and it refused
   * it. A flat black behind a warm-neutral wedding reads as a different product's dialog; the
   * ramp's dark end carries the tenant's tint, so the darkening belongs to the event.
   */
  backdrop: {
    flex: 1,
    backgroundColor: withAlpha(t.color.ramp.neutral[11], SCRIM_ALPHA),
    justifyContent: 'flex-end',
  },
  panel: {
    backgroundColor: t.color.surfaceRaised,
    borderTopLeftRadius: t.radius.lg,
    borderTopRightRadius: t.radius.lg,
    maxHeight: '90%',
  },
  content: { paddingHorizontal: t.space(4), paddingTop: t.space(4), gap: t.space(3) },
  /* The handle is decoration and is hidden from the accessibility tree: announcing it says
     "image" where the sheet's own label should be read. */
  handle: {
    alignSelf: 'center',
    width: t.space(10),
    height: t.space(1),
    borderRadius: t.radius.pill,
    backgroundColor: t.color.border,
    marginTop: t.space(2),
  },
}));

export function Sheet({ visible, onDismiss, label, children, testID }: Props) {
  const styles = useStyles();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType={theme.motion.enabled ? 'slide' : 'none'}
      /* Android's hardware back and the web's escape key both arrive here, so a sheet cannot be
         dismissed by one route and not the other. */
      onRequestClose={onDismiss}
      testID={testID}
    >
      <KeyboardAvoidingView
        /* Opposite behaviours per platform: iOS insets the view, Android resizes it. Using one
           for both leaves the field under the keyboard on whichever platform was not tested. */
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.backdrop}
      >
        <Pressable
          /* The backdrop dismisses, and is hidden from assistive technology: a screen reader
             user leaves a dialog with its own affordance, not by tapping the page behind it. */
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          /* react-native-web gives an enabled Pressable `tabIndex={0}`, so without this the
             first Tab inside a sheet lands on an invisible element that announces nothing. */
          tabIndex={-1}
          /*
           * The one Pressable in this package with no hover or pressed fill, deliberately.
           *
           * The house rule that every pressable shows its four states is about controls, and
           * this is not one — it is the scrim, and it is the size of the screen. A hover tint
           * on it means the page behind the sheet changes shade whenever the pointer moves;
           * a pressed fill means the whole screen flashes on the way to dismissing. That is
           * not feedback, it is the background misbehaving. What acknowledges the tap is the
           * sheet leaving.
           */
          style={styles.backdrop}
          onPress={onDismiss}
        />

        <View
          role="dialog"
          aria-modal
          aria-label={label}
          /*
           * The VoiceOver two-finger scrub, so an iOS user whose sheet has no visible close
           * control is not stuck inside it. The backdrop cannot rescue them — it is
           * deliberately hidden from the accessibility tree.
           *
           * Deliberately *without* `accessible`. The first version had it, on the theory that
           * the prop needs an accessibility element to land on; what `accessible` actually does
           * on a container is merge it and everything under it into one element, which would
           * hide the sheet's own fields and buttons from VoiceOver and TalkBack — turning a
           * missing escape gesture into a sheet whose contents cannot be reached at all. UIKit
           * passes `accessibilityPerformEscape` up the view hierarchy from whatever has focus,
           * so the handler is found here without this view being an element itself.
           *
           * Not covered by the component tests: react-native-web has no equivalent grouping, so
           * this is a native-only behaviour that the device pass owns.
           */
          onAccessibilityEscape={onDismiss}
          style={[styles.panel, toElevationStyle(theme.elevation.lg)]}
        >
          <View aria-hidden style={styles.handle} />
          <ScrollView
            /* The sheet scrolls rather than the page behind it, and taps outside a field still
               dismiss the keyboard — the gesture people expect from a sheet. */
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[
              styles.content,
              { paddingBottom: insets.bottom + theme.space(4) },
            ]}
          >
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
