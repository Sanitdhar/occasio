import { useTheme } from '@occasio/ui';
import { PlaceholderScreen } from '../src/features/placeholder/PlaceholderScreen';

export default function Route() {
  return (
    <PlaceholderScreen
      theme={useTheme()}
      eyebrow="DISCOVER"
      title="Events"
      description="Every event you can reach, each card rendered in its own theme."
      arrivesIn="#42"
    />
  );
}
