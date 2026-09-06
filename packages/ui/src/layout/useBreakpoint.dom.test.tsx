import { themeInputFromPreset } from '@occasio/theme';
import { afterEach, describe, expect, it } from '@jest/globals';
import { act, render, screen } from '@testing-library/react';
import { resetWindowSize, setWindowWidth } from '../../../../test/setup/windowSize';
import { ThemeProvider } from '../theme/ThemeProvider';
import { useBreakpoint } from './useBreakpoint';

/**
 * The platform-bound half of the breakpoint logic.
 *
 * `breakpointFor` is pure and tested on its own; what cannot be tested there is that the width
 * actually arrives — that `useWindowDimensions` is wired to something real and that a resize
 * reaches the component. Those are the two ways this silently becomes a constant: a window that
 * always reports one size, or an update that never propagates.
 *
 * Rendered through react-native-web, so what is exercised is the library's own `Dimensions`
 * rather than a mock of it.
 */

const THEME = themeInputFromPreset('conference', '#2563EB');

function Probe() {
  return <span data-testid="bp">{useBreakpoint()}</span>;
}

const renderAt = (width: number) => {
  setWindowWidth(width);
  return render(
    <ThemeProvider input={THEME} forceScheme="light">
      <Probe />
    </ThemeProvider>,
  );
};

describe('useBreakpoint', () => {
  afterEach(() => {
    resetWindowSize();
  });

  it('reports the phone width as the base', () => {
    renderAt(390);
    expect(screen.getByTestId('bp').textContent).toBe('base');
  });

  it('reports a desktop width as lg', () => {
    renderAt(1440);
    expect(screen.getByTestId('bp').textContent).toBe('lg');
  });

  it('includes the threshold itself', () => {
    /* A device sitting exactly on a boundary sits there for its whole life, so an off-by-one
       here is permanent for that device rather than intermittent. */
    const { unmount } = renderAt(767);
    expect(screen.getByTestId('bp').textContent).toBe('sm');
    unmount();

    renderAt(768);
    expect(screen.getByTestId('bp').textContent).toBe('md');
  });

  it('follows the window being resized', () => {
    /* The half that cannot be tested without rendering: a hook reading the width once at mount
       passes every case above and never changes when a browser window is dragged wider. */
    renderAt(390);
    expect(screen.getByTestId('bp').textContent).toBe('base');

    act(() => {
      setWindowWidth(1440);
    });

    expect(screen.getByTestId('bp').textContent).toBe('lg');
  });
});
