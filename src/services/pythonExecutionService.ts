import {
  WORKSPACE_LIMITS,
  type Workspace,
  type WorkspaceFile,
} from '../types/workspace';
export type WorkspacePythonChangeType = 'added' | 'modified' | 'deleted';

export interface WorkspacePythonChange {
  path: string;
  type: WorkspacePythonChangeType;
  content?: string;
  size?: number;
}

export interface WorkspacePythonExecutionResult {
  success: boolean;
  executionId: string;
  workspaceId: string;
  exitCode: number | null;
  signal: string | null;
  stdout: string;
  stderr: string;
  stdoutTruncated: boolean;
  stderrTruncated: boolean;
  timedOut: boolean;
  cancelled: boolean;
  outputLimitExceeded: boolean;
  durationMs: number;
  changedFiles: WorkspacePythonChange[];
  ignoredPaths: string[];
  fileSyncError: string | null;
  error: string | null;
  executionMode: 'browser-pyodide';
}

export interface WorkspacePythonBaseline {
  workspaceId: string;
  files: Record<string, {
    content: string;
    isBinary: boolean;
    updatedAt: number;
  }>;
}

export interface WorkspacePythonMergeResult {
  workspace?: Workspace;
  appliedChanges: string[];
  conflicts: string[];
  skipped: string[];
}

const LOCAL_RUNTIME_LOAD_TIMEOUT_MS = 180_000;
const LOCAL_WORKSPACE_PREPARATION_TIMEOUT_MS = 300_000;
const LOCAL_EXECUTION_TIMEOUT_MS = 120_000;
const LOCAL_MAX_INPUT_BYTES = WORKSPACE_LIMITS.MAX_TOTAL_UNCOMPRESSED_SIZE;

function getPythonRuntimeIndexUrl(): string {
  const scopeRoot = new URL('../../', import.meta.url);
  return new URL('pyodide/', scopeRoot).toString();
}
const encoder = new TextEncoder();

interface LocalWorkerResult {
  success?: unknown;
  exitCode?: unknown;
  stdout?: unknown;
  stderr?: unknown;
  stdoutTruncated?: unknown;
  stderrTruncated?: unknown;
  timedOut?: unknown;
  cancelled?: unknown;
  outputLimitExceeded?: unknown;
  changedFiles?: unknown;
  ignoredPaths?: unknown;
  fileSyncError?: unknown;
  error?: unknown;
}

interface WorkerRunRequest {
  type: 'run';
  executionId: string;
  scriptPath: string;
  files: Record<string, string>;
  indexURL: string;
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function strictSafeWorkspacePath(rawPath: string): string {
  if (typeof rawPath !== 'string' || rawPath.length === 0 || rawPath.length > 1_024) {
    throw new Error('工作区文件路径为空或过长');
  }
  const slashPath = rawPath.replace(/\\/g, '/');
  if (slashPath !== rawPath || slashPath !== slashPath.trim()) {
    throw new Error(`工作区路径必须使用规范的正斜杠格式: ${rawPath}`);
  }
  if (
    slashPath.startsWith('/') ||
    /^[A-Za-z]:/.test(slashPath) ||
    slashPath.includes('\0') ||
    /[\u0000-\u001f\u007f]/.test(slashPath)
  ) {
    throw new Error(`拒绝不安全的 Python 文件路径: ${rawPath}`);
  }

  const segments = slashPath.split('/');
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
    throw new Error(`路径必须是规范化的相对路径: ${rawPath}`);
  }
  if (segments.length > WORKSPACE_LIMITS.MAX_PATH_DEPTH) {
    throw new Error(`路径层级超过限制: ${rawPath}`);
  }
  for (const segment of segments) {
    if (segment.includes(':') || /[. ]$/.test(segment)) {
      throw new Error(`路径包含非法字符: ${rawPath}`);
    }
  }

  const normalizedPath = segments.join('/');
  if (!normalizedPath) throw new Error('工作区文件路径无效');
  return normalizedPath;
}

function strictPythonPath(rawPath: string): string {
  const normalizedPath = strictSafeWorkspacePath(rawPath);
  if (!normalizedPath.toLowerCase().endsWith('.py')) {
    throw new Error('只能执行工作区中的 .py 文件');
  }
  return normalizedPath;
}

function createExecutionId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    // Older Android WebViews may expose an unusable randomUUID function.
  }
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function failureResult(
  workspaceId: string,
  executionId: string,
  durationMs: number,
  message: string,
  flags: Partial<Pick<WorkspacePythonExecutionResult, 'cancelled' | 'timedOut'>> = {},
): WorkspacePythonExecutionResult {
  return {
    success: false,
    executionId,
    workspaceId,
    exitCode: null,
    signal: null,
    stdout: '',
    stderr: '',
    stdoutTruncated: false,
    stderrTruncated: false,
    timedOut: flags.timedOut === true,
    cancelled: flags.cancelled === true,
    outputLimitExceeded: false,
    durationMs,
    changedFiles: [],
    ignoredPaths: [],
    fileSyncError: null,
    error: message,
    executionMode: 'browser-pyodide',
  };
}

function normalizeWorkerResult(
  workspaceId: string,
  executionId: string,
  raw: LocalWorkerResult,
  durationMs: number,
): WorkspacePythonExecutionResult {
  const changedFiles: WorkspacePythonChange[] = [];
  const seenPaths = new Set<string>();
  if (Array.isArray(raw.changedFiles)) {
    for (const item of raw.changedFiles) {
      if (changedFiles.length >= WORKSPACE_LIMITS.MAX_FILE_COUNT) break;
      if (!item || typeof item !== 'object') continue;
      const candidate = item as Partial<WorkspacePythonChange>;
      if (
        typeof candidate.path !== 'string' ||
        (candidate.type !== 'added' && candidate.type !== 'modified' && candidate.type !== 'deleted')
      ) {
        continue;
      }
      let path: string;
      try {
        path = strictSafeWorkspacePath(candidate.path);
      } catch {
        continue;
      }
      const pathKey = path.toLocaleLowerCase('en-US');
      if (seenPaths.has(pathKey)) continue;
      seenPaths.add(pathKey);
      if (candidate.type === 'deleted') {
        changedFiles.push({ path, type: 'deleted' });
      } else if (typeof candidate.content === 'string') {
        const size = encoder.encode(candidate.content).byteLength;
        if (size <= WORKSPACE_LIMITS.MAX_SINGLE_FILE_SIZE) {
          changedFiles.push({ path, type: candidate.type, content: candidate.content, size });
        }
      }
    }
  }

  const ignoredPaths = Array.isArray(raw.ignoredPaths)
    ? raw.ignoredPaths.filter((item): item is string => typeof item === 'string').slice(0, 100)
    : [];
  const exitCode = typeof raw.exitCode === 'number' && Number.isInteger(raw.exitCode)
    ? raw.exitCode
    : null;
  const success = raw.success === true && exitCode === 0 &&
    raw.timedOut !== true && raw.cancelled !== true &&
    raw.outputLimitExceeded !== true && typeof raw.fileSyncError !== 'string';

  return {
    success,
    executionId,
    workspaceId,
    exitCode,
    signal: null,
    stdout: typeof raw.stdout === 'string' ? raw.stdout : '',
    stderr: typeof raw.stderr === 'string' ? raw.stderr : '',
    stdoutTruncated: raw.stdoutTruncated === true,
    stderrTruncated: raw.stderrTruncated === true,
    timedOut: raw.timedOut === true,
    cancelled: raw.cancelled === true,
    outputLimitExceeded: raw.outputLimitExceeded === true,
    durationMs,
    changedFiles,
    ignoredPaths,
    fileSyncError: nullableString(raw.fileSyncError),
    error: nullableString(raw.error),
    executionMode: 'browser-pyodide',
  };
}

function createProjectedFiles(workspace: Workspace): Record<string, string> {
  const entries = Object.entries(workspace.files);
  if (entries.length > WORKSPACE_LIMITS.MAX_FILE_COUNT) {
    throw new Error(`工作区文件数超过本地 Python 限制 (${WORKSPACE_LIMITS.MAX_FILE_COUNT})`);
  }

  const projected: Record<string, string> = {};
  const paths = new Set<string>();
  let totalBytes = 0;
  for (const [rawPath, file] of entries) {
    const path = strictSafeWorkspacePath(rawPath);
    if (strictSafeWorkspacePath(file.path) !== path) {
      throw new Error(`工作区文件键与文件路径不一致: ${rawPath}`);
    }
    const pathKey = path.toLocaleLowerCase('en-US');
    if (paths.has(pathKey)) throw new Error(`工作区存在重复路径: ${path}`);
    paths.add(pathKey);
    if (file.isBinary === true) continue;
    if (typeof file.content !== 'string') throw new Error(`文件内容无效: ${path}`);
    const byteLength = encoder.encode(file.content).byteLength;
    totalBytes += byteLength;
    if (byteLength > WORKSPACE_LIMITS.MAX_SINGLE_FILE_SIZE) {
      throw new Error(`文件超过本地 Python 单文件限制: ${path}`);
    }
    if (totalBytes > LOCAL_MAX_INPUT_BYTES) {
      throw new Error('工作区超过本地 Python 输入大小限制');
    }
    projected[path] = file.content;
  }
  return projected;
}

export function createWorkspacePythonBaseline(workspace: Workspace): WorkspacePythonBaseline {
  const files: WorkspacePythonBaseline['files'] = {};
  for (const [filePath, file] of Object.entries(workspace.files)) {
    files[filePath] = {
      content: file.content,
      isBinary: file.isBinary === true,
      updatedAt: file.updatedAt,
    };
  }
  return { workspaceId: workspace.id, files };
}

export function mergeWorkspacePythonChanges(
  latestWorkspace: Workspace,
  baseline: WorkspacePythonBaseline,
  changes: WorkspacePythonChange[],
): WorkspacePythonMergeResult {
  const candidateFiles: Record<string, WorkspaceFile> = { ...latestWorkspace.files };
  const appliedChanges: string[] = [];
  const conflicts: string[] = [];
  const skipped: string[] = [];
  const acceptedPaths = new Set<string>();
  const pending: Array<{
    path: string;
    type: WorkspacePythonChangeType;
    content?: string;
    size: number;
  }> = [];

  for (const change of changes) {
    let changedPath: string;
    try {
      changedPath = strictSafeWorkspacePath(change.path);
    } catch (error) {
      skipped.push(`${change.path || '(empty path)'}: ${error instanceof Error ? error.message : '无效路径'}`);
      continue;
    }
    const pathKey = changedPath.toLocaleLowerCase('en-US');
    if (acceptedPaths.has(pathKey)) {
      skipped.push(`${changedPath} (规范化后重复)`);
      continue;
    }
    acceptedPaths.add(pathKey);
    if (change.type !== 'added' && change.type !== 'modified' && change.type !== 'deleted') {
      skipped.push(`${changedPath} (不支持的变更类型)`);
      continue;
    }

    const baselineFile = baseline.files[changedPath];
    const latestFile = latestWorkspace.files[changedPath];
    const latestChanged = baselineFile
      ? !latestFile || latestFile.content !== baselineFile.content || latestFile.isBinary === true !== baselineFile.isBinary
      : Boolean(latestFile);
    if (latestChanged) {
      conflicts.push(changedPath);
      continue;
    }

    if ((change.type === 'added' && baselineFile) || (change.type === 'modified' && !baselineFile)) {
      conflicts.push(changedPath);
      continue;
    }
    if (baselineFile?.isBinary === true) {
      skipped.push(`${changedPath} (本地 Python 不会覆盖二进制基线文件)`);
      continue;
    }
    if (change.type === 'deleted') {
      if (!baselineFile && !latestFile) {
        skipped.push(`${changedPath} (文件已不存在)`);
      } else {
        pending.push({ path: changedPath, type: 'deleted', size: 0 });
      }
      continue;
    }
    if (typeof change.content !== 'string') {
      skipped.push(`${changedPath} (缺少文本内容)`);
      continue;
    }

    const size = encoder.encode(change.content).byteLength;
    if (size > WORKSPACE_LIMITS.MAX_SINGLE_FILE_SIZE) {
      skipped.push(`${changedPath} (${size} 字节超过单文件限制)`);
      continue;
    }
    pending.push({ path: changedPath, type: change.type, content: change.content, size });
  }

  for (const change of pending) {
    if (change.type === 'deleted') {
      delete candidateFiles[change.path];
    } else {
      candidateFiles[change.path] = {
        path: change.path,
        content: change.content || '',
        isBinary: false,
        size: change.size,
        updatedAt: Date.now(),
      };
    }
  }

  const paths = Object.keys(candidateFiles);
  const totalBytes = paths.reduce((sum, filePath) => sum + (candidateFiles[filePath].size || 0), 0);
  const collision = paths.find((filePath) => paths.some((candidate) => candidate.startsWith(`${filePath}/`)));
  let rejectionReason: string | null = null;
  if (paths.length > WORKSPACE_LIMITS.MAX_FILE_COUNT) {
    rejectionReason = `最终文件数超过 ${WORKSPACE_LIMITS.MAX_FILE_COUNT}`;
  } else if (totalBytes > WORKSPACE_LIMITS.MAX_TOTAL_UNCOMPRESSED_SIZE) {
    rejectionReason = `最终工作区总大小超过 ${WORKSPACE_LIMITS.MAX_TOTAL_UNCOMPRESSED_SIZE} 字节`;
  } else if (collision) {
    rejectionReason = `检测到文件/目录路径冲突: ${collision}`;
  }

  if (rejectionReason) {
    for (const change of pending) skipped.push(`${change.path} (${rejectionReason})`);
    return { appliedChanges, conflicts, skipped };
  }

  const updatedAt = Date.now();
  const nextFiles = { ...candidateFiles };
  for (const change of pending) {
    appliedChanges.push(change.path);
    if (change.type !== 'deleted') {
      nextFiles[change.path] = {
        ...nextFiles[change.path],
        path: change.path,
        content: change.content || '',
        isBinary: false,
        size: change.size,
        updatedAt,
      };
    }
  }

  if (appliedChanges.length === 0) return { appliedChanges, conflicts, skipped };
  return {
    workspace: { ...latestWorkspace, files: nextFiles, updatedAt },
    appliedChanges,
    conflicts,
    skipped,
  };
}

export async function executeWorkspacePython(
  workspace: Workspace,
  scriptPath: string,
  signal: AbortSignal,
): Promise<WorkspacePythonExecutionResult> {
  const normalizedScriptPath = strictPythonPath(scriptPath);
  const projectedFiles = createProjectedFiles(workspace);
  if (!Object.prototype.hasOwnProperty.call(projectedFiles, normalizedScriptPath)) {
    throw new Error(`工作区中不存在可执行的 Python 文件: ${normalizedScriptPath}`);
  }
  if (typeof Worker === 'undefined') {
    throw new Error('当前浏览器不支持 Web Worker，无法使用本地 Python 执行。');
  }
  const executionId = createExecutionId();
  const startedAt = Date.now();

  return new Promise<WorkspacePythonExecutionResult>((resolve) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL('../workers/pythonWorker.ts', import.meta.url), {
        type: 'module',
        name: 'workspace-python-runtime',
      });
    } catch (error: unknown) {
      resolve(failureResult(
        workspace.id,
        executionId,
        Date.now() - startedAt,
        error instanceof Error ? error.message : '无法创建本地 Python Worker',
      ));
      return;
    }

    let settled = false;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    let currentPhase = 0;
    let handleAbort: () => void = () => undefined;

    const cleanup = (): void => {
      if (timeoutHandle !== null) clearTimeout(timeoutHandle);
      signal.removeEventListener('abort', handleAbort);
      worker.onmessage = null;
      worker.onerror = null;
      worker.onmessageerror = null;
      worker.terminate();
    };
    const settle = (result: WorkspacePythonExecutionResult): void => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };
    const armTimeout = (timeoutMs: number, message: string): void => {
      if (timeoutHandle !== null) clearTimeout(timeoutHandle);
      timeoutHandle = setTimeout(() => {
        settle(failureResult(
          workspace.id,
          executionId,
          Date.now() - startedAt,
          message,
          { timedOut: true },
        ));
      }, timeoutMs);
    };
    handleAbort = (): void => {
      settle(failureResult(
        workspace.id,
        executionId,
        Date.now() - startedAt,
        '本地 Python 执行已取消',
        { cancelled: true },
      ));
    };

    signal.addEventListener('abort', handleAbort, { once: true });
    if (signal.aborted) {
      handleAbort();
      return;
    }

    armTimeout(LOCAL_RUNTIME_LOAD_TIMEOUT_MS, '本地 Python 运行时加载超时并已终止');

    worker.onmessage = (event: MessageEvent<unknown>): void => {
      if (settled) return;
      const message = event.data as {
        type?: unknown;
        executionId?: unknown;
        status?: unknown;
        result?: LocalWorkerResult;
        message?: unknown;
      };
      if (!message || message.executionId !== executionId) return;
      if (message.type === 'status') {
        const phase = message.status === 'loading'
          ? 1
          : message.status === 'preparing'
            ? 2
            : message.status === 'running'
              ? 3
              : 0;
        if (phase <= currentPhase) return;
        currentPhase = phase;
        if (phase === 1) armTimeout(LOCAL_RUNTIME_LOAD_TIMEOUT_MS, '本地 Python 运行时加载超时并已终止');
        if (phase === 2) armTimeout(LOCAL_WORKSPACE_PREPARATION_TIMEOUT_MS, '本地 Python 工作区准备超时并已终止');
        if (phase === 3) armTimeout(LOCAL_EXECUTION_TIMEOUT_MS, '本地 Python 执行超时并已终止');
        return;
      }
      if (message.type === 'error') {
        settle(failureResult(
          workspace.id,
          executionId,
          Date.now() - startedAt,
          typeof message.message === 'string' ? message.message : '本地 Python Worker 执行失败',
        ));
        return;
      }
      if (message.type === 'result' && message.result && typeof message.result === 'object') {
        settle(normalizeWorkerResult(
          workspace.id,
          executionId,
          message.result,
          Date.now() - startedAt,
        ));
      }
    };
    worker.onerror = (event: ErrorEvent): void => {
      settle(failureResult(
        workspace.id,
        executionId,
        Date.now() - startedAt,
        event.message || '本地 Python Worker 发生运行时错误',
      ));
    };
    worker.onmessageerror = (): void => {
      settle(failureResult(
        workspace.id,
        executionId,
        Date.now() - startedAt,
        '本地 Python Worker 返回了无法解析的数据',
      ));
    };

    try {
      worker.postMessage({
        type: 'run',
        executionId,
        scriptPath: normalizedScriptPath,
        files: projectedFiles,
        indexURL: getPythonRuntimeIndexUrl(),
      } satisfies WorkerRunRequest);
    } catch (error: unknown) {
      settle(failureResult(
        workspace.id,
        executionId,
        Date.now() - startedAt,
        error instanceof Error ? error.message : '无法向本地 Python Worker 发送工作区',
      ));
    }
  });
}
