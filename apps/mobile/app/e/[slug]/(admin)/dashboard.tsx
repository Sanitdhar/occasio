import { PlaceholderScreen } from '../../../../src/features/placeholder/PlaceholderScreen';
import { useAppTheme } from '../../../../src/theme/useScaffoldTheme';

export default function Route() {
  return (
    <PlaceholderScreen
      theme={useAppTheme()}
      eyebrow="ADMIN"
      title="Dashboard"
      description="Pending gossips, sessions today, and what needs attention."
      arrivesIn="the v0.4 milestone"
    />
  );
}
