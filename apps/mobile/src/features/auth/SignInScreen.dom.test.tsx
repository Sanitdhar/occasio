import { describe, expect, it, jest } from '@jest/globals';
import { ThemeProvider } from '@occasio/ui';
import { fireEvent, render, screen } from '@testing-library/react';
import { APP_THEME } from '../../theme/inputs';
import { SignInScreen } from './SignInScreen';

/**
 * The screen is deliberately almost empty, so what is worth asserting is what it does *not*
 * offer: one provider, and no second slot standing open. ADR-0007 is why.
 */

const renderSignIn = (props: Partial<Parameters<typeof SignInScreen>[0]> = {}) => {
  const onSignIn = jest.fn();
  render(
    <ThemeProvider input={APP_THEME} forceScheme="light">
      <SignInScreen onSignIn={onSignIn} {...props} />
    </ThemeProvider>,
  );
  return { onSignIn };
};

describe('SignInScreen', () => {
  it('offers exactly one way in', () => {
    /*
     * D28 allows Google and nothing else, and ADR-0007 records that Apple's is a submission
     * blocker for iOS rather than a preference. Counting the buttons is what makes adding the
     * second a visible change to this file rather than filling a slot somebody left open.
     */
    renderSignIn();

    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByTestId('sign-in-google')).toBeTruthy();
  });

  it('admits when it is not really Google', () => {
    /*
     * A button reading "Continue with Google" that signs somebody in as a fixed account, with
     * nothing on screen saying so, is the app lying about what it just did — and the person most
     * likely to be misled is whoever is demonstrating it to somebody else. It goes away with the
     * mock, which is one file.
     */
    renderSignIn({ demo: true });

    expect(screen.getByTestId('sign-in-demo').textContent).toMatch(/not connected yet/);
  });

  it('says nothing of the sort once a real provider is wired', () => {
    renderSignIn({ demo: false });

    expect(screen.queryByTestId('sign-in-demo')).toBeNull();
  });

  it('signs in when asked', () => {
    const { onSignIn } = renderSignIn();

    fireEvent.click(screen.getByTestId('sign-in-google'));
    expect(onSignIn).toHaveBeenCalledTimes(1);
  });

  it('will not start a second sign-in while one is running', () => {
    const { onSignIn } = renderSignIn({ busy: true });

    fireEvent.click(screen.getByTestId('sign-in-google'));
    expect(onSignIn).not.toHaveBeenCalled();
  });

  it('announces a failure rather than only colouring it', () => {
    /* `Text` has no danger tone — the resolver guarantees contrast for content colours and a
       solid `danger` fill is not one — so the role is what makes this an error at all. */
    renderSignIn({ error: 'Could not sign in. Please try again.' });

    expect(screen.getByRole('alert').textContent).toBe('Could not sign in. Please try again.');
  });

  it('shows nothing where an error would be when there is none', () => {
    renderSignIn();

    expect(screen.queryByRole('alert')).toBeNull();
  });
});
