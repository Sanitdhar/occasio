import { PlaceholderScreen } from '../../../../../src/features/placeholder/PlaceholderScreen';
import { useAppTheme } from '../../../../../src/theme/useScaffoldTheme';

export default function Route() {
  return (
    <PlaceholderScreen
      theme={useAppTheme()}
      eyebrow="ADMIN"
      title="Theme editor"
      description="Pick a preset and one colour; the engine derives the rest and guarantees contrast."
      arrivesIn="#74 to #78"
    />
  );
}
