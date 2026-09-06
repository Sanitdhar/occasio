import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Whether the person using this device has asked for less motion.
 *
 * One implementation for all three platforms: React Native reads the OS setting, and
 * react-native-web maps the same `AccessibilityInfo` API onto `prefers-reduced-motion`. No
 * platform split is needed, which is worth saying because the file next to this one has one.
 *
 * The initial value is read synchronously where that is possible, and this is the part that
 * matters. `AccessibilityInfo.isReduceMotionEnabled()` is a promise, so a hook that started at
 * `false` and corrected itself a tick later would play one frame of animation at every launch
 * — to the one person who asked for none — and would leave the visual gate screenshotting a
 * page mid-transition, because Playwright sets the preference before load and the first render
 * would not have seen it yet (#129).
 */
const prefersReducedMotionNow = (): boolean => {
  /* Guarded rather than assumed: this runs on iOS and Android too, where there is no `window`,
     and in a server render where there is one without `matchMedia`. */
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

/**
 * Removes a listener that may never have been added.
 *
 * React Native types `addEventListener` as always returning a subscription. react-native-web
 * returns `undefined` when `matchMedia` is unavailable — it takes an early return before
 * constructing one — and that is every non-DOM environment, including a server render, where
 * calling `.remove()` throws during cleanup. It is a function rather than an optional chain at
 * the call site because TypeScript narrows the assignment back to the type upstream declares,
 * and then reports the guard as unnecessary; across a parameter it cannot.
 */
const unsubscribe = (subscription: { readonly remove?: () => void } | undefined): void => {
  subscription?.remove?.();
};

export const useReducedMotion = (): boolean => {
  const [reduced, setReduced] = useState(prefersReducedMotionNow);

  useEffect(() => {
    let active = true;

    /* Native has no synchronous read, so the real value arrives here. On web this confirms what
       the initialiser already found. */
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) setReduced(enabled);
    });

    /* The setting can change while the app is open — iOS and Android both let it be toggled
       from a control centre, and a browser follows the OS. */
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);

    return () => {
      active = false;
      unsubscribe(subscription);
    };
  }, []);

  return reduced;
};
