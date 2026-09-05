import { PlaceholderScreen } from '../../../../src/features/placeholder/PlaceholderScreen';
import { useScaffoldTheme } from '../../../../src/theme/useScaffoldTheme';

export default function Route() {
  return (
    <PlaceholderScreen
      theme={useScaffoldTheme()}
      eyebrow="INFO"
      title="Venue and travel"
      description="Where it is, how to get there, and the questions everyone asks."
      arrivesIn="#40"
    />
  );
}
