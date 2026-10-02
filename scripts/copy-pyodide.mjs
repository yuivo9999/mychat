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
const packageMetadata = JSON.parse(await readFile(resolve(packageRoot, 'package.json'), 'utf8'));
const runtimeVersion = typeof packageMetadata.version === 'string' ? packageMetadata.version : undefined;
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

const buildId = buildHash.digest('hex');

const manifest = {
  schemaVersion: 1,
  ...(runtimeVersion ? { runtimeVersion } : {}),
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
