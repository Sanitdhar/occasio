import { PlaceholderScreen } from '../../src/features/placeholder/PlaceholderScreen';
import { useAppTheme } from '../../src/theme/useScaffoldTheme';

export default function Route() {
  return (
    <PlaceholderScreen
      theme={useAppTheme()}
      eyebrow="SUPER ADMIN"
      title="Approvals"
      description="Event admins and site publishes waiting on a decision."
      arrivesIn="#83 to #85"
    />
  );
}
