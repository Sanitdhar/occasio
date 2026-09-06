import { afterAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { hasOverlay, imageAccessibility, scrimGeometry } from './imageFrame';

describe('imageAccessibility', () => {
  /* The warnings are the point of half these cases, so they are captured rather than printed:
     an assertion that a defect was reported is what stops the reporting from being dropped in
     a later refactor, and a silent test run is worth having on its own. */
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

  beforeEach(() => {
    warn.mockClear();
  });

  afterAll(() => {
    warn.mockRestore();
  });

  it('announces an image that has alternative text', () => {
    expect(imageAccessibility('The couple cutting the cake', false)).toEqual({
      accessible: true,
      accessibilityRole: 'image',
      accessibilityLabel: 'The couple cutting the cake',
      accessibilityElementsHidden: false,
      importantForAccessibility: 'yes',
    });
    expect(warn).not.toHaveBeenCalled();
  });

  it('hides a decorative image rather than announcing an empty one', () => {
    const props = imageAccessibility(undefined, true);

    /* Empty rather than absent: expo-image maps accessibilityLabel to the web `alt` attribute,
       and `alt=""` is what removes an image from the accessibility tree. A missing attribute
       makes a screen reader read the file name instead. */
    expect(props.accessibilityLabel).toBe('');
    expect(props.accessible).toBe(false);
    expect(props.accessibilityElementsHidden).toBe(true);
    expect(props.importantForAccessibility).toBe('no-hide-descendants');
    expect(props.accessibilityRole).toBeUndefined();

    /* Declaring an image decorative is a decision, not a mistake, so it is the one hiding path
       that must stay quiet. A warning here would train people to ignore the others. */
    expect(warn).not.toHaveBeenCalled();
  });

  it('reports an empty `alt` instead of silently hiding the photograph', () => {
    /* How an empty caption field arrives: `alt={caption}` where the admin left it blank. The
       types cannot catch it — `''` is a string — and the result is a photograph that a screen
       reader never mentions, which is indistinguishable from the image not being there. */
    const props = imageAccessibility('', false);

    expect(props.accessible).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain('empty string');
  });

  it('reports an image that was given neither `alt` nor `decorative`', () => {
    /* Unreachable from TypeScript and entirely reachable from a JavaScript caller or a prop bag
       that came out of `JSON.parse`. The image is still hidden — that is the safe default for a
       frame that is about to render — but it is hidden loudly. */
    const props = imageAccessibility(undefined, false);

    expect(props.accessible).toBe(false);
    expect(props.accessibilityElementsHidden).toBe(true);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain('neither');
  });

  it('describes the image when it is given both, and says so', () => {
    /* A contradiction resolved toward the reader who cannot see the picture. Silently honouring
       `decorative` would drop a description someone actually wrote. */
    const props = imageAccessibility('The ceremony arch', true);

    expect(props.accessibilityLabel).toBe('The ceremony arch');
    expect(props.accessible).toBe(true);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain('both');
  });
});

describe('hasOverlay', () => {
  it('counts anything React will actually paint', () => {
    expect(hasOverlay('A caption')).toBe(true);
    expect(hasOverlay(0)).toBe(true);
    expect(hasOverlay([])).toBe(true);
  });

  it('does not count the values a JSX conditional collapses to', () => {
    /* The reason this function exists. `{title && <Text />}` is `false` when the title is empty
       and `{caption ?? null}` is `null` — React paints nothing for either, so a scrim and an
       empty overlay over a bare photograph would be the visible cost of checking only for
       `undefined`. */
    expect(hasOverlay(undefined)).toBe(false);
    expect(hasOverlay(null)).toBe(false);
    expect(hasOverlay(false)).toBe(false);
    expect(hasOverlay(true)).toBe(false);
  });
});

describe('scrimGeometry', () => {
  const gradient = ['#00000000', '#2A0F1CC7'] as const;

  it('renders nothing at all when there is no scrim', () => {
    expect(scrimGeometry(gradient, 'none')).toBeNull();
  });

  it('passes the theme gradient through untouched', () => {
    /* The colours are the tenant's — tinted toward the brand by the resolver — and this file
       only decides the direction. A scrim that mixed in its own colour would put a second,
       untenanted palette on top of every photograph. */
    expect(scrimGeometry(gradient, 'bottom')?.colors).toBe(gradient);
    expect(scrimGeometry(gradient, 'top')?.colors).toBe(gradient);
  });

  it('ramps toward the bottom edge for text sitting at the bottom', () => {
    const geometry = scrimGeometry(gradient, 'bottom');

    expect(geometry?.start).toEqual({ x: 0.5, y: 0 });
    expect(geometry?.end).toEqual({ x: 0.5, y: 1 });
  });

  it('ramps toward the top edge for text sitting at the top', () => {
    const geometry = scrimGeometry(gradient, 'top');

    expect(geometry?.start).toEqual({ x: 0.5, y: 1 });
    expect(geometry?.end).toEqual({ x: 0.5, y: 0 });
  });

  it('leaves the subject of the photograph alone and covers the same share of either edge', () => {
    const bottom = scrimGeometry(gradient, 'bottom');
    const top = scrimGeometry(gradient, 'top');

    /* Both are measured along their own axis, so identical locations mean identical coverage
       of opposite edges — a top scrim and a bottom scrim are the same weight of overlay. */
    expect(bottom?.locations).toEqual(top?.locations);

    const [onset, full] = bottom?.locations ?? [];
    expect(onset).toBeGreaterThan(0.5);
    expect(onset).toBeLessThan(full ?? 0);
    expect(full).toBe(1);
  });
});
