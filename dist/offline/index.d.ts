import { AxiosInstance, AxiosError } from 'axios';
export { onQueueEvent, offQueueEvent } from './suscriptions';
export { getConnectivityStatus } from './status';
/**
 * Initializes the offline support system for your application.
 *
 * This function sets up:
 * - The offline request queue for your provided Axios instance.
 * - Event listeners to monitor network connectivity changes.
 * - Automatic processing of queued requests once connectivity is restored.
 * - Cleanup logic for event listeners on window unload.
 *
 * @param {AxiosInstance} apiClient - The Axios instance used for network requests.
 * @returns {void}
 *
 * @example
 * import { initializeOfflineSupport } from 'your-offline-package';
 * import axios from 'axios';
 *
 * const api = axios.create();
 * initializeOfflineSupport(api);
 *
 * // Now, network requests will be queued when offline and retried once online.
 */
export declare const initializeOfflineSupport: (apiClient: AxiosInstance) => void;
/**
 * Determines if a given error was caused by a loss of network connectivity.
 *
 * Checks both the browser's online status and common Axios error codes/messages
 * to robustly differentiate connectivity errors from other types of errors.
 *
 * @param {AxiosError | Error} error - The error object to evaluate.
 * @returns {boolean} True if the error was caused by being offline, else false.
 *
 * @example
 * try {
 *   await api.get('/some-resource');
 * } catch (error) {
 *   if (isOfflineError(error)) {
 *     // Inform the user or queue the request for later retry.
 *   }
 * }
 */
export declare const isOfflineError: (error: AxiosError | Error) => boolean;
/**
 * Returns the number of requests currently pending in the offline queue.
 *
 * Use this to show users how many actions will be retried once online,
 * or for internal metrics and diagnostics.
 *
 * @returns {number} The count of queued offline requests.
 *
 * @example
 * const queueSize = getOfflineQueueSize();
 * if (queueSize > 0) {
 *   alert(`${queueSize} actions will be synced when back online.`);
 * }
 */
export declare const getOfflineQueueSize: () => number;
/**
 * Clears all requests in the offline queue.
 *
 * This is useful for administrative or debugging operations,
 * or if you need to reset the offline state for the current user session.
 *
 * @returns {void}
 *
 * @example
 * // Flush the offline queue on user logout
 * clearOfflineQueue();
 */
export declare const clearOfflineQueue: () => void;
/**
 * Exposes the offline request queue for advanced or direct control.
 * Developers can use this to manually manipulate the queue in rare cases,
 * though most apps should interact with the higher-level API instead.
 */
export { offlineQueue } from './queue';
/**
 * @default
 * The default export is the initializeOfflineSupport function for convenience.
 */
export default initializeOfflineSupport;
