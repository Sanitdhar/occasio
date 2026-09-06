import { Redirect } from 'expo-router';
import { Platform } from 'react-native';
import { useTenantResolution } from '../src/tenant/TenantProvider';

/**
 * Where `/` goes.
 *
 * The root layout has already asked the platform which event this is (#39), so this route reads
 * that answer rather than making its own. It matters most on a custom domain: somebody who typed
 * `lila-and-sam.com` resolves to that event at `/`, and sending them to a list of events instead
 * would be the site failing to be its own site on the one address somebody paid for.
 *
 * With no event to go to, the platforms differ because their situations do. The web has a page
 * of events and an address bar; native has neither, so it has the join screen — a code and the
 * events this device has already opened.
 *
 * Nothing is rendered while resolution is in flight. It is a storage read on web and a deep-link
 * read on native, so it is over in a frame or two, and painting anything in that window is the
 * flicker `useDeferredFlag` exists to avoid elsewhere.
 */
export default function IndexRoute() {
  const resolution = useTenantResolution();

  if (resolution.kind === 'resolving') return null;

  if (resolution.kind === 'resolved') return <Redirect href={`/e/${resolution.slug}`} />;

  return <Redirect href={Platform.OS === 'web' ? '/discover' : '/join'} />;
}
