import type { QueuedRequest } from "./types";

/**
 * Storage key used to persist the offline queue in localStorage.
 * @private
 */
const STORAGE_KEY = "offline_queue";

/**
 * Maximum number of queued requests allowed to be stored.
 * If this size is exceeded, the oldest request is removed.
 * @private
 */
const MAX_STORAGE_SIZE = 1000;

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
export const getStoredRequests = (): QueuedRequest[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch (error) {
    // Log storage read errors for debugging purposes
    console.error(
      "[Offline Storage] Failed to read stored requests from localStorage. Returning an empty queue.",
      error
    );
    return [];
  }
};

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
export const saveRequest = (request: QueuedRequest): boolean => {
  try {
    // Get a copy of the current requests
    const requests = getStoredRequests();

    // If the storage limit is reached, remove the oldest request (FIFO)
    if (requests.length >= MAX_STORAGE_SIZE) {
      requests.shift();
    }

    requests.push(request);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
    return true;
  } catch (error) {
    // Log save errors for easier troubleshooting.
    console.error(
      "[Offline Storage] Failed to save the request to localStorage. Request was not queued.",
      error
    );
    return false;
  }
};

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
export const removeRequest = (id: string): boolean => {
  try {
    const requests = getStoredRequests();
    // Filter out the request with the given ID
    const filtered = requests.filter((req) => req.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    return true;
  } catch (error) {
    // Log removal errors for better diagnostics
    console.error(
      `[Offline Storage] Failed to remove request with ID: ${id}. Request remains in queue.`,
      error
    );
    return false;
  }
};

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
export const clearStoredRequests = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    // Log errors that occur during clearing
    console.error(
      "[Offline Storage] Failed to clear stored requests in localStorage. Requests may still be present.",
      error
    );
  }
};

/**
 * Returns the current number of offline requests stored.
 *
 * @returns {number} The count of stored requests.
 *
 * @example
 * const count = getStoredRequestsCount();
 * if (count > 100) { ... }
 */
export const getStoredRequestsCount = (): number => {
  return getStoredRequests().length;
};
