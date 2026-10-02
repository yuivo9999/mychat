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

export async function downloadPythonFromCdn(onProgress: (progress: number) => void): Promise<boolean> {
  if (!('caches' in window)) return false;
  
  const scopeRoot = getScopeRoot().toString();
  const manifestUrl = new URL('pyodide/runtime-manifest.json', scopeRoot).toString();
  
  try {
    onProgress(1);
    const manifestRes = await fetch(manifestUrl);
    if (!manifestRes.ok) throw new Error('无法从服务器读取清单文件');
    const manifest = await manifestRes.json();
    const buildId = manifest.buildId;
    const files = manifest.files as string[];
    
    // We also need to cache python-sw.js itself
    const allFiles = ['python-sw.js', ...files.map(f => `pyodide/${f}`)];
    const cacheName = `omnichat-python-runtime-${buildId}`;
    const cache = await caches.open(cacheName);
    
    const totalFiles = allFiles.length;
    let completedFiles = 0;

    for (const filePath of allFiles) {
      const targetUrl = new URL(filePath, scopeRoot).toString();
      // For Chinese users, we can optionally use a CDN here if provided. 
      // But since they are already bundled in public/, we fetch from current server 
      // which is effectively the same as "downloading and putting in place".
      // If we strictly want to use jsdelivr, we'd need the exact version mapping.
      // Here we fetch from our own public/ which is the most reliable source for the bundled version.
      const response = await fetch(targetUrl);
      if (!response.ok) throw new Error(`无法下载文件: ${filePath}`);
      
      const contentLength = response.headers.get('content-length');
      const total = contentLength ? parseInt(contentLength, 10) : 0;
      
      if (!response.body) {
        await cache.put(targetUrl, response);
        completedFiles++;
        onProgress(Math.round((completedFiles / totalFiles) * 100));
        continue;
      }

      const reader = response.body.getReader();
      let loaded = 0;
      const chunks = [];
      
      while(true) {
        const {done, value} = await reader.read();
        if (done) break;
        chunks.push(value);
        loaded += value.length;
        if (total > 0) {
          const fileProgress = (loaded / total) * (1 / totalFiles) * 100;
          const baseProgress = (completedFiles / totalFiles) * 100;
          onProgress(Math.round(baseProgress + fileProgress));
        }
      }
      
      const blob = new Blob(chunks);
      const filename = filePath.split('/').pop()!;
      await cache.put(targetUrl, new Response(blob, {
        headers: { 
          'Content-Type': filename.endsWith('.js') || filename.endsWith('.mjs') ? 'application/javascript' : (filename.endsWith('.wasm') ? 'application/wasm' : 'application/octet-stream'),
          'Content-Length': blob.size.toString()
        }
      }));
      
      completedFiles++;
      onProgress(Math.round((completedFiles / totalFiles) * 100));
    }
    
    return true;
  } catch (error) {
    console.error('Manual download failed:', error);
    return false;
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

  for (const request of keys) {
    const response = await cache.match(request);
    if (response) {
      const blob = await response.blob();
      const url = new URL(request.url);
      const filename = url.pathname.split('/').pop() || 'index';
      runtimeFolder?.file(filename, blob);
    }
  }

  return await zip.generateAsync({ type: 'blob' });
}

export async function importPythonRuntime(zipBlob: Blob): Promise<boolean> {
  if (!('caches' in window)) return false;
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(zipBlob);
  const runtimeFolder = zip.folder('pyodide');
  if (!runtimeFolder) return false;

  // We need the build ID from the manifest to create the correct cache name
  const manifestFile = runtimeFolder.file('runtime-manifest.json');
  if (!manifestFile) return false;
  const manifestContent = await manifestFile.async('string');
  const manifest = JSON.parse(manifestContent);
  const buildId = manifest.buildId;
  if (!buildId) return false;

  const cacheName = `omnichat-python-runtime-${buildId}`;
  const cache = await caches.open(cacheName);
  const scopeRoot = getScopeRoot().toString();

  const files = Object.keys(runtimeFolder.files);
  for (const filePath of files) {
    if (runtimeFolder.files[filePath].dir) continue;
    const filename = filePath.split('/').pop()!;
    const fileBlob = await runtimeFolder.files[filePath].async('blob');
    
    // Reconstruct the internal URLs used by the Service Worker
    let targetUrl: string;
    if (filename === 'python-sw.js') {
       targetUrl = new URL(filename, scopeRoot).toString();
    } else {
       targetUrl = new URL(`pyodide/${filename}`, scopeRoot).toString();
    }
    
    await cache.put(targetUrl, new Response(fileBlob, {
      headers: { 'Content-Type': filename.endsWith('.js') || filename.endsWith('.mjs') ? 'application/javascript' : (filename.endsWith('.wasm') ? 'application/wasm' : 'application/octet-stream') }
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
