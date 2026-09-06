import { themeInputFromPreset } from '@occasio/theme';
import { afterAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { Component, type ReactNode } from 'react';
import { ThemeProvider } from './ThemeProvider';
import { useTheme } from './useTheme';

/**
 * The one behaviour in the theming layer that cannot be proved by a pure function.
 *
 * `resolveTheme` is tested exhaustively on its own, but "wrapping a subtree in a second
 * provider re-themes exactly that subtree" is a statement about React and about the DOM, and it
 * is the mechanism the theme editor's live preview depends on. Getting it wrong -- by writing
 * the variables to `document.documentElement`, say -- produces a page that looks right until
 * two themes are on screen at once, at which point the last provider to mount silently wins.
 *
 * Rendered through react-native-web, which is the same translation the web export ships. See
 * the `components` project in jest.config.mjs for what that does and does not cover (#110).
 */

const OUTER = themeInputFromPreset('romantic', '#7C3A5A');
const INNER = themeInputFromPreset('festival', '#1E6F5C');

/** The smallest boundary that reports what it caught, so the test can read the message. */
class Boundary extends Component<{ readonly children: ReactNode }, { readonly message: string }> {
  override state = { message: '' };

  static getDerivedStateFromError(error: unknown): { readonly message: string } {
    return { message: error instanceof Error ? error.message : String(error) };
  }

  override render(): ReactNode {
    return this.state.message === '' ? (
      this.props.children
    ) : (
      <p data-testid="boundary">{this.state.message}</p>
    );
  }
}

function Probe({ id }: { readonly id: string }) {
  const theme = useTheme();
  return <span data-testid={id}>{theme.color.brand}</span>;
}

/** The scope element a provider renders: the `display: contents` div carrying the variables. */
const scopeFor = (testId: string): HTMLElement => {
  const probe = screen.getByTestId(testId);
  const scope = probe.closest('div');
  if (scope === null) throw new Error(`no scope element around ${testId}`);
  return scope;
};

describe('ThemeProvider', () => {
  /* React logs a caught render error to console.error. Expected here, and noise otherwise. */
  const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);

  beforeEach(() => {
    consoleError.mockClear();
  });

  afterAll(() => {
    consoleError.mockRestore();
  });

  it('re-themes only the subtree a nested provider wraps', () => {
    render(
      <ThemeProvider input={OUTER} forceScheme="light">
        <Probe id="outer" />
        <ThemeProvider input={INNER} forceScheme="light">
          <Probe id="inner" />
        </ThemeProvider>
      </ThemeProvider>,
    );

    const outer = screen.getByTestId('outer').textContent;
    const inner = screen.getByTestId('inner').textContent;

    /* The fixtures have to actually differ, or the assertion below is satisfied by nothing
       happening at all. */
    expect(outer).not.toBe(inner);
    expect(outer).toBeTruthy();

    /* The sibling outside the nested provider keeps the outer theme -- this is the half that
       fails if the variables are written to the document root. */
    expect(screen.getByTestId('outer').textContent).toBe(outer);
  });

  it('publishes each theme as CSS variables on its own scope element', () => {
    render(
      <ThemeProvider input={OUTER} forceScheme="light">
        <Probe id="outer" />
        <ThemeProvider input={INNER} forceScheme="light">
          <Probe id="inner" />
        </ThemeProvider>
      </ThemeProvider>,
    );

    const outerBrand = scopeFor('outer').style.getPropertyValue('--occasio-color-brand');
    const innerBrand = scopeFor('inner').style.getPropertyValue('--occasio-color-brand');

    expect(outerBrand).not.toBe('');
    expect(innerBrand).not.toBe('');
    expect(outerBrand).not.toBe(innerBrand);
    /* What the context reports and what CSS resolves must be the same value, or a component
       styled in CSS and one styled from the hook drift apart. */
    expect(innerBrand).toBe(screen.getByTestId('inner').textContent);
  });

  it('keeps the scope out of layout', () => {
    /* `display: contents` is what lets the wrapper carry variables without becoming a box. A
       provider that introduced a block would change every layout it was added to. */
    render(
      <ThemeProvider input={OUTER} forceScheme="light">
        <Probe id="outer" />
      </ThemeProvider>,
    );

    expect(scopeFor('outer').style.display).toBe('contents');
  });

  it('refuses to render a themed component with no provider', () => {
    /*
     * Asserted through a boundary rather than `expect(render).toThrow`. React 19 does not
     * rethrow an uncaught render error out of `render` -- it reports it through
     * `window.reportError` -- so a root-level `toThrow` is testing a React implementation
     * detail that is already on its way out. A boundary is also how this failure actually
     * surfaces in the app, which makes the test a statement about the product rather than
     * about the renderer.
     *
     * Silently falling back to a default theme would put wrong colours on screen, which is far
     * harder to notice than a component that does not render at all.
     */
    render(
      <Boundary>
        <Probe id="orphan" />
      </Boundary>,
    );

    expect(screen.getByTestId('boundary').textContent).toMatch(/outside a <ThemeProvider>/);
    /* And the component genuinely did not render, rather than rendering beside the message. */
    expect(screen.queryByTestId('orphan')).toBeNull();
  });
});
