import { ConnectionStatus } from './types';
/**
 * Checks if the browser is currently connected to the internet, optionally validating connectivity to a specific URL.
 *
 * This function first checks the quick navigator.onLine property. If that reports online, it attempts a lightweight
 * fetch (HEAD request) to a robust endpoint (default is Google's favicon) or a specified URL, for greater reliability.
 * The request is aborted if it takes more than 3 seconds.
 *
 * @param {string} [customURL] - Optional. The URL to perform the connectivity check against. This should be a fast, reliable endpoint.
 * @returns {Promise<boolean>} Resolves to `true` if connectivity is detected, or `false` otherwise.
 *
 * @example
 * // Basic connectivity check (default endpoint)
 * const connected = await checkConnection();
 * if (connected) {
 *   // internet is reachable
 * }
 *
 * @example
 * // Check connectivity to a custom backend
 * const alive = await checkConnection("https://my-api/status");
 * if (!alive) {
 *   // handle backend unreachable
 * }
 *
 * @throws {Error} Does not throw, always resolves to a boolean. In case of unexpected errors, logs an error message to the console.
 */
export declare const checkConnection: (customURL?: string) => Promise<boolean>;
/**
 * Returns the current browser network connection status.
 *
 * This is based on `navigator.onLine`, which may not be 100% accurate (for example, a network may be captive or internet may be filtered).
 * For more reliable checks, consider using {@link checkConnection}.
 *
 * @returns {ConnectionStatus} `"online"` if browser believes it is connected, `"offline"` otherwise.
 *
 * @example
 * if (getConnectionStatus() === "offline") {
 *   // Prompt user to check network
 * }
 */
export declare const getConnectionStatus: () => ConnectionStatus;
/**
 * Sets up event listeners for browser online/offline events and triggers the provided callbacks.
 *
 * This utility attaches "online" and "offline" event listeners to `window`, calling your provided
 * callbacks when the connectivity status changes. It also emits internal queue events for
 * broader application notification.
 *
 * Be sure to call the returned cleanup function when the listeners are no longer needed
 * to avoid memory leaks (for example, when unmounting a React component).
 *
 * @param {() => void} onOnline  - Invoked when the browser transitions to "online" status.
 * @param {() => void} onOffline - Invoked when the browser transitions to "offline" status.
 * @returns {() => void} Cleanup function that removes the registered event listeners.
 *
 * @example
 * // Usage in a React effect
 * useEffect(() => {
 *   const cleanup = setupConnectionListeners(
 *     () => showToast("We're back online!"),
 *     () => showToast("Connection lost.")
 *   );
 *   return cleanup; // Remove listeners on component unmount
 * }, []);
 *
 * @throws {Error} Does not throw.
 */
export declare const setupConnectionListeners: (onOnline: () => void, onOffline: () => void) => (() => void);
