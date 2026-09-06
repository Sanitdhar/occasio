import { router } from 'expo-router';
import { DiscoverScreen } from '../src/features/discover/DiscoverScreen';
import { useDiscoverEvents } from '../src/features/discover/useDiscoverEvents';

/**
 * The route: where a card leads, and nothing else.
 */
export default function Route() {
  const { events, loading, failed, retry } = useDiscoverEvents();

  return (
    <DiscoverScreen
      events={events}
      loading={loading}
      failed={failed}
      onRetry={retry}
      onOpen={(slug) => {
        /* `push`, not `replace`: coming back to the list is a reasonable thing to want here, in
           a way it is not from the join screen. */
        router.push(`/e/${slug}`);
      }}
    />
  );
}
