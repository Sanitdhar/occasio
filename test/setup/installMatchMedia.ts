import { installMatchMedia } from './mediaQuery';

/* `setupFiles` runs before the test module is imported, which is what puts this in place
   before react-native-web captures the media query list at its own module load. */
installMatchMedia();
