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
  BrainCircuit, 
  FileText, 
  Check, 
  RotateCcw,
  Sparkles,
  Layers,
  Code2,
  FileCheck,
  Tag
} from 'lucide-react';
import { WorkspaceFile, ProjectMemoryItem } from '../types';
import { 
  parseUploadedFilesToWorkspace, 
  exportAndDownloadWorkspaceZip,
  getLanguageFromPath,
  normalizePath
} from '../services/workspace';

interface WorkspaceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  files: WorkspaceFile[];
  memories: ProjectMemoryItem[];
  onUpdateFiles: (files: WorkspaceFile[]) => void;
  onUpdateMemories: (memories: ProjectMemoryItem[]) => void;
  onRequestAiAnalyze?: () => void;
}

export const WorkspaceDrawer: React.FC<WorkspaceDrawerProps> = ({
  isOpen,
  onClose,
  files = [],
  memories = [],
  onUpdateFiles,
  onUpdateMemories,
  onRequestAiAnalyze,
}) => {
  const [activeTab, setActiveTab] = useState<'files' | 'memory'>('files');
  const [selectedFileId, setSelectedFileId] = useState<string | null>(files[0]?.id || null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditingFile, setIsEditingFile] = useState(false);
  const [fileEditContent, setFileEditContent] = useState('');
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [newFilePath, setNewFilePath] = useState('');

  // Memory creation states
  const [isCreatingMemory, setIsCreatingMemory] = useState(false);
  const [newMemoryKey, setNewMemoryKey] = useState('');
  const [newMemoryTitle, setNewMemoryTitle] = useState('');
  const [newMemoryContent, setNewMemoryContent] = useState('');
  const [newMemoryCategory, setNewMemoryCategory] = useState<ProjectMemoryItem['category']>('architecture');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);

  const selectedFile = useMemo(() => {
    return files.find(f => f.id === selectedFileId) || files[0] || null;
  }, [files, selectedFileId]);

  // Filtered files
  const filteredFiles = useMemo(() => {
    if (!searchQuery) return files;
    const q = searchQuery.toLowerCase();
    return files.filter(f => f.path.toLowerCase().includes(q) || f.content.toLowerCase().includes(q));
  }, [files, searchQuery]);

  // Handle upload standard files
  const handleUploadFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const newParsed = await parseUploadedFilesToWorkspace(e.target.files);
    
    // Merge into workspace, replace if path exists
    const merged = [...files];
    for (const nf of newParsed) {
      const idx = merged.findIndex(f => f.path.toLowerCase() === nf.path.toLowerCase());
      if (idx >= 0) {
        merged[idx] = nf;
      } else {
        merged.push(nf);
      }
    }

    onUpdateFiles(merged);
    if (newParsed[0]) setSelectedFileId(newParsed[0].id);
    e.target.value = '';
  };

  // Handle Download Workspace ZIP
  const handleDownloadZip = async () => {
    if (files.length === 0) return;
    await exportAndDownloadWorkspaceZip(files);
  };

  // Handle Save File Edit
  const handleSaveFileContent = () => {
    if (!selectedFile) return;
    const updated = files.map(f => {
      if (f.id === selectedFile.id) {
        return {
          ...f,
          content: fileEditContent,
          size: fileEditContent.length,
          updatedAt: Date.now(),
        };
      }
      return f;
    });
    onUpdateFiles(updated);
    setIsEditingFile(false);
  };

  // Handle Create File
  const handleCreateNewFile = () => {
    if (!newFilePath.trim()) return;
    const norm = normalizePath(newFilePath);
    const existing = files.find(f => f.path.toLowerCase() === norm.toLowerCase());
    if (existing) {
      setSelectedFileId(existing.id);
      setIsCreatingFile(false);
      setNewFilePath('');
      return;
    }

    const newFile: WorkspaceFile = {
      id: `file_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      path: norm,
      content: '// 新建文件\n',
      language: getLanguageFromPath(norm),
      size: 15,
      updatedAt: Date.now(),
    };

    onUpdateFiles([...files, newFile]);
    setSelectedFileId(newFile.id);
    setIsCreatingFile(false);
    setNewFilePath('');
  };

  // Handle Delete File
  const handleDeleteFile = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = files.filter(f => f.id !== id);
    onUpdateFiles(updated);
    if (selectedFileId === id) {
      setSelectedFileId(updated[0]?.id || null);
    }
  };

  // Handle Create Memory
  const handleCreateMemory = () => {
    if (!newMemoryKey.trim() || !newMemoryTitle.trim()) return;
    const newMem: ProjectMemoryItem = {
      id: `mem_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      key: newMemoryKey.trim(),
      title: newMemoryTitle.trim(),
      content: newMemoryContent.trim(),
      category: newMemoryCategory,
      updatedAt: Date.now(),
      source: 'user',
    };
    onUpdateMemories([newMem, ...memories]);
    setIsCreatingMemory(false);
    setNewMemoryKey('');
    setNewMemoryTitle('');
    setNewMemoryContent('');
  };

  // Handle Delete Memory
  const handleDeleteMemory = (id: string) => {
    onUpdateMemories(memories.filter(m => m.id !== id));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[580px] md:w-[680px] bg-white dark:bg-neutral-900 border-l border-neutral-200 dark:border-neutral-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
      {/* Drawer Header */}
      <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/50 dark:bg-neutral-950/40">
        <div className="flex items-center gap-3">
          <div className="flex bg-neutral-200/70 dark:bg-neutral-800 p-0.5 rounded-lg text-xs font-medium">
            <button
              type="button"
              onClick={() => setActiveTab('files')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition ${
                activeTab === 'files'
                  ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-2xs font-semibold'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              <Folder className="w-3.5 h-3.5 text-indigo-500" />
              <span>工作区文件 ({files.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('memory')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition ${
                activeTab === 'memory'
                  ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-2xs font-semibold'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              <BrainCircuit className="w-3.5 h-3.5 text-purple-500" />
              <span>项目记忆 ({memories.length})</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'files' && files.length > 0 && (
            <button
              type="button"
              onClick={handleDownloadZip}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium transition cursor-pointer shadow-xs"
              title="打包当前工作区所有文件为 ZIP 下载"
            >
              <Download className="w-3.5 h-3.5" />
              <span>打包下载 (.zip)</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Drawer Body */}
      {activeTab === 'files' ? (
        <div className="flex-1 flex overflow-hidden">
          {/* File List Left Column */}
          <div className="w-60 border-r border-neutral-200 dark:border-neutral-800 flex flex-col bg-neutral-50/30 dark:bg-neutral-950/20">
            {/* Search & Actions Bar */}
            <div className="p-2.5 space-y-2 border-b border-neutral-200 dark:border-neutral-800">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="搜索工作区文件..."
                  className="w-full text-xs pl-8 pr-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 outline-hidden"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleUploadFiles} 
                  multiple 
                  className="hidden" 
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-xs font-medium transition cursor-pointer"
                  title="上传文本代码文件或 .zip 压缩包"
                >
                  <Upload className="w-3 h-3" />
                  <span>上传 / 导入ZIP</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsCreatingFile(true)}
                  className="p-1.5 rounded-lg bg-neutral-200/80 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs transition cursor-pointer"
                  title="新建文件"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Inline Create File Input */}
              {isCreatingFile && (
                <div className="p-2 rounded-lg bg-white dark:bg-neutral-800 border border-indigo-500 space-y-1.5 animate-in fade-in">
                  <input
                    type="text"
                    value={newFilePath}
                    onChange={e => setNewFilePath(e.target.value)}
                    placeholder="如: src/utils.ts"
                    className="w-full text-xs p-1.5 rounded bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 outline-hidden font-mono"
                    autoFocus
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleCreateNewFile();
                      if (e.key === 'Escape') setIsCreatingFile(false);
                    }}
                  />
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => setIsCreatingFile(false)}
                      className="px-2 py-0.5 text-[11px] text-neutral-500 hover:text-neutral-700"
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      onClick={handleCreateNewFile}
                      className="px-2.5 py-0.5 text-[11px] bg-indigo-600 text-white rounded font-medium"
                    >
                      创建
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* File List */}
            <div className="flex-1 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800/60">
              {filteredFiles.length === 0 ? (
                <div className="p-6 text-center text-xs text-neutral-400 space-y-2">
                  <Folder className="w-8 h-8 mx-auto stroke-1 opacity-40" />
                  <p>工作区暂无文件</p>
                  <p className="text-[11px]">点击上方按钮上传代码或直接导入 ZIP 压缩包</p>
                </div>
              ) : (
                filteredFiles.map(file => {
                  const isSelected = file.id === selectedFile?.id;
                  return (
                    <div
                      key={file.id}
                      onClick={() => {
                        setSelectedFileId(file.id);
                        setIsEditingFile(false);
                      }}
                      className={`group p-2.5 flex items-start justify-between cursor-pointer text-xs transition ${
                        isSelected
                          ? 'bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-medium'
                          : 'hover:bg-neutral-100/60 dark:hover:bg-neutral-800/40 text-neutral-700 dark:text-neutral-300'
                      }`}
                    >
                      <div className="flex items-start gap-2 min-w-0 pr-1">
                        <FileCode className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-neutral-400'}`} />
                        <div className="min-w-0">
                          <p className="truncate font-mono text-[11px]" title={file.path}>
                            {file.path}
                          </p>
                          <div className="flex items-center gap-1.5 text-[10px] text-neutral-400 mt-0.5">
                            <span>{Math.round(file.size / 1024 * 10) / 10} KB</span>
                            {file.isModifiedByAgent && (
                              <span className="px-1 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-semibold">
                                AI修改
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={e => handleDeleteFile(file.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-neutral-400 hover:text-red-500 transition"
                        title="删除该文件"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* File Content / Code Preview Right Column */}
          <div className="flex-1 flex flex-col bg-white dark:bg-neutral-900 overflow-hidden">
            {selectedFile ? (
              <>
                {/* File Header */}
                <div className="p-3 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/40 dark:bg-neutral-950/30 text-xs">
                  <div className="flex items-center gap-2 font-mono truncate">
                    <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                      {selectedFile.path}
                    </span>
                    <span className="text-neutral-400 text-[11px]">
                      ({selectedFile.language || 'text'}, {selectedFile.content.split('\n').length} 行)
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {isEditingFile ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setIsEditingFile(false)}
                          className="px-2.5 py-1 text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 transition"
                        >
                          取消
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveFileContent}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium transition cursor-pointer"
                        >
                          <Save className="w-3 h-3" />
                          <span>保存</span>
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setFileEditContent(selectedFile.content);
                          setIsEditingFile(true);
                        }}
                        className="px-2.5 py-1 rounded-md border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-medium transition"
                      >
                        编辑
                      </button>
                    )}
                  </div>
                </div>

                {/* File Content Display */}
                <div className="flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed">
                  {isEditingFile ? (
                    <textarea
                      value={fileEditContent}
                      onChange={e => setFileEditContent(e.target.value)}
                      className="w-full h-full p-2 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 font-mono text-xs text-neutral-900 dark:text-neutral-100 outline-hidden resize-none leading-relaxed"
                    />
                  ) : (
                    <pre className="text-neutral-800 dark:text-neutral-200 whitespace-pre font-mono">
                      {selectedFile.content}
                    </pre>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-xs text-neutral-400">
                <FileCode className="w-12 h-12 stroke-1 opacity-30 mb-2" />
                <p>请在左侧选择或上传文件以查看内容</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Project Memory Tab */
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 text-sm">
                项目长期记忆 (Project Memory)
              </h3>
              <p className="text-xs text-neutral-500">
                Agent 在规划、修改代码时会持续引用并更新这部分关键记忆。
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsCreatingMemory(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>新建记忆条目</span>
            </button>
          </div>

          {/* Create Memory Form */}
          {isCreatingMemory && (
            <div className="p-3.5 rounded-xl border border-purple-300 dark:border-purple-800/80 bg-purple-50/40 dark:bg-purple-950/20 space-y-2.5 animate-in fade-in">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="block text-[11px] text-neutral-500 mb-1">记忆标识键 (Key)</label>
                  <input
                    type="text"
                    value={newMemoryKey}
                    onChange={e => setNewMemoryKey(e.target.value)}
                    placeholder="如: database_schema"
                    className="w-full p-2 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-neutral-500 mb-1">记忆分类</label>
                  <select
                    value={newMemoryCategory}
                    onChange={e => setNewMemoryCategory(e.target.value as any)}
                    className="w-full p-2 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 text-xs"
                  >
                    <option value="architecture">架构设计 (Architecture)</option>
                    <option value="decision">关键决策 (Decision)</option>
                    <option value="guideline">编码规范 (Guideline)</option>
                    <option value="history">改动历史 (History)</option>
                    <option value="note">备忘笔记 (Note)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-neutral-500 mb-1">标题</label>
                <input
                  type="text"
                  value={newMemoryTitle}
                  onChange={e => setNewMemoryTitle(e.target.value)}
                  placeholder="如: 数据库表结构约定与持久化规范"
                  className="w-full p-2 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] text-neutral-500 mb-1">详细记忆内容</label>
                <textarea
                  value={newMemoryContent}
                  onChange={e => setNewMemoryContent(e.target.value)}
                  placeholder="输入给 AI 的重要背景、架构约定或约束..."
                  rows={3}
                  className="w-full p-2 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 text-xs resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsCreatingMemory(false)}
                  className="px-3 py-1.5 text-xs text-neutral-500 hover:text-neutral-800"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleCreateMemory}
                  className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium"
                >
                  保存记忆
                </button>
              </div>
            </div>
          )}

          {/* Memory List Cards */}
          <div className="space-y-3">
            {memories.length === 0 ? (
              <div className="p-8 text-center text-xs text-neutral-400 space-y-2">
                <BrainCircuit className="w-10 h-10 mx-auto stroke-1 opacity-30" />
                <p>暂无项目记忆</p>
                <p className="text-[11px]">你可以新建记忆，或让 AI 在执行工作区任务时自动写入记忆库。</p>
              </div>
            ) : (
              memories.map(mem => (
                <div
                  key={mem.id}
                  className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-850 shadow-2xs space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-mono text-[10px] font-semibold uppercase">
                        {mem.category}
                      </span>
                      <h4 className="font-medium text-xs text-neutral-900 dark:text-neutral-100">
                        {mem.title}
                      </h4>
                    </div>

                    <div className="flex items-center gap-1.5 text-neutral-400">
                      <span className="text-[10px] font-mono opacity-70">
                        {mem.key}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteMemory(mem.id)}
                        className="p-1 hover:text-red-500 transition cursor-pointer"
                        title="删除该记忆"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-neutral-600 dark:text-neutral-300 whitespace-pre-wrap leading-relaxed">
                    {mem.content}
                  </p>

                  <div className="flex items-center justify-between pt-1 text-[10px] text-neutral-400 border-t border-neutral-100 dark:border-neutral-800/60">
                    <span>来源: {mem.source === 'agent' ? 'AI 自动沉淀' : '用户手动创建'}</span>
                    <span>更新时间: {new Date(mem.updatedAt).toLocaleString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
