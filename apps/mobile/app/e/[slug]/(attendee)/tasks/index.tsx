import { PlaceholderScreen } from '../../../../../src/features/placeholder/PlaceholderScreen';
import { useScaffoldTheme } from '../../../../../src/theme/useScaffoldTheme';

export default function Route() {
  return (
    <PlaceholderScreen
      theme={useScaffoldTheme()}
      eyebrow="TASKS"
      title="My action items"
      description="What you personally need to do, and when it is due."
      arrivesIn="#47"
    />
  );
}
