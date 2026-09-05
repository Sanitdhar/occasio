import { useTheme } from '@occasio/ui';
import { PlaceholderScreen } from '../../../../src/features/placeholder/PlaceholderScreen';

export default function Route() {
  return (
    <PlaceholderScreen
      theme={useTheme()}
      eyebrow="INFO"
      title="Venue and travel"
      description="Where it is, how to get there, and the questions everyone asks."
      arrivesIn="#53"
    />
  );
}
