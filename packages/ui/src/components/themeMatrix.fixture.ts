import {
  PRESET_IDS,
  resolveTheme,
  themeInputFromPreset,
  type ResolvedTheme,
  type Scheme,
} from '@occasio/theme';

/**
 * Every theme a token choice has to survive: each preset, a spread of seeds, both schemes.
 *
 * Shared by the token tests so that a palette proved readable is proved readable *everywhere*,
 * not on the one theme whoever wrote the test happened to pick. Each theme carries a label, so
 * a failure names the combination that broke rather than only the ratio.
 */

/** A spread of hues, plus the two achromatic extremes, which is where ramps usually break. */
const SEEDS = ['#7C3A5A', '#1E6F5C', '#C2410C', '#2563EB', '#F59E0B', '#111111', '#FFFFFF'];
const SCHEMES: readonly Scheme[] = ['light', 'dark'];

export type LabelledTheme = { readonly label: string; readonly theme: ResolvedTheme };

export const everyTheme = (): readonly LabelledTheme[] =>
  PRESET_IDS.flatMap((presetId) =>
    SEEDS.flatMap((seed) =>
      SCHEMES.map((scheme) => ({
        label: `${presetId}/${seed}/${scheme}`,
        theme: resolveTheme(themeInputFromPreset(presetId, seed), { forceScheme: scheme }),
      })),
    ),
  );
