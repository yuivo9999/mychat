/* global self, caches, fetch */

const CACHE_PREFIX = 'omnichat-python-runtime-';
const CACHE_VERSION = '__PYTHON_RUNTIME_BUILD_ID__';
const CACHE_NAME = `${CACHE_PREFIX}${CACHE_VERSION}`;
const RUNTIME_DIRECTORY = 'pyodide/';
const RUNTIME_MANIFEST = `${RUNTIME_DIRECTORY}runtime-manifest.json`;
const WORKER_ASSET = 'assets/python-worker.js';
const MAX_RUNTIME_FILES = 64;

const scopeRoot = new URL('./', self.registration.scope);
const runtimeManifestUrl = new URL(RUNTIME_MANIFEST, scopeRoot);
const workerAssetUrl = new URL(WORKER_ASSET, scopeRoot);
const runtimePathPrefix = new URL(RUNTIME_DIRECTORY, scopeRoot).pathname;

function isSafeRuntimeFileName(value) {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= 200
    && /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(value)
    && value !== '.'
    && value !== '..';
}

function getRuntimeFileUrls(manifest) {
  const files = manifest?.files;
  if (
    manifest?.schemaVersion !== 1
    || typeof manifest.buildId !== 'string'
    || !/^[a-f0-9]{64}$/u.test(manifest.buildId)
    || manifest.buildId !== CACHE_VERSION
    || !Array.isArray(files)
    || files.length === 0
    || files.length > MAX_RUNTIME_FILES
  ) {
    throw new Error('Pyodide runtime manifest has an unsupported or mismatched build');
  }

  const uniqueFiles = [];
  const seen = new Set();
  for (const file of files) {
    if (!isSafeRuntimeFileName(file) || seen.has(file)) {
      throw new Error(`Pyodide runtime manifest contains an unsafe file: ${String(file)}`);
    }
    seen.add(file);
    uniqueFiles.push({
      name: file,
      baseUrl: new URL(file, runtimeManifestUrl).toString(),
      versionedUrl: `${new URL(file, runtimeManifestUrl).toString()}?v=${encodeURIComponent(CACHE_VERSION)}`,
    });
  }
  return uniqueFiles;
}

async function readRuntimeManifest() {
  const response = await fetch(runtimeManifestUrl, {
    cache: 'reload',
    credentials: 'same-origin',
  });
  if (!response.ok) {
    throw new Error(`Pyodide runtime manifest request failed with HTTP ${response.status}`);
  }
  let manifest;
  try {
    manifest = await response.clone().json();
  } catch (error) {
    throw new Error(
      `Pyodide runtime manifest is invalid: ${error instanceof Error ? error.message : 'unknown error'}`,
    );
  }
  return { manifest, files: getRuntimeFileUrls(manifest), response };
}

async function fetchAndCache(cache, url, cacheKey = url) {
  const response = await fetch(url, {
    cache: 'no-store',
    credentials: 'same-origin',
  });
  if (!response.ok || response.type === 'opaque') {
    throw new Error(`Unable to cache Python runtime resource: ${url}`);
  }
  await cache.put(cacheKey, response);
}

async function cachePythonRuntime() {
  const runtime = await readRuntimeManifest();
  const cache = await caches.open(CACHE_NAME);
  await cache.put(runtimeManifestUrl, runtime.response);
  await Promise.all([
    fetchAndCache(
      cache,
      `${workerAssetUrl.toString()}?v=${encodeURIComponent(CACHE_VERSION)}`,
      workerAssetUrl.toString(),
    ),
    ...runtime.files.map((file) => fetchAndCache(cache, file.versionedUrl, file.baseUrl)),
  ]);
}

self.addEventListener('install', (event) => {
  event.waitUntil(cachePythonRuntime().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'PYTHON_RUNTIME_STATUS') return;
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(CACHE_NAME);
      const manifestResponse = await cache.match(runtimeManifestUrl);
      if (!manifestResponse) {
        throw new Error('Pyodide runtime manifest is missing from the offline cache');
      }
      const manifest = await manifestResponse.clone().json();
      const files = getRuntimeFileUrls(manifest);
      const cachedResources = await Promise.all([
        cache.match(workerAssetUrl),
        ...files.map((file) => cache.match(file.baseUrl)),
      ]);
      event.ports?.[0]?.postMessage({
        type: 'PYTHON_RUNTIME_STATUS_RESPONSE',
        ready: cachedResources.every(Boolean),
      });
    } catch (error) {
      event.ports?.[0]?.postMessage({
        type: 'PYTHON_RUNTIME_STATUS_RESPONSE',
        ready: false,
        error: error instanceof Error ? error.message : 'runtime cache status failed',
      });
    }
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const isRuntimeAsset = url.origin === scopeRoot.origin
    && url.pathname.startsWith(runtimePathPrefix);
  const isWorkerAsset = url.origin === scopeRoot.origin
    && url.pathname === workerAssetUrl.pathname;
  if (!isRuntimeAsset && !isWorkerAsset) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) {
      if (isWorkerAsset) {
        const headers = new Headers(cached.headers);
        headers.set(
          'Content-Security-Policy',
          "default-src 'none'; script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval'; connect-src 'none'; worker-src 'none'; child-src 'none'; object-src 'none'; base-uri 'none'",
        );
        headers.set('X-Content-Type-Options', 'nosniff');
        return new Response(await cached.blob(), {
          status: cached.status,
          statusText: cached.statusText,
          headers,
        });
      }
      return cached;
    }

    const response = await fetch(request);
    if (response.ok && response.type !== 'opaque') {
      await cache.put(request, response.clone());
    }
    return response;
  })());
});
