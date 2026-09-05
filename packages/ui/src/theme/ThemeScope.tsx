import type { ResolvedTheme } from '@occasio/theme';
import type { ReactNode } from 'react';

type Props = {
  readonly theme: ResolvedTheme;
  readonly children: ReactNode;
};

/**
 * Native (and the default): a pass-through.
 *
 * CSS custom properties have no meaning outside the DOM, and wrapping every themed subtree in
 * an extra View on native would add a layout node for nothing. The web variant lives in
 * ThemeScope.web.tsx; Metro picks it automatically.
 */
export function ThemeScope({ children }: Props) {
  return <>{children}</>;
}
