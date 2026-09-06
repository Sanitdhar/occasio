import type { ThemeInput } from '@occasio/theme';
import type { Tenant } from '@occasio/data';
import { useQueries, useQuery } from '@tanstack/react-query';
import { useAdapter } from '../../data/AdapterProvider';
import { useCurrentUserId } from '../../data/useCurrentUserId';
import { queryKeys } from '../../data/queryKeys';

/**
 * The events to show on `/`.
 *
 * **These are the events this account is in, not a public catalogue.** The platform is
 * invite-only, so there is no catalogue to list — `TenantDirectory` has no `listPublic` and
 * should not grow one for a page that exists to give `/` somewhere to go. When the platform
 * opens up, that method is a decision worth making on its own, against a real requirement about
 * who may see which events.
 *
 * Each event's own theme comes with it, because that is the point of the page: four events that
 * look nothing alike, rendered by one component, is D2 made visible rather than described.
 */

export type DiscoverEvent = {
  readonly tenant: Tenant;
  /**
   * The event's published theme, or `null` while it loads or if it has never been published.
   *
   * `null` rather than a default, so the card can decide. Substituting the app's own theme here
   * would render a card that looks like the console and claims to be the event.
   */
  readonly theme: ThemeInput | null;
};

export type Discovery = {
  readonly events: readonly DiscoverEvent[];
  readonly loading: boolean;
  readonly failed: boolean;
};

export const useDiscoverEvents = (): Discovery => {
  const adapter = useAdapter();
  const me = useCurrentUserId();

  const listing = useQuery({
    queryKey: queryKeys.directory.forUser(me),
    queryFn: () => adapter.directory.listForUser(me),
  });

  const tenants = listing.data?.items ?? [];

  /*
   * One query per event rather than one for all of them. `tenants.config` is per-tenant in the
   * repository layer because a config is per-tenant in the eventual table, and inventing a
   * batch read here would be a shape the Supabase adapter then has to reproduce. They are
   * cached under the tenant prefix, so opening an event afterwards finds its theme already
   * loaded rather than fetching it again.
   */
  const configs = useQueries({
    queries: tenants.map((tenant) => ({
      queryKey: queryKeys.tenants.config(tenant.id),
      queryFn: () => adapter.tenants.config(tenant.id),
    })),
  });

  return {
    events: tenants.map((tenant, index) => ({
      tenant,
      theme: configs[index]?.data?.published?.config.theme ?? null,
    })),
    loading: listing.isPending,
    /* Only the listing failing is a failure: a config that will not load costs one card its
       palette, and a card in the wrong palette is still a way into the event. */
    failed: listing.isError,
  };
};
