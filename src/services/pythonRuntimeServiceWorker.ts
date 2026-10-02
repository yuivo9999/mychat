const SERVICE_WORKER_FILE = 'python-sw.js';
const SERVICE_WORKER_READY_TIMEOUT_MS = 180_000;
const CONTROLLER_CHANGE_TIMEOUT_MS = 5_000;
const STATUS_RESPONSE_TIMEOUT_MS = 5_000;

let registrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;

function getScopeRoot(): URL {
  // The production bundle lives in <scope>/assets/*.js. Source modules used by Vite's
  // development server live in <scope>/src/services/*, so the same depth works in both modes.
  return new URL('../../', import.meta.url);
}

function getAbortReason(signal?: AbortSignal): DOMException | null {
  if (!signal?.aborted) return null;
  return signal.reason instanceof DOMException
    ? signal.reason
    : new DOMException('本地 Python 运行时准备已取消', 'AbortError');
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
  signal?: AbortSignal,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const abortReason = getAbortReason(signal);
    if (abortReason) {
      reject(abortReason);
      return;
    }

    const timeout = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    const onAbort = (): void => {
      window.clearTimeout(timeout);
      reject(getAbortReason(signal));
    };
    signal?.addEventListener('abort', onAbort, { once: true });

    const cleanup = (): void => {
      window.clearTimeout(timeout);
      signal?.removeEventListener('abort', onAbort);
    };
    promise.then(
      (value) => {
        cleanup();
        resolve(value);
      },
      (error: unknown) => {
        cleanup();
        reject(error);
      },
    );
  });
}

function isProductionRuntimeContext(): boolean {
  return import.meta.env.PROD
    && typeof window !== 'undefined'
    && window.isSecureContext
    && 'serviceWorker' in navigator;
}

export function getPythonRuntimeIndexUrl(): string {
  return new URL('pyodide/', getScopeRoot()).toString();
}

export function registerPythonRuntimeServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isProductionRuntimeContext()) return Promise.resolve(null);
  if (registrationPromise) return registrationPromise;

  const scopeRoot = getScopeRoot();
  const workerUrl = new URL(SERVICE_WORKER_FILE, scopeRoot);
  registrationPromise = navigator.serviceWorker.register(workerUrl, {
    scope: scopeRoot.pathname,
  }).catch((error: unknown) => {
    console.warn('Python runtime service worker registration failed:', error);
    registrationPromise = null;
    return null;
  });

  return registrationPromise;
}

async function queryActiveWorker(worker: ServiceWorker, signal?: AbortSignal): Promise<boolean> {
  return new Promise<boolean>((resolve, reject) => {
    const abortReason = getAbortReason(signal);
    if (abortReason) {
      reject(abortReason);
      return;
    }

    const channel = new MessageChannel();
    const timeout = window.setTimeout(() => {
      cleanup();
      resolve(false);
    }, STATUS_RESPONSE_TIMEOUT_MS);
    const onAbort = (): void => {
      cleanup();
      reject(getAbortReason(signal));
    };
    const cleanup = (): void => {
      window.clearTimeout(timeout);
      signal?.removeEventListener('abort', onAbort);
      channel.port1.close();
    };

    signal?.addEventListener('abort', onAbort, { once: true });
    channel.port1.onmessage = (event: MessageEvent<unknown>) => {
      cleanup();
      const response = event.data as { type?: unknown; ready?: unknown } | null;
      resolve(response?.type === 'PYTHON_RUNTIME_STATUS_RESPONSE' && response.ready === true);
    };
    channel.port1.onmessageerror = () => {
      cleanup();
      resolve(false);
    };
    channel.port1.start();
    worker.postMessage({ type: 'PYTHON_RUNTIME_STATUS' }, [channel.port2]);
  });
}

async function waitForController(registration: ServiceWorkerRegistration, signal?: AbortSignal): Promise<void> {
  if (navigator.serviceWorker.controller) return;
  await withTimeout(
    new Promise<void>((resolve) => {
      navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true });
    }),
    CONTROLLER_CHANGE_TIMEOUT_MS,
    '本地 Python 离线缓存尚未接管当前页面',
    signal,
  );
  if (!navigator.serviceWorker.controller && registration.active) {
    throw new Error('本地 Python 离线缓存未能接管当前页面，请刷新后重试');
  }
}

export async function waitForPythonRuntimeCache(signal?: AbortSignal): Promise<boolean> {
  if (!import.meta.env.PROD) return true;
  if (!isProductionRuntimeContext()) return false;

  const registration = await withTimeout(
    navigator.serviceWorker.ready,
    SERVICE_WORKER_READY_TIMEOUT_MS,
    '本地 Python 运行时缓存准备超时；首次使用时请保持联网并稍后重试',
    signal,
  );
  await waitForController(registration, signal);

  const activeWorker = navigator.serviceWorker.controller;
  if (!activeWorker) return false;
  return queryActiveWorker(activeWorker, signal);
}
