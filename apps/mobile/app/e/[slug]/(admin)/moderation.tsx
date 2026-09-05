import { useTheme } from '@occasio/ui';
import { PlaceholderScreen } from '../../../../src/features/placeholder/PlaceholderScreen';

export default function Route() {
  return (
    <PlaceholderScreen
      theme={useTheme()}
      eyebrow="ADMIN"
      title="Moderation queue"
      description="Approve, reject or hide gossip posts before attendees see them."
      arrivesIn="#58"
    />
  );
}
