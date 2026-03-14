# axios-offline-queue

[![npm version](https://img.shields.io/npm/v/axios-offline-queue.svg)](https://www.npmjs.com/package/axios-offline-queue)
[![npm downloads](https://img.shields.io/npm/dm/axios-offline-queue.svg)](https://www.npmjs.com/package/axios-offline-queue)
[![License](https://img.shields.io/npm/l/axios-offline-queue.svg)](./LICENSE)
<!-- [![Build Status](https://github.com/youruser/axios-offline-queue/actions/workflows/ci.yml/badge.svg)](https://github.com/youruser/axios-offline-queue/actions) -->

> Powerful utilities for offline request queueing, seamless Axios integration, and robust connectivity detection for React and JavaScript applications.

## 📚 Table of Contents

- [🏆 Features](#-features)
- [🔧 Installation](#-installation)
- [🚀 Quick Start](#-quick-start)
- [📦 API & Exports](#-api--exports)
- [🧩 Basic Offline Queue Example](#-basic-offline-queue-example)
- [📚 React Full Example](#-react-full-example)
- [🔍 Offline GET Hook (`useOfflineGet`)](#-offline-get-hook-useofflineget)
- [🧱 Service Usage (`offlineGetHandler`)](#-service-usage-offlinegethandler)
- [🔔 Event System](#-event-system)
- [🤝 Contributing & Issues](#-contributing--issues)
- [📄 License](#-license)
- [👤 Author](#-author)
---

## 🏆 Features

- **Transparent Axios interceptors for offline queueing**: Requests are automatically queued when offline and retried when connectivity returns.
- **Auto-connectivity detection**: Monitors both network status and Axios server reachability.
- **LocalStorage-based persistent queue**: Survives page reloads and crashes.
- **Hooks for React**: Simple state and cache management for your React UI.
- **Manual queue management utilities**: Query queue size, clear queue, and handle events.
- **Fully typed and documented API**.
- **No runtime dependencies** except `axios`. React is only required if using hooks.

---

## 🔧 Installation

```bash
npm install axios-offline-queue
# or
yarn add axios-offline-queue
```

---

## 🚀 Quick Start

### Axios Integration

Automatically queue failed requests and retry them when back online:

```ts
import axios from "axios";
import { offlineHook, initializeOfflineSupport } from "axios-offline-queue";

// Apply offline interceptors to your Axios instance
const api = axios.create({ baseURL: "/api" });
const [onSuccess, onError] = offlineHook();
api.interceptors.response.use(onSuccess, onError);

// Alternatively, you can use destructuring:
 /*
  *  api.interceptors.response.use(...offlineHook());
  */

// Initialize global offline support (call last, with your AxiosInstance)
initializeOfflineSupport(api);
```

---

## 📦 API & Exports

All exports are fully typed and documented.

| Export                    | Description                                                                                 |
|---------------------------|---------------------------------------------------------------------------------------------|
| **offlineHook**           | Axios response interceptors for queuing requests when offline.                              |
| **initializeOfflineSupport** | Sets up global listeners for connectivity changes.                                         |
| **getOfflineQueueSize**   | Returns the number of queued requests.                                                      |
| **clearOfflineQueue**     | Clears all requests from the offline queue.                                                 |
| **offlineQueue**          | Singleton queue instance for advanced/manual manipulation. Includes event system.            |
| **getConnectivityStatus** | Returns `{ online, serverReachable }` representing current network/server reachability.      |
| **onQueueEvent / offQueueEvent** | Low-level API for subscribing/unsubscribing to global queue events (usually not required if you use `offlineQueue.on`). |

---

## 🧩 Basic Offline Queue Example

```ts
import { offlineHook, getOfflineQueueSize, clearOfflineQueue } from "axios-offline-queue";
import axios from "axios";

// Setup interceptor
const [respOk, respError] = offlineHook();
axios.interceptors.response.use(respOk, respError);

// Query queue size
const enCola = getOfflineQueueSize();

// Clear the queue
clearOfflineQueue();
```

---

## 📚 React Full Example

```tsx
import {
  offlineHook,
  initializeOfflineSupport,
  getOfflineQueueSize,
  offlineQueue,
  getConnectivityStatus,
  useOfflineGet,
} from "axios-offline-queue";
import axios from "axios";
import { useEffect, useState } from "react";

const api = axios.create({ baseURL: "/api" });
const [onFulfilled, onRejected] = offlineHook({ useLogs: true });
api.interceptors.response.use(onFulfilled, onRejected);
initializeOfflineSupport(api);

function ColaOfflineInfo() {
  const [size, setSize] = useState(0);
  const [{ online, serverReachable }, setStatus] = useState(
    getConnectivityStatus(),
  );

  useEffect(() => {
    setSize(getOfflineQueueSize());
    const interval = setInterval(() => setSize(getOfflineQueueSize()), 2000);

    const unsubscribeQueue = offlineQueue.on("queue-processed", () => {
      // The queue has finished processing at least one cycle
      setSize(getOfflineQueueSize());
    });

    const unsubscribeConnectionLost = offlineQueue.on(
      "connection-lost",
      () => {
        setStatus(getConnectivityStatus());
      },
    );

    const unsubscribeConnectionRestored = offlineQueue.on(
      "connection-restored",
      () => {
        setStatus(getConnectivityStatus());
      },
    );

    return () => {
      clearInterval(interval);
      unsubscribeQueue();
      unsubscribeConnectionLost();
      unsubscribeConnectionRestored();
    };
  }, []);

  return (
    <div>
      <div>Pending offline requests: {size}</div>
      <div>Internet connection: {online ? "Yes" : "No"}</div>
      <div>Server reachable: {serverReachable ? "Yes" : "No"}</div>
    </div>
  );
}

export default ColaOfflineInfo;
```

---

## 🔍 Offline GET Hook (`useOfflineGet`)

In addition to offline queueing for mutation requests, this package provides a specialized hook for **GET requests** that do not get queued, but can serve the **last successful result** from cache when the request fails due to connectivity.

#### Concept

- GETs are _not_ queued.
- If a GET fails due to offline or network error:
  - The hook tries to return the last known good result (stored by default in `localStorage`).
- Fully customizable:
  - Define your `fetcher` (how your GET is performed)
  - You can provide a custom `storage` if you don't want to use `localStorage`.

#### API

```ts
type UseOfflineGetOptions<TData> = {
  key: string;
  fetcher: () => Promise<TData>;
  initialData?: TData;
  storage?: {
    get: (key: string) => TData | null;
    set: (key: string, value: TData) => void;
    remove?: (key: string) => void;
  };
  /**
   * Custom serialization for the default (localStorage) storage.
   * Ideal for encryption or data transformation.
   * If `storage` is provided, these functions are ignored.
   */
  serialize?: (value: TData) => string;
  deserialize?: (raw: string) => TData;
  enabled?: boolean; // default: true
};
```

Returns:

```ts
type UseOfflineGetState<TData> = {
  data: TData | null;
  isLoading: boolean;
  error: unknown;
  isFromCache: boolean;
  hasCache: boolean;
  refetch: () => Promise<void>;
};
```

#### Simple Axios Example

```tsx
import { useOfflineGet } from "axios-offline-queue";
import api from "./api"; // your axios instance with offlineHook + initializeOfflineSupport

type User = { id: string; name: string };

function UsersList() {
  const { data, isLoading, error, isFromCache } = useOfflineGet<User[]>({
    key: "users-list",
    fetcher: () => api.get<User[]>("/users").then((r) => r.data),
  });

  if (isLoading && !data) return <div>Loading users...</div>;
  if (error && !data) return <div>Error loading users</div>;

  return (
    <div>
      {isFromCache && <small>Showing cached data</small>}
      <ul>
        {data?.map((user) => (
          <li key={user.id}>{user.name}</li>
        ))}
      </ul>
    </div>
  );
}
```

#### Example with Custom Storage

```ts
const myStorage = {
  get: (key: string) => myInMemoryCache[key] ?? null,
  set: (key: string, value: any) => {
    myInMemoryCache[key] = value;
  },
  remove: (key: string) => {
    delete myInMemoryCache[key];
  },
};

const state = useOfflineGet({
  key: "products",
  fetcher: () => api.get("/products").then((r) => r.data),
  storage: myStorage,
});
```

This lets you decide, per GET, **how to manage the last successful value** (in `localStorage`, RAM, IndexedDB, etc.) and automatically retrieves it when connectivity is lost, all without touching the global queue logic.

#### Example: Custom Encryption using localStorage

```ts
import { useOfflineGet } from "axios-offline-queue";
import api from "./api";
import { encrypt, decrypt } from "./crypto"; // defined in your project

type SecretData = { /* ... */ };

const serializeSecret = (value: SecretData) =>
  encrypt(JSON.stringify(value)); // returns string

const deserializeSecret = (raw: string): SecretData =>
  JSON.parse(decrypt(raw));

function SecretComponent() {
  const state = useOfflineGet<SecretData>({
    key: "secret-key",
    fetcher: () => api.get<SecretData>("/secret").then((r) => r.data),
    serialize: serializeSecret,
    deserialize: deserializeSecret,
  });

  // ...
}
```

> ⚠️ **Security:** This package does _not_ include out-of-the-box encryption! For sensitive data, you should use `serialize`/`deserialize` or a custom `storage` with encryption. Always review your app's security best practices.

---

## 🧱 Service Usage (`offlineGetHandler`)

Prefer to use the same offline cache logic in plain TypeScript services (no hooks)? Use `offlineGetHandler` inside functions like `getUsers`, `getProducts`, etc.

#### Basic API

```ts
type OfflineGetHandlerOptions<TData> = {
  key: string;
  fetcher: Promise<TData> | (() => Promise<TData>);
  initialData?: TData;
  storage?: {
    get: (key: string) => TData | null;
    set: (key: string, value: TData) => void;
    remove?: (key: string) => void;
  };
  serialize?: (value: TData) => string;
  deserialize?: (raw: string) => TData;
  enabled?: boolean;
};

type OfflineGetHandlerResult<TData> = {
  data: TData | null;
  isLoading: boolean;
  error: unknown;
  isFromCache: boolean;
  hasCache: boolean;
};
```

#### Example in `services.ts`

```ts
import { offlineGetHandler } from "axios-offline-queue";
import api from "./api";

type User = { id: string; name: string };

export const getUsers = async (): Promise<User[] | null> => {
  try {
    const { data } = await offlineGetHandler<User[]>({
      key: "users",
      // You can pass a promise...
      fetcher: api.get<User[]>("/users").then((r) => r.data),
      // ...or a function returning a promise:
      // fetcher: () => api.get<User[]>("/users").then(r => r.data),
    });

    return data;
  } catch (error) {
    console.error("Error fetching users", error);
    throw error;
  }
};
```

#### Behavior Notes

- If **offline**, `offlineGetHandler`:
  - Does _not_ attempt the call.
  - Returns the last cached value (if available) or `initialData`.
- On network/offline error:
  - Tries to return cached value.
  - If not available, **throws** so your service can handle it.
- Business (4xx/5xx) errors with no cache:
  - Error is propagated directly.

You can use all the same `storage`, `serialize`, and `deserialize` customizations as in the hook—use IndexedDB, encryption, or any store you want.

---

## 🔔 Event System

The `offlineQueue` singleton exposes a robust event system to react to queue events or connectivity changes.

#### API

- **offlineQueue.on(event, handler):** Subscribe a listener; returns an unsubscribe function.
- **offlineQueue.off(event, handler):** Unsubscribe a listener.

Available event types:

- **"queue-processed"**  
  - Emitted when `processQueue()` finishes one complete cycle.
  - Payload: `undefined`
- **"request-success"**  
  - Fired when a request is retried _and_ succeeds, and is then removed from the queue.
  - Payload:
    ```ts
    {
      request: QueuedRequest;
      success: true;
      response: AxiosResponse;
    }
    ```
- **"request-failed"**  
  - Fired when a request is removed from the queue due to a permanent failure (e.g. 4xx error, or exceeded `MAX_RETRY_COUNT`).
  - Payload:
    ```ts
    {
      request: QueuedRequest;
      success: false;
      status: number | null;
      error: AxiosError | { code?: string; message?: string };
    }
    ```
- **"request-processed"**  
  - Fired for both "request-success" and "request-failed"; payload is a union.
- **"connection-lost" / "connection-restored"**  
  - Emitted when the network or server connectivity changes.
    ```ts
    {
      kind: "network" | "server";
      online: boolean;
      serverReachable: boolean;
      error?: AxiosError | { code?: string; message?: string };
    }
    ```

#### Example: Subscribing to Queue Events

```ts
import { offlineQueue } from "axios-offline-queue";

// React when the queue processes requests
offlineQueue.on("queue-processed", () => {
  console.log("Offline queue has finished processing.");
});

// Detect when a request is retried successfully
offlineQueue.on("request-success", ({ request, response }) => {
  console.log("Request successfully retried:", request.id, response.status);
});

// Handle permanent failures (4xx, max retries)
offlineQueue.on("request-failed", ({ request, status }) => {
  console.warn("Request removed from queue due to permanent failure:", request.id, status);
});

// Connectivity changes
offlineQueue.on("connection-lost", ({ kind }) => {
  if (kind === "network") {
    console.log("Internet connection lost");
  } else {
    console.log("Server unreachable, but internet is up");
  }
});

offlineQueue.on("connection-restored", ({ kind }) => {
  if (kind === "network") {
    console.log("Internet connection restored");
  } else {
    console.log("Server is reachable again");
  }
});
```

---

## 🤝 Contributing & Issues

Have suggestions, feature requests, or found a bug?  
Feel free to [open an issue](https://github.com/youruser/axios-offline-queue/issues) or submit a pull request!

- Please provide clear reproduction steps or code snippets for bugs.
- Contributions in English are preferred; Spanish also welcome for community topics.

---

## 📄 License

MIT

---

## 👤 Author

Developed and maintained by **Antonio Benavides**