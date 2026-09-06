import type { RovingGroupProps } from './rovingGroupProps';

/**
 * Native (and the default): a pass-through.
 *
 * Arrow-key traversal of a radio group is a keyboard behaviour, and on iOS and Android the
 * keyboard belongs to the platform: VoiceOver and TalkBack move between radios with their own
 * gestures, which they can do because the roles are announced correctly. There is nothing for
 * this component to add there, and a `View` wrapper would add a layout node for nothing.
 *
 * The web variant lives in RovingGroup.web.tsx; Metro and Jest both pick it automatically.
 */
export function RovingGroup({ children }: RovingGroupProps) {
  return <>{children}</>;
}
