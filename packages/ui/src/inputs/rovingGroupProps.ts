import type { ReactNode } from 'react';

/**
 * The shape both RovingGroup variants take.
 *
 * In its own module because the platform split makes the obvious alternative circular: on web,
 * `./RovingGroup` resolves to `RovingGroup.web.tsx`, so the web file importing the type from
 * "the other one" would import itself.
 */
export type RovingGroupProps = {
  /** How many options the group holds. */
  readonly count: number;
  /** Which option is selected — the one that is Tab-reachable. */
  readonly index: number;
  /** Called when a key moves the selection. The caller re-renders with the new index. */
  readonly onMove: (next: number) => void;
  readonly disabled?: boolean | undefined;
  readonly children: ReactNode;
};
