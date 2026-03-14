import { AxiosInstance, AxiosRequestConfig } from 'axios';
import { QueueEvent, QueueEventHandler } from './suscriptions';
import { QueuedRequest, QueueProcessCallback } from './types';
/**
 * OfflineQueue provides robust queuing and automatic retry logic for HTTP requests
 * made via Axios when network connectivity is temporarily unavailable.
 *
 * - Requests are persisted in browser storage and retried automatically when connectivity is restored.
 * - Only non-GET requests, and GET requests marked with the `X-Queue-Offline=true` header, are queued.
 * - Configurable event handlers allow hooks for retry results and queue state changes.
 * - Retries use exponential backoff (linear backoff * retry count).
 *
 * @example
 * ```typescript
 * import { offlineQueue } from 'your-package/offline/queue';
 * import axios from 'axios';
 *
 * // Initialize queue with your Axios instance
 * offlineQueue.initialize(axios.create());
 *
 * // Listen for queue events
 * offlineQueue.on('request-success', ({ request, response }) => {
 *   console.log(`Request ${request.id} sent!`);
 * });
 *
 * // Add a request to the queue manually
 * offlineQueue.addRequest({ url: '/api/my-endpoint', method: 'POST', data: { foo: "bar" } });
 * ```
 */
export declare class OfflineQueue {
    private apiClient;
    private isProcessing;
    private processCallback;
    private hasServerConnectivityIssue;
    /**
     * Subscribes to queue-related events.
     *
     * @param {E} event - The queue event to listen for (e.g., `'queue-processed'`, `'request-success'`, etc.).
     * @param {QueueEventHandler<E>} handler - The callback function for the event.
     * @returns {() => void} - Call this function to unsubscribe the handler.
     *
     * @example
     * ```typescript
     * const unsubscribe = offlineQueue.on('request-success', ({ request }) => {
     *   console.log(request);
     * });
     * // To remove the handler later:
     * unsubscribe();
     * ```
     */
    on<E extends QueueEvent>(event: E, handler: QueueEventHandler<E>): () => void;
    /**
     * Unsubscribes a handler from queue-related events.
     *
     * @param {E} event - The event name.
     * @param {QueueEventHandler<E>} handler - The registered handler to remove.
     *
     * @example
     * ```typescript
     * offlineQueue.off('queue-processed', myHandler);
     * ```
     */
    off<E extends QueueEvent>(event: E, handler: QueueEventHandler<E>): void;
    /**
     * Initializes the queue with an Axios instance.
     * Must be called before requests can be retried.
     *
     * @param {AxiosInstance} apiClient - Your preconfigured Axios instance.
     *
     * @example
     * ```typescript
     * offlineQueue.initialize(axios.create());
     * ```
     */
    initialize(apiClient: AxiosInstance): void;
    /**
     * Loads and reports any pending (persisted) requests from storage.
     * @private
     */
    private loadStoredRequests;
    /**
     * Generates a unique ID for a newly queued request.
     * @private
     * @returns {string} Unique request ID.
     */
    private generateRequestId;
    /**
     * Adds a request to the offline queue for retry upon connectivity.
     *
     * @param {AxiosRequestConfig} config - The Axios request configuration.
     * @returns {Promise<QueuedRequest>} The queued request object.
     * @throws {Error} If config is invalid.
     *
     * @example
     * ```typescript
     * await offlineQueue.addRequest({ url: '/api/data', method: 'POST', data: {...} });
     * ```
     */
    addRequest(config: AxiosRequestConfig): Promise<QueuedRequest>;
    /**
     * Processes all pending requests in the queue, attempting to send each via the configured Axios instance.
     * If an error occurs, each request is retried up to MAX_RETRY_COUNT.
     * Individual processing is handled by {@link processRequest}.
     * Emits 'queue-processed' event after processing.
     *
     * @returns {Promise<void>}
     *
     * @example
     * ```typescript
     * await offlineQueue.processQueue();
     * ```
     */
    processQueue(): Promise<void>;
    /**
     * Processes an individual queued request.
     * Automatically retries with increasing delay if transient or server errors (up to MAX_RETRY_COUNT).
     * Removes requests with client errors (HTTP 4xx) from the queue.
     *
     * @param {QueuedRequest} request - The queued request to process.
     * @returns {Promise<void>}
     *
     * @private
     * @example
     * ```typescript
     * // Not intended for public usage.
     * ```
     */
    private processRequest;
    /**
     * Assigns a callback function to be called after each request is processed (success or failure).
     * This is for advanced use cases: the majority of integrations use event listeners instead.
     *
     * @param {QueueProcessCallback} callback - Callback invoked when a request is processed.
     *
     * @example
     * ```typescript
     * offlineQueue.setProcessCallback((request, success) => {
     *   if (!success) alert(`Request ${request.id} failed!`);
     * });
     * ```
     */
    setProcessCallback(callback: QueueProcessCallback): void;
    /**
     * Returns the number of requests currently persisted in the queue.
     *
     * @returns {number} Count of queued requests.
     *
     * @example
     * ```typescript
     * const pending = offlineQueue.getQueueSize();
     * ```
     */
    getQueueSize(): number;
    /**
     * Clears the entire queue, removing all persisted requests.
     *
     * @returns {void}
     *
     * @example
     * ```typescript
     * offlineQueue.clearQueue();
     * ```
     */
    clearQueue(): void;
}
/**
 * Singleton instance of {@link OfflineQueue} for use in most applications.
 *
 * @see OfflineQueue
 */
export declare const offlineQueue: OfflineQueue;
