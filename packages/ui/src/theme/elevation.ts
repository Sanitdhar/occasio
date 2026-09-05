import type { ElevationSpec } from '@occasio/theme';
import type { ViewStyle } from 'react-native';

/**
 * Native: React Native's shadow props, plus Android's separate `elevation` scale.
 *
 * iOS shadows are described by offset, radius and opacity; Android has a single elevation
 * number and derives the rest. They are not interchangeable, which is why the theme emits a
 * neutral spec and each platform translates it here.
 *
 * `spread` has no React Native equivalent and is dropped rather than approximated.
 */
export const toElevationStyle = (spec: ElevationSpec): ViewStyle => {
  if (spec.opacity === 0) return {};
  return {
    shadowColor: spec.color,
    shadowOffset: { width: 0, height: spec.y },
    shadowOpacity: spec.opacity,
    /* CSS blur is roughly twice the Gaussian radius React Native takes. */
    shadowRadius: spec.blur / 2,
    elevation: spec.android,
  };
};
