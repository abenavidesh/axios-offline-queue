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
export declare const getConnectivityStatus: ({ serverURL }: {
    serverURL?: string;
}) => Promise<ConnectivityStatus>;
/**
 * Type of the listener function for connectivity status changes.
 * @callback Listener
 * @param {ConnectivityStatus} status - The current connectivity status snapshot.
 */
type Listener = (status: ConnectivityStatus) => void;
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
export declare const onConnectivityStatusChange: (cb: Listener) => () => void;
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
export declare function startConnectivityPolling(serverURL?: string): () => void;
export {};
