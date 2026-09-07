import { userId } from '@occasio/core';
import { createMemoryStorage, createMockAuthAdapter } from '@occasio/data';
import { describe, expect, it } from '@jest/globals';
import { ThemeProvider } from '@occasio/ui';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider } from '../auth/AuthProvider';
import { APP_THEME } from '../theme/inputs';
import { PlatformGate } from './PlatformGate';

/**
 * A cross-tenant area with no cross-tenant role in the model, so the gate is an allow-list — and
 * the thing worth testing is what it compares against. Comparing a placeholder identity rather
 * than a session let a signed-out visitor through, which is the case below.
 */

const ADMIN = { id: userId('u_sanit'), email: 'sanit@example.com' };
const NOT_ADMIN = { id: userId('u_meera'), email: 'meera@example.com' };

const mount = async (user: typeof ADMIN, signedIn: boolean) => {
  const storage = createMemoryStorage();
  if (signedIn) await createMockAuthAdapter({ user, storage }).signInWithOAuth('google');

  render(
    <AuthProvider adapter={createMockAuthAdapter({ user, storage })}>
      <ThemeProvider input={APP_THEME} forceScheme="light">
        <PlatformGate>
          <div data-testid="super-admin">the platform screens</div>
        </PlatformGate>
      </ThemeProvider>
    </AuthProvider>,
  );
};

describe('PlatformGate', () => {
  it('shows nothing but a placeholder while the session is still being restored', async () => {
    await mount(ADMIN, true);

    expect(screen.getByTestId('platform-gate-loading')).toBeTruthy();
    expect(screen.queryByTestId('super-admin')).toBeNull();
  });

  it('lets a platform administrator through', async () => {
    await mount(ADMIN, true);

    await waitFor(() => {
      expect(screen.getByTestId('super-admin')).toBeTruthy();
    });
  });

  it('refuses somebody signed in who is not on the list', async () => {
    await mount(NOT_ADMIN, true);

    await waitFor(() => {
      expect(screen.getByTestId('platform-gate-refused')).toBeTruthy();
    });
    expect(screen.queryByTestId('super-admin')).toBeNull();
  });

  it('refuses a visitor who is not signed in at all', async () => {
    /*
     * The case that was open. The gate compared `useCurrentUserId`, a placeholder constant that
     * answers the same thing whether or not anybody has signed in — so a signed-out visitor
     * matched the allow-list and rendered the platform screens. Nobody is a platform
     * administrator until they are somebody.
     */
    await mount(ADMIN, false);

    await waitFor(() => {
      expect(screen.getByTestId('platform-gate-refused')).toBeTruthy();
    });
    expect(screen.queryByTestId('super-admin')).toBeNull();
  });
});
