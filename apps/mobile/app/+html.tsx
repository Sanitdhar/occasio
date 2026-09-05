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
 * Two things it has to get right for an event site opened on a phone from a chat message: a
 * viewport that will not let the page zoom out to nothing, and font connections opened before
 * the bundle finishes parsing.
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
        {/* Tenant typography sets are served from Google Fonts; opening the connections early
            saves a round trip on the first paint that matters most. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Resets body margin and lets a root ScrollView fill the viewport on web. */}
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
