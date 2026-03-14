import { checkConnection } from "./connection";

/**
 * The interval (in milliseconds) at which connectivity status will be checked
 * when polling is active.
 */
const CHECK_INTERVAL = 3000;

/**
 * Represents the connectivity status of the client.
 *
 * @property {boolean} online - Whether the browser reports an active internet connection
 *   (based on `navigator.onLine`, which may not always be reliable).
 * @property {boolean} serverReachable - Whether a server is reachable via network
 *   check (using the `checkConnection` function).
 */
export type ConnectivityStatus = {
  online: boolean;
  serverReachable: boolean;
};

/**
 * Returns the initial 'online' status.
 * For server-side rendering (SSR), always returns `true` (optimistic).
 * For browsers, uses `navigator.onLine`.
 *
 * @returns {boolean} Current or initial browser online status.
 *
 * @example
 * const isOnline = getInitialOnline();
 */
const getInitialOnline = (): boolean => {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine;
};

/**
 * Checks whether the configured server is reachable.
 * For SSR, returns `true` (optimistic).
 * For browsers, uses `checkConnection`, optionally to a provided server URL.
 *
 * @param {string} [serverURL] - Optional URL to check.
 * @returns {Promise<boolean>} Promise resolving to `true` if the server is reachable; `false` otherwise.
 *
 * @example
 * const canReach = await getInitialServerReachable("https://api.example.com/status");
 */
const getInitialServerReachable = async (serverURL?: string): Promise<boolean> => {
  if (typeof navigator === "undefined") return true;
  return await checkConnection(serverURL);
};

/**
 * Returns an immutable snapshot of the current connectivity status.
 * The status includes both the browser's reported online indicator and an
 * explicit server reachability check (via `checkConnection`).
 *
 * @param {Object} options - Options object.
 * @param {string} [options.serverURL] - Optional. The URL to check for server reachability.
 * @returns {Promise<ConnectivityStatus>} An object with `online` and `serverReachable` booleans.
 *
 * @example
 * const status = await getConnectivityStatus({ serverURL: "https://api.example.com" });
 * console.log(status.online, status.serverReachable);
 */
export const getConnectivityStatus = async ({
  serverURL
}: { serverURL?: string }): Promise<ConnectivityStatus> => ({
  online: getInitialOnline(),
  serverReachable: serverURL ? await getInitialServerReachable(serverURL) : true ,
});

/**
 * Type of the listener function for connectivity status changes.
 * @callback Listener
 * @param {ConnectivityStatus} status - The current connectivity status snapshot.
 */
type Listener = (status: ConnectivityStatus) => void;

/**
 * Set of currently subscribed connectivity status listeners.
 * Listeners are called with the latest status when the status changes.
 */
const listeners = new Set<Listener>();

/**
 * Subscribes a callback to be notified whenever the connectivity status changes
 * (either online/offline or server reachability changes). Returns an unsubscribe function.
 * Callbacks are not called immediately upon subscription; they are only notified on changes.
 *
 * @param {Listener} cb - The callback function to invoke on status changes.
 * @returns {() => void} Unsubscribe function.
 *
 * @example
 * const unsubscribe = onConnectivityStatusChange((status) => {
 *   console.log("Connectivity changed:", status);
 * });
 * // ...
 * unsubscribe(); // to remove the listener
 */
export const onConnectivityStatusChange = (cb: Listener): () => void => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

/**
 * Notifies all registered listeners with a cloned (immutable) copy of the current status.
 */
function notifyListeners() {
  listeners.forEach((cb) => cb({ ...currentStatus }));
}

/**
 * Holds the current online and server reachability state.
 * Optimistically initialized for SSR, but will be updated as real checks are performed.
 */
let currentStatus: ConnectivityStatus = {
  online: getInitialOnline(),
  serverReachable: true, // If SSR, true; otherwise updates in real polling
};

/**
 * Handle for the active polling interval, if any.
 */
let poller: ReturnType<typeof setInterval> | null = null;

/**
 * Starts polling the connectivity status at a fixed interval.
 * This repeatedly checks both the browser's online status and server reachability,
 * and notifies registered listeners if anything changes.
 *
 * If a poller is already running, it is cleared and restarted.
 *
 * @param {string} [serverURL] - Optional. The server URL to check for reachability.
 * @returns {() => void} Function to call to stop polling.
 *
 * @example
 * // Start polling for status
 * const stop = startConnectivityPolling("https://api.example.com/ping");
 * // ...later, stop polling
 * stop();
 *
 * @throws {Error} Will log a clear error if polling itself fails internally,
 * but will never throw errors to subscribers; polling continues in the face of polling errors.
 */
export function startConnectivityPolling(serverURL?: string): () => void {
  // Clear existing poller if already running
  if (poller) clearInterval(poller);

  /**
   * Performs a single poll of online and server reachability status.
   * If status has changed, notifies all listeners.
   */
  const doPoll = async () => {
    try {
      // Determine browser online status.
      // In SSR/fallback cases, assume online: true.
      const online =
        typeof navigator === "undefined" ? true : navigator.onLine;

      let serverReachable = false;
      try {
        // Check network/server connectivity; will throw on fetch/abort error.
        serverReachable = await checkConnection(serverURL);
      } catch (err) {
        // Network/server check failed; set unreachable and continue polling
        serverReachable = false;
      }

      const nextStatus: ConnectivityStatus = { online, serverReachable };

      // Notify listeners only if the state has changed.
      if (
        currentStatus.online !== nextStatus.online ||
        currentStatus.serverReachable !== nextStatus.serverReachable
      ) {
        currentStatus = nextStatus;
        notifyListeners();
      } else {
        // Retain current status for reference.
        currentStatus = nextStatus;
      }
    } catch (e) {
      // If polling fails, do NOT stop the poller!
      // Log a clear error for developer debugging.
      // eslint-disable-next-line no-console
      console.error(
        "[Offline Status] Error in connectivity polling. Polling will continue.",
        e
      );
    }
  };

  // Run an immediate poll, then begin periodic polling.
  doPoll();
  poller = setInterval(doPoll, CHECK_INTERVAL);

  /**
   * Stops the connectivity polling (clears the interval).
   */
  return () => {
    if (poller) {
      clearInterval(poller);
      poller = null;
    }
  };
}