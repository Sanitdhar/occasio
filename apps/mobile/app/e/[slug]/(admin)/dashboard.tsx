import { useTheme } from '@occasio/ui';
import { PlaceholderScreen } from '../../../../src/features/placeholder/PlaceholderScreen';

export default function Route() {
  return (
    <PlaceholderScreen
      theme={useTheme()}
      eyebrow="ADMIN"
      title="Dashboard"
      description="Pending gossips, sessions today, and what needs attention."
      arrivesIn="the v0.4 milestone"
    />
  );
}
