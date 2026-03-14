var A = Object.defineProperty;
var D = (t, e, r) => e in t ? A(t, e, { enumerable: !0, configurable: !0, writable: !0, value: r }) : t[e] = r;
var m = (t, e, r) => D(t, typeof e != "symbol" ? e + "" : e, r);
import { useState as y, useEffect as T, useCallback as F } from "react";
const Q = {
  "queue-processed": /* @__PURE__ */ new Set(),
  "request-success": /* @__PURE__ */ new Set(),
  "request-failed": /* @__PURE__ */ new Set(),
  "request-processed": /* @__PURE__ */ new Set(),
  "connection-lost": /* @__PURE__ */ new Set(),
  "connection-restored": /* @__PURE__ */ new Set()
}, _ = (t, e) => (Q[t].add(e), () => {
  Q[t].delete(e);
}), J = (t, e) => {
  Q[t].delete(e);
}, g = (t, e) => {
  Q[t].forEach((n) => {
    try {
      n(e);
    } catch (i) {
      console.error(
        `[Offline Queue] Listener for event "${t}" threw an error. This does not affect other listeners.
Details:`,
        i
      );
    }
  });
}, I = "offline_queue", G = 1e3, p = () => {
  try {
    const t = localStorage.getItem(I);
    return t ? JSON.parse(t) : [];
  } catch (t) {
    return console.error(
      "[Offline Storage] Failed to read stored requests from localStorage. Returning an empty queue.",
      t
    ), [];
  }
}, H = (t) => {
  try {
    const e = p();
    return e.length >= G && e.shift(), e.push(t), localStorage.setItem(I, JSON.stringify(e)), !0;
  } catch (e) {
    return console.error(
      "[Offline Storage] Failed to save the request to localStorage. Request was not queued.",
      e
    ), !1;
  }
}, L = (t) => {
  try {
    const r = p().filter((n) => n.id !== t);
    return localStorage.setItem(I, JSON.stringify(r)), !0;
  } catch (e) {
    return console.error(
      `[Offline Storage] Failed to remove request with ID: ${t}. Request remains in queue.`,
      e
    ), !1;
  }
}, x = () => {
  try {
    localStorage.removeItem(I);
  } catch (t) {
    console.error(
      "[Offline Storage] Failed to clear stored requests in localStorage. Requests may still be present.",
      t
    );
  }
}, v = async (t) => {
  if (!navigator.onLine)
    return !1;
  try {
    const e = new AbortController(), r = setTimeout(() => e.abort(), 3e3);
    return await fetch(t || "https://www.google.com/favicon.ico", {
      method: "HEAD",
      mode: "no-cors",
      // This prevents CORS errors from failing connectivity checks, but limits information.
      signal: e.signal,
      cache: "no-cache"
      // Always reach out over network.
    }), clearTimeout(r), !0;
  } catch (e) {
    return console.error(
      "[Offline] Network check failed. This may indicate loss of connectivity or server is unreachable.",
      e
    ), !1;
  }
}, Y = (t, e) => {
  const r = () => {
    console.log("[Offline] Connection restored."), g("connection-restored", {
      kind: "network",
      online: !0,
      serverReachable: !0
    }), t();
  }, n = () => {
    console.log("[Offline] Connection lost."), g("connection-lost", {
      kind: "network",
      online: !1,
      serverReachable: !1
    }), e();
  };
  return window.addEventListener("online", r), window.addEventListener("offline", n), () => {
    window.removeEventListener("online", r), window.removeEventListener("offline", n);
  };
}, P = 20, K = 1e3;
class M {
  constructor() {
    m(this, "apiClient", null);
    m(this, "isProcessing", !1);
    m(this, "processCallback", null);
    m(this, "hasServerConnectivityIssue", !1);
  }
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
  on(e, r) {
    return _(e, r);
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
  off(e, r) {
    J(e, r);
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
  initialize(e) {
    this.apiClient = e, this.loadStoredRequests();
  }
  /**
   * Loads and reports any pending (persisted) requests from storage.
   * @private
   */
  loadStoredRequests() {
    const e = p();
    e.length > 0 && console.log(
      `[Offline Queue] Loaded ${e.length} pending requests.`
    );
  }
  /**
   * Generates a unique ID for a newly queued request.
   * @private
   * @returns {string} Unique request ID.
   */
  generateRequestId() {
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
  async addRequest(e) {
    const r = {
      id: this.generateRequestId(),
      config: e,
      timestamp: Date.now(),
      retryCount: 0
    };
    return H(r), console.log(`[Offline Queue] Request added to queue: ${r.id}`), await v() && this.processQueue(), r;
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
  async processQueue() {
    if (!this.apiClient) {
      console.warn("[Offline Queue] Error: API client is not initialized. Call offlineQueue.initialize() first.");
      return;
    }
    if (this.isProcessing)
      return;
    if (!await v()) {
      console.log("[Offline Queue] Offline: requests will not be processed.");
      return;
    }
    this.isProcessing = !0;
    const r = p();
    if (r.length === 0) {
      this.isProcessing = !1;
      return;
    }
    console.log(
      `[Offline Queue] Processing ${r.length} queued request(s).`
    );
    for (const n of r)
      try {
        await this.processRequest(n);
      } catch (i) {
        console.error(
          `[Offline Queue] Error while processing request ${n.id}:`,
          i
        );
      }
    this.isProcessing = !1, g("queue-processed", void 0);
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
  async processRequest(e) {
    var n, i, s;
    if (!this.apiClient) return;
    if (!await v()) {
      console.log(
        `[Offline Queue] Offline: Request ${e.id} remains queued.`
      );
      return;
    }
    try {
      e.retryCount > 0 && await new Promise(
        (l) => setTimeout(l, K * e.retryCount)
      );
      const { transformRequest: f, transformResponse: a, ...o } = e.config, d = await this.apiClient(o);
      L(e.id), console.log(
        `[Offline Queue] Request ${e.id} sent successfully.`
      ), this.processCallback && this.processCallback(e, !0), this.hasServerConnectivityIssue && navigator.onLine && (this.hasServerConnectivityIssue = !1, g("connection-restored", {
        kind: "server",
        online: !0,
        serverReachable: !0
      })), g("request-success", {
        request: e,
        success: !0,
        response: d
      }), g("request-processed", {
        request: e,
        success: !0,
        response: d
      });
    } catch (f) {
      const a = f, o = ((n = a.response) == null ? void 0 : n.status) ?? null;
      if (!navigator.onLine || a.code === "ERR_NETWORK" || ((i = a.message) == null ? void 0 : i.includes("Network Error")) || ((s = a.message) == null ? void 0 : s.includes("timeout"))) {
        console.log(
          `[Offline Queue] Network error: Request ${e.id} stays in queue.`
        ), navigator.onLine && !this.hasServerConnectivityIssue && (this.hasServerConnectivityIssue = !0, g("connection-lost", {
          kind: "server",
          online: !0,
          serverReachable: !1,
          error: a
        }));
        return;
      }
      if (o && o >= 400 && o < 500) {
        L(e.id), console.warn(
          `[Offline Queue] Request ${e.id} removed from queue due to unrecoverable client error (HTTP ${o}).`
        ), this.processCallback && this.processCallback(e, !1), g("request-failed", {
          request: e,
          success: !1,
          status: o,
          error: a
        }), g("request-processed", {
          request: e,
          success: !1,
          status: o,
          error: a
        });
        return;
      }
      if (e.retryCount >= P)
        L(e.id), console.error(
          `[Offline Queue] Request ${e.id} removed after ${P} failed attempts.`
        ), this.processCallback && this.processCallback(e, !1), g("request-failed", {
          request: e,
          success: !1,
          status: o,
          error: a
        }), g("request-processed", {
          request: e,
          success: !1,
          status: o,
          error: a
        });
      else {
        e.retryCount++;
        const l = p(), h = l.findIndex((u) => u.id === e.id);
        h !== -1 && (l[h] = e, localStorage.setItem("offline_queue", JSON.stringify(l)));
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
  setProcessCallback(e) {
    this.processCallback = e;
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
  getQueueSize() {
    return p().length;
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
  clearQueue() {
    x(), console.log("[Offline Queue] Queue cleared.");
  }
}
const O = new M(), X = () => typeof navigator > "u" ? !0 : navigator.onLine, W = async (t) => typeof navigator > "u" ? !0 : await v(t), z = async ({
  serverURL: t
}) => ({
  online: X(),
  serverReachable: t ? await W(t) : !0
}), V = (t) => {
  O.initialize(t);
  const e = Y(
    async () => {
      await v() && (console.log("[Offline] Processing queued offline requests..."), O.processQueue());
    },
    () => {
      console.log(
        "[Offline] Connection lost. New requests will be stored for later processing."
      );
    }
  );
  typeof window < "u" && window.addEventListener("beforeunload", e);
}, N = (t) => {
  var e, r;
  if (!navigator.onLine)
    return !0;
  if ("code" in t) {
    const n = t;
    return n.code === "ERR_NETWORK" || n.code === "ECONNABORTED" || ((e = n.message) == null ? void 0 : e.includes("Network Error")) || ((r = n.message) == null ? void 0 : r.includes("timeout"));
  }
  return !1;
}, ee = () => O.getQueueSize(), te = () => {
  O.clearQueue();
}, j = (t, e) => ({
  get: (r) => {
    if (typeof window > "u" || !window.localStorage) return null;
    try {
      const n = window.localStorage.getItem(r);
      return n ? (e ?? ((s) => JSON.parse(s)))(n) : null;
    } catch {
      return null;
    }
  },
  set: (r, n) => {
    if (!(typeof window > "u" || !window.localStorage))
      try {
        const s = (t ?? ((f) => JSON.stringify(f)))(n);
        window.localStorage.setItem(r, s);
      } catch {
      }
  },
  remove: (r) => {
    if (!(typeof window > "u" || !window.localStorage))
      try {
        window.localStorage.removeItem(r);
      } catch {
      }
  }
});
function re(t) {
  const {
    key: e,
    fetcher: r,
    initialData: n,
    storage: i,
    serialize: s,
    deserialize: f,
    enabled: a = !0
  } = t, o = i ?? j(s, f), [d, l] = y(n ?? null), [h, u] = y(!1), [C, R] = y(null), [b, c] = y(!1), [E, q] = y(!1);
  T(() => {
    const w = o.get(e);
    w !== null && (l(w), q(!0), c(!0));
  }, [o, e]);
  const k = F(async () => {
    if (a) {
      u(!0), R(null);
      try {
        const { online: w } = await z({});
        if (!w) {
          const $ = o.get(e);
          $ !== null && (l($), q(!0), c(!0)), u(!1);
          return;
        }
        const S = await r();
        l(S), c(!1), q(!0), o.set(e, S), u(!1);
      } catch (w) {
        if (R(w), w instanceof Error && N(w)) {
          const S = o.get(e);
          if (S !== null) {
            l(S), q(!0), c(!0), u(!1);
            return;
          }
        }
        u(!1);
      }
    }
  }, [f, a, o, r, e, s]);
  return T(() => {
    a && k();
  }, [a, k]), {
    data: d,
    isLoading: h,
    error: C,
    isFromCache: b,
    hasCache: E,
    refetch: k
  };
}
const B = (t, e) => ({
  /**
   * Retrieve a value from localStorage.
   */
  get: (r) => {
    if (typeof window > "u" || !window.localStorage) return null;
    try {
      const n = window.localStorage.getItem(r);
      return n ? (e ?? ((s) => JSON.parse(s)))(n) : null;
    } catch {
      return null;
    }
  },
  /**
   * Store a value in localStorage.
   */
  set: (r, n) => {
    if (!(typeof window > "u" || !window.localStorage))
      try {
        const s = (t ?? ((f) => JSON.stringify(f)))(n);
        window.localStorage.setItem(r, s);
      } catch {
      }
  },
  /**
   * Remove a value from localStorage.
   */
  remove: (r) => {
    if (!(typeof window > "u" || !window.localStorage))
      try {
        window.localStorage.removeItem(r);
      } catch {
      }
  }
}), ne = async (t) => {
  const {
    key: e,
    fetcher: r,
    initialData: n,
    storage: i,
    serialize: s,
    deserialize: f,
    enabled: a = !0
  } = t, o = i ?? B(s, f);
  let d = n ?? null, l = null, h = !1, u = !1;
  const C = o.get(e);
  if (C !== null && (d = C, h = !0, u = !0), !a)
    return {
      data: d,
      isLoading: !1,
      error: l,
      isFromCache: h,
      hasCache: u
    };
  const { online: R } = await z({});
  if (!R)
    return {
      data: d,
      isLoading: !1,
      error: l,
      isFromCache: h,
      hasCache: u
    };
  const b = typeof r == "function" ? r : () => r;
  try {
    const c = await b();
    return d = c, h = !1, u = !0, o.set(e, c), {
      data: d,
      isLoading: !1,
      error: l,
      isFromCache: h,
      hasCache: u
    };
  } catch (c) {
    if (l = c, c instanceof Error && N(c)) {
      const E = o.get(e);
      if (E !== null)
        return {
          data: E,
          isLoading: !1,
          error: null,
          isFromCache: !0,
          hasCache: !0
        };
    }
    throw new Error(
      `[offlineGetHandler] Fetch failed and no cached data is available: ${c instanceof Error ? c.message : String(c)}`
    );
  }
};
function oe({ useLogs: t = !1 }) {
  return [
    /**
     * Response interceptor for Axios.
     * Optionally logs API responses to the console.
     *
     * @param {AxiosResponse} response - The Axios response object.
     * @returns {AxiosResponse} The unmodified response object.
     */
    (e) => (t && console.log(`[API Response] ${e.status} ${e.config.url}`), e),
    /**
     * Error interceptor for Axios.
     * If the error is due to offline connectivity, the request is added to the offline queue,
     * unless it's a GET request without the `X-Queue-Offline` override header.
     * Optionally logs errors to the console.
     *
     * @param {AxiosError} error - The Axios error object.
     * @returns {Promise<never>} Always rejects with the original error,
     *   but may queue the request for future retry if offline.
     *
     * @example
     * // Applied automatically via the use of `offlineHook` in an Axios interceptor.
     */
    async (e) => {
      var r, n, i;
      if (t && console.error(
        "[API Response Error]",
        ((r = e.response) == null ? void 0 : r.data) || e.message
      ), N(e)) {
        const s = e.config;
        s && (((n = s.method) == null ? void 0 : n.toUpperCase()) !== "GET" || ((i = s.headers) == null ? void 0 : i["X-Queue-Offline"]) === "true") && (await O.addRequest(s), t && console.log(
          "[API] Request has been added to the offline queue due to connectivity issues."
        ));
      }
      return Promise.reject(e);
    }
  ];
}
export {
  te as clearOfflineQueue,
  z as getConnectivityStatus,
  ee as getOfflineQueueSize,
  V as initializeOfflineSupport,
  N as isOfflineError,
  J as offQueueEvent,
  ne as offlineGetHandler,
  oe as offlineHook,
  O as offlineQueue,
  _ as onQueueEvent,
  re as useOfflineGet
};
