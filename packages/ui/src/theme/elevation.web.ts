import { withAlpha, type ElevationSpec } from '@occasio/theme';
import type { ViewStyle } from 'react-native';

/**
 * Web: a single `boxShadow`, which is what browsers actually render.
 *
 * React Native's shadow props translate poorly through react-native-web — historically to a
 * different shadow, and on some versions to none at all. Emitting CSS directly means what you
 * see in a browser is what the spec described, and `spread` survives, which it cannot on native.
 */
export const toElevationStyle = (spec: ElevationSpec): ViewStyle => {
  if (spec.opacity === 0) return {};
  const shadow = `0px ${String(spec.y)}px ${String(spec.blur)}px ${String(spec.spread)}px ${withAlpha(spec.color, spec.opacity)}`;
  return { boxShadow: shadow };
};
