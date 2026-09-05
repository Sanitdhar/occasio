import { useTheme } from '@occasio/ui';
import { PlaceholderScreen } from '../../../../../src/features/placeholder/PlaceholderScreen';
import { TypeSetEditor } from '../../../../../src/features/theme/TypeSetEditor';
import { FIXTURE_TENANT_THEME } from '../../../../../src/theme/inputs';

export default function Route() {
  return (
    <PlaceholderScreen
      theme={useTheme()}
      eyebrow="ADMIN"
      title="Theme editor"
      description="Pick a preset and one colour; the engine derives the rest and guarantees contrast."
      arrivesIn="#74 to #78"
    >
      {/* The typography half of the editor is real ahead of the rest (#31), because the fonts it
          loads are what the whole app renders in. The theme it edits is the fixture until
          tenant config exists (#23). */}
      <TypeSetEditor input={FIXTURE_TENANT_THEME} />
    </PlaceholderScreen>
  );
}
