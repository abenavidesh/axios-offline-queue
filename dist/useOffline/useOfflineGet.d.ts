/**
 * A generic interface for client-side key/value storage.
 *
 * @template T Type of data stored.
 */
export type StorageAdapter<T> = {
    /**
     * Retrieve a value by its key.
     * @param {string} key - The storage key.
     * @returns {T | null} The stored value, or null if not found.
     */
    get: (key: string) => T | null;
    /**
     * Persist a value by key.
     * @param {string} key - The storage key.
     * @param {T} value - The value to store.
     */
    set: (key: string, value: T) => void;
    /**
     * Remove a stored value by key.
     * @param {string} key - The storage key.
     */
    remove?: (key: string) => void;
};
/**
 * Options for configuring the `useOfflineGet` React hook.
 *
 * @template TData The type of data being fetched and cached.
 */
export type UseOfflineGetOptions<TData> = {
    /**
     * Unique key for caching the response.
     * Used as the key in storage (default is `localStorage`).
     */
    key: string;
    /**
     * Function that performs the GET request.
     * Can use Axios, fetch, or any promise-based client.
     */
    fetcher: () => Promise<TData>;
    /**
     * Initial data to use before the first load.
     */
    initialData?: TData;
    /**
     * Storage adapter. Uses localStorage by default.
     * Allows customizing where/how the latest response is saved.
     * Takes precedence over `serialize`/`deserialize` if provided.
     */
    storage?: StorageAdapter<TData>;
    /**
     * Function to serialize data before storing in default storage.
     * Can be used for encryption, custom transformations, etc.
     * Defaults to `JSON.stringify`.
     */
    serialize?: (value: TData) => string;
    /**
     * Function to deserialize data from the default storage.
     * Must be the inverse of `serialize`.
     * Defaults to `JSON.parse`.
     */
    deserialize?: (raw: string) => TData;
    /**
     * If false, the hook does not fire the initial request automatically.
     * Defaults to true.
     */
    enabled?: boolean;
};
/**
 * The state returned by the `useOfflineGet` hook.
 *
 * @template TData The type of data fetched.
 */
export type UseOfflineGetState<TData> = {
    /**
     * The currently loaded data or `null` if not loaded.
     */
    data: TData | null;
    /**
     * Whether a fetch is currently in progress.
     */
    isLoading: boolean;
    /**
     * Any error caught during fetching, or `null` if none.
     */
    error: unknown;
    /**
     * True if the data comes from cache (last successful result); otherwise, false.
     */
    isFromCache: boolean;
    /**
     * True if any value is cached for this key.
     */
    hasCache: boolean;
};
/**
 * React hook for performing GET requests that are NOT queued, but can return the last successful result
 * from cache if the request fails due to network or server errors.
 *
 * Automatically caches each successful response using a unique key, and returns cached data
 * when offline or on network failure.
 *
 * @template TData The type of data being fetched and cached.
 * @param {UseOfflineGetOptions<TData>} options - Configuration options.
 * @returns {UseOfflineGetState<TData> & {refetch: () => Promise<void>}} Hook state and manual refetch function.
 *
 * @example
 * ```tsx
 * // Basic usage with Axios and TypeScript
 * const { data, isLoading, error, isFromCache, refetch } = useOfflineGet<User[]>({
 *   key: "users",
 *   fetcher: () => api.get<User[]>("/users").then(r => r.data),
 * });
 * ```
 *
 * @example
 * ```tsx
 * // Using custom serializer/deserializer for localstorage encryption
 * const { data } = useOfflineGet<SecretData>({
 *   key: "encryptedData",
 *   fetcher: fetchSecrets,
 *   serialize: encFn,
 *   deserialize: decFn,
 * });
 * ```
 *
 * @throws {Error} Throws if fetch fails and there is no cache.
 */
export declare function useOfflineGet<TData>(options: UseOfflineGetOptions<TData>): UseOfflineGetState<TData> & {
    refetch: () => Promise<void>;
};
