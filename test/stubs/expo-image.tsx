import { View, type ViewProps } from 'react-native';

/**
 * Stands in for `expo-image` in the jsdom component project.
 *
 * The real package reaches for the Expo runtime, which pulls in the native module registry and
 * a great deal else that a component test has no use for — and transforming all of it makes the
 * suite slow and the failures unreadable.
 *
 * What is given up is real: this renders nothing of expo-image's own behaviour, so the caching,
 * the blurhash decode and the transition are not covered here. They belong to the visual gate
 * and to a device. What component tests are for is the layer above — that `Image` requires
 * alternative text, that `Avatar` rejects a child that is not it — and that layer is untouched
 * by the substitution.
 */
export const Image = (props: ViewProps) => <View {...props} />;

export type ImageSource = { readonly uri?: string };
