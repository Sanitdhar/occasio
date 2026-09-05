import { describe, expect, it } from '@jest/globals';
import { imageAccessibility, scrimGeometry } from './imageFrame';

describe('imageAccessibility', () => {
  it('announces an image that has alternative text', () => {
    expect(imageAccessibility('The couple cutting the cake')).toEqual({
      accessible: true,
      accessibilityRole: 'image',
      accessibilityLabel: 'The couple cutting the cake',
      accessibilityElementsHidden: false,
      importantForAccessibility: 'yes',
    });
  });

  it('hides a decorative image rather than announcing an empty one', () => {
    const props = imageAccessibility(undefined);

    /* Empty rather than absent: expo-image maps accessibilityLabel to the web `alt` attribute,
       and `alt=""` is what removes an image from the accessibility tree. A missing attribute
       makes a screen reader read the file name instead. */
    expect(props.accessibilityLabel).toBe('');
    expect(props.accessible).toBe(false);
    expect(props.accessibilityElementsHidden).toBe(true);
    expect(props.importantForAccessibility).toBe('no-hide-descendants');
    expect(props.accessibilityRole).toBeUndefined();
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
