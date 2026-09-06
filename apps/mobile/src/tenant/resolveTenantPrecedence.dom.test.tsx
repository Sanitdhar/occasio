/**
 * @jest-environment-options {"url": "https://lila-and-sam.com/e/harvest-lights/schedule"}
 */
import { describe, expect, it } from '@jest/globals';
import { render, screen, waitFor } from '@testing-library/react';
import { TenantProvider, useTenantResolution } from './TenantProvider';

/**
 * A URL where both sources answer, which is the only arrangement that can tell the order apart.
 *
 * The custom-domain test next door uses a path that names no event, so the path contributes
 * nothing there and reversing the two would have changed no result — a test of precedence that
 * did not test precedence. This one puts a different event in each.
 *
 * The hostname wins: somebody typed `lila-and-sam.com`, and a link they followed to a schedule
 * inside another event does not overrule whose site they are on. It is also the direction that
 * fails safely — a wrong hostname is a misconfigured domain somebody notices immediately,
 * where a wrong path is a link that silently shows the wrong event.
 */

const Probe = () => {
  const resolution = useTenantResolution();
  return (
    <div data-testid="probe">
      {resolution.kind === 'resolved' ? `${resolution.source}:${resolution.slug}` : resolution.kind}
    </div>
  );
};

describe('when the hostname and the path name different events', () => {
  it('takes the hostname', async () => {
    render(
      <TenantProvider>
        <Probe />
      </TenantProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('probe').textContent).toBe('domain:lila-and-sam');
    });
  });
});
