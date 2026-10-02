import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, '..');
const packageEntry = require.resolve('pyodide', { paths: [projectRoot] });
const packageRoot = resolve(dirname(packageEntry));
const targetRoot = resolve(projectRoot, 'public/pyodide');
const requiredRuntimeFiles = [
  'pyodide.asm.js',
  'pyodide.asm.mjs',
  'pyodide.asm.wasm',
  'python_stdlib.zip',
  'pyodide-lock.json',
];
const optionalRuntimeFiles = ['python_packages.json'];
const runtimeFiles = [];

await rm(targetRoot, { recursive: true, force: true });
await mkdir(targetRoot, { recursive: true });

const buildHash = createHash('sha256');
for (const fileName of [...requiredRuntimeFiles, ...optionalRuntimeFiles]) {
  const sourcePath = resolve(packageRoot, fileName);
  let source;
  try {
    source = await readFile(sourcePath);
  } catch (error) {
    if (requiredRuntimeFiles.includes(fileName) && fileName !== 'pyodide.asm.js' && fileName !== 'pyodide.asm.mjs') {
      throw new Error(
        `Required Pyodide runtime file is missing: ${sourcePath}. Reinstall dependencies before building.`,
        { cause: error },
      );
    }
    continue;
  }

  await cp(sourcePath, resolve(targetRoot, fileName), { force: true });
  runtimeFiles.push(fileName);
  buildHash.update(fileName);
  buildHash.update('\0');
  buildHash.update(source);
  buildHash.update('\0');
}

// Normalize an already generated Service Worker back to its template form so repeated
// builds are idempotent instead of failing after the first build replaced the placeholder.
const serviceWorkerSource = await readFile(serviceWorkerPath, 'utf8');
if (!cacheVersionPattern.test(serviceWorkerSource)) {
  throw new Error(`Service Worker has an invalid CACHE_VERSION declaration`);
}
const normalizedServiceWorkerSource = serviceWorkerSource.replace(
  cacheVersionPattern,
  `const CACHE_VERSION = '${buildIdPlaceholder}';`,
);
const workerSource = await readFile(workerSourcePath);
buildHash.update(workerSource);
buildHash.update('\0');
buildHash.update(normalizedServiceWorkerSource);
const buildId = buildHash.digest('hex');

const manifest = {
  schemaVersion: 1,
  buildId,
  files: runtimeFiles,
};
await writeFile(
  resolve(targetRoot, 'runtime-manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
  'utf8',
);

console.log(
  `Copied Pyodide runtime (${runtimeFiles.length} files, build ${buildId.slice(0, 12)}) to public/pyodide`,
);
