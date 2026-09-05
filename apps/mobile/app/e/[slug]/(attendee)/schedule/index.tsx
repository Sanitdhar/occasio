import { PlaceholderScreen } from '../../../../../src/features/placeholder/PlaceholderScreen';
import { useScaffoldTheme } from '../../../../../src/theme/useScaffoldTheme';

export default function Route() {
  return (
    <PlaceholderScreen
      theme={useScaffoldTheme()}
      eyebrow="SCHEDULE"
      title="Story cards"
      description="Swipeable day cards by default, with a list view for scanning and for reduced motion."
      arrivesIn="#33 and #35"
    />
  );
}
