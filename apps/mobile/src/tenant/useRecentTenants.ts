import { useEffect, useState } from 'react';
import { readRecentTenants } from './recentTenants';
import type { RecentTenant } from './recentTenants.shared';

/**
 * The events this device has opened, for the picker on the join screen.
 *
 * Read once on mount rather than kept in sync: the list only changes when somebody opens an
 * event, which is the moment this screen stops being on screen. Subscribing to storage would be
 * machinery for an update nobody can observe.
 *
 * Starts empty rather than undefined. An empty list and a list not yet read look the same to
 * this screen — both render no picker — and inventing a third state would put a spinner over a
 * section that is decoration next to the code field.
 */
export const useRecentTenants = (): readonly RecentTenant[] => {
  const [recents, setRecents] = useState<readonly RecentTenant[]>([]);

  useEffect(() => {
    let abandoned = false;
    void readRecentTenants().then((stored) => {
      if (!abandoned) setRecents(stored);
    });
    return () => {
      abandoned = true;
    };
  }, []);

  return recents;
};
