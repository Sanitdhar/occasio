import { themeInputFromPreset } from '@occasio/theme';
import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react';
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
    /* Silently falling back to a default theme would put wrong colours on screen, which is far
       harder to notice than a component that does not render at all. */
    expect(() => render(<Probe id="orphan" />)).toThrow(/outside a <ThemeProvider>/);
  });
});
