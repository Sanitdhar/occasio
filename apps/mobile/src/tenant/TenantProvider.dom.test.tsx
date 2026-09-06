import { describe, expect, it, beforeEach } from '@jest/globals';
import { act, render, screen, waitFor } from '@testing-library/react';
import { TenantProvider, useTenantResolution } from './TenantProvider';

/**
 * The provider's job is to turn what the platform knows into one of three states, and the parts
 * worth rendering to check are the ones the pure tests cannot see: that an explicit slug does
 * not wait for anything, that a resolved event is remembered, and that a hook used outside the
 * provider fails loudly instead of looking like an event that could not be found.
 *
 * This is the web implementation — `resolveTenant.web.ts` — because that is what Jest and the
 * web build both resolve. The native path is the same union from a different source.
 */

const Probe = () => {
  const resolution = useTenantResolution();
  return (
    <div data-testid="probe">
      {resolution.kind === 'resolved'
        ? `${resolution.kind}:${resolution.source}:${resolution.slug}`
        : resolution.kind}
    </div>
  );
};

const probe = () => screen.getByTestId('probe').textContent;

const at = (path: string) => {
  window.history.pushState({}, '', path);
};

/** Seeds the recent list the way the app writes it, so the read path is the one under test. */
const remember = (entries: readonly { slug: string; name: string }[]) => {
  window.localStorage.setItem('occasio.recentTenants', JSON.stringify(entries));
};

describe('TenantProvider', () => {
  beforeEach(() => {
    window.localStorage.clear();
    at('/');
  });

  it('does not ask the platform when the route already knows', () => {
    /* The URL is the answer. Asking again would be a second opinion about a fact, and it would
       cost a `resolving` frame on every navigation inside an event. */
    render(
      <TenantProvider slug="lila-and-sam">
        <Probe />
      </TenantProvider>,
    );

    expect(probe()).toBe('resolved:path:lila-and-sam');
  });

  it('reads the canonical path when it is not given a slug', async () => {
    at('/e/harvest-lights/schedule');

    render(
      <TenantProvider>
        <Probe />
      </TenantProvider>,
    );

    await waitFor(() => {
      expect(probe()).toBe('resolved:path:harvest-lights');
    });
  });

  it('falls back to the last event this browser opened', async () => {
    /* The one moment storage matters on web: the bare origin, opened by somebody who has been
       to an event before. */
    remember([{ slug: 'dev-summit-2026', name: 'Dev Summit' }]);

    render(
      <TenantProvider>
        <Probe />
      </TenantProvider>,
    );

    await waitFor(() => {
      expect(probe()).toBe('resolved:recent:dev-summit-2026');
    });
  });

  it('is unresolved, not broken, when nothing identifies an event', async () => {
    /* A first visit to the bare origin. It is the state the join screen and the discover page
       exist to answer, so it must not read as an error. */
    render(
      <TenantProvider>
        <Probe />
      </TenantProvider>,
    );

    await waitFor(() => {
      expect(probe()).toBe('unresolved');
    });
  });

  it('ignores a stored value that is not a slug', async () => {
    /* Written by an older build, or by whoever had the console open. It is about to become a
       path segment. */
    remember([{ slug: '../../etc/passwd', name: 'Nope' }]);

    render(
      <TenantProvider>
        <Probe />
      </TenantProvider>,
    );

    await waitFor(() => {
      expect(probe()).toBe('unresolved');
    });
  });

  it('takes a slug given later over an answer still in flight', async () => {
    /*
     * Resolution is asynchronous on both platforms, so a late answer landing after the provider
     * has been told the slug would overwrite a correct state with a stale one — and it would do
     * it a frame after the screen looked right, which is the hardest kind of bug to attribute.
     */
    remember([{ slug: 'dev-summit-2026', name: 'Dev Summit' }]);

    const { rerender } = render(
      <TenantProvider>
        <Probe />
      </TenantProvider>,
    );

    rerender(
      <TenantProvider slug="lila-and-sam">
        <Probe />
      </TenantProvider>,
    );

    expect(probe()).toBe('resolved:path:lila-and-sam');

    /* Let every pending resolution settle: the abandoned one must not arrive after all. */
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(probe()).toBe('resolved:path:lila-and-sam');
  });

  it('fails loudly when a screen is mounted outside the provider', () => {
    /*
     * Returning `unresolved` here would render as a plausible empty state that nobody
     * investigates — the wiring mistake wearing the costume of a legitimate outcome.
     */
    expect(() => render(<Probe />)).toThrow(/inside a <TenantProvider>/);
  });
});
