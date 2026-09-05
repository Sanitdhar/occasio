import { PlaceholderScreen } from '../../../../../src/features/placeholder/PlaceholderScreen';
import { useScaffoldTheme } from '../../../../../src/theme/useScaffoldTheme';

export default function Route() {
  return (
    <PlaceholderScreen
      theme={useScaffoldTheme()}
      eyebrow="GOSSIPS"
      title="The board"
      description="Anonymous posts, approved by a host before anyone sees them."
      arrivesIn="#56"
    />
  );
}
