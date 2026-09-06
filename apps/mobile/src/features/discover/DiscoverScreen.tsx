import {
  Button,
  Card,
  EmptyState,
  Screen,
  Skeleton,
  SkeletonGroup,
  Text,
  ThemeProvider,
  createStyles,
} from '@occasio/ui';
import { View } from 'react-native';
import type { DiscoverEvent } from './useDiscoverEvents';

/**
 * Where `/` goes on the web while the platform is invite-only.
 *
 * The page is a list of events, and the reason it is worth building rather than stubbing is the
 * second half of it: **each card renders in its own event's theme.** Four cards, one component,
 * four palettes and four typefaces — D2 made visible rather than described, and the same nested
 * `ThemeProvider` the theme editor's live preview will use.
 *
 * That is also why the card is not a themed component receiving colours as props. It reads the
 * theme it is under, exactly like every screen inside the event does, so a card that looks right
 * here is evidence the event will look right too.
 *
 * Props in, JSX out: the route supplies the events and where a card leads.
 */

export type DiscoverScreenProps = {
  readonly events: readonly DiscoverEvent[];
  readonly loading?: boolean | undefined;
  readonly failed?: boolean | undefined;
  readonly onOpen: (slug: string) => void;
  readonly onRetry?: (() => void) | undefined;
};

const useStyles = createStyles((t) => ({
  header: { gap: t.space(2), marginBottom: t.space(6) },
  list: { gap: t.space(4) },
  card: { gap: t.space(3) },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
}));

export function DiscoverScreen({
  events,
  loading = false,
  failed = false,
  onOpen,
  onRetry,
}: DiscoverScreenProps) {
  const styles = useStyles();

  return (
    <Screen testID="discover-screen">
      <View style={styles.header}>
        <Text variant="display2">Your events</Text>
        <Text tone="muted">
          Occasio is invite-only for now. These are the events you have been added to.
        </Text>
      </View>

      {failed ? (
        <EmptyState
          title="Could not load your events"
          message="Something went wrong reaching the server. It may be the connection."
          action={
            onRetry === undefined ? undefined : <Button label="Try again" onPress={onRetry} />
          }
        />
      ) : loading ? (
        <SkeletonGroup label="Loading your events">
          <Skeleton width="100%" height={96} />
          <Skeleton width="100%" height={96} />
        </SkeletonGroup>
      ) : events.length === 0 ? (
        <EmptyState
          title="No events yet"
          message="When somebody adds you to an event, it will appear here."
        />
      ) : (
        <View style={styles.list}>
          {events.map((event) => (
            <EventCard key={event.tenant.id} event={event} onOpen={onOpen} />
          ))}
        </View>
      )}
    </Screen>
  );
}

/**
 * One event, in its own colours.
 *
 * The `ThemeProvider` is the whole trick and it is deliberately per card rather than per page:
 * nesting is what lets several themes coexist on one screen, which is the property the theme
 * editor's preview needs and the reason the provider was built to nest in the first place.
 *
 * A card whose theme has not arrived renders under the page's, rather than waiting. It is a link
 * to an event either way, and holding the whole list back for one palette would trade the thing
 * somebody came for against a detail they have not noticed yet.
 */
function EventCard({
  event,
  onOpen,
}: {
  readonly event: DiscoverEvent;
  readonly onOpen: (slug: string) => void;
}) {
  const body = <EventCardBody event={event} onOpen={onOpen} />;

  return event.theme === null ? body : <ThemeProvider input={event.theme}>{body}</ThemeProvider>;
}

function EventCardBody({
  event,
  onOpen,
}: {
  readonly event: DiscoverEvent;
  readonly onOpen: (slug: string) => void;
}) {
  const styles = useStyles();
  const { tenant } = event;

  return (
    <Card testID={`discover-card-${tenant.slug}`}>
      <View style={styles.card}>
        <Text variant="title1">{tenant.name}</Text>
        <View style={styles.meta}>
          <Text variant="caption" tone="muted">
            {tenant.kind}
          </Text>
          <Button
            label="Open"
            accessibilityLabel={`Open ${tenant.name}`}
            testID={`discover-open-${tenant.slug}`}
            onPress={() => {
              onOpen(tenant.slug);
            }}
          />
        </View>
      </View>
    </Card>
  );
}
