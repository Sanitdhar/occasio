import { View, type ViewProps } from 'react-native';

/**
 * Stands in for `react-native-safe-area-context` in the jsdom component project.
 *
 * The real one reads insets from the platform — a notch on iOS, a gesture bar on Android,
 * nothing at all in a browser — so in jsdom it has nothing to report and pulls in native module
 * plumbing to say so.
 *
 * Zero insets are what a browser genuinely has, so `Screen` renders here exactly as it does on
 * the web, which is the platform D30 ships first. What is not covered is a notched phone; that
 * belongs to the visual gate and a device.
 */
export const useSafeAreaInsets = () => ({ top: 0, right: 0, bottom: 0, left: 0 });

export const SafeAreaProvider = (props: ViewProps) => <View {...props} />;

export const SafeAreaView = (props: ViewProps) => <View {...props} />;
