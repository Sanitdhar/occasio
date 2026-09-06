/**
 * @jest-environment-options {"url": "https://www.lila-and-sam.com/discover?utm=x"}
 */
import { describe, expect, it } from '@jest/globals';
import { render, screen, waitFor } from '@testing-library/react';
import { TenantProvider, useTenantResolution } from './TenantProvider';

/**
 * A custom domain, in its own file because the hostname is fixed when the environment is built —
 * `window.location` cannot be reassigned in jsdom, which is also true of a real browser and is
 * exactly why ADR-0003 keeps hostnames out of routing.
 *
 * The URL is chosen to be hostile to the check: a `www.` prefix, a path that names no event, and
 * a query string. If the hostname does not win here, a custom domain serves the discover page,
 * and the site fails to be its own site on the one address somebody paid for.
 */

const Probe = () => {
  const resolution = useTenantResolution();
  return (
    <div data-testid="probe">
      {resolution.kind === 'resolved' ? `${resolution.source}:${resolution.slug}` : resolution.kind}
    </div>
  );
};

describe('resolution on a custom domain', () => {
  it('takes the hostname over a path that names no event', async () => {
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
