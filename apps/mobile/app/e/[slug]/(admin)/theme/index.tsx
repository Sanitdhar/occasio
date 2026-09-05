import { useTheme } from '@occasio/ui';
import { PlaceholderScreen } from '../../../../../src/features/placeholder/PlaceholderScreen';
import { TypeSetPicker } from '../../../../../src/theme/TypeSetPicker';

export default function Route() {
  const theme = useTheme();
  return (
    <PlaceholderScreen
      theme={theme}
      eyebrow="ADMIN"
      title="Theme editor"
      description="Pick a preset and one colour; the engine derives the rest and guarantees contrast."
      arrivesIn="#74 to #78"
    >
      {/* The typography picker is real ahead of the rest of the editor (#31), because the fonts
          it loads are what the whole app renders in. `selectedId` is the fixture tenant's set
          until tenant config exists and the editor can read and write it. */}
      <TypeSetPicker theme={theme} selectedId="romantic" />
    </PlaceholderScreen>
  );
}
