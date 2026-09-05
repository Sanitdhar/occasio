import { useTheme } from '@occasio/ui';
import { PlaceholderScreen } from '../../../../../src/features/placeholder/PlaceholderScreen';

export default function Route() {
  return (
    <PlaceholderScreen
      theme={useTheme()}
      eyebrow="GOSSIPS"
      title="The board"
      description="Anonymous posts, approved by a host before anyone sees them."
      arrivesIn="#56"
    />
  );
}
