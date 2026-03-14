import { AxiosError, AxiosResponse } from 'axios';
export { useOfflineGet } from './useOfflineGet';
export { offlineGetHandler } from './offlineGetHandler';
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
 * Returns an array of Axios response and error interceptors.
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
 * @returns {[function(AxiosResponse): AxiosResponse, function(AxiosError): Promise<never>]}
 *    Array containing the success and error interceptor respectively.
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
export declare function offlineHook({ useLogs }: OfflineHookProps): (((response: AxiosResponse) => AxiosResponse) | ((error: AxiosError) => Promise<never>))[];
export default offlineHook;
