import { describe, expect, it } from '@jest/globals';
import { atLeast, breakpointFor, BREAKPOINT_NAMES } from './breakpoints';

const BREAKPOINTS = { sm: 480, md: 768, lg: 1024 } as const;

describe('breakpointFor', () => {
  it('calls a phone the base, which is the layout that works everywhere', () => {
    expect(breakpointFor(320, BREAKPOINTS)).toBe('base');
    expect(breakpointFor(479, BREAKPOINTS)).toBe('base');
  });

  it('includes the threshold itself', () => {
    /* `md: 768` means 768 is md, which is what a designer means and what CSS does. A device
       sitting exactly on a boundary sits there forever, so an off-by-one here is permanent for
       that device rather than intermittent. */
    expect(breakpointFor(480, BREAKPOINTS)).toBe('sm');
    expect(breakpointFor(768, BREAKPOINTS)).toBe('md');
    expect(breakpointFor(1024, BREAKPOINTS)).toBe('lg');
  });

  it('picks the widest one reached, not the first one passed', () => {
    /* Ordered checks are easy to write smallest-first, which returns `sm` for a desktop. */
    expect(breakpointFor(1600, BREAKPOINTS)).toBe('lg');
    expect(breakpointFor(900, BREAKPOINTS)).toBe('md');
  });

  it('survives a zero or absurd width rather than returning nothing', () => {
    /* `useWindowDimensions` reports 0 for one frame during some rotations, and a component that
       rendered `undefined` for that frame would flash. */
    expect(breakpointFor(0, BREAKPOINTS)).toBe('base');
    expect(breakpointFor(99_999, BREAKPOINTS)).toBe('lg');
  });
});

describe('atLeast', () => {
  it('answers the question a component actually asks', () => {
    expect(atLeast('md', 'md')).toBe(true);
    expect(atLeast('lg', 'md')).toBe(true);
    expect(atLeast('sm', 'md')).toBe(false);
    expect(atLeast('base', 'sm')).toBe(false);
  });

  it('is true of the base for the base', () => {
    expect(atLeast('base', 'base')).toBe(true);
  });

  it('orders every named breakpoint below the one after it', () => {
    /* The order is the whole mechanism; a list that stopped being sorted would make `atLeast`
       quietly wrong rather than fail. */
    const all = ['base', ...BREAKPOINT_NAMES] as const;
    for (let i = 0; i < all.length - 1; i += 1) {
      const smaller = all[i];
      const larger = all[i + 1];
      if (smaller === undefined || larger === undefined) throw new Error('bad fixture');
      expect(atLeast(larger, smaller)).toBe(true);
      expect(atLeast(smaller, larger)).toBe(false);
    }
  });
});
