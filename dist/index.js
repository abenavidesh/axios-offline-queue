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
    } catch (a) {
      console.error(
        `[Offline Queue] Listener for event "${t}" threw an error. This does not affect other listeners.
Details:`,
        a
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
      } catch (a) {
        console.error(
          `[Offline Queue] Error while processing request ${n.id}:`,
          a
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
    var n, a, l;
    if (!this.apiClient) return;
    if (!await v()) {
      console.log(
        `[Offline Queue] Offline: Request ${e.id} remains queued.`
      );
      return;
    }
    try {
      e.retryCount > 0 && await new Promise(
        (i) => setTimeout(i, K * e.retryCount)
      );
      const { transformRequest: u, transformResponse: s, ...o } = e.config, c = await this.apiClient(o);
      L(e.id), console.log(
        `[Offline Queue] Request ${e.id} sent successfully.`
      ), this.processCallback && this.processCallback(e, !0), this.hasServerConnectivityIssue && navigator.onLine && (this.hasServerConnectivityIssue = !1, g("connection-restored", {
        kind: "server",
        online: !0,
        serverReachable: !0
      })), g("request-success", {
        request: e,
        success: !0,
        response: c
      }), g("request-processed", {
        request: e,
        success: !0,
        response: c
      });
    } catch (u) {
      const s = u, o = ((n = s.response) == null ? void 0 : n.status) ?? null;
      if (!navigator.onLine || s.code === "ERR_NETWORK" || ((a = s.message) == null ? void 0 : a.includes("Network Error")) || ((l = s.message) == null ? void 0 : l.includes("timeout"))) {
        console.log(
          `[Offline Queue] Network error: Request ${e.id} stays in queue.`
        ), navigator.onLine && !this.hasServerConnectivityIssue && (this.hasServerConnectivityIssue = !0, g("connection-lost", {
          kind: "server",
          online: !0,
          serverReachable: !1,
          error: s
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
          error: s
        }), g("request-processed", {
          request: e,
          success: !1,
          status: o,
          error: s
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
          error: s
        }), g("request-processed", {
          request: e,
          success: !1,
          status: o,
          error: s
        });
      else {
        e.retryCount++;
        const i = p(), h = i.findIndex((d) => d.id === e.id);
        h !== -1 && (i[h] = e, localStorage.setItem("offline_queue", JSON.stringify(i)));
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
const O = new M(), X = () => typeof navigator > "u" ? !0 : navigator.onLine, U = async (t) => typeof navigator > "u" ? !0 : await v(t), z = async ({
  serverURL: t
}) => ({
  online: X(),
  serverReachable: t ? await U(t) : !0
}), Z = (t) => {
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
}, W = (t, e) => ({
  get: (r) => {
    if (typeof window > "u" || !window.localStorage) return null;
    try {
      const n = window.localStorage.getItem(r);
      return n ? (e ?? ((l) => JSON.parse(l)))(n) : null;
    } catch {
      return null;
    }
  },
  set: (r, n) => {
    if (!(typeof window > "u" || !window.localStorage))
      try {
        const l = (t ?? ((u) => JSON.stringify(u)))(n);
        window.localStorage.setItem(r, l);
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
    storage: a,
    serialize: l,
    deserialize: u,
    enabled: s = !0
  } = t, o = a ?? W(l, u), [c, i] = y(n ?? null), [h, d] = y(!1), [C, E] = y(null), [b, f] = y(!1), [R, q] = y(!1);
  T(() => {
    const w = o.get(e);
    w !== null && (i(w), q(!0), f(!0));
  }, [o, e]);
  const k = F(async () => {
    if (s) {
      d(!0), E(null);
      try {
        const { online: w } = await z({});
        if (!w) {
          const $ = o.get(e);
          $ !== null && (i($), q(!0), f(!0)), d(!1);
          return;
        }
        const S = await r();
        i(S), f(!1), q(!0), o.set(e, S), d(!1);
      } catch (w) {
        if (E(w), w instanceof Error && N(w)) {
          const S = o.get(e);
          if (S !== null) {
            i(S), q(!0), f(!0), d(!1);
            return;
          }
        }
        d(!1);
      }
    }
  }, [u, s, o, r, e, l]);
  return T(() => {
    s && k();
  }, [s, k]), {
    data: c,
    isLoading: h,
    error: C,
    isFromCache: b,
    hasCache: R,
    refetch: k
  };
}
const j = (t, e) => ({
  /**
   * Retrieve a value from localStorage.
   */
  get: (r) => {
    if (typeof window > "u" || !window.localStorage) return null;
    try {
      const n = window.localStorage.getItem(r);
      return n ? (e ?? ((l) => JSON.parse(l)))(n) : null;
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
        const l = (t ?? ((u) => JSON.stringify(u)))(n);
        window.localStorage.setItem(r, l);
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
    storage: a,
    serialize: l,
    deserialize: u,
    enabled: s = !0
  } = t, o = a ?? j(l, u);
  let c = n ?? null, i = null, h = !1, d = !1;
  const C = o.get(e);
  if (C !== null && (c = C, h = !0, d = !0), !s)
    return {
      data: c,
      isLoading: !1,
      error: i,
      isFromCache: h,
      hasCache: d
    };
  const { online: E } = await z({});
  if (!E)
    return {
      data: c,
      isLoading: !1,
      error: i,
      isFromCache: h,
      hasCache: d
    };
  const b = typeof r == "function" ? r : () => r;
  try {
    const f = await b();
    return c = f, h = !1, d = !0, o.set(e, f), {
      data: c,
      isLoading: !1,
      error: i,
      isFromCache: h,
      hasCache: d
    };
  } catch (f) {
    if (i = f, f instanceof Error && N(f)) {
      const R = o.get(e);
      if (R !== null)
        return {
          data: R,
          isLoading: !1,
          error: null,
          isFromCache: !0,
          hasCache: !0
        };
    }
    throw new Error(
      `[offlineGetHandler] Fetch failed and no cached data is available: ${f instanceof Error ? f.message : String(f)}`
    );
  }
};
function oe({
  useLogs: t = !1
}) {
  return [(n) => (t && console.log(`[API Response] ${n.status} ${n.config.url}`), n), async (n) => {
    var a, l, u, s;
    if (t && console.error(
      "[API Response Error]",
      ((a = n.response) == null ? void 0 : a.data) || n.message
    ), N(n)) {
      const o = n.config;
      if (o) {
        let c = !1;
        const i = (l = o.headers) == null ? void 0 : l["X-Queue-Offline"];
        typeof i > "u" || i === null ? c = ((u = o.method) == null ? void 0 : u.toUpperCase()) !== "GET" : i === "true" ? c = !0 : i === "false" ? c = !1 : c = ((s = o.method) == null ? void 0 : s.toUpperCase()) !== "GET", c && (await O.addRequest(o), t && console.log(
          "[API] Request has been added to the offline queue due to connectivity issues."
        ));
      }
    }
    return Promise.reject(n);
  }];
}
export {
  te as clearOfflineQueue,
  z as getConnectivityStatus,
  ee as getOfflineQueueSize,
  Z as initializeOfflineSupport,
  N as isOfflineError,
  J as offQueueEvent,
  ne as offlineGetHandler,
  oe as offlineHook,
  O as offlineQueue,
  _ as onQueueEvent,
  re as useOfflineGet
};
