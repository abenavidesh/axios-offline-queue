import { AxiosError, AxiosResponse } from 'axios';
import { QueuedRequest } from './types';
/**
 * Payload for successfully processed requests.
 */
export type RequestSuccessPayload = {
    /** The offline-queued request object. */
    request: QueuedRequest;
    /** Indicates this was a successful result. Always `true`. */
    success: true;
    /** The Axios response returned from the server. */
    response: AxiosResponse;
};
/**
 * Payload for requests that failed processing.
 */
export type RequestFailedPayload = {
    /** The offline-queued request object. */
    request: QueuedRequest;
    /** Indicates this was a failed operation. Always `false`. */
    success: false;
    /** HTTP status code if available, or `null`. */
    status: number | null;
    /** The error object returned by Axios, or a fallback error with code and message. */
    error: AxiosError | {
        code?: string;
        message?: string;
    };
};
/**
 * Payload when the entire offline queue has been processed.
 *
 * This payload is always `undefined`.
 */
export type QueueProcessedPayload = undefined;
/**
 * Payload for changes in network or server connection state.
 */
export type ConnectionChangePayload = {
    /**
     * Type of connectivity change:
     * - `"network"`: General browser connectivity (e.g. `navigator.onLine`)
     * - `"server"`: Connectivity to a specific configured server (using Axios)
     */
    kind: "network" | "server";
    /** Whether the browser is considered online (may be unreliable). */
    online: boolean;
    /** Whether the designated server is reachable. */
    serverReachable: boolean;
    /** Optional error details if a connection error occurred. */
    error?: AxiosError | {
        code?: string;
        message?: string;
    };
};
/**
 * Mapping of all event names to their corresponding payload type.
 */
export type QueueEventMap = {
    "queue-processed": QueueProcessedPayload;
    "request-success": RequestSuccessPayload;
    "request-failed": RequestFailedPayload;
    "request-processed": RequestSuccessPayload | RequestFailedPayload;
    "connection-lost": ConnectionChangePayload;
    "connection-restored": ConnectionChangePayload;
};
/**
 * String type for all queue event names.
 */
export type QueueEvent = keyof QueueEventMap;
/**
 * Generic event handler type for a specific offline queue event.
 */
export type QueueEventHandler<E extends QueueEvent> = (payload: QueueEventMap[E]) => void;
/**
 * Subscribe to an offline queue event.
 *
 * Allows your application to listen for changes in queue state, connectivity, or result of retry attempts.
 *
 * @template E Event name type.
 * @param {E} event - The name of the event to listen for (e.g., `'queue-processed'`, `'request-success'`).
 * @param {QueueEventHandler<E>} handler - The callback to invoke when the event occurs.
 * @returns {() => void} Function that removes (`unsubscribe`) the handler from the event.
 *
 * @example
 * ```typescript
 * const unsubscribe = onQueueEvent('request-failed', (payload) => {
 *   console.log('A queued request failed', payload);
 * });
 *
 * // Later, when you want to remove the listener:
 * unsubscribe();
 * ```
 *
 * @throws Does not throw. If an invalid event is provided, TypeScript will catch it at compile time.
 */
export declare const onQueueEvent: <E extends QueueEvent>(event: E, handler: QueueEventHandler<E>) => (() => void);
/**
 * Remove a previously registered listener from an event on the offline queue.
 *
 * @template E Event name type.
 * @param {E} event - The event name the handler was registered under.
 * @param {QueueEventHandler<E>} handler - The handler function to remove.
 *
 * @example
 * ```typescript
 * offQueueEvent('request-success', mySuccessHandler);
 * ```
 *
 * @throws Does not throw.
 */
export declare const offQueueEvent: <E extends QueueEvent>(event: E, handler: QueueEventHandler<E>) => void;
/**
 * Dispatch (emit) an offline queue event to all registered listeners for the event.
 * Used by the internal queue management and connection logic.
 *
 * @template E Event name type.
 * @param {E} event - The event name to emit.
 * @param {QueueEventMap[E]} payload - The event data to pass to listeners.
 *
 * @example
 * ```typescript
 * emitQueueEvent('connection-lost', { kind: "network", online: false, serverReachable: false });
 * ```
 *
 * @internal
 * @throws Does not throw. If a listener throws, logs an error and continues with others.
 */
export declare const emitQueueEvent: <E extends QueueEvent>(event: E, payload: QueueEventMap[E]) => void;
