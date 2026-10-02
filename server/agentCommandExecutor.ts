import 'dotenv/config';
import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  chmod,
  chown,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export interface AgentCommandExecutorConfig {
  enabled: boolean;
  workRoot: string;
  timeoutMs: number;
  maxOutputBytes: number;
  maxCommandLength: number;
  maxWorkspaceFiles: number;
  maxFileBytes: number;
  maxTotalBytes: number;
  maxScanFiles: number;
  maxConcurrentExecutions: number;
  dropPrivileges: boolean;
  dropPrivilegesToUid: number;
  dropPrivilegesToGid: number;
}

export interface CommandFileInput {
  content?: unknown;
  isBinary?: unknown;
}

export interface ChangedCommandFile {
  path: string;
  type: 'added' | 'modified' | 'deleted';
  content?: string;
  isBinary?: false;
  size?: number;
}

export interface AgentCommandExecutionResult {
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
  changedFiles: ChangedCommandFile[];
  ignoredPaths: string[];
  fileSyncError: string | null;
  error: string | null;
}

export class AgentCommandApiError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.name = 'AgentCommandApiError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

function readBooleanEnv(name: string, fallback = false): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) return fallback;
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

function readIntegerEnv(name: string, fallback: number, minimum: number, maximum: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

function loadConfig(): AgentCommandExecutorConfig {
  const configuredRoot = process.env.AGENT_COMMAND_WORK_ROOT?.trim();
  const workRoot = path.resolve(configuredRoot || path.join(os.tmpdir(), 'ivochat-agent-command'));
  if (workRoot === path.parse(workRoot).root) {
    throw new Error('AGENT_COMMAND_WORK_ROOT 不能配置为文件系统根目录');
  }

  return {
    enabled: readBooleanEnv('AGENT_COMMAND_EXECUTION_ENABLED', false),
    workRoot,
    timeoutMs: readIntegerEnv('AGENT_COMMAND_TIMEOUT_MS', 120_000, 1_000, 600_000),
    maxOutputBytes: readIntegerEnv(
      'AGENT_COMMAND_MAX_OUTPUT_BYTES',
      512 * 1024,
      4 * 1024,
      8 * 1024 * 1024,
    ),
    maxCommandLength: readIntegerEnv('AGENT_COMMAND_MAX_LENGTH', 16_000, 64, 64_000),
    maxWorkspaceFiles: readIntegerEnv(
      'AGENT_COMMAND_MAX_WORKSPACE_FILES',
      1_200,
      1,
      5_000,
    ),
    maxFileBytes: readIntegerEnv(
      'AGENT_COMMAND_MAX_FILE_BYTES',
      10 * 1024 * 1024,
      1_024,
      50 * 1024 * 1024,
    ),
    maxTotalBytes: readIntegerEnv(
      'AGENT_COMMAND_MAX_TOTAL_BYTES',
      150 * 1024 * 1024,
      1_024 * 1024,
      500 * 1024 * 1024,
    ),
    maxScanFiles: readIntegerEnv('AGENT_COMMAND_MAX_SCAN_FILES', 5_000, 100, 20_000),
    maxConcurrentExecutions: readIntegerEnv(
      'AGENT_COMMAND_MAX_CONCURRENCY',
      2,
      1,
      16,
    ),
    dropPrivileges: readBooleanEnv('AGENT_COMMAND_DROP_PRIVILEGES', process.platform !== 'win32'),
    dropPrivilegesToUid: readIntegerEnv('AGENT_COMMAND_UID', 65_534, 1, 65_535),
    dropPrivilegesToGid: readIntegerEnv('AGENT_COMMAND_GID', 65_534, 1, 65_535),
  };
}

export const agentCommandConfig = loadConfig();

const IGNORED_DIRECTORY_NAMES = new Set([
  '.git',
  '.hg',
  '.svn',
  '.command-tmp',
  'node_modules',
  '.next',
  '.nuxt',
  '.svelte-kit',
  '.cache',
  '.npm',
  '.npm-cache',
  '.pnpm-store',
  '.yarn',
  '.venv',
  'venv',
  '__pycache__',
  '.pytest_cache',
  '.mypy_cache',
  '.ruff_cache',
  '.tox',
  '.gradle',
  '.idea',
  'coverage',
  'dist',
  'build',
  'target',
]);

const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;
const UTF8_DECODER = new TextDecoder('utf-8', { fatal: true });

function normalizeSafeRelativePath(rawPath: unknown): { valid: boolean; normalizedPath: string; error?: string } {
  if (typeof rawPath !== 'string' || rawPath.length === 0) {
    return { valid: false, normalizedPath: '', error: '文件路径不能为空' };
  }
  if (rawPath.length > 1_024) {
    return { valid: false, normalizedPath: '', error: '文件路径过长' };
  }

  const slashPath = rawPath.replace(/\\/g, '/').trim();
  if (!slashPath || slashPath.startsWith('/') || /^[A-Za-z]:/.test(slashPath)) {
    return { valid: false, normalizedPath: '', error: `拒绝绝对路径: ${rawPath}` };
  }

  const segments = slashPath.split('/');
  const safeSegments: string[] = [];
  for (const segment of segments) {
    if (!segment || segment === '.') continue;
    if (segment === '..') {
      return { valid: false, normalizedPath: '', error: `拒绝路径穿越: ${rawPath}` };
    }
    if (
      segment.includes(':') ||
      CONTROL_CHARACTER_PATTERN.test(segment) ||
      /[. ]$/.test(segment)
    ) {
      return { valid: false, normalizedPath: '', error: `路径包含非法字符: ${rawPath}` };
    }
    safeSegments.push(segment);
  }

  if (safeSegments.length === 0) {
    return { valid: false, normalizedPath: '', error: '文件路径规范化后为空' };
  }
  if (safeSegments.length > 32) {
    return { valid: false, normalizedPath: '', error: `文件路径层级过深: ${rawPath}` };
  }

  const normalizedPath = safeSegments.join('/');
  if (path.posix.normalize(normalizedPath) !== normalizedPath) {
    return { valid: false, normalizedPath: '', error: `文件路径未规范化: ${rawPath}` };
  }
  return { valid: true, normalizedPath };
}

function resolveInsideRoot(root: string, relativePath: string): string {
  const absolutePath = path.resolve(root, ...relativePath.split('/'));
  const relativeToRoot = path.relative(root, absolutePath);
  const staysInside = relativeToRoot === '' || (
    relativeToRoot !== '..' &&
    !relativeToRoot.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relativeToRoot)
  );
  if (!staysInside) {
    throw new AgentCommandApiError(400, 'PATH_OUTSIDE_WORKSPACE', `路径超出执行工作区: ${relativePath}`);
  }
  return absolutePath;
}

function sanitizeWorkspaceId(rawWorkspaceId: unknown): string {
  if (typeof rawWorkspaceId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(rawWorkspaceId)) {
    throw new AgentCommandApiError(400, 'INVALID_WORKSPACE_ID', 'workspaceId 格式无效');
  }
  return rawWorkspaceId;
}

function validateCommand(rawCommand: unknown, config: AgentCommandExecutorConfig): string {
  if (typeof rawCommand !== 'string' || rawCommand.trim().length === 0) {
    throw new AgentCommandApiError(400, 'EMPTY_COMMAND', 'command 不能为空');
  }
  const command = rawCommand.trim();
  if (command.length > config.maxCommandLength) {
    throw new AgentCommandApiError(
      413,
      'COMMAND_TOO_LONG',
      `命令长度超过限制 (${config.maxCommandLength} 字符)`,
    );
  }
  if (command.includes('\0')) {
    throw new AgentCommandApiError(400, 'INVALID_COMMAND', '命令包含非法空字符');
  }
  return command;
}

interface PreparedWorkspace {
  baselineFiles: Map<string, string>;
  totalBytes: number;
}

async function materializeWorkspace(
  root: string,
  rawFiles: unknown,
  config: AgentCommandExecutorConfig,
): Promise<PreparedWorkspace> {
  if (!rawFiles || typeof rawFiles !== 'object' || Array.isArray(rawFiles)) {
    throw new AgentCommandApiError(400, 'INVALID_WORKSPACE_FILES', 'files 必须是工作区文件对象');
  }

  const entries = Object.entries(rawFiles as Record<string, CommandFileInput>);
  if (entries.length > config.maxWorkspaceFiles) {
    throw new AgentCommandApiError(
      413,
      'TOO_MANY_WORKSPACE_FILES',
      `工作区文件数超过限制 (${config.maxWorkspaceFiles})`,
    );
  }

  const baselineFiles = new Map<string, string>();
  const normalizedPaths = new Set<string>();
  const materializedEntries: Array<{ filePath: string; content: string; byteLength: number }> = [];
  const projectedPaths: string[] = [];
  let totalBytes = 0;

  for (const [rawPath, file] of entries) {
    const normalized = normalizeSafeRelativePath(rawPath);
    if (!normalized.valid) {
      throw new AgentCommandApiError(400, 'INVALID_WORKSPACE_PATH', normalized.error || '工作区路径无效');
    }
    const filePath = normalized.normalizedPath;
    const fileKey = process.platform === 'win32' ? filePath.toLowerCase() : filePath;
    if (normalizedPaths.has(fileKey)) {
      throw new AgentCommandApiError(400, 'DUPLICATE_WORKSPACE_PATH', `存在重复路径: ${filePath}`);
    }
    normalizedPaths.add(fileKey);
    projectedPaths.push(filePath);

    if (file?.isBinary === true) continue;
    if (!file || typeof file.content !== 'string') {
      throw new AgentCommandApiError(400, 'INVALID_WORKSPACE_FILE', `文件内容无效: ${filePath}`);
    }

    const byteLength = Buffer.byteLength(file.content, 'utf8');
    if (byteLength > config.maxFileBytes) {
      throw new AgentCommandApiError(
        413,
        'WORKSPACE_FILE_TOO_LARGE',
        `文件超过单文件限制: ${filePath}`,
      );
    }
    totalBytes += byteLength;
    if (totalBytes > config.maxTotalBytes) {
      throw new AgentCommandApiError(
        413,
        'WORKSPACE_TOO_LARGE',
        `工作区总大小超过限制 (${config.maxTotalBytes} 字节)`,
      );
    }

    materializedEntries.push({ filePath, content: file.content, byteLength });
    baselineFiles.set(filePath, file.content);
  }

  // Validate file/directory collisions before writing anything to disk.
  for (const filePath of projectedPaths) {
    const conflict = projectedPaths.find((candidate) =>
      candidate !== filePath && candidate.startsWith(`${filePath}/`)
    );
    if (conflict) {
      throw new AgentCommandApiError(
        400,
        'CONFLICTING_WORKSPACE_PATHS',
        `文件路径冲突: "${filePath}" 同时被用作文件和目录 (${conflict})`,
      );
    }
  }

  materializedEntries.sort((left, right) => {
    const depthDifference = left.filePath.split('/').length - right.filePath.split('/').length;
    return depthDifference || left.filePath.localeCompare(right.filePath);
  });

  for (const entry of materializedEntries) {
    const absolutePath = resolveInsideRoot(root, entry.filePath);
    await mkdir(path.dirname(absolutePath), { recursive: true, mode: 0o700 });
    await writeFile(absolutePath, entry.content, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
  }

  return { baselineFiles, totalBytes };
}

class BoundedOutput {
  private readonly chunks: Buffer[] = [];
  private bytes = 0;
  private truncated = false;

  constructor(private readonly maxBytes: number) {}

  /** Returns true only when this chunk newly reaches the output limit. */
  append(chunk: Buffer): boolean {
    if (this.truncated) return false;
    const remaining = this.maxBytes - this.bytes;
    const accepted = chunk.length > remaining ? chunk.subarray(0, remaining) : chunk;
    if (accepted.length > 0) {
      this.chunks.push(Buffer.from(accepted));
      this.bytes += accepted.length;
    }
    if (accepted.length < chunk.length) {
      this.truncated = true;
      return true;
    }
    return false;
  }

  get isTruncated(): boolean {
    return this.truncated;
  }

  toString(): string {
    return Buffer.concat(this.chunks, this.bytes).toString('utf8');
  }
}

function getDroppedIdentity(config: AgentCommandExecutorConfig): { uid: number; gid: number } | null {
  if (
    !config.dropPrivileges ||
    process.platform === 'win32' ||
    typeof process.getuid !== 'function' ||
    process.getuid() !== 0
  ) {
    return null;
  }
  return { uid: config.dropPrivilegesToUid, gid: config.dropPrivilegesToGid };
}

async function makeTreeOwnedBy(
  root: string,
  identity: { uid: number; gid: number },
): Promise<void> {
  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    const absolutePath = path.join(root, entry.name);
    if (entry.isDirectory() && !entry.isSymbolicLink()) {
      await makeTreeOwnedBy(absolutePath, identity);
      await chown(absolutePath, identity.uid, identity.gid);
      await chmod(absolutePath, 0o700);
    } else if (entry.isFile() && !entry.isSymbolicLink()) {
      await chown(absolutePath, identity.uid, identity.gid);
      await chmod(absolutePath, 0o600);
    }
  }
  await chown(root, identity.uid, identity.gid);
  await chmod(root, 0o700);
}

function killProcessTree(child: ChildProcess, signal: NodeJS.Signals): void {
  if (!child.pid) return;
  if (process.platform === 'win32') {
    try {
      spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
        windowsHide: true,
        stdio: 'ignore',
      });
    } catch {
      try { child.kill(signal); } catch { /* Process already exited. */ }
    }
    return;
  }

  try {
    process.kill(-child.pid, signal);
  } catch {
    try { child.kill(signal); } catch { /* Process already exited. */ }
  }
}

interface ProcessResult {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  spawnError: NodeJS.ErrnoException | null;
}

interface ShellExecutionResult {
  result: ProcessResult;
  stdout: BoundedOutput;
  stderr: BoundedOutput;
  timedOut: boolean;
  cancelled: boolean;
  outputLimitExceeded: boolean;
}

async function runShellCommand(
  command: string,
  cwd: string,
  config: AgentCommandExecutorConfig,
  abortSignal: AbortSignal,
  runAs: { uid: number; gid: number } | null,
): Promise<ShellExecutionResult> {
  const stdout = new BoundedOutput(config.maxOutputBytes);
  const stderr = new BoundedOutput(config.maxOutputBytes);
  let timedOut = false;
  let cancelled = false;
  let outputLimitExceeded = false;
  let forceKillTimer: NodeJS.Timeout | null = null;
  let terminationRequested = false;

  if (abortSignal.aborted) {
    cancelled = true;
    return {
      result: { exitCode: null, signal: null, spawnError: new Error('客户端已取消命令执行') },
      stdout,
      stderr,
      timedOut,
      cancelled,
      outputLimitExceeded,
    };
  }

  const temporaryDirectory = path.join(cwd, '.command-tmp');
  await mkdir(temporaryDirectory, { recursive: true, mode: 0o700 });
  if (runAs) await makeTreeOwnedBy(cwd, runAs);

  const childEnvironment: NodeJS.ProcessEnv = {
    PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin',
    HOME: cwd,
    TMPDIR: temporaryDirectory,
    TMP: temporaryDirectory,
    TEMP: temporaryDirectory,
    LANG: process.env.LANG || 'C.UTF-8',
    LC_ALL: process.env.LC_ALL || 'C.UTF-8',
    CI: '1',
    NO_COLOR: '1',
    PYTHONUNBUFFERED: '1',
    PYTHONDONTWRITEBYTECODE: '1',
    npm_config_cache: path.join(cwd, '.npm-cache'),
  };

  const isWindows = process.platform === 'win32';
  const shell = isWindows ? (process.env.ComSpec || 'cmd.exe') : '/bin/sh';
  const shellArguments = isWindows ? ['/d', '/s', '/c', command] : ['-c', command];
  const child = spawn(shell, shellArguments, {
    cwd,
    env: childEnvironment,
    detached: !isWindows,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    ...(runAs ? { uid: runAs.uid, gid: runAs.gid } : {}),
  });

  const requestTermination = (): void => {
    // Do not trust child.exitCode here: a shell can exit while a grandchild still holds the
    // stdout/stderr pipes open. The detached process group must still be terminated.
    if (terminationRequested || !child.pid) return;
    terminationRequested = true;
    killProcessTree(child, 'SIGTERM');
    forceKillTimer = setTimeout(() => killProcessTree(child, 'SIGKILL'), 2_000);
    forceKillTimer.unref?.();
  };

  const timeoutTimer = setTimeout(() => {
    timedOut = true;
    requestTermination();
  }, config.timeoutMs);
  timeoutTimer.unref?.();

  const abortHandler = (): void => {
    cancelled = true;
    requestTermination();
  };
  abortSignal.addEventListener('abort', abortHandler, { once: true });
  // Close the race between the initial pre-spawn check and listener registration.
  if (abortSignal.aborted) abortHandler();

  const stopOutput = (stream: NodeJS.ReadableStream | null, collector: BoundedOutput): void => {
    stream?.on('data', (chunk: Buffer | string) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      if (collector.append(buffer)) {
        outputLimitExceeded = true;
        requestTermination();
      }
    });
  };
  stopOutput(child.stdout, stdout);
  stopOutput(child.stderr, stderr);

  const processResult = await new Promise<ProcessResult>((resolve) => {
    let settled = false;
    const settle = (result: ProcessResult): void => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    child.once('error', (error) => {
      settle({ exitCode: null, signal: null, spawnError: error });
    });
    child.once('close', (code, signal) => {
      settle({ exitCode: code, signal, spawnError: null });
    });
  });

  clearTimeout(timeoutTimer);
  if (forceKillTimer) clearTimeout(forceKillTimer);
  abortSignal.removeEventListener('abort', abortHandler);

  return { result: processResult, stdout, stderr, timedOut, cancelled, outputLimitExceeded };
}

async function scanCommandOutput(
  root: string,
  baselineFiles: Map<string, string>,
  config: AgentCommandExecutorConfig,
): Promise<{ changedFiles: ChangedCommandFile[]; ignoredPaths: string[] }> {
  const changedFiles: ChangedCommandFile[] = [];
  const ignoredPaths: string[] = [];
  let ignoredPathCount = 0;
  let scannedEntryCount = 0;
  let changedTotalBytes = 0;

  const recordIgnoredPath = (relativePath: string): void => {
    ignoredPathCount += 1;
    if (ignoredPaths.length < 100) ignoredPaths.push(relativePath);
  };

  const addChangedFile = (file: ChangedCommandFile): void => {
    if (changedFiles.length >= config.maxWorkspaceFiles) {
      throw new AgentCommandApiError(
        413,
        'TOO_MANY_CHANGED_FILES',
        `命令变更文件数超过同步限制 (${config.maxWorkspaceFiles})`,
      );
    }
    changedFiles.push(file);
  };

  const walk = async (directory: string): Promise<void> => {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
      scannedEntryCount += 1;
      if (scannedEntryCount > config.maxScanFiles) {
        throw new AgentCommandApiError(
          413,
          'TOO_MANY_GENERATED_FILES',
          `命令生成目录项数量超过同步限制 (${config.maxScanFiles})`,
        );
      }

      const absolutePath = path.join(directory, entry.name);
      const relativePath = path.relative(root, absolutePath).split(path.sep).join('/');
      const safePath = normalizeSafeRelativePath(relativePath);
      if (!safePath.valid) {
        throw new AgentCommandApiError(
          500,
          'UNSAFE_GENERATED_PATH',
          `检测到不安全生成路径: ${relativePath}`,
        );
      }

      if (entry.isSymbolicLink()) {
        recordIgnoredPath(`${relativePath} (symbolic link)`);
        continue;
      }
      if (entry.isDirectory()) {
        if (IGNORED_DIRECTORY_NAMES.has(entry.name)) {
          recordIgnoredPath(`${relativePath}/`);
          continue;
        }
        await walk(absolutePath);
        continue;
      }
      if (!entry.isFile()) {
        recordIgnoredPath(relativePath);
        continue;
      }

      const stat = await lstat(absolutePath);
      if (stat.size > config.maxFileBytes) {
        recordIgnoredPath(`${relativePath} (file too large)`);
        continue;
      }

      const buffer = await readFile(absolutePath);
      let content: string;
      try {
        content = UTF8_DECODER.decode(buffer);
      } catch {
        recordIgnoredPath(`${relativePath} (binary or invalid UTF-8)`);
        continue;
      }

      const baseline = baselineFiles.get(relativePath);
      if (baseline === content) continue;

      changedTotalBytes += buffer.byteLength;
      if (changedTotalBytes > config.maxTotalBytes) {
        throw new AgentCommandApiError(
          413,
          'CHANGED_FILES_TOO_LARGE',
          `命令生成文件总大小超过同步限制 (${config.maxTotalBytes} 字节)`,
        );
      }

      addChangedFile({
        path: safePath.normalizedPath,
        type: baseline === undefined ? 'added' : 'modified',
        content,
        isBinary: false,
        size: buffer.byteLength,
      });
    }
  };

  await walk(root);

  for (const baselinePath of baselineFiles.keys()) {
    const absolutePath = resolveInsideRoot(root, baselinePath);
    try {
      const stat = await lstat(absolutePath);
      if (!stat.isFile()) addChangedFile({ path: baselinePath, type: 'deleted' });
    } catch {
      addChangedFile({ path: baselinePath, type: 'deleted' });
    }
  }

  const deduplicatedChanges = new Map<string, ChangedCommandFile>();
  for (const change of changedFiles) deduplicatedChanges.set(change.path, change);

  const finalChanges = Array.from(deduplicatedChanges.values())
    .sort((left, right) => left.path.localeCompare(right.path));
  ignoredPaths.sort();
  if (ignoredPathCount > ignoredPaths.length) {
    ignoredPaths.push(`…另有 ${ignoredPathCount - ignoredPaths.length} 个生成项未同步`);
  }
  return { changedFiles: finalChanges, ignoredPaths };
}

export interface ExecuteAgentCommandInput {
  workspaceId: unknown;
  command: unknown;
  files: unknown;
  abortSignal: AbortSignal;
}

export class AgentCommandExecutor {
  private activeExecutionCount = 0;
  private readonly lockedWorkspaces = new Set<string>();

  constructor(private readonly config: AgentCommandExecutorConfig = agentCommandConfig) {}

  getStatus(): {
    enabled: boolean;
    timeoutMs: number;
    maxOutputBytes: number;
    maxWorkspaceFiles: number;
    maxFileBytes: number;
    maxConcurrentExecutions: number;
    privilegesDropped: boolean;
  } {
    return {
      enabled: this.config.enabled,
      timeoutMs: this.config.timeoutMs,
      maxOutputBytes: this.config.maxOutputBytes,
      maxWorkspaceFiles: this.config.maxWorkspaceFiles,
      maxFileBytes: this.config.maxFileBytes,
      maxConcurrentExecutions: this.config.maxConcurrentExecutions,
      privilegesDropped: getDroppedIdentity(this.config) !== null,
    };
  }

  async execute(input: ExecuteAgentCommandInput): Promise<AgentCommandExecutionResult> {
    if (!this.config.enabled) {
      throw new AgentCommandApiError(
        403,
        'COMMAND_EXECUTION_DISABLED',
        '服务端未启用 Agent 命令执行。请设置 AGENT_COMMAND_EXECUTION_ENABLED=true，并通过隔离容器或专用主机部署后再试。',
      );
    }

    const workspaceId = sanitizeWorkspaceId(input.workspaceId);
    const command = validateCommand(input.command, this.config);

    if (this.lockedWorkspaces.has(workspaceId)) {
      throw new AgentCommandApiError(409, 'WORKSPACE_COMMAND_BUSY', '该工作区已有命令正在执行，请等待完成');
    }
    if (this.activeExecutionCount >= this.config.maxConcurrentExecutions) {
      throw new AgentCommandApiError(429, 'COMMAND_CAPACITY_EXCEEDED', '服务端命令执行队列已满，请稍后重试');
    }

    this.activeExecutionCount += 1;
    this.lockedWorkspaces.add(workspaceId);

    const executionId = randomUUID();
    const startedAt = Date.now();
    const runAs = getDroppedIdentity(this.config);
    let sessionDirectory: string | null = null;

    try {
      await mkdir(this.config.workRoot, { recursive: true, mode: runAs ? 0o711 : 0o700 });
      try {
        await chmod(this.config.workRoot, runAs ? 0o711 : 0o700);
      } catch {
        // Some mounted filesystems do not support chmod; deployment must still isolate this root.
      }

      sessionDirectory = await mkdtemp(path.join(this.config.workRoot, `${workspaceId}-`));
      if (!runAs) {
        try { await chmod(sessionDirectory, 0o700); } catch { /* Best effort on non-POSIX filesystems. */ }
      }

      const prepared = await materializeWorkspace(sessionDirectory, input.files, this.config);
      const execution = await runShellCommand(
        command,
        sessionDirectory,
        this.config,
        input.abortSignal,
        runAs,
      );

      let changedFiles: ChangedCommandFile[] = [];
      let ignoredPaths: string[] = [];
      let fileSyncError: string | null = null;
      try {
        const scan = await scanCommandOutput(sessionDirectory, prepared.baselineFiles, this.config);
        changedFiles = scan.changedFiles;
        ignoredPaths = scan.ignoredPaths;
      } catch (error) {
        const message = error instanceof Error ? error.message : '未知文件同步错误';
        fileSyncError = `命令已结束，但生成文件无法安全同步: ${message}`;
      }

      const exitCode = execution.result.spawnError ? null : execution.result.exitCode;
      const success = !execution.result.spawnError &&
        exitCode === 0 &&
        !execution.timedOut &&
        !execution.cancelled &&
        !execution.outputLimitExceeded &&
        !fileSyncError;
      const error = execution.result.spawnError?.message ||
        (execution.timedOut ? '命令执行超时并已终止' : null) ||
        (execution.cancelled ? '命令执行已取消' : null) ||
        (execution.outputLimitExceeded ? '命令输出超过限制并已终止' : null) ||
        fileSyncError;

      return {
        success,
        executionId,
        workspaceId,
        exitCode,
        signal: execution.result.signal,
        stdout: execution.stdout.toString(),
        stderr: execution.stderr.toString(),
        stdoutTruncated: execution.stdout.isTruncated,
        stderrTruncated: execution.stderr.isTruncated,
        timedOut: execution.timedOut,
        cancelled: execution.cancelled,
        outputLimitExceeded: execution.outputLimitExceeded,
        durationMs: Date.now() - startedAt,
        changedFiles,
        ignoredPaths,
        fileSyncError,
        error,
      };
    } finally {
      if (sessionDirectory) {
        await rm(sessionDirectory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }).catch((error) => {
          console.error(`Failed to clean command session ${executionId}:`, error);
        });
      }
      this.lockedWorkspaces.delete(workspaceId);
      this.activeExecutionCount = Math.max(0, this.activeExecutionCount - 1);
    }
  }
}

export const agentCommandExecutor = new AgentCommandExecutor();
