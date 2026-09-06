/**
 * The camera, when there is one.
 *
 * Native today: `null`. Scanning needs a camera dependency and a permission prompt, and neither
 * is in this repo yet — so this is the seam rather than the feature, and the join screen renders
 * no scan button at all when it answers `null`.
 *
 * That is deliberate and it is the part worth arguing with. The alternative — a "Scan the QR
 * code" button that opens something apologetic — is a control that lies about what it does, put
 * in front of a guest at the exact moment they are trying to get in. A code field that works is
 * better than a scanner that does not, and the field is the primary control regardless: a camera
 * permission dialog is a poor thing to place between somebody and the event they were invited
 * to, and some devices will refuse it forever.
 *
 * When a scanner lands it returns a function here and the button appears, with the screen
 * unchanged — the prop and its tests already exist.
 */
export const scanJoinCode: (() => void) | null = null;
