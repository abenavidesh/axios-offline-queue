import { useCallback, useEffect, useState } from "react";
import { isOfflineError } from "../offline";
import { getConnectivityStatus } from "../offline";

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
 * Creates a default StorageAdapter using `localStorage`.
 * Allows optional customization with serializers/deserializers.
 *
 * @template TData The type of data stored.
 * @param {(value: TData) => string} [serialize] - Optional custom serializer.
 * @param {(raw: string) => TData} [deserialize] - Optional custom deserializer.
 * @returns {StorageAdapter<TData>} The storage adapter using localStorage.
 */
const createDefaultStorage = <TData,>(
  serialize?: (value: TData) => string,
  deserialize?: (raw: string) => TData,
): StorageAdapter<TData> => ({
  get: (key: string) => {
    if (typeof window === "undefined" || !window.localStorage) return null;
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return null;
      // Use custom or default deserializer
      const parser = deserialize ?? ((value: string) => JSON.parse(value) as TData);
      return parser(raw);
    } catch (e) {
      // Could not parse the data
      return null;
    }
  },
  set: (key: string, value: TData) => {
    if (typeof window === "undefined" || !window.localStorage) return;
    try {
      // Use custom or default serializer
      const stringifier =
        serialize ?? ((val: TData) => JSON.stringify(val) as string);
      const raw = stringifier(value);
      window.localStorage.setItem(key, raw);
    } catch (e) {
      // Swallow storage errors (e.g. quota exceeded), as they're not actionable
    }
  },
  remove: (key: string) => {
    if (typeof window === "undefined" || !window.localStorage) return;
    try {
      window.localStorage.removeItem(key);
    } catch (e) {
      // Swallow storage errors
    }
  },
});

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
export function useOfflineGet<TData>(
  options: UseOfflineGetOptions<TData>,
): UseOfflineGetState<TData> & { refetch: () => Promise<void> } {
  const {
    key,
    fetcher,
    initialData,
    storage,
    serialize,
    deserialize,
    enabled = true,
  } = options;

  // Choose user-provided storage or fallback to localStorage-based adapter.
  const effectiveStorage =
    storage ?? createDefaultStorage<TData>(serialize, deserialize);

  const [data, setData] = useState<TData | null>(initialData ?? null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<unknown>(null);
  const [isFromCache, setIsFromCache] = useState<boolean>(false);
  const [hasCache, setHasCache] = useState<boolean>(false);

  /**
   * Load initial cache if it exists.
   */
  useEffect(() => {
    const cached = effectiveStorage.get(key);
    if (cached !== null) {
      setData(cached);
      setHasCache(true);
      setIsFromCache(true);
    }
  }, [effectiveStorage, key]);

  /**
   * Manually refetch data from the server.
   * If offline or the fetch fails with a connectivity error,
   * tries to load and return cached data if available.
   *
   * @returns {Promise<void>} Promise that resolves when fetching is complete.
   */
  const refetch = useCallback(async () => {
    if (!enabled) return;

    setIsLoading(true);
    setError(null);

    try {
      // Check if there is connectivity before making the network call.
      const { online } = await getConnectivityStatus({});
      if (!online) {
        // If offline, fall back to cache (if available).
        const cached = effectiveStorage.get(key);
        if (cached !== null) {
          setData(cached);
          setHasCache(true);
          setIsFromCache(true);
        }
        setIsLoading(false);
        return;
      }

      // Attempt to fetch live data.
      const result = await fetcher();
      setData(result);
      setIsFromCache(false);
      setHasCache(true);
      effectiveStorage.set(key, result); // Save fresh result to cache.
      setIsLoading(false);
    } catch (err: unknown) {
      setError(err);

      // If network/offline error, try to return cached data instead of failing.
      if (err instanceof Error && isOfflineError(err)) {
        const cached = effectiveStorage.get(key);
        if (cached !== null) {
          setData(cached);
          setHasCache(true);
          setIsFromCache(true);
          setIsLoading(false);
          return;
        }
      }

      // Otherwise, mark as not loading (error state is reflected in `error` property).
      setIsLoading(false);
    }
  }, [deserialize, enabled, effectiveStorage, fetcher, key, serialize]);

  /**
   * Initial load: fire fetch if enabled.
   */
  useEffect(() => {
    if (!enabled) return;
    void refetch();
  }, [enabled, refetch]);

  return {
    data,
    isLoading,
    error,
    isFromCache,
    hasCache,
    refetch,
  };
}