import { Anton_400Regular } from '@expo-google-fonts/anton/400Regular';
import { CormorantGaramond_600SemiBold } from '@expo-google-fonts/cormorant-garamond/600SemiBold';
import { DMSans_400Regular } from '@expo-google-fonts/dm-sans/400Regular';
import { DMSans_600SemiBold } from '@expo-google-fonts/dm-sans/600SemiBold';
import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces/600SemiBold';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Nunito_400Regular } from '@expo-google-fonts/nunito/400Regular';
import { Nunito_600SemiBold } from '@expo-google-fonts/nunito/600SemiBold';
import { PlayfairDisplay_600SemiBold } from '@expo-google-fonts/playfair-display/600SemiBold';
import { Sora_600SemiBold } from '@expo-google-fonts/sora/600SemiBold';
import { WorkSans_400Regular } from '@expo-google-fonts/work-sans/400Regular';
import { WorkSans_600SemiBold } from '@expo-google-fonts/work-sans/600SemiBold';
import type { LoadableTypeSetId, TypeSetFace } from '@occasio/theme';

/**
 * The one place Metro is told which font files exist (#31).
 *
 * `require()` is resolved at bundle time, so a family name cannot be turned into a path at
 * runtime — every face has to be named here, statically, or it is not in the bundle at all.
 * That constraint is why the type sets are a fixed curated list rather than an upload field.
 *
 * The imports are per-weight subpaths (`.../inter/400Regular`) rather than the package root.
 * The root index re-exports all eighteen cuts of Inter, and Metro would then pull every one of
 * them into the export — about 8 MB of Inter alone for the two faces actually used.
 *
 * The `TypeSetFace<K>` key type is derived from `TYPE_SETS` itself, so a set that gains a
 * family or a weight fails `tsc` here until its file is added. That is the enforcement: there
 * is no runtime check for a missing face, because there cannot be one.
 */
export const TYPE_SET_FONTS: {
  /** `number` rather than `FontSource`: a static `require()` is a Metro module id and nothing
   *  else, and keeping that narrow is what lets the loader wrap each one in a `FontResource`. */
  readonly [K in LoadableTypeSetId]: Readonly<Record<TypeSetFace<K>, number>>;
} = {
  editorial: { PlayfairDisplay_600SemiBold, Inter_400Regular, Inter_600SemiBold },
  modernist: { Sora_600SemiBold, Inter_400Regular, Inter_600SemiBold },
  romantic: { CormorantGaramond_600SemiBold, Nunito_400Regular, Nunito_600SemiBold },
  festival: { Anton_400Regular, WorkSans_400Regular, WorkSans_600SemiBold },
  humanist: { Fraunces_600SemiBold, DMSans_400Regular, DMSans_600SemiBold },
};
