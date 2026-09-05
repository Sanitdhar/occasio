import { PlaceholderScreen } from '../src/features/placeholder/PlaceholderScreen';
import { useScaffoldTheme } from '../src/theme/useScaffoldTheme';

export default function Route() {
  return (
    <PlaceholderScreen
      theme={useScaffoldTheme()}
      eyebrow="JOIN"
      title="Join an event"
      description="A six-character code, a recent event, or the QR code printed on the table."
      arrivesIn="#27"
    />
  );
}
