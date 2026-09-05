import { useTheme } from '@occasio/ui';
import { PlaceholderScreen } from '../../src/features/placeholder/PlaceholderScreen';

export default function Route() {
  return (
    <PlaceholderScreen
      theme={useTheme()}
      eyebrow="SUPER ADMIN"
      title="Approvals"
      description="Event admins and site publishes waiting on a decision."
      arrivesIn="#83 to #85"
    />
  );
}
