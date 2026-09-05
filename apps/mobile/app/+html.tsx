import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/**
 * The web document shell.
 *
 * ⚠️ INERT UNDER THE CURRENT CONFIG. Expo only applies `+html.tsx` when `web.output` is
 * `static` or `server`; with `single` it emits its own SPA shell and this file is ignored.
 * Verified by exporting and diffing the generated index.html — see the issue linked from #18.
 *
 * It is kept rather than deleted because it is correct and starts working the moment web output
 * moves to `server`, which is the plan once tenant routes need real SEO and link previews.
 *
 * The thing it has to get right for an event site opened on a phone from a chat message is a
 * viewport that will not let the page zoom out to nothing.
 *
 * It used to preconnect to Google Fonts. Since #31 the typography sets are bundled with the app
 * and served from its own origin, so those two connections would be opened to a host the page
 * never talks to — a wasted DNS lookup and TLS handshake on the first paint that matters most.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        {/* Resets body margin and lets a root ScrollView fill the viewport on web. */}
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
