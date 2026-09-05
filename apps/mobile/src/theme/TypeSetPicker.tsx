import { TYPE_SET_IDS, typeSetSpecimen, type ResolvedTheme, type TypeSetId } from '@occasio/theme';
import { Pressable, Text, View } from 'react-native';
import { useTypeSetFonts } from './useTypeSetFonts';

type RowProps = {
  readonly theme: ResolvedTheme;
  readonly setId: TypeSetId;
  readonly selected: boolean;
  readonly onSelect: (setId: TypeSetId) => void;
};

/**
 * One specimen. The label and the sample line come from the set being offered; the *faces* come
 * from whichever set is safe to draw with right now, which is `system` until this row's fonts
 * have loaded. That split is the whole point — the admin reads the choice immediately and sees
 * it typeset a moment later, instead of waiting on a blank card.
 *
 * Each row owns its own `useTypeSetFonts` call, so opening the picker fetches five sets in
 * parallel and each one appears as it lands rather than all of them after the slowest.
 */
function TypeSetSpecimenRow({ theme, setId, selected, onSelect }: RowProps) {
  const { color, type, space, radius, border } = theme;
  const ready = useTypeSetFonts(setId);
  const set = typeSetSpecimen(setId);
  const faces = typeSetSpecimen(ready);
  const loaded = ready === setId;

  return (
    <Pressable
      /* The `aria-*` props, not `accessibilityState`. React Native Web drops
         `accessibilityState={{ selected }}` on a radio entirely — verified against the export:
         the element came back with role="radio" and no state attribute at all, so every row
         announced as an unchecked radio. */
      role="radio"
      aria-checked={selected}
      aria-label={`${set.label} typography set`}
      onPress={() => {
        onSelect(setId);
      }}
      style={{
        backgroundColor: selected ? color.brandSubtle : color.surface,
        borderColor: selected ? color.brandBorder : color.border,
        borderWidth: selected ? border.standard : border.hairline,
        borderRadius: radius.md,
        padding: space(4),
        gap: space(1),
      }}
    >
      <Text style={{ ...type.overline, color: color.textMuted }}>{set.label}</Text>
      <Text style={{ ...type.title1, ...faces.display, color: color.text }}>{set.sample}</Text>
      <Text style={{ ...type.caption, ...faces.body, color: color.textMuted }}>
        {loaded
          ? `${set.typefaces.display} · ${set.typefaces.body}`
          : 'Loading — shown in system type'}
      </Text>
    </Pressable>
  );
}

type Props = {
  readonly theme: ResolvedTheme;
  readonly selectedId: TypeSetId;
  readonly onSelect: (setId: TypeSetId) => void;
};

/**
 * The typography half of the theme editor (#31, feeding the full editor in #74–#78).
 *
 * A type set cannot be described in words — "a serif display over a clean sans" is true of
 * three of these — so the picker shows each one set in its own faces.
 *
 * `selectedId` and `onSelect` are both required. A picker whose rows announce themselves as
 * radios and then refuse to change is worse than a list, so this component cannot be rendered
 * in that state — the caller owns the selection or uses something else.
 *
 * Pure: theme in, JSX out, no router and no data, so the editor can render it under a preview
 * provider later.
 */
export function TypeSetPicker({ theme, selectedId, onSelect }: Props) {
  const { color, type, space } = theme;
  return (
    <View style={{ gap: space(2) }}>
      <Text style={{ ...type.title2, color: color.text }}>Typography</Text>
      <Text style={{ ...type.body, color: color.textMuted }}>
        Every set is fetched on demand and never blocks the page. Until one arrives its specimen is
        drawn in the device&apos;s own type.
      </Text>
      {/* Only the rows belong inside the group — a radiogroup containing prose makes a screen
          reader read the description as if it were an option. */}
      <View role="radiogroup" aria-label="Typography set" style={{ gap: space(2) }}>
        {TYPE_SET_IDS.map((setId) => (
          <TypeSetSpecimenRow
            key={setId}
            theme={theme}
            setId={setId}
            selected={setId === selectedId}
            onSelect={onSelect}
          />
        ))}
      </View>
    </View>
  );
}
