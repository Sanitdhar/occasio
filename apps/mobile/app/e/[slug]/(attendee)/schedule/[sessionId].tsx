import { useTheme } from '@occasio/ui';
import { PlaceholderScreen } from '../../../../../src/features/placeholder/PlaceholderScreen';

export default function Route() {
  return (
    <PlaceholderScreen
      theme={useTheme()}
      eyebrow="SESSION"
      title="Session detail"
      description="Hero, time, venue, hosts, and directions into the OS maps app."
      arrivesIn="#48"
    />
  );
}
