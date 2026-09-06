/**
 * Web: there is no scanner, and there is a URL bar instead.
 *
 * Somebody on the web already has an address to type into and a link to click, so the camera
 * buys nothing here that the URL does not. Separate from the native file so that adding a
 * scanner there does not accidentally put a camera prompt in front of a browser.
 */
export const scanJoinCode: (() => void) | null = null;
