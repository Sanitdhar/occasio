import { useTheme } from '@occasio/ui';
import { PlaceholderScreen } from '../../../../../src/features/placeholder/PlaceholderScreen';

export default function Route() {
  return (
    <PlaceholderScreen
      theme={useTheme()}
      eyebrow="SCHEDULE"
      title="Story cards"
      description="Swipeable day cards by default, with a list view for scanning and for reduced motion."
      arrivesIn="#49 and #50"
    />
  );
}
