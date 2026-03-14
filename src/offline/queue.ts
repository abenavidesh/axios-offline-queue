import type {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosError,
  AxiosResponse,
} from "axios";
import {
  emitQueueEvent,
  onQueueEvent,
  offQueueEvent,
  type QueueEvent,
  type QueueEventHandler,
} from "./suscriptions";
import type { QueuedRequest, QueueProcessCallback } from "./types";
import {
  getStoredRequests,
  saveRequest,
  removeRequest,
  clearStoredRequests,
} from "./storage";
import { checkConnection } from "./connection";

/**
 * The maximum number of times a failed queued request will be retried before being removed from the queue.
 */
const MAX_RETRY_COUNT = 20;

/**
 * The delay (ms) between retries for failed requests. Delay increases with each retry.
 */
const RETRY_DELAY = 1000; // 1 second between retries

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
export class OfflineQueue {
  private apiClient: AxiosInstance | null = null;
  private isProcessing = false;
  private processCallback: QueueProcessCallback | null = null;
  private hasServerConnectivityIssue = false;

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
  on<E extends QueueEvent>(
    event: E,
    handler: QueueEventHandler<E>,
  ): () => void {
    return onQueueEvent(event, handler);
  }

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
  off<E extends QueueEvent>(event: E, handler: QueueEventHandler<E>): void {
    offQueueEvent(event, handler);
  }

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
  initialize(apiClient: AxiosInstance): void {
    this.apiClient = apiClient;
    this.loadStoredRequests();
  }

  /**
   * Loads and reports any pending (persisted) requests from storage.
   * @private
   */
  private loadStoredRequests(): void {
    const stored = getStoredRequests();
    if (stored.length > 0) {
      console.log(
        `[Offline Queue] Loaded ${stored.length} pending requests.`
      );
    }
  }

  /**
   * Generates a unique ID for a newly queued request.
   * @private
   * @returns {string} Unique request ID.
   */
  private generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

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
  async addRequest(config: AxiosRequestConfig): Promise<QueuedRequest> {
    const request: QueuedRequest = {
      id: this.generateRequestId(),
      config,
      timestamp: Date.now(),
      retryCount: 0,
    };

    saveRequest(request);
    console.log(`[Offline Queue] Request added to queue: ${request.id}`);

    // If online (according to checkConnection), try to process the queue immediately.
    if (await checkConnection()) {
      this.processQueue();
    }

    return request;
  }

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
  async processQueue(): Promise<void> {
    if (!this.apiClient) {
      console.warn("[Offline Queue] Error: API client is not initialized. Call offlineQueue.initialize() first.");
      return;
    }
    // Prevent re-entrancy
    if (this.isProcessing) {
      return;
    }

    const isOnline = await checkConnection();
    if (!isOnline) {
      console.log("[Offline Queue] Offline: requests will not be processed.");
      return;
    }

    this.isProcessing = true;
    const requests = getStoredRequests();

    if (requests.length === 0) {
      this.isProcessing = false;
      return;
    }

    console.log(
      `[Offline Queue] Processing ${requests.length} queued request(s).`
    );

    // Process requests sequentially for safety (to avoid duplicate/mutate side effects)
    for (const request of requests) {
      try {
        await this.processRequest(request);
      } catch (error) {
        console.error(
          `[Offline Queue] Error while processing request ${request.id}:`,
          error,
        );
      }
    }

    this.isProcessing = false;

    emitQueueEvent("queue-processed", undefined);
  }

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
  private async processRequest(request: QueuedRequest): Promise<void> {
    if (!this.apiClient) return;

    // Ensure connection before processing each request
    const isOnline = await checkConnection();
    if (!isOnline) {
      console.log(
        `[Offline Queue] Offline: Request ${request.id} remains queued.`
      );
      return;
    }

    try {
      // Linear backoff based on retry count
      if (request.retryCount > 0) {
        await new Promise((resolve) =>
          setTimeout(resolve, RETRY_DELAY * request.retryCount),
        );
      }

      // Remove transformRequest/transformResponse because functions can't be serialized to storage.
      // This ensures successful resending of plain requests.
      const { transformRequest, transformResponse, ...sanitizedConfig } =
        request.config;

      const response: AxiosResponse = await this.apiClient(sanitizedConfig);

      // Request succeeded, remove from queue and notify listeners
      removeRequest(request.id);
      console.log(
        `[Offline Queue] Request ${request.id} sent successfully.`
      );

      if (this.processCallback) {
        this.processCallback(request, true);
      }

      // If there was a prior server connectivity issue, and this request now works, consider it restored
      if (this.hasServerConnectivityIssue && navigator.onLine) {
        this.hasServerConnectivityIssue = false;
        emitQueueEvent("connection-restored", {
          kind: "server",
          online: true,
          serverReachable: true,
        });
      }

      emitQueueEvent("request-success", {
        request,
        success: true,
        response,
      });
      emitQueueEvent("request-processed", {
        request,
        success: true,
        response,
      });
    } catch (error: unknown) {
      const axiosError = error as AxiosError | { code?: string; message?: string };
      const status = (axiosError as AxiosError).response?.status ?? null;

      // Detect network-related errors (loss of network or server unreachability)
      const isNetworkError =
        !navigator.onLine ||
        axiosError.code === "ERR_NETWORK" ||
        axiosError.message?.includes("Network Error") ||
        axiosError.message?.includes("timeout");

      if (isNetworkError) {
        console.log(
          `[Offline Queue] Network error: Request ${request.id} stays in queue.`
        );

        // If the browser has connectivity but the server is unreachable, consider it a server-side loss
        if (navigator.onLine && !this.hasServerConnectivityIssue) {
          this.hasServerConnectivityIssue = true;
          emitQueueEvent("connection-lost", {
            kind: "server",
            online: true,
            serverReachable: false,
            error: axiosError,
          });
        }
        return;
      }

      // Client errors (4xx) should not be retried; remove from queue.
      if (status && status >= 400 && status < 500) {
        removeRequest(request.id);
        console.warn(
          `[Offline Queue] Request ${request.id} removed from queue due to unrecoverable client error (HTTP ${status}).`
        );

        if (this.processCallback) {
          this.processCallback(request, false);
        }

        emitQueueEvent("request-failed", {
          request,
          success: false,
          status,
          error: axiosError,
        });
        emitQueueEvent("request-processed", {
          request,
          success: false,
          status,
          error: axiosError,
        });
        return;
      }

      // For all other errors (e.g. 5xx), retry up to MAX_RETRY_COUNT
      if (request.retryCount >= MAX_RETRY_COUNT) {
        removeRequest(request.id);
        console.error(
          `[Offline Queue] Request ${request.id} removed after ${MAX_RETRY_COUNT} failed attempts.`
        );

        if (this.processCallback) {
          this.processCallback(request, false);
        }

        emitQueueEvent("request-failed", {
          request,
          success: false,
          status,
          error: axiosError,
        });
        emitQueueEvent("request-processed", {
          request,
          success: false,
          status,
          error: axiosError,
        });
      } else {
        // Increment retry count and persist back to storage
        request.retryCount++;
        const requests = getStoredRequests();
        const index = requests.findIndex((r) => r.id === request.id);
        if (index !== -1) {
          requests[index] = request;
          localStorage.setItem("offline_queue", JSON.stringify(requests));
        }
      }
    }
  }

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
  setProcessCallback(callback: QueueProcessCallback): void {
    this.processCallback = callback;
  }

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
  getQueueSize(): number {
    return getStoredRequests().length;
  }

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
  clearQueue(): void {
    clearStoredRequests();
    console.log("[Offline Queue] Queue cleared.");
  }
}

/**
 * Singleton instance of {@link OfflineQueue} for use in most applications.
 *
 * @see OfflineQueue
 */
export const offlineQueue = new OfflineQueue();