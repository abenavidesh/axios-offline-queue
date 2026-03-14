import { isOfflineError } from "../offline";
import { getConnectivityStatus } from "../offline";

/**
 * Interface for storage adapters used for caching data offline.
 * 
 * @template T The type of data handled by the storage adapter.
 */
export type StorageAdapter<T> = {
  /**
   * Retrieves the cached value for the given key.
   * @param {string} key - The unique storage key.
   * @returns {T | null} The cached value, or null if not found.
   */
  get: (key: string) => T | null;
  /**
   * Stores a value under the provided key.
   * @param {string} key - The unique storage key.
   * @param {T} value - The value to store.
   */
  set: (key: string, value: T) => void;
  /**
   * Removes the value associated with the key.
   * @param {string} key - The storage key to remove.
   */
  remove?: (key: string) => void;
};

/**
 * Configuration options for {@link offlineGetHandler}.
 *
 * @template TData The data shape expected from the fetcher.
 */
export type OfflineGetHandlerOptions<TData> = {
  /**
   * Unique key used to identify and cache the response in storage.
   */
  key: string;
  /**
   * Promise or function returning a promise for the data.
   * For example:
   *   - fetcher: api.get("/users")
   *   - fetcher: () => api.get("/users").then(r => r.data)
   */
  fetcher: Promise<TData> | (() => Promise<TData>);
  /**
   * Optional initial data. Returned immediately if provided and no cache exists.
   */
  initialData?: TData;
  /**
   * Optional custom storage adapter. Defaults to localStorage.
   * Allows customizing where/how the last response is saved.
   */
  storage?: StorageAdapter<TData>;
  /**
   * Optional custom serializer for values written to the default storage (localStorage).
   * Useful for encryption or transformations.
   * Ignored if a custom `storage` is provided.
   */
  serialize?: (value: TData) => string;
  /**
   * Optional custom deserializer for values read from the default storage.
   * Ignored if custom `storage` is provided.
   */
  deserialize?: (raw: string) => TData;
  /**
   * If set to false, disables data refresh and only returns cached/initial data.
   * Default: true.
   */
  enabled?: boolean;
};

/**
 * The result of {@link offlineGetHandler}.
 *
 * @template TData The data type returned.
 */
export type OfflineGetHandlerResult<TData> = {
  /** The data, or null if not available. */
  data: TData | null;
  /** Whether data is being loaded. Always false in this handler. */
  isLoading: boolean;
  /** Any error that may have occurred during fetching. */
  error: unknown;
  /** True if the data was loaded from cache, false if from fetcher. */
  isFromCache: boolean;
  /** True if any cached data was available (regardless of whether it was used). */
  hasCache: boolean;
};

/**
 * Internal helper to provide default localStorage interface with (optional) custom serialization.
 *
 * @template TData Type of value stored.
 * @param {function(TData): string} [serialize] - Optional custom serializer.
 * @param {function(string): TData} [deserialize] - Optional custom deserializer.
 * @returns {StorageAdapter<TData>} The default localStorage-based adapter.
 */
const createDefaultStorage = <TData,>(
  serialize?: (value: TData) => string,
  deserialize?: (raw: string) => TData,
): StorageAdapter<TData> => ({
  /**
   * Retrieve a value from localStorage.
   */
  get: (key: string) => {
    // localStorage not available (SSR or sandboxed env)
    if (typeof window === "undefined" || !window.localStorage) return null;
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return null;
      const parser = deserialize ?? ((value: string) => JSON.parse(value) as TData);
      return parser(raw);
    } catch (getError) {
      // Return null if parsing fails or localStorage throws.
      return null;
    }
  },
  /**
   * Store a value in localStorage.
   */
  set: (key: string, value: TData) => {
    if (typeof window === "undefined" || !window.localStorage) return;
    try {
      const stringifier =
        serialize ?? ((val: TData) => JSON.stringify(val) as string);
      const raw = stringifier(value);
      window.localStorage.setItem(key, raw);
    } catch (setError) {
      // Storage errors are ignored.
      // (E.g. storage full, quota exceeded, or serialization error)
    }
  },
  /**
   * Remove a value from localStorage.
   */
  remove: (key: string) => {
    if (typeof window === "undefined" || !window.localStorage) return;
    try {
      window.localStorage.removeItem(key);
    } catch (removeError) {
      // Storage errors are ignored.
    }
  },
});

/**
 * Fetches data with offline-first/cached behavior, using a storage backend or localStorage.
 * 
 * This handler can be used outside of React as a plain TypeScript/JS function.
 * 
 * ## Behavior
 * 1. Checks cache (storage/localStorage) for the requested key.
 *    - If available, returns cached data immediately as `isFromCache: true`.
 * 2. If `enabled` is false, returns cached/initial data without fetching.
 * 3. If offline, returns cached/initial data. (No fetch).
 * 4. Otherwise, runs the fetcher. 
 *    - On success: saves value to cache and returns it (`isFromCache: false`).
 *    - On error: if an offline/network error and cache exists, returns cached data (`isFromCache: true`).
 *      Otherwise, throws the error for the caller to handle.
 * 
 * @template TData The type of the data to fetch/cache.
 * @param {OfflineGetHandlerOptions<TData>} options - The handler options.
 * @returns {Promise<OfflineGetHandlerResult<TData>>} The resolved handler result.
 * 
 * @example <caption>Basic Usage</caption>
 * ```typescript
 * const { data, error } = await offlineGetHandler({
 *   key: "users",
 *   fetcher: api.get("/users").then(r => r.data),
 * });
 * ```
 * 
 * @example <caption>With Initial Data and Custom Storage</caption>
 * ```typescript
 * const customStorage: StorageAdapter<User[]> = {
 *   get: (key) => sessionStorage.getItem(key) ? JSON.parse(sessionStorage.getItem(key)!) : null,
 *   set: (key, value) => sessionStorage.setItem(key, JSON.stringify(value)),
 *   remove: (key) => sessionStorage.removeItem(key),
 * };
 * const { data } = await offlineGetHandler({
 *   key: "user_list",
 *   fetcher: () => fetchUsers(),
 *   initialData: [],
 *   storage: customStorage,
 * });
 * ```
 * 
 * @throws {Error} If the fetcher throws a non-network error and no valid cached data exists,
 * the original error is rethrown for the caller to handle.
 */
export const offlineGetHandler = async <TData,>(
  options: OfflineGetHandlerOptions<TData>,
): Promise<OfflineGetHandlerResult<TData>> => {
  const {
    key,
    fetcher,
    initialData,
    storage,
    serialize,
    deserialize,
    enabled = true,
  } = options;

  // Use custom storage if supplied, otherwise default to localStorage with optional serialization.
  const effectiveStorage =
    storage ?? createDefaultStorage<TData>(serialize, deserialize);

  let data: TData | null = initialData ?? null;
  let error: unknown = null;
  let isFromCache = false;
  let hasCache = false;

  // Attempt to load from cache immediately.
  const cached = effectiveStorage.get(key);
  if (cached !== null) {
    data = cached;
    isFromCache = true;
    hasCache = true;
  }

  // If not enabled, return immediately (skip refresh/fetch).
  if (!enabled) {
    return {
      data,
      isLoading: false,
      error,
      isFromCache,
      hasCache,
    };
  }

  // Online status: if offline, return cache/initial data.
  const { online } = await getConnectivityStatus({});
  if (!online) {
    return {
      data,
      isLoading: false,
      error,
      isFromCache,
      hasCache,
    };
  }

  // Standardize fetcher to always be () => Promise<TData>
  const runFetcher =
    typeof fetcher === "function" ? (fetcher as () => Promise<TData>) : () => fetcher;

  try {
    // Try to fetch new data
    const result = await runFetcher();
    data = result;
    isFromCache = false;
    hasCache = true;

    // Save fresh result to cache
    effectiveStorage.set(key, result);

    return {
      data,
      isLoading: false,
      error,
      isFromCache,
      hasCache,
    };
  } catch (err: unknown) {
    error = err;

    // If the error was network/offline, try returning cached data if available.
    if (err instanceof Error && isOfflineError(err)) {
      const cachedOnError = effectiveStorage.get(key);
      if (cachedOnError !== null) {
        // Return cached data on network error as a fallback.
        return {
          data: cachedOnError,
          isLoading: false,
          error: null,
          isFromCache: true,
          hasCache: true,
        };
      }
    }

    // If no usable cache, propagate error for the caller's handling.
    throw new Error(
      `[offlineGetHandler] Fetch failed and no cached data is available: ${err instanceof Error ? err.message : String(err)}`
    );
  }
};

