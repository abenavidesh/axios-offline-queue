import { QueuedRequest } from './types';
/**
 * Retrieves all queued requests stored in localStorage.
 *
 * @returns {QueuedRequest[]} Array of queued requests. Returns an empty array if none are found, or if a storage error occurs.
 *
 * @example
 * const requests = getStoredRequests();
 * requests.forEach(req => { ... });
 *
 * @throws Will not throw an error, but will log and safely return [] on any failure.
 */
export declare const getStoredRequests: () => QueuedRequest[];
/**
 * Persists a new request to the offline storage queue.
 * If the queue exceeds {@link MAX_STORAGE_SIZE}, the oldest request will be dropped to make space.
 *
 * @param {QueuedRequest} request - The request to be queued.
 * @returns {boolean} True if the request was saved successfully, false otherwise.
 *
 * @example
 * const result = saveRequest({ id: "123", url: "/api", ... });
 * if (!result) {
 *   // Handle failed storage operation
 * }
 *
 * @throws Will not throw; errors are logged and the function returns false on failure.
 */
export declare const saveRequest: (request: QueuedRequest) => boolean;
/**
 * Removes a queued request from localStorage by its unique ID.
 *
 * @param {string} id - The ID of the request to remove.
 * @returns {boolean} True if the request was removed (or did not exist), false if an error occurred.
 *
 * @example
 * const success = removeRequest("request-abc");
 * if (!success) {
 *   // Handle removal failure
 * }
 *
 * @throws Will not throw; errors are logged and returns false on error.
 */
export declare const removeRequest: (id: string) => boolean;
/**
 * Clears all queued requests from offline storage.
 *
 * @returns {void}
 *
 * @example
 * clearStoredRequests();
 *
 * @throws Will not throw; logs any errors encountered.
 */
export declare const clearStoredRequests: () => void;
/**
 * Returns the current number of offline requests stored.
 *
 * @returns {number} The count of stored requests.
 *
 * @example
 * const count = getStoredRequestsCount();
 * if (count > 100) { ... }
 */
export declare const getStoredRequestsCount: () => number;
