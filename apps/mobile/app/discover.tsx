import { PlaceholderScreen } from '../src/features/placeholder/PlaceholderScreen';
import { useScaffoldTheme } from '../src/theme/useScaffoldTheme';

export default function Route() {
  return (
    <PlaceholderScreen
      theme={useScaffoldTheme()}
      eyebrow="DISCOVER"
      title="Events"
      description="Every event you can reach, each card rendered in its own theme."
      arrivesIn="#28"
    />
  );
}
