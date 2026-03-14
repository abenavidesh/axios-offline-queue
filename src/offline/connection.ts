import type { ConnectionStatus } from "./types";
import { emitQueueEvent } from "./suscriptions";

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
export const checkConnection = async (customURL?: string): Promise<boolean> => {
  // Use the quick online status for an early exit (not always reliable).
  if (!navigator.onLine) {
    return false;
  }

  // Secondary network check - performs a lightweight HEAD fetch to a public (or custom) resource.
  try {
    const controller = new AbortController();
    // Abort if no response in 3 seconds (network errors, captive portals, etc).
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    // Use custom endpoint or Google's favicon as a public fast-resolving endpoint.
    const url = customURL || "https://www.google.com/favicon.ico";

    await fetch(url, {
      method: "HEAD",
      mode: "no-cors", // This prevents CORS errors from failing connectivity checks, but limits information.
      signal: controller.signal,
      cache: "no-cache", // Always reach out over network.
    });

    clearTimeout(timeoutId);
    return true;
  } catch (error) {
    // Log detailed error for developer debugging.
    console.error(
      "[Offline] Network check failed. This may indicate loss of connectivity or server is unreachable.",
      error
    );
    return false;
  }
};

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
export const getConnectionStatus = (): ConnectionStatus => {
  return navigator.onLine ? "online" : "offline";
};

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
export const setupConnectionListeners = (
  onOnline: () => void,
  onOffline: () => void
): (() => void) => {
  /**
   * Handler invoked when browser goes online.
   */
  const handleOnline = () => {
    console.log("[Offline] Connection restored.");
    emitQueueEvent("connection-restored", {
      kind: "network",
      online: true,
      serverReachable: true,
    });
    onOnline();
  };

  /**
   * Handler invoked when browser goes offline.
   */
  const handleOffline = () => {
    console.log("[Offline] Connection lost.");
    emitQueueEvent("connection-lost", {
      kind: "network",
      online: false,
      serverReachable: false,
    });
    onOffline();
  };

  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);

  // Return cleanup function for deregistering event listeners.
  return () => {
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("offline", handleOffline);
  };
};