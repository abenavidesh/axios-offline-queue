import { AxiosError, AxiosResponse } from "axios";
import { isOfflineError, offlineQueue } from "../offline";
export { useOfflineGet } from "./useOfflineGet";
export { offlineGetHandler } from "./offlineGetHandler";

/**
 * Properties for configuring the `offlineHook` interceptor.
 *
 * @typedef {Object} OfflineHookProps
 * @property {boolean} [useLogs=false] - If true, logs responses and handled errors to the console.
 */
export type OfflineHookProps = {
  useLogs?: boolean;
};

/**
 * Returns a tuple of Axios response and error interceptors. 
 * 
 * These interceptors enable offline support by:
 * - Logging API responses and errors (when enabled).
 * - Automatically queuing non-GET requests or GET requests with the `X-Queue-Offline` header
 *   when the client is offline, so they can be retried later.
 * 
 * Use this hook by applying its return value as interceptors for an Axios instance:
 *
 * @param {OfflineHookProps} props - Options for the hook.
 * @param {boolean} [props.useLogs=false] - Enables or disables logging.
 * 
 * @returns {[
 *   (response: AxiosResponse) => AxiosResponse,
 *   (error: AxiosError) => Promise<never>
 * ]} 
 *    Tuple containing the success and error interceptor respectively.
 * 
 * @example
 * import axios from 'axios';
 * import { offlineHook } from 'axios-offline-queue';
 * 
 * const apiClient = axios.create();
 * const [onResponse, onError] = offlineHook({ useLogs: true });
 * 
 * apiClient.interceptors.response.use(onResponse, onError);
 * 
 * @throws {Error} If the error is not due to offline connectivity, or if it can't be queued, the original error is rethrown.
 */
export function offlineHook({
  useLogs = false,
}: OfflineHookProps): [
  (response: AxiosResponse) => AxiosResponse,
  (error: AxiosError) => Promise<never>
] {
  const onResponse = (response: AxiosResponse): AxiosResponse => {
    if (useLogs) {
      console.log(`[API Response] ${response.status} ${response.config.url}`);
    }
    return response;
  };

  const onError = async (error: AxiosError): Promise<never> => {
    if (useLogs) {
      console.error(
        "[API Response Error]",
        error.response?.data || error.message,
      );
    }

    // If the error is related to offline connectivity, attempt to queue the request for later
    if (isOfflineError(error)) {
      const requestConfig = error.config;
      if (requestConfig) {
        // Only queue non-GET requests, or GET requests with the X-Queue-Offline header
        // Determines if the request should be queued:
        // - If "X-Queue-Offline" header is explicitly "false", do NOT queue (even if not GET).
        // - If "X-Queue-Offline" is "true", ALWAYS queue.
        // - Otherwise, queue if the method is not GET.
        let shouldQueue = false;
        const headerValue = requestConfig.headers?.["X-Queue-Offline"];

          if (typeof headerValue === "undefined" || headerValue === null) {
            shouldQueue = requestConfig.method?.toUpperCase() !== "GET";
          } else if (headerValue === "true") {
            shouldQueue = true;
          } else if (headerValue === "false") {
            shouldQueue = false;
          } else {
            shouldQueue = requestConfig.method?.toUpperCase() !== "GET";
          }

        if (shouldQueue) {
          // Add the failed request to the offline queue for retrying when back online
          await offlineQueue.addRequest(requestConfig);

          if (useLogs) {
            console.log(
              "[API] Request has been added to the offline queue due to connectivity issues.",
            );
          }
        }
      }
    }

    // Always rethrow the error to be handled by the caller
    return Promise.reject(error);
  };

  return [onResponse, onError];
}

export default offlineHook;