import { useTheme } from '@occasio/ui';
import { PlaceholderScreen } from '../src/features/placeholder/PlaceholderScreen';

export default function Route() {
  return (
    <PlaceholderScreen
      theme={useTheme()}
      eyebrow="JOIN"
      title="Join an event"
      description="A six-character code, a recent event, or the QR code printed on the table."
      arrivesIn="#41"
    />
  );
}
