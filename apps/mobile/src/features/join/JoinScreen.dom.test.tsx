import { describe, expect, it, jest } from '@jest/globals';
import { ThemeProvider } from '@occasio/ui';
import { fireEvent, render, screen } from '@testing-library/react';
import { APP_THEME } from '../../theme/inputs';
import { JoinScreen } from './JoinScreen';
import type { RecentTenant } from '../../tenant/recentTenants.shared';

/**
 * The screen at the moment somebody is standing in a venue holding a printed card. What matters
 * is that the field works, that a code with the decoration people type still submits, and that
 * the picker offers events rather than slugs.
 */

const RECENTS: readonly RecentTenant[] = [
  { slug: 'lila-and-sam', name: 'Lila & Sam' },
  { slug: 'maple-1999', name: 'Maple Street Reunion' },
];

const renderJoin = (props: Partial<Parameters<typeof JoinScreen>[0]> = {}) => {
  const onSubmitCode = jest.fn<(code: string) => void>();
  const onOpen = jest.fn<(slug: string) => void>();

  render(
    <ThemeProvider input={APP_THEME} forceScheme="light">
      <JoinScreen recents={[]} onOpen={onOpen} onSubmitCode={onSubmitCode} {...props} />
    </ThemeProvider>,
  );

  return { onOpen, onSubmitCode };
};

const codeField = () => screen.getByLabelText('Event code');

describe('JoinScreen', () => {
  it('submits the code exactly as typed, and lets the data layer normalise it', () => {
    /*
     * Not uppercased or stripped here. There is one rule for what a code means and it lives in
     * `joinCode.ts`, next to the comparison — a second, slightly different rule in a text field
     * is how a code that works on one platform stops working on the other.
     */
    const { onSubmitCode } = renderJoin();

    fireEvent.change(codeField(), { target: { value: ' san riy 26 ' } });
    fireEvent.click(screen.getByTestId('join-submit'));

    expect(onSubmitCode).toHaveBeenCalledWith(' san riy 26 ');
  });

  it('will not submit a field that looks empty', () => {
    /* Whitespace-only is not a submission. Enabling the button on it spends a request to be
       told the code is wrong, and tells somebody their card is bad when they typed nothing. */
    const { onSubmitCode } = renderJoin();

    fireEvent.change(codeField(), { target: { value: '   ' } });
    fireEvent.click(screen.getByTestId('join-submit'));

    expect(onSubmitCode).not.toHaveBeenCalled();
  });

  it('does not submit twice while a lookup is already running', () => {
    const { onSubmitCode } = renderJoin({ submitting: true });

    fireEvent.change(codeField(), { target: { value: 'SANRIY26' } });
    fireEvent.click(screen.getByTestId('join-submit'));

    expect(onSubmitCode).not.toHaveBeenCalled();
  });

  it('shows the error under the field, where the code was typed', () => {
    renderJoin({ error: 'No event has that code.' });

    expect(screen.getByText('No event has that code.')).toBeTruthy();
  });

  it('lists events by name, not by slug', () => {
    /* A slug is an implementation detail of the URL. Somebody recognises "Lila & Sam". */
    const { onOpen } = renderJoin({ recents: RECENTS });

    expect(screen.getByText('Lila & Sam')).toBeTruthy();
    expect(screen.getByText('Maple Street Reunion')).toBeTruthy();

    fireEvent.click(screen.getByTestId('join-recent-maple-1999'));
    expect(onOpen).toHaveBeenCalledWith('maple-1999');
  });

  it('names each open button after its event, so they are distinguishable by voice', () => {
    /* Five buttons all called "Open" is a list a screen reader cannot navigate. */
    renderJoin({ recents: RECENTS });

    expect(screen.getByLabelText('Open Lila & Sam')).toBeTruthy();
    expect(screen.getByLabelText('Open Maple Street Reunion')).toBeTruthy();
  });

  it('shows no picker at all when there is nothing to pick', () => {
    renderJoin({ recents: [] });

    expect(screen.queryByText('Events you have been to')).toBeNull();
  });

  it('offers no scan button where there is no scanner', () => {
    /*
     * The seam exists and the feature does not. A "Scan the QR code" button that opens something
     * apologetic is a control that lies about what it does, in front of a guest at the moment
     * they are trying to get in.
     */
    renderJoin();

    expect(screen.queryByTestId('join-scan')).toBeNull();
  });

  it('offers one when a scanner is supplied', () => {
    const onScan = jest.fn();
    renderJoin({ onScan });

    fireEvent.click(screen.getByTestId('join-scan'));
    expect(onScan).toHaveBeenCalledTimes(1);
  });
});
