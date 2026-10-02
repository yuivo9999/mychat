import { loadPyodide } from 'pyodide';

type PyodideInterface = Awaited<ReturnType<typeof loadPyodide>>;

const WORKSPACE_ROOT = '/workspace';
const BASELINE_PATH = '/tmp/ivochat-python-baseline.json';
const RESULT_PATH = '/tmp/ivochat-python-result.json';
const MAX_OUTPUT_BYTES = 512 * 1024;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_BYTES = 150 * 1024 * 1024;
const MAX_SCAN_FILES = 5_000;
const MAX_CHANGED_FILES = 1_200;

interface RunRequest {
  type: 'run';
  executionId: string;
  scriptPath: string;
  files: Record<string, string>;
  indexURL: string;
}

interface CancelRequest {
  type: 'cancel';
  executionId: string;
}

type WorkerRequest = RunRequest | CancelRequest;

interface StatusResponse {
  type: 'status';
  executionId: string;
  status: 'loading' | 'preparing' | 'running';
}

interface ResultResponse {
  type: 'result';
  executionId: string;
  result: {
    success: boolean;
    exitCode: number | null;
    stdout: string;
    stderr: string;
    stdoutTruncated: boolean;
    stderrTruncated: boolean;
    timedOut: boolean;
    cancelled: boolean;
    outputLimitExceeded: boolean;
    changedFiles: Array<{
      path: string;
      type: 'added' | 'modified' | 'deleted';
      content?: string;
      isBinary?: false;
      size?: number;
    }>;
    ignoredPaths: string[];
    fileSyncError: string | null;
    error: string | null;
  };
}

interface ErrorResponse {
  type: 'error';
  executionId: string;
  message: string;
}

type WorkerResponse = StatusResponse | ResultResponse | ErrorResponse;

interface WorkerScope {
  postMessage(message: WorkerResponse): void;
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
}

interface PyodideFileSystem {
  mkdirTree(path: string): void;
  writeFile(path: string, data: string | Uint8Array, options?: { encoding?: 'utf8' | 'binary' }): unknown;
  readFile(path: string, options?: { encoding?: 'utf8' | 'binary' }): unknown;
}

const scope = globalThis as unknown as WorkerScope;
let runtimePromise: Promise<PyodideInterface> | null = null;
let runtimeIndexURL = '';
let activeExecutionId: string | null = null;
let cancellationRequested = false;

function post(message: WorkerResponse): void {
  scope.postMessage(message);
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  const text = String(error || '');
  return text || '本地 Python 运行时发生未知错误';
}

function blockWorkerNetworkAccess(): void {
  const message = '本地 Python 执行已禁用网络访问';
  const rejectNetworkAccess = (): Promise<never> => Promise.reject(new Error(message));
  const blockedConstructor = (): never => { throw new Error(message); };
  const workerGlobal = globalThis as unknown as Record<string, unknown>;

  const blockGlobal = (name: string): void => {
    const existed = typeof workerGlobal[name] !== 'undefined';
    try {
      workerGlobal[name] = blockedConstructor;
    } catch (error) {
      if (existed) throw error;
      return;
    }
    if (existed && workerGlobal[name] !== blockedConstructor) {
      throw new Error(`无法安全禁用 Worker 网络入口: ${name}`);
    }
  };

  try {
    workerGlobal.fetch = rejectNetworkAccess;
  } catch (error) {
    throw error;
  }
  if (workerGlobal.fetch !== rejectNetworkAccess) {
    throw new Error('无法安全禁用 Worker fetch');
  }

  for (const name of [
    'XMLHttpRequest',
    'WebSocket',
    'EventSource',
    'WebTransport',
    'RTCPeerConnection',
    'webkitRTCPeerConnection',
    'Worker',
    'SharedWorker',
    'importScripts',
  ]) {
    blockGlobal(name);
  }

  const workerNavigator = workerGlobal.navigator as Record<string, unknown> | undefined;
  if (workerNavigator && typeof workerNavigator === 'object' && typeof workerNavigator.sendBeacon !== 'undefined') {
    try {
      workerNavigator.sendBeacon = blockedConstructor;
    } catch (error) {
      throw error;
    }
    if (workerNavigator.sendBeacon !== blockedConstructor) {
      throw new Error('无法安全禁用 navigator.sendBeacon');
    }
  }
}

function pythonStringLiteral(value: string): string {
  return JSON.stringify(value)
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

async function getRuntime(indexURL: string): Promise<PyodideInterface> {
  const normalizedIndexURL = indexURL.endsWith('/') ? indexURL : `${indexURL}/`;
  if (runtimePromise && runtimeIndexURL === normalizedIndexURL) return runtimePromise;
  runtimeIndexURL = normalizedIndexURL;
  runtimePromise = loadPyodide({ indexURL: normalizedIndexURL }).catch((error: unknown) => {
    runtimePromise = null;
    runtimeIndexURL = '';
    throw error;
  });
  return runtimePromise;
}

function workspacePath(relativePath: string): string {
  if (
    relativePath.startsWith('/') ||
    relativePath.startsWith('\\') ||
    /^[A-Za-z]:/.test(relativePath) ||
    relativePath.split(/[\\/]/u).some((segment) => segment === '..' || segment === '')
  ) {
    throw new Error(`不安全的 Python 文件路径: ${relativePath}`);
  }
  return `${WORKSPACE_ROOT}/${relativePath}`;
}

function readUtf8File(fileSystem: PyodideFileSystem, path: string): string {
  const value = fileSystem.readFile(path, { encoding: 'utf8' });
  if (typeof value === 'string') return value;
  if (value instanceof Uint8Array) return new TextDecoder('utf-8').decode(value);
  return String(value ?? '');
}

const PYTHON_RUNNER = String.raw`
import io
import json
import os
import runpy
import shutil
import sys
import traceback

_ROOT = ${pythonStringLiteral(WORKSPACE_ROOT)}
_BASELINE_PATH = ${pythonStringLiteral(BASELINE_PATH)}
_RESULT_PATH = ${pythonStringLiteral(RESULT_PATH)}
_MAX_FILE_BYTES = ${MAX_FILE_BYTES}
_MAX_TOTAL_BYTES = ${MAX_TOTAL_BYTES}
_MAX_SCAN_FILES = ${MAX_SCAN_FILES}
_MAX_CHANGED_FILES = ${MAX_CHANGED_FILES}
_MAX_OUTPUT_BYTES = ${MAX_OUTPUT_BYTES}
_IGNORED_DIRECTORIES = {
    '.git', '.hg', '.svn', '.command-tmp', 'node_modules', '.next',
    '.nuxt', '.svelte-kit', '.cache', '.npm', '.npm-cache', '.pnpm-store',
    '.yarn', '.venv', 'venv', '__pycache__', '.pytest_cache', '.mypy_cache',
    '.ruff_cache', '.tox', '.gradle', '.idea', 'coverage', 'dist', 'build',
    'target'
}

class _BoundedWriter(io.TextIOBase):
    def __init__(self, limit):
        super().__init__()
        self._limit = limit
        self._parts = []
        self._size = 0
        self.truncated = False

    @property
    def encoding(self):
        return 'utf-8'

    def writable(self):
        return True

    def seekable(self):
        return False

    def isatty(self):
        return False

    def flush(self):
        return None

    def close(self):
        return None

    def write(self, value):
        if self.truncated:
            raise RuntimeError('Python 输出超过本地安全限制')
        if value is None:
            return 0
        if not isinstance(value, str):
            value = str(value)
        encoded = value.encode('utf-8', 'replace')
        remaining = self._limit - self._size
        if len(encoded) > remaining:
            accepted = encoded[:remaining] if remaining > 0 else b''
            text = accepted.decode('utf-8', 'ignore')
            if text:
                self._parts.append(text)
            self._size += len(accepted)
            self.truncated = True
            raise RuntimeError('Python 输出超过本地安全限制')
        self._parts.append(encoded.decode('utf-8'))
        self._size += len(encoded)
        return len(value)

    def value(self):
        return ''.join(self._parts)


def _collect_workspace(root, baseline_json):
    baseline = json.loads(baseline_json)
    baseline_directories = set()
    for baseline_path in baseline:
        parts = baseline_path.split('/')
        for depth in range(1, len(parts)):
            baseline_directories.add('/'.join(parts[:depth]))

    changed = []
    ignored = []
    ignored_count = 0
    scanned_entries = 0
    changed_bytes = 0

    def add_ignored(value):
        nonlocal ignored_count
        ignored_count += 1
        if len(ignored) < 100:
            ignored.append(value)

    def add_changed(value):
        if len(changed) >= _MAX_CHANGED_FILES:
            raise RuntimeError('生成文件数超过本地同步限制')
        changed.append(value)

    def walk(directory):
        nonlocal scanned_entries, changed_bytes
        try:
            entries = sorted(os.scandir(directory), key=lambda entry: entry.name)
        except OSError as error:
            add_ignored('%s (%s)' % (os.path.relpath(directory, root), error))
            return

        for entry in entries:
            scanned_entries += 1
            if scanned_entries > _MAX_SCAN_FILES:
                raise RuntimeError('生成目录项数量超过本地同步限制')

            relative_path = os.path.relpath(entry.path, root).replace(os.sep, '/')
            if relative_path in ('', '.'):
                continue

            try:
                is_symlink = entry.is_symlink()
                is_directory = entry.is_dir(follow_symlinks=False)
                is_file = entry.is_file(follow_symlinks=False)
            except OSError:
                add_ignored('%s (无法读取)' % relative_path)
                continue

            if is_symlink:
                add_ignored('%s (symbolic link)' % relative_path)
                continue
            if is_directory:
                if entry.name in _IGNORED_DIRECTORIES and relative_path not in baseline_directories:
                    add_ignored('%s/' % relative_path)
                else:
                    walk(entry.path)
                continue
            if not is_file:
                add_ignored(relative_path)
                continue

            try:
                file_size = entry.stat(follow_symlinks=False).st_size
            except OSError:
                add_ignored('%s (无法读取大小)' % relative_path)
                continue
            if file_size > _MAX_FILE_BYTES:
                add_ignored('%s (file too large)' % relative_path)
                continue

            try:
                with open(entry.path, 'rb') as handle:
                    raw_content = handle.read()
                content = raw_content.decode('utf-8')
            except (OSError, UnicodeDecodeError):
                add_ignored('%s (binary or invalid UTF-8)' % relative_path)
                continue

            if baseline.get(relative_path) == content:
                continue

            changed_bytes += len(raw_content)
            if changed_bytes > _MAX_TOTAL_BYTES:
                raise RuntimeError('生成文件总大小超过本地同步限制')
            add_changed({
                'path': relative_path,
                'type': 'modified' if relative_path in baseline else 'added',
                'content': content,
                'isBinary': False,
                'size': len(raw_content),
            })

    walk(root)

    for baseline_path in baseline:
        absolute_path = os.path.join(root, *baseline_path.split('/'))
        try:
            still_file = os.path.isfile(absolute_path) and not os.path.islink(absolute_path)
        except OSError:
            still_file = False
        if not still_file:
            add_changed({'path': baseline_path, 'type': 'deleted'})

    changed.sort(key=lambda item: item['path'])
    ignored.sort()
    if ignored_count > len(ignored):
        ignored.append('…另有 %d 个生成项未同步' % (ignored_count - len(ignored)))
    return changed, ignored


def _execute(script_path, baseline_path):
    original_stdout = sys.stdout
    original_stderr = sys.stderr
    original_cwd = os.getcwd()
    original_argv = list(sys.argv)
    original_path = list(sys.path)
    output = _BoundedWriter(_MAX_OUTPUT_BYTES)
    error_output = _BoundedWriter(_MAX_OUTPUT_BYTES)
    exit_code = 0
    execution_error = None
    file_sync_error = None
    changed = []
    ignored = []

    try:
        os.chdir(_ROOT)
        sys.stdout = output
        sys.stderr = error_output
        sys.argv = [script_path]
        sys.dont_write_bytecode = True
        sys.path.insert(0, os.path.dirname(script_path))
        sys.path.insert(0, _ROOT)
        runpy.run_path(script_path, run_name='__main__')
    except SystemExit as exc:
        value = exc.code
        if value is None:
            exit_code = 0
        elif isinstance(value, int):
            exit_code = value
        else:
            exit_code = 1
            execution_error = 'SystemExit: %s' % (value,)
    except BaseException:
        exit_code = 1
        execution_error = traceback.format_exc()
    finally:
        if execution_error is not None:
            try:
                error_output.write(execution_error)
            except BaseException:
                pass
        try:
            sys.stdout = original_stdout
            sys.stderr = original_stderr
            sys.argv = original_argv
            sys.path[:] = original_path
            os.chdir(original_cwd)
        except BaseException:
            pass

    try:
        with open(baseline_path, 'r', encoding='utf-8') as baseline_file:
            baseline_json = baseline_file.read()
        changed, ignored = _collect_workspace(_ROOT, baseline_json)
    except BaseException:
        file_sync_error = 'Python 已结束，但生成文件无法安全同步: %s' % traceback.format_exc()

    output_limit_exceeded = output.truncated or error_output.truncated
    limit_error = 'Python 输出超过限制并已终止' if output_limit_exceeded else None
    payload = {
        'success': exit_code == 0 and not output_limit_exceeded and file_sync_error is None,
        'exitCode': exit_code,
        'stdout': output.value(),
        'stderr': error_output.value(),
        'stdoutTruncated': output.truncated,
        'stderrTruncated': error_output.truncated,
        'timedOut': False,
        'cancelled': False,
        'outputLimitExceeded': output_limit_exceeded,
        'changedFiles': changed,
        'ignoredPaths': ignored,
        'fileSyncError': file_sync_error,
        'error': execution_error or limit_error or file_sync_error,
    }
    with open(_RESULT_PATH, 'w', encoding='utf-8') as handle:
        json.dump(payload, handle, ensure_ascii=True, separators=(',', ':'))
`;

async function execute(request: RunRequest): Promise<void> {
  activeExecutionId = request.executionId;
  cancellationRequested = false;
  post({ type: 'status', executionId: request.executionId, status: 'loading' });

  try {
    const runtime = await getRuntime(request.indexURL);
    if (cancellationRequested) throw new Error('Python 执行已取消');
    post({ type: 'status', executionId: request.executionId, status: 'preparing' });
    blockWorkerNetworkAccess();

    const fileSystem = runtime.FS as unknown as PyodideFileSystem;
    await runtime.runPythonAsync(
      `import os, shutil; shutil.rmtree(${pythonStringLiteral(WORKSPACE_ROOT)}, ignore_errors=True); os.makedirs(${pythonStringLiteral(WORKSPACE_ROOT)}, exist_ok=True)`,
    );
    fileSystem.mkdirTree(WORKSPACE_ROOT);

    for (const [relativePath, content] of Object.entries(request.files)) {
      const absolutePath = workspacePath(relativePath);
      const directory = absolutePath.slice(0, absolutePath.lastIndexOf('/'));
      fileSystem.mkdirTree(directory);
      fileSystem.writeFile(absolutePath, content, { encoding: 'utf8' });
    }
    fileSystem.writeFile(BASELINE_PATH, JSON.stringify(request.files), { encoding: 'utf8' });

    if (cancellationRequested) throw new Error('Python 执行已取消');
    const scriptPath = workspacePath(request.scriptPath);
    post({ type: 'status', executionId: request.executionId, status: 'running' });
    await runtime.runPythonAsync(
      `${PYTHON_RUNNER}\n_execute(${pythonStringLiteral(scriptPath)}, ${pythonStringLiteral(BASELINE_PATH)})`,
    );

    const rawResult = readUtf8File(fileSystem, RESULT_PATH);
    const result = JSON.parse(rawResult) as ResultResponse['result'];
    post({ type: 'result', executionId: request.executionId, result });
  } catch (error: unknown) {
    post({
      type: 'error',
      executionId: request.executionId,
      message: errorMessage(error),
    });
  } finally {
    activeExecutionId = null;
    cancellationRequested = false;
  }
}

scope.onmessage = (event: MessageEvent<WorkerRequest>): void => {
  const request = event.data;
  if (!request || typeof request !== 'object') return;
  if (request.type === 'cancel') {
    if (activeExecutionId === request.executionId) cancellationRequested = true;
    return;
  }
  if (request.type === 'run') void execute(request);
};

scope.onerror = (event: ErrorEvent): void => {
  event.preventDefault();
};
