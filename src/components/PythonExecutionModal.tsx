import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CircleX,
  Loader2,
  Play,
  Terminal,
  X,
} from 'lucide-react';
import type { WorkspacePythonExecutionResult } from '../services/pythonExecutionService';

export type PythonExecutionPhase = 'confirm' | 'running' | 'completed' | 'error';

export interface PythonExecutionSummary {
  appliedChanges: string[];
  conflicts: string[];
  skipped: string[];
}

interface PythonExecutionModalProps {
  isOpen: boolean;
  scriptPath: string;
  phase: PythonExecutionPhase;
  result: WorkspacePythonExecutionResult | null;
  error: string | null;
  summary: PythonExecutionSummary | null;
  onConfirm: () => void;
  onCancel: () => void;
}

function formatDuration(durationMs: number): string {
  if (durationMs < 1_000) return `${durationMs} ms`;
  return `${(durationMs / 1_000).toFixed(durationMs < 10_000 ? 2 : 1)} s`;
}

function PathList({ title, paths, tone }: { title: string; paths: string[]; tone: string }) {
  if (paths.length === 0) return null;
  return (
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/50 p-3">
      <div className={`text-[11px] font-semibold mb-2 ${tone}`}>{title} ({paths.length})</div>
      <div className="max-h-28 overflow-y-auto space-y-1 font-mono text-[11px] text-neutral-600 dark:text-neutral-300">
        {paths.map((path) => <div key={path} className="break-all">{path}</div>)}
      </div>
    </div>
  );
}

export const PythonExecutionModal: React.FC<PythonExecutionModalProps> = ({
  isOpen,
  scriptPath,
  phase,
  result,
  error,
  summary,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;
  const isRunning = phase === 'running';
  const succeeded = phase === 'completed' && result?.success === true;

  return (
    <div
      className="fixed inset-0 z-[80] bg-black/65 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
      onMouseDown={() => { if (!isRunning) onCancel(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="python-execution-title"
        onMouseDown={(event) => event.stopPropagation()}
        className="w-full max-w-2xl max-h-[90vh] overflow-hidden bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-2xl flex flex-col animate-in zoom-in-95"
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-start gap-3 min-w-0">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              isRunning
                ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400'
                : succeeded
                  ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                  : phase === 'error' || result?.success === false
                    ? 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400'
                    : 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400'
            }`}>
              {isRunning ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : succeeded ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : phase === 'error' || result?.success === false ? (
                <CircleX className="w-5 h-5" />
              ) : (
                <Terminal className="w-5 h-5" />
              )}
            </div>
            <div className="min-w-0">
              <h3 id="python-execution-title" className="text-sm font-semibold text-neutral-900 dark:text-white">
                执行 Python 文件
              </h3>
              <p className="mt-1 text-xs font-mono text-neutral-500 dark:text-neutral-400 truncate" title={scriptPath}>
                {scriptPath}
              </p>
            </div>
          </div>
          {!isRunning && (
            <button
              type="button"
              onClick={onCancel}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 dark:hover:text-neutral-200 dark:hover:bg-neutral-800 transition"
              title="关闭"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="px-5 py-4 overflow-y-auto space-y-4">
          {phase === 'confirm' && (
            <>
              <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40 p-3.5">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs leading-5 text-amber-900 dark:text-amber-200">
                  该脚本将在当前浏览器的 Web Worker 与 WebAssembly Python 运行时中执行，不会上传工作区，也不会调用 Python 执行后端。运行时直接从当前应用随包提供的本地 Pyodide 资源加载，不依赖 Service Worker 或浏览器 Cache Storage。执行器会尽力关闭常见网络入口；脚本仍可读写工作区内存文件、消耗本机 CPU/内存，并可能覆盖工作区文件，请确认内容可信后再运行。
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-neutral-600 dark:text-neutral-300">
                <div className="rounded-xl bg-neutral-50 dark:bg-neutral-800/70 p-3">
                  <div className="font-semibold text-neutral-800 dark:text-neutral-200">浏览器运行时</div>
                  <div className="mt-1 text-neutral-500">Pyodide / WebAssembly</div>
                </div>
                <div className="rounded-xl bg-neutral-50 dark:bg-neutral-800/70 p-3">
                  <div className="font-semibold text-neutral-800 dark:text-neutral-200">本地隔离</div>
                  <div className="mt-1 text-neutral-500">独立 Worker，不上传工作区</div>
                </div>
                <div className="rounded-xl bg-neutral-50 dark:bg-neutral-800/70 p-3">
                  <div className="font-semibold text-neutral-800 dark:text-neutral-200">受控回写</div>
                  <div className="mt-1 text-neutral-500">超时、输出和文件大小受限</div>
                </div>
              </div>
            </>
          )}

          {phase === 'running' && (
            <div className="py-8 text-center">
              <Loader2 className="w-8 h-8 mx-auto animate-spin text-amber-500" />
              <div className="mt-3 text-sm font-medium text-neutral-800 dark:text-neutral-200">正在准备或执行 Python…</div>
              <p className="mt-1 text-xs text-neutral-500">运行时与工作区均在手机本地准备，完成后将显示输出和文件变更。</p>
            </div>
          )}

          {phase === 'error' && (
            <div className="flex gap-3 rounded-xl border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/40 p-3.5">
              <CircleX className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
              <div>
                <div className="text-xs font-semibold text-red-800 dark:text-red-200">执行请求失败</div>
                <div className="mt-1 text-xs text-red-700 dark:text-red-300 whitespace-pre-wrap break-words">{error}</div>
              </div>
            </div>
          )}

          {phase === 'completed' && result && (
            <>
              <div className={`flex items-center justify-between gap-3 rounded-xl border p-3 ${
                result.success
                  ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40'
                  : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/40'
              }`}>
                <div className={`text-xs font-semibold ${result.success ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>
                  {result.cancelled
                    ? '执行已取消'
                    : result.timedOut
                      ? '执行超时并已终止'
                      : result.outputLimitExceeded
                        ? '输出超限并已终止'
                        : result.success
                          ? '执行成功'
                          : '执行失败'}
                </div>
                <div className="text-[11px] font-mono text-neutral-600 dark:text-300">
                  退出码 {result.exitCode ?? 'N/A'} · {formatDuration(result.durationMs)}
                </div>
              </div>

              {(result.error || result.fileSyncError) && (
                <div className="rounded-xl bg-red-50 dark:bg-red-950/30 px-3 py-2 text-xs text-red-700 dark:text-red-300 whitespace-pre-wrap break-words">
                  {result.error || result.fileSyncError}
                </div>
              )}

              {summary && (
                <div className="grid sm:grid-cols-2 gap-2">
                  <PathList title="已同步" paths={summary.appliedChanges} tone="text-emerald-600 dark:text-emerald-400" />
                  <PathList title="用户并发修改，已跳过" paths={summary.conflicts} tone="text-amber-600 dark:text-amber-400" />
                  <PathList title="未同步" paths={summary.skipped} tone="text-red-600 dark:text-red-400" />
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-3">
                <div className="overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800">
                  <div className="px-3 py-2 text-[11px] font-semibold bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 flex justify-between">
                    <span>stdout</span>
                    {result.stdoutTruncated && <span className="text-amber-600">已截断</span>}
                  </div>
                  <pre className="h-36 overflow-auto whitespace-pre-wrap break-words p-3 text-[11px] font-mono text-neutral-700 dark:text-neutral-300">
                    {result.stdout || '（无标准输出）'}
                  </pre>
                </div>
                <div className="overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800">
                  <div className="px-3 py-2 text-[11px] font-semibold bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 flex justify-between">
                    <span>stderr</span>
                    {result.stderrTruncated && <span className="text-amber-600">已截断</span>}
                  </div>
                  <pre className="h-36 overflow-auto whitespace-pre-wrap break-words p-3 text-[11px] font-mono text-neutral-700 dark:text-neutral-300">
                    {result.stderr || '（无错误输出）'}
                  </pre>
                </div>
              </div>

              {result.ignoredPaths.length > 0 && (
                <details className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-3">
                  <summary className="text-xs text-neutral-600 dark:text-neutral-300 cursor-pointer">
                    查看未同步的生成项 ({result.ignoredPaths.length})
                  </summary>
                  <div className="mt-2 max-h-24 overflow-auto font-mono text-[10px] text-neutral-500 dark:text-neutral-400 space-y-1">
                    {result.ignoredPaths.map((path) => <div key={path} className="break-all">{path}</div>)}
                  </div>
                </details>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-950/20">
          {phase === 'confirm' && (
            <>
              <button type="button" onClick={onCancel} className="px-4 py-2 rounded-xl text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition">
                取消
              </button>
              <button type="button" onClick={onConfirm} className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 shadow-sm transition active:scale-[0.98]">
                <Play className="w-3.5 h-3.5 fill-current" />
                确认执行
              </button>
            </>
          )}
          {isRunning && (
            <button type="button" onClick={onCancel} className="px-4 py-2 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-700 text-white transition">
              取消执行
            </button>
          )}
          {(phase === 'completed' || phase === 'error') && (
            <button type="button" onClick={onCancel} className="px-4 py-2 rounded-xl text-xs font-semibold bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-900 transition">
              关闭
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
