const SERVICE_WORKER_FILE = 'python-sw.js';
const SERVICE_WORKER_READY_TIMEOUT_MS = 180_000;
const CONTROLLER_CHANGE_TIMEOUT_MS = 5_000;
const STATUS_RESPONSE_TIMEOUT_MS = 5_000;
const PYODIDE_CDN_BASE = 'https://cdn.jsdelivr.net/pyodide';

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

function getRuntimeContentType(filename: string): string {
  if (filename.endsWith('.js') || filename.endsWith('.mjs')) return 'application/javascript';
  if (filename.endsWith('.wasm')) return 'application/wasm';
  if (filename.endsWith('.json')) return 'application/json';
  if (filename.endsWith('.zip')) return 'application/zip';
  return 'application/octet-stream';
}

/**
 * Downloads the Pyodide offline package for the user to save with the browser.
 *
 * Important: this function deliberately does NOT write to Cache Storage. The downloaded
 * ZIP is imported later through importPythonRuntime(), which is the only path that installs
 * the runtime into this app's local cache.
 *
 * The Pyodide directory URL itself is not a download target. Each runtime file is fetched
 * from its concrete jsDelivr file URL:
 * https://cdn.jsdelivr.net/pyodide/v<version>/full/<file>
 */
export async function downloadPythonFromCdn(onProgress: (progress: number) => void): Promise<Blob | null> {
  const scopeRoot = getScopeRoot().toString();
  const manifestUrl = new URL('pyodide/runtime-manifest.json', scopeRoot).toString();

  try {
    onProgress(1);

    const manifestRes = await fetch(manifestUrl, { cache: 'no-store' });
    if (!manifestRes.ok) throw new Error('无法从服务器读取 Python 运行时清单');

    const manifest = await manifestRes.json();
    const buildId = typeof manifest.buildId === 'string' ? manifest.buildId.trim() : '';
    const runtimeVersion = typeof manifest.runtimeVersion === 'string'
      ? manifest.runtimeVersion.trim()
      : '';
    const files = manifest.files as unknown;

    if (
      !/^[a-f0-9]{64}$/u.test(buildId)
      || !/^\\d+\\.\\d+\\.\\d+$/u.test(runtimeVersion)
      || !Array.isArray(files)
      || files.length === 0
      || files.some((file) => typeof file !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(file))
    ) {
      throw new Error('Python 运行时清单格式无效');
    }

    const { default: JSZip } = await import('jszip');
    const zip = new JSZip();
    const runtimeFolder = zip.folder('pyodide');
    if (!runtimeFolder) throw new Error('无法创建 Python 运行时离线包');

    // The manifest is required by the import path to reconstruct the exact cache name.
    runtimeFolder.file('runtime-manifest.json', JSON.stringify(manifest, null, 2));

    // python-sw.js is part of the offline runtime package and is restored to the app root
    // by importPythonRuntime(). Keeping it inside the pyodide folder makes the ZIP layout
    // consistent with exportPythonRuntime().
    const workerUrl = new URL('python-sw.js', scopeRoot).toString();
    const workerResponse = await fetch(workerUrl, { cache: 'no-store' });
    if (!workerResponse.ok) {
      throw new Error(`无法下载离线服务脚本：HTTP ${workerResponse.status}`);
    }
    runtimeFolder.file('python-sw.js', await workerResponse.blob());

    const totalFiles = files.length + 1;
    let completedFiles = 0;

    for (const filename of files) {
      // This is the actual downloadable file URL. Do not fetch the /full/ directory itself.
      const fileUrl = new URL(
        filename,
        `${PYODIDE_CDN_BASE}/v${runtimeVersion}/full/`,
      ).toString();

      const response = await fetch(fileUrl, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`无法下载 Pyodide 文件 ${filename}：HTTP ${response.status}`);
      }

      runtimeFolder.file(filename, await response.blob());
      completedFiles += 1;
      onProgress(Math.round((completedFiles / totalFiles) * 100));
    }

    // Count the service worker as the final completed file.
    completedFiles += 1;
    onProgress(Math.round((completedFiles / totalFiles) * 100));

    return await zip.generateAsync({
      type: 'blob',
      compression: 'STORE',
    }, (metadata) => {
      onProgress(Math.max(99, Math.round(metadata.percent)));
    });
  } catch (error) {
    console.error('Manual Python runtime download failed:', error);
    return null;
  }
}

export async function exportPythonRuntime(): Promise<Blob | null> {
  if (!('caches' in window)) return null;
  const cacheNames = await caches.keys();
  const runtimeCacheName = cacheNames.find(name => name.startsWith('omnichat-python-runtime-'));
  if (!runtimeCacheName) return null;

  const cache = await caches.open(runtimeCacheName);
  const keys = await cache.keys();
  if (keys.length === 0) return null;

  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const runtimeFolder = zip.folder('pyodide');
  if (!runtimeFolder) return null;

  for (const request of keys) {
    const response = await cache.match(request);
    if (response) {
      const blob = await response.blob();
      const url = new URL(request.url);
      const filename = url.pathname.split('/').pop() || 'index';
      runtimeFolder.file(filename, blob);
    }
  }

  // Older caches created by previous versions may not contain the manifest. Do not create
  // an unusable export in that case.
  if (!runtimeFolder.file('runtime-manifest.json')) return null;

  return await zip.generateAsync({ type: 'blob' });
}

export async function importPythonRuntime(zipBlob: Blob): Promise<boolean> {
  if (!('caches' in window)) return false;
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(zipBlob);
  const runtimeFolder = zip.folder('pyodide');
  if (!runtimeFolder) return false;

  // We need the build ID from the manifest to create the correct cache name.
  const manifestFile = runtimeFolder.file('runtime-manifest.json');
  if (!manifestFile) return false;

  let manifest: { buildId?: unknown; schemaVersion?: unknown; files?: unknown };
  try {
    const manifestContent = await manifestFile.async('string');
    manifest = JSON.parse(manifestContent);
  } catch {
    return false;
  }

  const buildId = typeof manifest.buildId === 'string' ? manifest.buildId.trim() : '';
  if (
    manifest.schemaVersion !== 1
    || !/^[a-f0-9]{64}$/u.test(buildId)
    || !Array.isArray(manifest.files)
    || manifest.files.length === 0
    || manifest.files.some((file) => typeof file !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(file))
  ) {
    return false;
  }

  const requiredFiles = new Set(['runtime-manifest.json', 'python-sw.js', ...manifest.files]);
  const suppliedFiles = new Set(
    Object.keys(runtimeFolder.files)
      .filter((filePath) => !runtimeFolder.files[filePath].dir)
      .map((filePath) => filePath.split('/').pop() || ''),
  );

  for (const requiredFile of requiredFiles) {
    if (!suppliedFiles.has(requiredFile)) return false;
  }

  const cacheName = `omnichat-python-runtime-${buildId}`;
  const cache = await caches.open(cacheName);
  const scopeRoot = getScopeRoot().toString();

  const files = Object.keys(runtimeFolder.files);
  for (const filePath of files) {
    if (runtimeFolder.files[filePath].dir) continue;

    const filename = filePath.split('/').pop()!;
    const fileBlob = await runtimeFolder.files[filePath].async('blob');

    // Reconstruct the internal URLs used by the Service Worker.
    const targetUrl = filename === 'python-sw.js'
      ? new URL(filename, scopeRoot).toString()
      : new URL(`pyodide/${filename}`, scopeRoot).toString();

    await cache.put(targetUrl, new Response(fileBlob, {
      headers: { 'Content-Type': getRuntimeContentType(filename) },
    }));
  }

  return true;
}

export async function clearPythonRuntimeCache(): Promise<void> {
  if (!('caches' in window)) return;
  const cacheNames = await caches.keys();
  for (const name of cacheNames) {
    if (name.startsWith('omnichat-python-runtime-')) {
      await caches.delete(name);
    }
  }
}
