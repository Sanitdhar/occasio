import { themeInputFromPreset } from '@occasio/theme';
import { tenantId } from '@occasio/core';
import { describe, expect, it, jest } from '@jest/globals';
import { ThemeProvider } from '@occasio/ui';
import { fireEvent, render, screen } from '@testing-library/react';
import type { Tenant } from '@occasio/data';
import { APP_THEME } from '../../theme/inputs';
import { DiscoverScreen } from './DiscoverScreen';
import type { DiscoverEvent } from './useDiscoverEvents';

/**
 * The page's second requirement is the one worth rendering for: each card in its own event's
 * theme. Two cards with different seeds must not resolve to the same colours, and asserting that
 * needs the real provider chain rather than a prop comparison.
 */

const tenant = (slug: string, name: string, kind: Tenant['kind']): Tenant => ({
  id: tenantId(`t_${slug}`),
  slug,
  name,
  kind,
  status: 'approved',
  timezone: 'Europe/London',
  visibility: 'unlisted',
  joinCode: null,
  startsOn: null,
  endsOn: null,
  createdBy: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

const WEDDING: DiscoverEvent = {
  tenant: tenant('lila-and-sam', 'Lila & Sam', 'wedding'),
  theme: themeInputFromPreset('romantic', '#B4436C'),
};

const FESTIVAL: DiscoverEvent = {
  tenant: tenant('harvest-lights', 'Harvest Lights', 'festival'),
  theme: themeInputFromPreset('festival', '#1FA97A'),
};

const renderDiscover = (props: Partial<DiscoverScreenProps> = {}) => {
  const onOpen = jest.fn<(slug: string) => void>();
  render(
    <ThemeProvider input={APP_THEME} forceScheme="light">
      <DiscoverScreen events={[]} onOpen={onOpen} {...props} />
    </ThemeProvider>,
  );
  return { onOpen };
};

type DiscoverScreenProps = Parameters<typeof DiscoverScreen>[0];

const cardBackground = (slug: string): string => {
  const card = screen.getByTestId(`discover-card-${slug}`);
  return window.getComputedStyle(card).backgroundColor;
};

describe('DiscoverScreen', () => {
  it('lists the events as cards, by name', () => {
    renderDiscover({ events: [WEDDING, FESTIVAL] });

    expect(screen.getByText('Lila & Sam')).toBeTruthy();
    expect(screen.getByText('Harvest Lights')).toBeTruthy();
  });

  it('renders each card in its own event’s theme', () => {
    /*
     * The requirement, and the only assertion on this page that could not be made by reading the
     * component. Two events with different presets and different seeds must resolve to different
     * surfaces — if the nested provider were dropped, both cards would take the page's theme and
     * these two values would be identical.
     */
    renderDiscover({ events: [WEDDING, FESTIVAL] });

    const wedding = cardBackground('lila-and-sam');
    const festival = cardBackground('harvest-lights');

    expect(wedding).not.toBe('');
    expect(wedding).not.toBe(festival);
  });

  it('still shows a card whose theme has not arrived', () => {
    /* A link to the event is what somebody came for. Holding the list back for a palette they
       have not noticed yet trades the thing they want against a detail. */
    renderDiscover({ events: [{ ...WEDDING, theme: null }] });

    expect(screen.getByTestId('discover-card-lila-and-sam')).toBeTruthy();
  });

  it('opens the event a card names', () => {
    const { onOpen } = renderDiscover({ events: [WEDDING, FESTIVAL] });

    fireEvent.click(screen.getByTestId('discover-open-harvest-lights'));
    expect(onOpen).toHaveBeenCalledWith('harvest-lights');
  });

  it('names each open button after its event', () => {
    /* Two buttons both called "Open" is a list a screen reader cannot navigate. */
    renderDiscover({ events: [WEDDING, FESTIVAL] });

    expect(screen.getByLabelText('Open Lila & Sam')).toBeTruthy();
    expect(screen.getByLabelText('Open Harvest Lights')).toBeTruthy();
  });

  it('says so when there are no events rather than showing an empty page', () => {
    renderDiscover({ events: [] });

    expect(screen.getByText('No events yet')).toBeTruthy();
  });

  it('offers a retry when the listing failed, and does not pretend the list is empty', () => {
    const onRetry = jest.fn();
    renderDiscover({ failed: true, onRetry });

    expect(screen.queryByText('No events yet')).toBeNull();
    fireEvent.click(screen.getByText('Try again'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
