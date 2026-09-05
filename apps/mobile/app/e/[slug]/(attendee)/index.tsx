import { PlaceholderScreen } from '../../../../src/features/placeholder/PlaceholderScreen';
import { useScaffoldTheme } from '../../../../src/theme/useScaffoldTheme';

export default function Route() {
  return (
    <PlaceholderScreen
      theme={useScaffoldTheme()}
      eyebrow="HOME"
      title="Event home"
      description="Hero, what is happening now, what is next, and who is hosting."
      arrivesIn="#39"
    />
  );
}
