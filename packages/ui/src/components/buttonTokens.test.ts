import { describe, expect, it } from '@jest/globals';
import { contrast, resolveTheme, themeInputFromPreset } from '@occasio/theme';
import {
  BUTTON_STATES,
  BUTTON_VARIANTS,
  buttonPalette,
  focusOriginAfterPointerDown,
  resolveButtonState,
  showsFocusRing,
} from './buttonTokens';
import { everyTheme } from './themeMatrix.fixture';

describe('resolveButtonState', () => {
  it('paints rest when nothing is happening', () => {
    expect(resolveButtonState({ disabled: false, hovered: false, pressed: false })).toBe('rest');
  });

  it('paints hover for a pointer that is over but not down', () => {
    expect(resolveButtonState({ disabled: false, hovered: true, pressed: false })).toBe('hover');
  });

  it('lets pressed win over hover, because a press is always also a hover', () => {
    expect(resolveButtonState({ disabled: false, hovered: true, pressed: true })).toBe('pressed');
  });

  it('lets disabled win over everything', () => {
    /* A disabled button still receives hover on the web — the pointer really is over it. If
       hover won, an unusable control would light up as though it could be clicked. */
    expect(resolveButtonState({ disabled: true, hovered: true, pressed: true })).toBe('disabled');
  });
});

describe('showsFocusRing', () => {
  it('shows the ring for keyboard focus', () => {
    expect(showsFocusRing('keyboard', false)).toBe(true);
  });

  it('stays hidden for focus that came from a click', () => {
    /* mousedown focuses the element on the web, so a ring on every focus flashes up after an
       ordinary click. This is the `:focus-visible` behaviour Pressable does not expose. */
    expect(showsFocusRing('pointer', false)).toBe(false);
  });

  it('stays hidden when blurred', () => {
    expect(showsFocusRing('blurred', false)).toBe(false);
  });

  it('stays hidden on a disabled button that somehow holds focus', () => {
    expect(showsFocusRing('keyboard', true)).toBe(false);
  });
});

describe('buttonPalette', () => {
  it('defines every state of every variant', () => {
    const palette = buttonPalette(resolveTheme(themeInputFromPreset('editorial', '#7C3A5A')));

    for (const variant of BUTTON_VARIANTS) {
      expect(Object.keys(palette[variant]).sort()).toEqual([...BUTTON_STATES].sort());
    }
  });

  it.each(BUTTON_VARIANTS.flatMap((v) => BUTTON_STATES.map((s) => [v, s] as const)))(
    'keeps the %s button legible in its %s state, in every theme',
    (variant, state) => {
      /* The regression this exists for: the primary hover and pressed fills are further along
         the brand ramp than `color.brand`, so the paired `onBrand` label falls to 2.97:1 on the
         pressed fill — an AA failure on the exact state a user is looking at while they click.
         The palette derives the label from the fill instead; this is what holds it there. */
      const failures = everyTheme()
        .map(({ label, theme }) => {
          const tone = buttonPalette(theme)[variant][state];
          return { label, ratio: contrast(tone.label, tone.background) };
        })
        .filter(({ ratio }) => ratio < 4.5)
        .map(({ label, ratio }) => `${label} ${ratio.toFixed(2)}:1`);

      expect(failures).toEqual([]);
    },
  );
});

describe('focus ring', () => {
  it('stays visible against the page it is drawn on', () => {
    /* The ring is drawn in a gap outside the control, so the background it must separate from
       is the page, not the button — inside a primary button the ring colour *is* the fill. */
    const failures = everyTheme()
      .map(({ label, theme }) => ({
        label,
        ratio: contrast(theme.color.interactive.focusRing, theme.color.bg),
      }))
      .filter(({ ratio }) => ratio < 3)
      .map(({ label, ratio }) => `${label} ${ratio.toFixed(2)}:1`);

    expect(failures).toEqual([]);
  });
});

describe('focusOriginAfterPointerDown', () => {
  it('takes the ring away from a button that was tabbed to and then clicked', () => {
    /* The case the function exists for. Focus does not move, so no second `onFocus` fires, and
       without this transition the ring raised by the tab would still be up under the pointer. */
    expect(focusOriginAfterPointerDown('keyboard')).toBe('pointer');
  });

  it('leaves the other two origins alone', () => {
    expect(focusOriginAfterPointerDown('pointer')).toBe('pointer');
    /* Not promoted to `pointer`: the focus event that follows the press is what decides, and it
       reads the pointer flag rather than this value. */
    expect(focusOriginAfterPointerDown('blurred')).toBe('blurred');
  });

  it('never shows a ring for the origin it produces', () => {
    /* The two functions have to agree, since one feeds the other. */
    expect(showsFocusRing(focusOriginAfterPointerDown('keyboard'), false)).toBe(false);
  });
});
