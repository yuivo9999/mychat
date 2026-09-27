import React, { useState, useMemo, useRef } from 'react';
import { 
  X, 
  Folder, 
  FileCode, 
  Upload, 
  Download, 
  Plus, 
  Trash2, 
  Search, 
  Save, 
  RotateCcw, 
  FileCheck, 
  ChevronRight, 
  ChevronDown, 
  AlertTriangle,
  History,
  ShieldAlert,
  Edit2
} from 'lucide-react';
import { Workspace, WorkspaceFile } from '../types/workspace';
import { 
  importZipToNewWorkspace, 
  createEmptyWorkspace, 
  revertToPreviousSnapshot, 
  restoreOriginalSnapshot,
  getModifiedFilesAgainstOriginal,
  packageWorkspaceToZip
} from '../services/workspaceService';
import { DiffViewerModal } from './DiffViewerModal';

interface WorkspaceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  workspaces: Workspace[];
  activeWorkspaceId?: string;
  onSelectWorkspace: (id: string) => void;
  onSaveWorkspace: (ws: Workspace) => void;
  onDeleteWorkspace: (id: string) => void;
}

export const WorkspaceDrawer: React.FC<WorkspaceDrawerProps> = ({
  isOpen,
  onClose,
  workspaces = [],
  activeWorkspaceId,
  onSelectWorkspace,
  onSaveWorkspace,
  onDeleteWorkspace,
}) => {
  const [selectedFileKey, setSelectedFileKey] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditingFile, setIsEditingFile] = useState(false);
  const [fileEditText, setFileEditText] = useState('');
  const [isDiffModalOpen, setIsDiffModalOpen] = useState(false);
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [newFilePath, setNewFilePath] = useState('');
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameNewPath, setRenameNewPath] = useState('');

  const zipInputRef = useRef<HTMLInputElement>(null);

  // Active workspace
  const currentWorkspace = useMemo(() => {
    return workspaces.find(w => w.id === activeWorkspaceId) || workspaces[0] || null;
  }, [workspaces, activeWorkspaceId]);

  // Modified files comparing to original v1 snapshot
  const modifiedFilesList = useMemo(() => {
    if (!currentWorkspace) return [];
    return getModifiedFilesAgainstOriginal(currentWorkspace);
  }, [currentWorkspace]);

  // Active selected file
  const activeFile: WorkspaceFile | null = useMemo(() => {
    if (!currentWorkspace) return null;
    if (selectedFileKey && currentWorkspace.files[selectedFileKey]) {
      return currentWorkspace.files[selectedFileKey];
    }
    const firstKey = Object.keys(currentWorkspace.files)[0];
    return firstKey ? currentWorkspace.files[firstKey] : null;
  }, [currentWorkspace, selectedFileKey]);

  // Filtered files
  const filteredFilePaths = useMemo(() => {
    if (!currentWorkspace) return [];
    const paths = Object.keys(currentWorkspace.files).sort();
    if (!searchQuery.trim()) return paths;
    const q = searchQuery.toLowerCase();
    return paths.filter(p => p.toLowerCase().includes(q));
  }, [currentWorkspace, searchQuery]);

  // Handle Upload ZIP
  const handleUploadZip = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const res = await importZipToNewWorkspace(file);
    if (!res.success || !res.workspace) {
      alert(res.error || 'ZIP 上传解压失败');
    } else {
      onSaveWorkspace(res.workspace);
      onSelectWorkspace(res.workspace.id);
      setSelectedFileKey(Object.keys(res.workspace.files)[0] || null);
    }
    e.target.value = '';
  };

  // Handle Download Clean Project ZIP
  const handleDownloadZip = async () => {
    if (!currentWorkspace || Object.keys(currentWorkspace.files).length === 0) {
      alert('当前工作区没有可打包的文件');
      return;
    }
    try {
      const blob = await packageWorkspaceToZip(currentWorkspace);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${currentWorkspace.name}-v${currentWorkspace.currentVersion}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`打包失败: ${err.message || '未知错误'}`);
    }
  };

  // Handle Undo / Revert to previous snapshot
  const handleUndo = () => {
    if (!currentWorkspace) return;
    const res = revertToPreviousSnapshot(currentWorkspace);
    if (!res.success) {
      alert(res.message);
      return;
    }
    onSaveWorkspace(res.workspace);
    alert(res.message);
  };

  // Handle Restore Original v1
  const handleRestoreOriginal = () => {
    if (!currentWorkspace) return;
    if (confirm('确认将当前工作区恢复至用户初始上传的基准版本 (v1)？所有 AI 及手动修改将被重置。')) {
      const res = restoreOriginalSnapshot(currentWorkspace);
      onSaveWorkspace(res.workspace);
      alert(res.message);
    }
  };

  // Handle Save File Edit
  const handleSaveFileContent = () => {
    if (!currentWorkspace || !activeFile) return;
    const updatedFiles = {
      ...currentWorkspace.files,
      [activeFile.path]: {
        ...activeFile,
        content: fileEditText,
        size: fileEditText.length,
        updatedAt: Date.now(),
      },
    };
    const updatedWs: Workspace = {
      ...currentWorkspace,
      files: updatedFiles,
      updatedAt: Date.now(),
    };
    onSaveWorkspace(updatedWs);
    setIsEditingFile(false);
  };

  // Handle Create File
  const handleCreateFile = () => {
    if (!currentWorkspace || !newFilePath.trim()) return;
    const p = newFilePath.trim().replace(/^\/+/, '');
    if (currentWorkspace.files[p]) {
      alert('已存在同名文件');
      return;
    }
    const updatedFiles = {
      ...currentWorkspace.files,
      [p]: {
        path: p,
        content: '// 新建文件\n',
        size: 15,
        updatedAt: Date.now(),
      },
    };
    const updatedWs: Workspace = {
      ...currentWorkspace,
      files: updatedFiles,
      updatedAt: Date.now(),
    };
    onSaveWorkspace(updatedWs);
    setSelectedFileKey(p);
    setIsCreatingFile(false);
    setNewFilePath('');
  };

  // Handle Delete File
  const handleDeleteFile = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentWorkspace) return;
    if (confirm(`确认删除文件 "${path}"？`)) {
      const updatedFiles = { ...currentWorkspace.files };
      delete updatedFiles[path];
      const updatedWs: Workspace = {
        ...currentWorkspace,
        files: updatedFiles,
        updatedAt: Date.now(),
      };
      onSaveWorkspace(updatedWs);
      if (selectedFileKey === path) {
        setSelectedFileKey(Object.keys(updatedFiles)[0] || null);
      }
    }
  };

  // Handle Rename File
  const handleRenameFile = (oldPath: string) => {
    if (!currentWorkspace || !renameNewPath.trim()) return;
    const newP = renameNewPath.trim().replace(/^\/+/, '');
    if (newP === oldPath) {
      setRenamingPath(null);
      return;
    }
    if (currentWorkspace.files[newP]) {
      alert('目标路径已存在同名文件');
      return;
    }
    const file = currentWorkspace.files[oldPath];
    const updatedFiles = { ...currentWorkspace.files };
    delete updatedFiles[oldPath];
    updatedFiles[newP] = { ...file, path: newP, updatedAt: Date.now() };

    const updatedWs: Workspace = {
      ...currentWorkspace,
      files: updatedFiles,
      updatedAt: Date.now(),
    };
    onSaveWorkspace(updatedWs);
    setSelectedFileKey(newP);
    setRenamingPath(null);
    setRenameNewPath('');
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-y-0 right-0 z-40 w-full sm:w-[620px] md:w-[740px] bg-white dark:bg-neutral-900 border-l border-neutral-200 dark:border-neutral-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        {/* Top Header */}
        <div className="p-3.5 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/50 dark:bg-neutral-950/40">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <Folder className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-neutral-900 dark:text-neutral-100 truncate">
                  AI 编程工作区
                </span>
                {currentWorkspace && (
                  <span className="px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-mono text-[10px] font-bold">
                    v{currentWorkspace.currentVersion}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-neutral-500 truncate">
                AI 负责代码阅读与修改，不运行代码；用户负责测试。
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input 
              type="file" 
              ref={zipInputRef} 
              accept=".zip" 
              onChange={handleUploadZip} 
              className="hidden" 
            />
            <button
              type="button"
              onClick={() => zipInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 text-xs font-medium transition cursor-pointer"
              title="上传并解压工程 ZIP 包"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>上传 ZIP</span>
            </button>

            {currentWorkspace && (
              <button
                type="button"
                onClick={handleDownloadZip}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium transition cursor-pointer shadow-xs"
                title="重新打包当前项目为 ZIP 下载"
              >
                <Download className="w-3.5 h-3.5" />
                <span>下载 ZIP</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Workspace Selector & Version Snapshot Action Bar */}
        {currentWorkspace && (
          <div className="px-4 py-2.5 bg-neutral-100/60 dark:bg-neutral-950/60 border-b border-neutral-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-neutral-500">当前工作区:</span>
              <select
                value={currentWorkspace.id}
                onChange={e => onSelectWorkspace(e.target.value)}
                className="px-2 py-1 rounded-md bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 font-medium text-xs outline-hidden"
              >
                {workspaces.map(ws => (
                  <option key={ws.id} value={ws.id}>
                    {ws.name} ({Object.keys(ws.files).length} 文件 · v{ws.currentVersion})
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => {
                  const name = prompt('输入新工作区名称:', '新工作区');
                  if (name && name.trim()) {
                    const ws = createEmptyWorkspace(name.trim());
                    onSaveWorkspace(ws);
                    onSelectWorkspace(ws.id);
                  }
                }}
                className="p-1 hover:text-indigo-600 text-neutral-400 text-xs"
                title="新建空白工作区"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              {modifiedFilesList.length > 0 ? (
                <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 font-medium text-[11px]">
                  已修改 {modifiedFilesList.length} 个文件
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 text-[11px]">
                  基准原始版本
                </span>
              )}

              <button
                type="button"
                onClick={() => setIsDiffModalOpen(true)}
                className="px-2.5 py-1 rounded-md bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:border-indigo-400 text-neutral-700 dark:text-neutral-300 transition text-[11px] font-medium flex items-center gap-1 cursor-pointer"
                title="查看代码变动 Diff"
              >
                <FileCheck className="w-3 h-3 text-indigo-500" />
                <span>查看修改</span>
              </button>

              <button
                type="button"
                onClick={handleUndo}
                disabled={currentWorkspace.snapshots.length <= 1}
                className="px-2 py-1 rounded-md border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white disabled:opacity-40 transition text-[11px] flex items-center gap-1 cursor-pointer"
                title="撤销最近一次 AI 修改，回退到上一快照版本"
              >
                <RotateCcw className="w-3 h-3" />
                <span>撤销</span>
              </button>

              <button
                type="button"
                onClick={handleRestoreOriginal}
                className="px-2 py-1 rounded-md border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:text-red-600 transition text-[11px] cursor-pointer"
                title="将整个工作区重置恢复至初始上传的 ZIP 基准状态"
              >
                <span>恢复原始</span>
              </button>
            </div>
          </div>
        )}

        {/* Body: Two columns layout */}
        {currentWorkspace ? (
          <div className="flex-1 flex overflow-hidden">
            {/* Left Column: File Explorer Tree */}
            <div className="w-64 border-r border-neutral-200 dark:border-neutral-800 flex flex-col bg-neutral-50/30 dark:bg-neutral-950/20">
              {/* File Search & Create */}
              <div className="p-2.5 space-y-2 border-b border-neutral-200 dark:border-neutral-800">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="搜索文件路径..."
                    className="w-full text-xs pl-8 pr-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 outline-hidden"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-neutral-400">
                    共 {filteredFilePaths.length} 个文件
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsCreatingFile(true)}
                    className="inline-flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>新建文件</span>
                  </button>
                </div>

                {isCreatingFile && (
                  <div className="p-2 rounded-lg bg-white dark:bg-neutral-800 border border-indigo-500 space-y-1.5 animate-in fade-in">
                    <input
                      type="text"
                      value={newFilePath}
                      onChange={e => setNewFilePath(e.target.value)}
                      placeholder="路径如: src/App.tsx"
                      className="w-full text-xs p-1.5 rounded bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 font-mono text-neutral-900 dark:text-neutral-100 outline-hidden"
                      autoFocus
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleCreateFile();
                        if (e.key === 'Escape') setIsCreatingFile(false);
                      }}
                    />
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setIsCreatingFile(false)}
                        className="px-2 py-0.5 text-[10px] text-neutral-500"
                      >
                        取消
                      </button>
                      <button
                        type="button"
                        onClick={handleCreateFile}
                        className="px-2 py-0.5 text-[10px] bg-indigo-600 text-white rounded font-medium"
                      >
                        创建
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* File list */}
              <div className="flex-1 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800/60">
                {filteredFilePaths.map(path => {
                  const file = currentWorkspace.files[path];
                  const isSelected = path === (activeFile?.path || selectedFileKey);
                  const isModified = modifiedFilesList.some(m => m.path === path);

                  return (
                    <div
                      key={path}
                      onClick={() => {
                        setSelectedFileKey(path);
                        setIsEditingFile(false);
                      }}
                      className={`group p-2.5 flex items-start justify-between cursor-pointer text-xs transition ${
                        isSelected
                          ? 'bg-indigo-50/80 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-medium'
                          : 'hover:bg-neutral-100/60 dark:hover:bg-neutral-800/40 text-neutral-700 dark:text-neutral-300'
                      }`}
                    >
                      <div className="flex items-start gap-1.5 min-w-0 pr-1">
                        <FileCode className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-neutral-400'}`} />
                        <div className="min-w-0">
                          {renamingPath === path ? (
                            <input
                              type="text"
                              value={renameNewPath}
                              onChange={e => setRenameNewPath(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') handleRenameFile(path);
                                if (e.key === 'Escape') setRenamingPath(null);
                              }}
                              className="text-xs p-0.5 rounded bg-white dark:bg-neutral-900 border border-indigo-500 outline-hidden font-mono"
                              autoFocus
                              onClick={e => e.stopPropagation()}
                            />
                          ) : (
                            <p className="truncate font-mono text-[11px]" title={path}>
                              {path}
                            </p>
                          )}
                          <div className="flex items-center gap-1.5 text-[10px] text-neutral-400 mt-0.5">
                            <span>{Math.round((file.size / 1024) * 10) / 10} KB</span>
                            {isModified && (
                              <span className="px-1 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 font-bold">
                                已修改
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition">
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            setRenamingPath(path);
                            setRenameNewPath(path);
                          }}
                          className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                          title="重命名文件"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={e => handleDeleteFile(path, e)}
                          className="p-1 text-neutral-400 hover:text-red-500"
                          title="删除文件"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Code Viewer / Editor */}
            <div className="flex-1 flex flex-col bg-white dark:bg-neutral-900 overflow-hidden">
              {activeFile ? (
                <>
                  <div className="p-3 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/40 dark:bg-neutral-950/30 text-xs">
                    <div className="flex items-center gap-2 font-mono truncate">
                      <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                        {activeFile.path}
                      </span>
                      <span className="text-neutral-400 text-[11px]">
                        ({activeFile.content.split('\n').length} 行, {activeFile.size} 字节)
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {isEditingFile ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setIsEditingFile(false)}
                            className="px-2 py-1 text-neutral-500 hover:text-neutral-800"
                          >
                            取消
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveFileContent}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-xs"
                          >
                            <Save className="w-3 h-3" />
                            <span>保存更改</span>
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setFileEditText(activeFile.content);
                            setIsEditingFile(true);
                          }}
                          className="px-2.5 py-1 rounded border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-medium"
                        >
                          在线编辑
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed select-text">
                    {isEditingFile ? (
                      <textarea
                        value={fileEditText}
                        onChange={e => setFileEditText(e.target.value)}
                        className="w-full h-full p-2 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 font-mono text-xs text-neutral-900 dark:text-neutral-100 outline-hidden resize-none leading-relaxed"
                      />
                    ) : (
                      <pre className="text-neutral-800 dark:text-neutral-200 whitespace-pre">
                        {activeFile.content}
                      </pre>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-xs text-neutral-400">
                  <FileCode className="w-12 h-12 stroke-1 opacity-30 mb-2" />
                  <p>当前工作区暂无选中的文件</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-xs text-neutral-400 space-y-3">
            <Folder className="w-14 h-14 stroke-1 opacity-30" />
            <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
              尚未创建或上传工作区
            </p>
            <p className="max-w-xs text-neutral-500">
              点击上方“上传 ZIP”导入您的项目压缩包，系统将安全解压并建立工作区，AI 即可按需检索与修改代码。
            </p>
          </div>
        )}
      </div>

      {/* Diff Viewer Modal */}
      <DiffViewerModal
        isOpen={isDiffModalOpen}
        onClose={() => setIsDiffModalOpen(false)}
        workspace={currentWorkspace}
        onDownloadZip={handleDownloadZip}
      />
    </>
  );
};
