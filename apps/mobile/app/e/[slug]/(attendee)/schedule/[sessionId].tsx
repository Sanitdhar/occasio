import { PlaceholderScreen } from '../../../../../src/features/placeholder/PlaceholderScreen';
import { useScaffoldTheme } from '../../../../../src/theme/useScaffoldTheme';

export default function Route() {
  return (
    <PlaceholderScreen
      theme={useScaffoldTheme()}
      eyebrow="SESSION"
      title="Session detail"
      description="Hero, time, venue, hosts, and directions into the OS maps app."
      arrivesIn="#32"
    />
  );
}
