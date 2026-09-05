import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Animated, Easing, Platform, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../theme/useTheme';

/**
 * The wrapper every skeleton lives inside. It does two things a lone bar cannot.
 *
 * **One pulse for the whole placeholder.** If each bar drove its own loop, bars mounted a frame
 * apart — a list that appends a footer placeholder, a section that reveals late — would drift
 * out of phase, and a screen of placeholders shimmering independently reads as broken rather
 * than as loading. One Animated.Value per group also means one driver node instead of thirty.
 *
 * **One thing said to a screen reader.** A skeleton is twenty meaningless rectangles; announced
 * individually they are twenty meaningless rectangles. Announced as one busy `progressbar` with
 * a label, they are "loading the schedule".
 *
 * Both are why <Skeleton> throws outside a group rather than quietly rendering a static bar,
 * the same reasoning as useTheme(): a placeholder that silently loses its animation and its
 * accessible name still looks fine in the simulator.
 */

/** The pulsing opacity, shared by every bar in the group. */
export const SkeletonPulseContext = createContext<Animated.AnimatedInterpolation<number> | null>(
  null,
);

/** Fully opaque at rest, so a reduced-motion group is a plain, legible placeholder. */
const OPACITY_REST = 1;
/** Far enough to be unmistakably alive, short of the flicker that makes people look away. */
const OPACITY_FADED = 0.45;

export const useSkeletonPulse = (): Animated.AnimatedInterpolation<number> => {
  const pulse = useContext(SkeletonPulseContext);
  if (pulse === null) {
    throw new Error(
      '<Skeleton> was rendered outside a <SkeletonGroup>. The group owns the shared pulse and the "loading" announcement, so a skeleton without one is silently unanimated and silently unlabelled.',
    );
  }
  return pulse;
};

type Props = {
  /**
   * What is loading, in the words an attendee would use — this is the whole announcement, so
   * "Loading the schedule" beats "Loading".
   */
  readonly label: string;
  readonly children: ReactNode;
  readonly style?: StyleProp<ViewStyle> | undefined;
};

export function SkeletonGroup({ label, children, style }: Props) {
  const theme = useTheme();
  const progress = useRef(new Animated.Value(0)).current;

  const { enabled, slow } = theme.motion;

  useEffect(() => {
    /* D11 — the reduced-motion path is a first-class path, not a degraded one. A static bar at
       full opacity still says "content is coming", and it is what the theme asks for when the
       tenant picked motion: none or the OS asked for less. */
    if (!enabled) return undefined;

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          toValue: 1,
          duration: slow * 2,
          easing: Easing.inOut(Easing.quad),
          /* react-native-web has no native driver, and asking for one there logs a warning on
             every mount. Web is the platform this ships on first (D30). */
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(progress, {
          toValue: 0,
          duration: slow * 2,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),
    );
    loop.start();

    return () => {
      loop.stop();
      /* Leaving it mid-fade would freeze the next group that reuses this value at whatever
         opacity this one happened to unmount at. */
      progress.setValue(0);
    };
  }, [enabled, slow, progress]);

  const pulse = useMemo(
    () =>
      progress.interpolate({
        inputRange: [0, 1],
        outputRange: [OPACITY_REST, OPACITY_FADED],
      }),
    [progress],
  );

  return (
    <SkeletonPulseContext.Provider value={pulse}>
      {/* `accessible` collapses the subtree into this one node, so the bars inside are never
          reached individually. */}
      <View
        style={style}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={label}
        accessibilityState={{ busy: true }}
      >
        {children}
      </View>
    </SkeletonPulseContext.Provider>
  );
}
