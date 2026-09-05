import { useTheme } from '@occasio/ui';
import { PlaceholderScreen } from '../../../../../src/features/placeholder/PlaceholderScreen';

export default function Route() {
  return (
    <PlaceholderScreen
      theme={useTheme()}
      eyebrow="TASKS"
      title="My action items"
      description="What you personally need to do, and when it is due."
      arrivesIn="#60"
    />
  );
}
