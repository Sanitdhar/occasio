import { PlaceholderScreen } from '../../../../src/features/placeholder/PlaceholderScreen';
import { useAppTheme } from '../../../../src/theme/useScaffoldTheme';

export default function Route() {
  return (
    <PlaceholderScreen
      theme={useAppTheme()}
      eyebrow="ADMIN"
      title="Moderation queue"
      description="Approve, reject or hide gossip posts before attendees see them."
      arrivesIn="#46"
    />
  );
}
