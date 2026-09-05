import { useTheme } from '@occasio/ui';
import { PlaceholderScreen } from '../../../../src/features/placeholder/PlaceholderScreen';

export default function Route() {
  return (
    <PlaceholderScreen
      theme={useTheme()}
      eyebrow="HOME"
      title="Event home"
      description="Hero, what is happening now, what is next, and who is hosting."
      arrivesIn="#52"
    />
  );
}
