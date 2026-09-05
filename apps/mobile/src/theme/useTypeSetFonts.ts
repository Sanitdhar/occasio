import {
  TYPE_SET_IDS,
  typeSetFaces,
  type LoadableTypeSetId,
  type ThemeInput,
  type TypeSetId,
} from '@occasio/theme';
import { FontDisplay, isLoaded, loadAsync, type FontSource } from 'expo-font';
import { useEffect, useMemo, useState } from 'react';
import { TYPE_SET_FONTS } from './fonts';

/**
 * Tenant fonts, loaded lazily and never in front of first paint (#31).
 *
 * A wedding site that shows nothing for 800ms on a venue's overloaded wifi is worse than one
 * that reflows: the guest looking for the ceremony time gets the answer immediately and the
 * typeface catches up. So nothing here gates rendering — the hook reports which set is safe to
 * *style* with right now, and that is `system` until the real faces have arrived.
 */

/**
 * `font-display: swap` is the second line of defence, for the window where the `@font-face`
 * rule exists but the file is still in flight. Without it the browser's default is to hide the
 * text for up to three seconds — the exact failure this issue is about.
 */
const fontSourcesFor = (setId: LoadableTypeSetId): Record<string, FontSource> =>
  Object.fromEntries(
    Object.entries<number>(TYPE_SET_FONTS[setId]).map(([family, uri]) => [
      family,
      { uri, display: FontDisplay.SWAP },
    ]),
  );

/**
 * One in-flight request per set, shared by every component that asks for it.
 *
 * Fifteen screens mounting under the same theme must not start fifteen downloads, and a set the
 * admin previews in the picker must not be fetched again when they select it. A rejected load
 * is dropped from the map so a later mount retries rather than caching the failure forever.
 */
const inFlight = new Map<LoadableTypeSetId, Promise<void>>();

export const loadTypeSetAsync = (setId: LoadableTypeSetId): Promise<void> => {
  const existing = inFlight.get(setId);
  if (existing) return existing;

  const request = loadAsync(fontSourcesFor(setId)).catch((error: unknown) => {
    inFlight.delete(setId);
    throw error;
  });
  inFlight.set(setId, request);
  return request;
};

/** True once every face the set needs is registered. `system` needs none, so it is always true. */
export const isTypeSetLoaded = (setId: TypeSetId): boolean =>
  typeSetFaces(setId).every((family) => isLoaded(family));

/**
 * Returns the set that may be styled with *now*: `setId` once its faces are loaded, and
 * `system` until then. Callers pass the result straight back into `ThemeInput.typography.setId`,
 * so the fallback is a real resolved theme with real system families rather than a half-applied
 * one — every token still has a family, a size and a weight, and no text can render blank.
 *
 * Switching sets (the theme editor's picker) is handled by keeping a list rather than a single
 * boolean: going back to a set that has already loaded is instant, with no second flash of
 * system type.
 */
export const useTypeSetFonts = (setId: TypeSetId): TypeSetId => {
  const [loaded, setLoaded] = useState<readonly TypeSetId[]>(() =>
    TYPE_SET_IDS.filter(isTypeSetLoaded),
  );

  useEffect(() => {
    const remember = () => {
      setLoaded((previous) => (previous.includes(setId) ? previous : [...previous, setId]));
    };

    if (setId === 'system' || isTypeSetLoaded(setId)) {
      remember();
      return;
    }

    let live = true;
    void loadTypeSetAsync(setId).then(
      () => {
        if (live) remember();
      },
      (error: unknown) => {
        /* A missing typeface is a cosmetic failure, not a broken event site. Warn for the
           console and stay on system families — throwing here would take out the whole screen
           because a font did not download. */
        console.warn(
          `[fonts] typography set "${setId}" did not load; keeping system families`,
          error,
        );
      },
    );
    return () => {
      live = false;
    };
  }, [setId]);

  return loaded.includes(setId) ? setId : 'system';
};

/**
 * The same fallback, expressed as a theme input: the set is swapped for `system` until its
 * faces are registered, then swapped back and the subtree re-renders.
 *
 * Applying it to the *input* rather than to individual styles is what keeps the fallback
 * honest. `resolveTheme` derives sizes, line heights and weights for whichever set it is
 * handed, so the fallback is a complete, designed theme rather than a real theme with holes in
 * it — every token keeps a family, a size and a weight, and no text can render blank.
 *
 * Memoised because `ThemeProvider` memoises `resolveTheme` on the identity of `input`: a fresh
 * object every render would re-resolve ~150 tokens on every render of the loading window.
 */
export const useFontReadyInput = (input: ThemeInput): ThemeInput => {
  const setId = useTypeSetFonts(input.typography.setId);
  return useMemo(
    () =>
      setId === input.typography.setId
        ? input
        : { ...input, typography: { ...input.typography, setId } },
    [input, setId],
  );
};
