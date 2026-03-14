import { AxiosRequestConfig } from 'axios';
/**
 * Represents a single HTTP request that has been queued for offline processing.
 *
 * @property {string} id - A unique identifier for the queued request.
 * @property {AxiosRequestConfig} config - The complete Axios request configuration object.
 * @property {number} timestamp - The time (in ms since UNIX epoch) when the request was enqueued.
 * @property {number} retryCount - How many times the request has been retried.
 *
 * @example
 * ```typescript
 * const req: QueuedRequest = {
 *   id: "d327c7ad",
 *   config: {
 *     url: "/api/endpoint",
 *     method: "POST",
 *     data: { foo: "bar" },
 *   },
 *   timestamp: Date.now(),
 *   retryCount: 0,
 * };
 * ```
 */
export interface QueuedRequest {
    id: string;
    config: AxiosRequestConfig;
    timestamp: number;
    retryCount: number;
}
/**
 * Represents the current connection status for the offline queue system.
 *
 * - `"online"`: The client has Internet connectivity (according to browser APIs).
 * - `"offline"`: The client is offline (no network connectivity detected).
 * - `"checking"`: The connectivity state is being determined.
 *
 * @typedef {"online" | "offline" | "checking"} ConnectionStatus
 *
 * @example
 * ```typescript
 * let status: ConnectionStatus = "online";
 * if (!navigator.onLine) status = "offline";
 * ```
 */
export type ConnectionStatus = "online" | "offline" | "checking";
/**
 * Callback function signature for when a queued request is processed.
 *
 * This type is used for hooks or subscription functions that notify about the
 * processing result (success or failure) of a queued request.
 *
 * @param {QueuedRequest} request - The request that was processed.
 * @param {boolean} success - Indicates if the request was successfully processed (`true`) or failed (`false`).
 *
 * @returns {void}
 *
 * @example
 * ```typescript
 * const onProcess: QueueProcessCallback = (request, success) => {
 *   if (success) {
 *     console.log(`Request ${request.id} sent successfully!`);
 *   } else {
 *     console.log(`Request ${request.id} failed after retries.`);
 *   }
 * };
 * ```
 */
export type QueueProcessCallback = (request: QueuedRequest, success: boolean) => void;
