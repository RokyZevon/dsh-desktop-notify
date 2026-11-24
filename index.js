/**
 * Host half of the desktop-notify bundle.
 *
 * DSH Desktop's Host runs as a separate Node child process without Electron's
 * Notification API, so the notification itself belongs to the browser half.
 * This entry point exists so the bundle's Loader row resolves; it registers
 * nothing.
 */
export function apply() {}
