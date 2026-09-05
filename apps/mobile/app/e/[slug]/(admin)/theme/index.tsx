import { useTheme } from '@occasio/ui';
import { PlaceholderScreen } from '../../../../../src/features/placeholder/PlaceholderScreen';

export default function Route() {
  return (
    <PlaceholderScreen
      theme={useTheme()}
      eyebrow="ADMIN"
      title="Theme editor"
      description="Pick a preset and one colour; the engine derives the rest and guarantees contrast."
      arrivesIn="#74 to #78"
    />
  );
}
