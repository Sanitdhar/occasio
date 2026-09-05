import type { ResolvedTheme } from '@occasio/theme';
import type { CSSProperties, ReactNode } from 'react';
import { toCssVars } from './cssVars';

type Props = {
  readonly theme: ResolvedTheme;
  readonly children: ReactNode;
};

/**
 * Web: publishes the theme's tokens as CSS custom properties on a scope element.
 *
 * Scoped to an element rather than `document.documentElement` so nesting works: a nested
 * ThemeProvider gets its own scope, and CSS inside it resolves to that theme's values. Writing
 * to the document root would mean the last provider to mount silently wins, which would break
 * the theme editor's preview in a way nobody would attribute to CSS variables.
 *
 * `display: contents` keeps the wrapper out of layout entirely — it exists to carry variables,
 * not to affect the box model.
 */
export function ThemeScope({ theme, children }: Props) {
  const style: CSSProperties = { display: 'contents', ...toCssVars(theme) };
  return <div style={style}>{children}</div>;
}
