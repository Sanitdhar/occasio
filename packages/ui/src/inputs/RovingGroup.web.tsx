import { useRef, type CSSProperties, type KeyboardEvent } from 'react';
import { nextIndexForKey } from './segmentedKeys';
import type { RovingGroupProps } from './rovingGroupProps';

/**
 * Web: gives a radio group the keyboard behaviour its role promises.
 *
 * A `radiogroup` is one Tab stop, not one per option: Tab enters the group at the selected
 * option and leaves the group entirely, and the arrow keys move within it. That is the whole
 * reason to claim the role rather than render a row of buttons, and a group that claims it and
 * ignores the arrow keys is worse than one that never claimed it — a keyboard user is told the
 * behaviour is there and finds it is not.
 *
 * `display: contents` so the wrapper carries the handler without entering layout, the same
 * trick ThemeScope.web.tsx uses for CSS variables. Key events bubble along the DOM tree rather
 * than the layout tree, so the segments' keydowns arrive here regardless.
 */

const CONTENTS: CSSProperties = { display: 'contents' };

/**
 * Focus the nth radio under `root`.
 *
 * Read from the DOM rather than held as refs because that is where the answer is: the segments
 * are rendered by react-native-web, and what takes focus is the element it produced. An
 * `instanceof` check rather than a typed `querySelectorAll` — the narrowing is then real, and a
 * node that turns out not to be focusable is skipped instead of throwing.
 */
const focusOption = (root: HTMLElement | null, index: number): void => {
  if (root === null) return;
  const node = root.querySelectorAll('[role="radio"]').item(index);
  if (node instanceof HTMLElement) node.focus();
};

export function RovingGroup({
  count,
  index,
  onMove,
  disabled = false,
  children,
}: RovingGroupProps) {
  const root = useRef<HTMLDivElement | null>(null);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (disabled) return;

    const next = nextIndexForKey(event.key, index, count);
    /* Null means the key is not ours. Leaving it alone is what keeps Tab leaving the group and
       leaves the browser its own shortcuts; a widget that swallows every key is a focus trap. */
    if (next === null) return;

    /* Arrow keys scroll the page by default, which would drag the group off screen as somebody
       moved through it. */
    event.preventDefault();

    /*
     * Focus is moved by hand rather than left to the roving `tabIndex`. Which option carries
     * `tabIndex={0}` decides where the *next* Tab lands; it does not move a caret already
     * inside the group, so without this the selection would walk while focus stayed behind.
     *
     * Unconditionally, and before the change: every option is already mounted, so the element
     * exists whether or not the selection moves, and `Home` pressed on the first option should
     * still pull focus back to it. Focusing an element whose `tabIndex` is -1 is allowed — that
     * attribute governs Tab, not `focus()` — and the re-render then makes it the Tab stop.
     */
    focusOption(root.current, next);
    if (next !== index) onMove(next);
  };

  return (
    <div ref={root} style={CONTENTS} onKeyDown={onKeyDown}>
      {children}
    </div>
  );
}
