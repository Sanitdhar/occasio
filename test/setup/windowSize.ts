/**
 * A controllable window width for the jsdom component project.
 *
 * react-native-web's `Dimensions` reads `document.documentElement.clientWidth` (or the visual
 * viewport where one exists) and recomputes on `resize`. jsdom reports 0 for both and fires no
 * resize of its own, so a breakpoint test without this is a test of one hard-coded width.
 *
 * Driving the real values rather than mocking `useWindowDimensions` keeps react-native-web's own
 * translation in the loop — the same reasoning as the media query helper beside this file, which
 * exists because a mock standing where the library should be cost a day of assertions landing on
 * nothing.
 */

const DEFAULT_WIDTH = 1024;
const DEFAULT_HEIGHT = 768;

const apply = (width: number, height: number): void => {
  Object.defineProperty(document.documentElement, 'clientWidth', {
    configurable: true,
    value: width,
  });
  Object.defineProperty(document.documentElement, 'clientHeight', {
    configurable: true,
    value: height,
  });
  window.dispatchEvent(new Event('resize'));
};

export const setWindowWidth = (width: number, height = DEFAULT_HEIGHT): void => {
  apply(width, height);
};

export const resetWindowSize = (): void => {
  apply(DEFAULT_WIDTH, DEFAULT_HEIGHT);
};
