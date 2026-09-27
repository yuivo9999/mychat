import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  X, 
  Folder, 
  FolderOpen,
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
  Edit2,
  MoreVertical,
  Bot,
  Activity,
  ArrowLeft,
  FilePlus,
  FolderPlus,
  FileText,
  File,
  Code2,
  RefreshCw,
  Check
} from 'lucide-react';
import { Workspace, WorkspaceFile } from '../types/workspace';
import { 
  importZipToNewWorkspace, 
  createEmptyWorkspace, 
  revertToPreviousSnapshot, 
  restoreOriginalSnapshot,
  getModifiedFilesAgainstOriginal,
  packageWorkspaceToZip,
  addFilesToActiveWorkspace,
  deleteFolderFromWorkspace,
  renameFolderInWorkspace
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
  onSendAiMessage?: (prompt: string) => void;
  aiStatusText?: string;
}

// Hierarchical File Tree Node
interface TreeNode {
  name: string;
  path: string;
  isFolder: boolean;
  children?: TreeNode[];
  file?: WorkspaceFile;
}

// Build nested tree from flat file map
function buildFileTree(files: Record<string, WorkspaceFile>, searchQuery = ''): TreeNode[] {
  const rootNodes: TreeNode[] = [];
  const folderMap = new Map<string, TreeNode>();

  const q = searchQuery.toLowerCase().trim();
  const sortedPaths = Object.keys(files).sort();

  for (const path of sortedPaths) {
    if (q && !path.toLowerCase().includes(q)) {
      continue;
    }

    const segments = path.split('/');
    let currentPath = '';

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const isLast = i === segments.length - 1;
      const prevPath = currentPath;
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;

      if (isLast) {
        // File node
        const fileNode: TreeNode = {
          name: segment,
          path: currentPath,
          isFolder: false,
          file: files[path],
        };

        if (prevPath && folderMap.has(prevPath)) {
          folderMap.get(prevPath)!.children!.push(fileNode);
        } else {
          rootNodes.push(fileNode);
        }
      } else {
        // Folder node
        if (!folderMap.has(currentPath)) {
          const folderNode: TreeNode = {
            name: segment,
            path: currentPath,
            isFolder: true,
            children: [],
          };
          folderMap.set(currentPath, folderNode);

          if (prevPath && folderMap.has(prevPath)) {
            folderMap.get(prevPath)!.children!.push(folderNode);
          } else {
            rootNodes.push(folderNode);
          }
        }
      }
    }
  }

  // Sort nodes: folders first, then files alphabetically
  function sortTreeNodes(nodes: TreeNode[]) {
    nodes.sort((a, b) => {
      if (a.isFolder === b.isFolder) {
        return a.name.localeCompare(b.name);
      }
      return a.isFolder ? -1 : 1;
    });
    for (const node of nodes) {
      if (node.children) {
        sortTreeNodes(node.children);
      }
    }
  }

  sortTreeNodes(rootNodes);
  return rootNodes;
}

// Helper to choose appropriate file icon based on extension
function getFileIcon(fileName: string) {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.tsx') || lower.endsWith('.jsx')) {
    return <Code2 className="w-3.5 h-3.5 text-cyan-500 shrink-0" />;
  }
  if (lower.endsWith('.ts') || lower.endsWith('.js')) {
    return <Code2 className="w-3.5 h-3.5 text-yellow-500 shrink-0" />;
  }
  if (lower.endsWith('.json')) {
    return <FileText className="w-3.5 h-3.5 text-amber-500 shrink-0" />;
  }
  if (lower.endsWith('.css') || lower.endsWith('.scss') || lower.endsWith('.html')) {
    return <FileCode className="w-3.5 h-3.5 text-blue-500 shrink-0" />;
  }
  if (lower.endsWith('.md') || lower.endsWith('.txt')) {
    return <FileText className="w-3.5 h-3.5 text-emerald-500 shrink-0" />;
  }
  return <File className="w-3.5 h-3.5 text-neutral-400 shrink-0" />;
}

export const WorkspaceDrawer: React.FC<WorkspaceDrawerProps> = ({
  isOpen,
  onClose,
  workspaces = [],
  activeWorkspaceId,
  onSelectWorkspace,
  onSaveWorkspace,
  onDeleteWorkspace,
  onSendAiMessage,
  aiStatusText,
}) => {
  // Navigation & Selection state
  const [selectedFileKey, setSelectedFileKey] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileView, setMobileView] = useState<'files' | 'editor'>('files');

  // Sidebar resize state (desktop)
  const [sidebarWidth, setSidebarWidth] = useState(230);
  const isResizingRef = useRef(false);

  // Editor State
  const [isEditingFile, setIsEditingFile] = useState(false);
  const [fileEditText, setFileEditText] = useState('');

  // Modals & Menus
  const [isDiffModalOpen, setIsDiffModalOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [activeMenuPath, setActiveMenuPath] = useState<string | null>(null);

  // Folder Expansion Set
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['src', 'components', 'services']));

  // File / Folder Creation Dialog
  const [createType, setCreateType] = useState<'file' | 'folder' | null>(null);
  const [createTargetParent, setCreateTargetParent] = useState<string>('');
  const [newPathInput, setNewPathInput] = useState('');

  // Rename Dialog
  const [renamingItem, setRenamingItem] = useState<{ path: string; isFolder: boolean } | null>(null);
  const [renameInput, setRenameInput] = useState('');

  // File Upload Conflict Dialog
  const [pendingUploadFiles, setPendingUploadFiles] = useState<{ path: string; content: string }[] | null>(null);
  const [conflictFilesList, setConflictFilesList] = useState<string[]>([]);

  // Input Refs for Uploads
  const zipInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Close menus when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setIsMoreMenuOpen(false);
      }
      if (activeMenuPath && !(e.target as HTMLElement).closest('.file-action-menu')) {
        setActiveMenuPath(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeMenuPath]);

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

  // Check if active file has unsaved local edits
  const isCurrentFileModifiedUnsaved = useMemo(() => {
    if (!activeFile || !isEditingFile) return false;
    return fileEditText !== activeFile.content;
  }, [activeFile, isEditingFile, fileEditText]);

  // Sync editor text when active file changes
  useEffect(() => {
    if (activeFile) {
      setFileEditText(activeFile.content);
      setIsEditingFile(false);
    }
  }, [activeFile?.path]);

  // Build Hierarchical File Tree
  const fileTree = useMemo(() => {
    if (!currentWorkspace) return [];
    return buildFileTree(currentWorkspace.files, searchQuery);
  }, [currentWorkspace, searchQuery]);

  // Toggle folder expand/collapse
  const toggleFolder = (folderPath: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderPath)) {
        next.delete(folderPath);
      } else {
        next.add(folderPath);
      }
      return next;
    });
  };

  // Drag-to-resize sidebar width handler
  const handleMouseDownResize = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizingRef.current) return;
      const delta = moveEvent.clientX - startX;
      const newWidth = Math.max(180, Math.min(420, startWidth + delta));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      isResizingRef.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // 1. Handle Upload ZIP (Import new or full project)
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
    setIsMoreMenuOpen(false);
  };

  // 2. Handle Upload Plain Files to current Workspace
  const handleUploadFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!currentWorkspace || !e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files);
    const loadedFiles: { path: string; content: string }[] = [];

    for (const f of files) {
      const text = await f.text();
      loadedFiles.push({ path: f.name, content: text });
    }

    // Check for conflicts
    const conflicts = loadedFiles
      .map(f => f.path)
      .filter(p => currentWorkspace.files[p] !== undefined);

    if (conflicts.length > 0) {
      setPendingUploadFiles(loadedFiles);
      setConflictFilesList(conflicts);
    } else {
      const res = addFilesToActiveWorkspace(currentWorkspace, loadedFiles, 'overwrite');
      onSaveWorkspace(res.updatedWorkspace);
      if (loadedFiles[0]) {
        setSelectedFileKey(loadedFiles[0].path);
      }
    }
    e.target.value = '';
    setIsMoreMenuOpen(false);
  };

  // 3. Handle Upload Folder to current Workspace
  const handleUploadFolder = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!currentWorkspace || !e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files);
    const loadedFiles: { path: string; content: string }[] = [];

    for (const f of files) {
      // webkitRelativePath contains the directory structure
      const rawPath = f.webkitRelativePath || f.name;
      // Strip out root folder name if desired, or retain full path
      const parts = rawPath.replace(/\\/g, '/').split('/');
      const relativePath = parts.length > 1 ? parts.slice(1).join('/') : rawPath;

      if (!relativePath || relativePath.endsWith('.DS_Store') || relativePath.includes('node_modules/')) {
        continue;
      }

      const text = await f.text();
      loadedFiles.push({ path: relativePath, content: text });
    }

    if (loadedFiles.length === 0) {
      alert('未检测到有效的文本或代码文件');
      return;
    }

    const conflicts = loadedFiles
      .map(f => f.path)
      .filter(p => currentWorkspace.files[p] !== undefined);

    if (conflicts.length > 0) {
      setPendingUploadFiles(loadedFiles);
      setConflictFilesList(conflicts);
    } else {
      const res = addFilesToActiveWorkspace(currentWorkspace, loadedFiles, 'overwrite');
      onSaveWorkspace(res.updatedWorkspace);
      if (loadedFiles[0]) {
        setSelectedFileKey(loadedFiles[0].path);
      }
    }
    e.target.value = '';
    setIsMoreMenuOpen(false);
  };

  // Resolve upload conflicts
  const handleResolveConflict = (resolution: 'overwrite' | 'rename' | 'skip') => {
    if (!currentWorkspace || !pendingUploadFiles) return;
    const res = addFilesToActiveWorkspace(currentWorkspace, pendingUploadFiles, resolution);
    onSaveWorkspace(res.updatedWorkspace);
    setPendingUploadFiles(null);
    setConflictFilesList([]);
    if (pendingUploadFiles[0]) {
      setSelectedFileKey(pendingUploadFiles[0].path);
    }
  };

  // 4. Handle Download Clean Project ZIP
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
    setIsMoreMenuOpen(false);
  };

  // 5. Handle Download Single File
  const handleDownloadSingleFile = (file: WorkspaceFile) => {
    const blob = new Blob([file.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.path.split('/').pop() || 'file.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setActiveMenuPath(null);
  };

  // 6. Handle Save File Edit
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

  // 7. Handle Create File or Folder
  const handleConfirmCreate = () => {
    if (!currentWorkspace || !newPathInput.trim()) return;
    let target = newPathInput.trim().replace(/^\/+/, '');
    if (createTargetParent) {
      target = `${createTargetParent.replace(/\/+$/, '')}/${target}`;
    }

    if (createType === 'folder') {
      // Add a .gitkeep or placeholder inside the new folder
      target = `${target.replace(/\/+$/, '')}/.gitkeep`;
    }

    if (currentWorkspace.files[target]) {
      alert('已存在同名路径');
      return;
    }

    const updatedFiles = {
      ...currentWorkspace.files,
      [target]: {
        path: target,
        content: createType === 'folder' ? '# 目录占位\n' : '// 新建文件\n',
        size: 15,
        updatedAt: Date.now(),
      },
    };

    onSaveWorkspace({
      ...currentWorkspace,
      files: updatedFiles,
      updatedAt: Date.now(),
    });

    setSelectedFileKey(target);
    setCreateType(null);
    setCreateTargetParent('');
    setNewPathInput('');
  };

  // 8. Handle Delete File
  const handleDeleteFile = (path: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!currentWorkspace) return;
    if (confirm(`确定删除文件 "${path}"？`)) {
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
      setActiveMenuPath(null);
    }
  };

  // 9. Handle Delete Folder
  const handleDeleteFolder = (folderPath: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!currentWorkspace) return;
    const prefix = folderPath.replace(/\/+$/, '') + '/';
    const filesInFolder = Object.keys(currentWorkspace.files).filter(p => p.startsWith(prefix));
    
    if (confirm(`确定删除文件夹 "${folderPath}"？\n其中包含 ${filesInFolder.length} 个文件，删除后将无法恢复。`)) {
      const res = deleteFolderFromWorkspace(currentWorkspace, folderPath);
      onSaveWorkspace(res.updatedWorkspace);
      if (selectedFileKey && selectedFileKey.startsWith(prefix)) {
        setSelectedFileKey(Object.keys(res.updatedWorkspace.files)[0] || null);
      }
      setActiveMenuPath(null);
    }
  };

  // 10. Handle Rename Item (File or Folder)
  const handleConfirmRename = () => {
    if (!currentWorkspace || !renamingItem || !renameInput.trim()) return;
    const newName = renameInput.trim().replace(/^\/+/, '');
    
    if (renamingItem.isFolder) {
      const res = renameFolderInWorkspace(currentWorkspace, renamingItem.path, newName);
      onSaveWorkspace(res.updatedWorkspace);
      if (selectedFileKey?.startsWith(renamingItem.path)) {
        const rest = selectedFileKey.slice(renamingItem.path.length);
        setSelectedFileKey(`${newName}${rest}`);
      }
    } else {
      if (currentWorkspace.files[newName] && newName !== renamingItem.path) {
        alert('目标路径已存在同名文件');
        return;
      }
      const file = currentWorkspace.files[renamingItem.path];
      const updatedFiles = { ...currentWorkspace.files };
      delete updatedFiles[renamingItem.path];
      updatedFiles[newName] = { ...file, path: newName, updatedAt: Date.now() };

      onSaveWorkspace({
        ...currentWorkspace,
        files: updatedFiles,
        updatedAt: Date.now(),
      });
      setSelectedFileKey(newName);
    }

    setRenamingItem(null);
    setRenameInput('');
    setActiveMenuPath(null);
  };

  // 11. Handle AI Analysis Trigger
  const handleTriggerAiAnalysis = (filePath: string) => {
    onSendAiMessage?.(`请分析工作区文件: \`${filePath}\` 的实现与架构。`);
    setActiveMenuPath(null);
    onClose();
  };

  // 12. Handle AI Diagnosis Trigger
  const handleTriggerAiDiagnosis = (filePath: string) => {
    onSendAiMessage?.(`我怀疑工作区文件 \`${filePath}\` 这里有问题，请帮我系统诊断相关代码。`);
    setActiveMenuPath(null);
    onClose();
  };

  // Recursive Tree Node Renderer
  const renderTreeNode = (node: TreeNode, depth = 0) => {
    const isExpanded = expandedFolders.has(node.path);
    const isSelected = selectedFileKey === node.path;
    const isModified = modifiedFilesList.some(m => m.path === node.path);
    const isMenuOpen = activeMenuPath === node.path;

    if (node.isFolder) {
      return (
        <div key={node.path} className="select-none">
          <div
            onClick={() => toggleFolder(node.path)}
            style={{ paddingLeft: `${depth * 14 + 8}px` }}
            className="group flex items-center justify-between py-1.5 pr-2 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800/60 cursor-pointer text-xs transition text-neutral-700 dark:text-neutral-300"
          >
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <span className="text-neutral-400">
                {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </span>
              <span className="text-amber-500">
                {isExpanded ? <FolderOpen className="w-4 h-4" /> : <Folder className="w-4 h-4" />}
              </span>
              <span className="truncate font-medium text-[12px]">{node.name}</span>
            </div>

            {/* Folder Actions Menu */}
            <div className="relative opacity-0 group-hover:opacity-100 flex items-center gap-1 transition">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCreateTargetParent(node.path);
                  setCreateType('file');
                  setNewPathInput('');
                }}
                className="p-1 rounded text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                title="在此目录下新建文件"
              >
                <Plus className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveMenuPath(isMenuOpen ? null : node.path);
                }}
                className="p-1 rounded text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700"
              >
                <MoreVertical className="w-3 h-3" />
              </button>

              {/* Folder Menu Popup */}
              {isMenuOpen && (
                <div className="file-action-menu absolute right-0 top-6 z-50 w-36 bg-white dark:bg-neutral-800 rounded-lg shadow-xl border border-neutral-200 dark:border-neutral-700 py-1 text-xs animate-in fade-in">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCreateTargetParent(node.path);
                      setCreateType('file');
                      setActiveMenuPath(null);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center gap-2"
                  >
                    <FilePlus className="w-3.5 h-3.5 text-indigo-500" />
                    <span>新建文件</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setRenamingItem({ path: node.path, isFolder: true });
                      setRenameInput(node.path);
                      setActiveMenuPath(null);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center gap-2"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-neutral-400" />
                    <span>重命名</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleDeleteFolder(node.path, e)}
                    className="w-full text-left px-3 py-1.5 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center gap-2"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>删除文件夹</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Child Nodes */}
          {isExpanded && node.children && (
            <div className="flex flex-col space-y-0.5">
              {node.children.map(child => renderTreeNode(child, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    // File Node
    return (
      <div
        key={node.path}
        onClick={() => {
          setSelectedFileKey(node.path);
          setMobileView('editor');
        }}
        style={{ paddingLeft: `${depth * 14 + 18}px` }}
        className={`group flex items-center justify-between py-1.5 pr-2 rounded-md cursor-pointer text-xs transition ${
          isSelected
            ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-medium'
            : 'hover:bg-neutral-100 dark:hover:bg-neutral-800/50 text-neutral-700 dark:text-neutral-300'
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {getFileIcon(node.name)}
          <span className="truncate text-[12px]">{node.name}</span>
          {isModified && (
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" title="自原始版本以来已被修改" />
          )}
        </div>

        {/* File Actions Menu Button */}
        <div className="relative opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setActiveMenuPath(isMenuOpen ? null : node.path);
            }}
            className="p-1 rounded text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700"
          >
            <MoreVertical className="w-3 h-3" />
          </button>

          {/* File Menu Popup */}
          {isMenuOpen && node.file && (
            <div className="file-action-menu absolute right-0 top-6 z-50 w-36 bg-white dark:bg-neutral-800 rounded-lg shadow-xl border border-neutral-200 dark:border-neutral-700 py-1 text-xs animate-in fade-in">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedFileKey(node.path);
                  setMobileView('editor');
                  setActiveMenuPath(null);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center gap-2"
              >
                <Code2 className="w-3.5 h-3.5 text-neutral-400" />
                <span>打开代码</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleTriggerAiDiagnosis(node.path);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-medium flex items-center gap-2"
              >
                <Activity className="w-3.5 h-3.5" />
                <span>🩺 AI 诊断</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleTriggerAiAnalysis(node.path);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center gap-2"
              >
                <Bot className="w-3.5 h-3.5 text-neutral-500" />
                <span>🤖 AI 分析</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setRenamingItem({ path: node.path, isFolder: false });
                  setRenameInput(node.path);
                  setActiveMenuPath(null);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center gap-2"
              >
                <Edit2 className="w-3.5 h-3.5 text-neutral-400" />
                <span>重命名</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownloadSingleFile(node.file!);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center gap-2"
              >
                <Download className="w-3.5 h-3.5 text-neutral-400" />
                <span>下载文件</span>
              </button>
              <button
                type="button"
                onClick={(e) => handleDeleteFile(node.path, e)}
                className="w-full text-left px-3 py-1.5 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center gap-2"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>删除文件</span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-y-0 right-0 z-40 w-full sm:w-[680px] md:w-[840px] lg:w-[940px] bg-white dark:bg-neutral-900 border-l border-neutral-200 dark:border-neutral-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        {/* Row 1: Main Header (Back / Title / AI Status / More / Close) */}
        <div className="px-4 py-2.5 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/70 dark:bg-neutral-950/60">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition"
              title="返回聊天"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-semibold text-sm text-neutral-900 dark:text-neutral-100 truncate">
                AI 编程工作区
              </span>
              {aiStatusText && (
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-[10px] font-medium border border-indigo-200/50 dark:border-indigo-800/50">
                  <Activity className="w-2.5 h-2.5 animate-pulse" />
                  {aiStatusText}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Hidden Input Elements for File / Folder Uploads */}
            <input type="file" ref={zipInputRef} accept=".zip" onChange={handleUploadZip} className="hidden" />
            <input type="file" ref={fileInputRef} multiple onChange={handleUploadFiles} className="hidden" />
            <input 
              type="file" 
              ref={folderInputRef} 
              multiple 
              {...({ webkitdirectory: '', directory: '' } as any)} 
              onChange={handleUploadFolder} 
              className="hidden" 
            />

            {/* Quick Diff Pill (Desktop) */}
            {modifiedFilesList.length > 0 && (
              <button
                type="button"
                onClick={() => setIsDiffModalOpen(true)}
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60 text-xs font-medium transition cursor-pointer"
                title="查看与基准版本的代码差异对比"
              >
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span>已修改 {modifiedFilesList.length} 个文件</span>
              </button>
            )}

            {/* "⋯ 更多" Dropdown Menu */}
            <div className="relative" ref={moreMenuRef}>
              <button
                type="button"
                onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
                className="p-1.5 rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/70 dark:hover:bg-neutral-800 transition flex items-center gap-1"
                title="更多工作区管理选项"
              >
                <MoreVertical className="w-4 h-4" />
                <span className="text-xs hidden sm:inline">更多</span>
              </button>

              {isMoreMenuOpen && (
                <div className="absolute right-0 top-8 z-50 w-52 bg-white dark:bg-neutral-800 rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-700 py-1.5 text-xs animate-in fade-in">
                  <div className="px-3 py-1 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
                    文件导入与导出
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      fileInputRef.current?.click();
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center gap-2.5 text-neutral-700 dark:text-neutral-200"
                  >
                    <FilePlus className="w-4 h-4 text-indigo-500" />
                    <span>上传普通文件 (加入当前)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      folderInputRef.current?.click();
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center gap-2.5 text-neutral-700 dark:text-neutral-200"
                  >
                    <FolderPlus className="w-4 h-4 text-indigo-500" />
                    <span>上传项目文件夹</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      zipInputRef.current?.click();
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center gap-2.5 text-neutral-700 dark:text-neutral-200"
                  >
                    <Upload className="w-4 h-4 text-neutral-500" />
                    <span>导入新工程 ZIP 包</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadZip}
                    className="w-full text-left px-3 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center gap-2.5 text-emerald-600 dark:text-emerald-400 font-medium"
                  >
                    <Download className="w-4 h-4" />
                    <span>打包下载当前项目 ZIP</span>
                  </button>

                  <div className="my-1 border-t border-neutral-100 dark:border-neutral-700" />
                  <div className="px-3 py-1 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
                    版本与重置
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsDiffModalOpen(true);
                      setIsMoreMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center gap-2.5 text-neutral-700 dark:text-neutral-200"
                  >
                    <FileCheck className="w-4 h-4 text-amber-500" />
                    <span>查看完整修改差异 (Diff)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (currentWorkspace) {
                        const res = revertToPreviousSnapshot(currentWorkspace);
                        if (res.success) onSaveWorkspace(res.workspace);
                        alert(res.message);
                      }
                      setIsMoreMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center gap-2.5 text-neutral-700 dark:text-neutral-200"
                  >
                    <RotateCcw className="w-4 h-4 text-neutral-400" />
                    <span>撤销至上一快照版本</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (currentWorkspace && confirm('确认将当前工作区恢复至用户初始基准版本 (v1)？所有 AI 及手动修改将被重置。')) {
                        const res = restoreOriginalSnapshot(currentWorkspace);
                        onSaveWorkspace(res.workspace);
                        alert(res.message);
                      }
                      setIsMoreMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center gap-2.5 text-amber-600 dark:text-amber-400"
                  >
                    <History className="w-4 h-4" />
                    <span>恢复到原始版本 (v1)</span>
                  </button>

                  <div className="my-1 border-t border-neutral-100 dark:border-neutral-700" />
                  <button
                    type="button"
                    onClick={() => {
                      const newWs = createEmptyWorkspace(`新项目_${workspaces.length + 1}`);
                      onSaveWorkspace(newWs);
                      onSelectWorkspace(newWs.id);
                      setIsMoreMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center gap-2.5 text-neutral-700 dark:text-neutral-200"
                  >
                    <Plus className="w-4 h-4 text-indigo-500" />
                    <span>新建空白工作区</span>
                  </button>
                  {workspaces.length > 1 && currentWorkspace && (
                    <button
                      type="button"
                      onClick={() => {
                        onDeleteWorkspace(currentWorkspace.id);
                        setIsMoreMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center gap-2.5"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>删除当前工作区</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition"
              title="关闭抽屉"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Row 2: Secondary Metadata Bar (Current Workspace Selector · Version · Mobile View Switcher) */}
        <div className="px-4 py-2 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-white dark:bg-neutral-900 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            {/* Workspace Select */}
            <select
              value={currentWorkspace?.id || ''}
              onChange={(e) => onSelectWorkspace(e.target.value)}
              className="px-2 py-1 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 font-medium border-0 focus:ring-1 focus:ring-indigo-500 cursor-pointer text-xs"
            >
              {workspaces.map(ws => (
                <option key={ws.id} value={ws.id}>
                  {ws.name} ({Object.keys(ws.files).length} 文件)
                </option>
              ))}
            </select>
            {currentWorkspace && (
              <span className="px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-mono text-[10px] font-bold">
                v{currentWorkspace.currentVersion}
              </span>
            )}
          </div>

          {/* Mobile Tab View Switcher */}
          <div className="flex sm:hidden items-center p-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-800">
            <button
              type="button"
              onClick={() => setMobileView('files')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                mobileView === 'files'
                  ? 'bg-white dark:bg-neutral-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                  : 'text-neutral-500'
              }`}
            >
              文件 ({Object.keys(currentWorkspace?.files || {}).length})
            </button>
            <button
              type="button"
              onClick={() => setMobileView('editor')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                mobileView === 'editor'
                  ? 'bg-white dark:bg-neutral-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                  : 'text-neutral-500'
              }`}
            >
              代码 {isCurrentFileModifiedUnsaved && '●'}
            </button>
          </div>
        </div>

        {/* Main Body (Split View: File Tree + Code Editor) */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* Left Panel: File Tree (Shown on desktop or when mobileView === 'files') */}
          <div 
            style={{ width: `${sidebarWidth}px` }}
            className={`flex flex-col border-r border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/30 overflow-hidden shrink-0 ${
              mobileView === 'files' ? 'w-full sm:w-auto flex' : 'hidden sm:flex'
            }`}
          >
            {/* Search and Quick Add Bar */}
            <div className="p-2.5 border-b border-neutral-200 dark:border-neutral-800 space-y-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-neutral-400" />
                <input
                  type="text"
                  placeholder="搜索文件路径或名称..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:border-indigo-500 text-neutral-800 dark:text-neutral-200 placeholder-neutral-400"
                />
              </div>

              <div className="flex items-center justify-between text-xs pt-0.5">
                <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                  项目文件 ({Object.keys(currentWorkspace?.files || {}).length})
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setCreateTargetParent('');
                      setCreateType('file');
                      setNewPathInput('');
                    }}
                    className="p-1 rounded text-neutral-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-neutral-200/60 dark:hover:bg-neutral-800"
                    title="新建文件"
                  >
                    <FilePlus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCreateTargetParent('');
                      setCreateType('folder');
                      setNewPathInput('');
                    }}
                    className="p-1 rounded text-neutral-500 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-neutral-200/60 dark:hover:bg-neutral-800"
                    title="新建文件夹"
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* File Tree List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
              {fileTree.length === 0 ? (
                <div className="p-4 text-center text-xs text-neutral-400">
                  {searchQuery ? '未找到匹配的文件' : '当前工作区为空，请在上方导入或新建文件'}
                </div>
              ) : (
                fileTree.map(node => renderTreeNode(node))
              )}
            </div>

            {/* Mobile Bottom Quick Actions */}
            <div className="p-2 border-t border-neutral-200 dark:border-neutral-800 flex sm:hidden items-center justify-around text-xs bg-white dark:bg-neutral-900">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center gap-1 text-neutral-600 dark:text-neutral-400 p-1"
              >
                <Upload className="w-3.5 h-3.5" />
                <span className="text-[10px]">上传文件</span>
              </button>
              <button
                type="button"
                onClick={() => handleDownloadZip()}
                className="flex flex-col items-center gap-1 text-emerald-600 dark:text-emerald-400 p-1"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="text-[10px]">下载 ZIP</span>
              </button>
              {modifiedFilesList.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsDiffModalOpen(true)}
                  className="flex flex-col items-center gap-1 text-amber-600 dark:text-amber-400 p-1"
                >
                  <FileCheck className="w-3.5 h-3.5" />
                  <span className="text-[10px]">Diff ({modifiedFilesList.length})</span>
                </button>
              )}
            </div>
          </div>

          {/* Draggable Divider (Desktop Only) */}
          <div
            onMouseDown={handleMouseDownResize}
            className="hidden sm:block w-1 hover:w-1.5 bg-neutral-200 hover:bg-indigo-400 dark:bg-neutral-800 dark:hover:bg-indigo-600 cursor-col-resize select-none transition-all z-10"
            title="拖动调整文件树宽度"
          />

          {/* Right Panel: Code Viewer & Editor (Shown on desktop or when mobileView === 'editor') */}
          <div className={`flex-1 flex flex-col overflow-hidden bg-neutral-950 text-neutral-100 ${
            mobileView === 'editor' ? 'w-full sm:w-auto flex' : 'hidden sm:flex'
          }`}>
            {activeFile ? (
              <>
                {/* Editor Header Bar */}
                <div className="px-4 py-2 border-b border-neutral-800 bg-neutral-900/90 flex items-center justify-between text-xs shrink-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-neutral-200 font-semibold truncate">
                      {activeFile.path}
                    </span>
                    {isCurrentFileModifiedUnsaved && (
                      <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" title="有未保存的代码修改" />
                    )}
                    <span className="text-[10px] text-neutral-500 font-mono">
                      ({Math.round((activeFile.size / 1024) * 10) / 10} KB)
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Trigger AI Diagnosis */}
                    <button
                      type="button"
                      onClick={() => handleTriggerAiDiagnosis(activeFile.path)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-medium transition cursor-pointer shadow-xs"
                      title="让 AI 对当前文件进行 10 步系统性静态代码诊断"
                    >
                      <Activity className="w-3 h-3" />
                      <span>AI 诊断</span>
                    </button>

                    {/* Trigger AI Analysis */}
                    <button
                      type="button"
                      onClick={() => handleTriggerAiAnalysis(activeFile.path)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-[11px] font-medium transition cursor-pointer"
                      title="让 AI 分析本文件结构与逻辑"
                    >
                      <Bot className="w-3 h-3" />
                      <span className="hidden sm:inline">AI 分析</span>
                    </button>

                    {/* Toggle Manual Edit Mode / Save */}
                    {!isEditingFile ? (
                      <button
                        type="button"
                        onClick={() => {
                          setFileEditText(activeFile.content);
                          setIsEditingFile(true);
                        }}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-[11px] font-medium transition cursor-pointer"
                        title="手动编辑此代码文件"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span className="hidden sm:inline">编辑</span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setFileEditText(activeFile.content);
                            setIsEditingFile(false);
                          }}
                          className="px-2 py-1 rounded text-neutral-400 hover:text-neutral-200 text-[11px] transition"
                        >
                          取消
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveFileContent}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-medium transition cursor-pointer shadow-xs"
                        >
                          <Save className="w-3 h-3" />
                          <span>保存</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Code Content Area */}
                <div className="flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed select-text">
                  {isEditingFile ? (
                    <textarea
                      value={fileEditText}
                      onChange={(e) => setFileEditText(e.target.value)}
                      className="w-full h-full bg-neutral-950 text-neutral-100 font-mono text-xs p-2 rounded border border-neutral-800 focus:outline-none focus:border-indigo-500 resize-none"
                      spellCheck={false}
                    />
                  ) : (
                    <pre className="text-neutral-300 whitespace-pre font-mono text-xs">
                      {activeFile.content || '（文件内容为空）'}
                    </pre>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-neutral-500 space-y-3">
                <FileCode className="w-12 h-12 stroke-1 opacity-40" />
                <p className="text-sm font-medium">未选择任何文件</p>
                <p className="text-xs max-w-sm">请在左侧文件树中点击一个文件进行浏览、编辑或执行 AI 诊断。</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Inline Create File / Folder Dialog */}
      {createType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-xl p-5 shadow-2xl border border-neutral-200 dark:border-neutral-800 space-y-4 animate-in zoom-in-95">
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              {createType === 'file' ? <FilePlus className="w-4 h-4 text-indigo-600" /> : <FolderPlus className="w-4 h-4 text-amber-600" />}
              <span>{createType === 'file' ? '新建代码/文本文件' : '新建文件夹目录'}</span>
            </h3>
            <p className="text-xs text-neutral-500">
              {createTargetParent ? `目标父目录: ${createTargetParent}/` : '创建于工作区根目录'}
            </p>
            <input
              type="text"
              placeholder={createType === 'file' ? '例如: src/types/api.ts' : '例如: components/ui'}
              value={newPathInput}
              onChange={(e) => setNewPathInput(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:border-indigo-500 text-neutral-900 dark:text-neutral-100 font-mono"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConfirmCreate();
                if (e.key === 'Escape') setCreateType(null);
              }}
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCreateType(null)}
                className="px-3 py-1.5 rounded-lg text-xs text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleConfirmCreate}
                className="px-4 py-1.5 rounded-lg text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition cursor-pointer"
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Dialog */}
      {renamingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-xl p-5 shadow-2xl border border-neutral-200 dark:border-neutral-800 space-y-4 animate-in zoom-in-95">
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              <Edit2 className="w-4 h-4 text-indigo-600" />
              <span>重命名 {renamingItem.isFolder ? '文件夹' : '文件'}</span>
            </h3>
            <input
              type="text"
              value={renameInput}
              onChange={(e) => setRenameInput(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:border-indigo-500 text-neutral-900 dark:text-neutral-100 font-mono"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConfirmRename();
                if (e.key === 'Escape') setRenamingItem(null);
              }}
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRenamingItem(null)}
                className="px-3 py-1.5 rounded-lg text-xs text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleConfirmRename}
                className="px-4 py-1.5 rounded-lg text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition cursor-pointer"
              >
                确认重命名
              </button>
            </div>
          </div>
        </div>
      )}

      {/* File Upload Conflict Resolution Modal */}
      {pendingUploadFiles && conflictFilesList.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-xl p-5 shadow-2xl border border-amber-200 dark:border-amber-800/60 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center gap-2.5 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="text-sm font-semibold">检测到同名文件冲突</h3>
            </div>
            <p className="text-xs text-neutral-600 dark:text-neutral-300">
              当前工作区中已存在以下同名文件：
            </p>
            <div className="max-h-32 overflow-y-auto p-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-950 font-mono text-[11px] text-neutral-700 dark:text-neutral-300 divide-y divide-neutral-200 dark:divide-neutral-800">
              {conflictFilesList.map(p => (
                <div key={p} className="py-1">{p}</div>
              ))}
            </div>
            <p className="text-xs text-neutral-500">
              请选择处理策略，避免误覆盖重要代码：
            </p>
            <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setPendingUploadFiles(null);
                  setConflictFilesList([]);
                }}
                className="px-3 py-1.5 rounded-lg text-xs text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
              >
                取消上传
              </button>
              <button
                type="button"
                onClick={() => handleResolveConflict('rename')}
                className="px-3 py-1.5 rounded-lg text-xs bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 dark:hover:bg-neutral-600 text-neutral-800 dark:text-neutral-200 font-medium transition cursor-pointer"
              >
                另存为副本 (_copy)
              </button>
              <button
                type="button"
                onClick={() => handleResolveConflict('overwrite')}
                className="px-3.5 py-1.5 rounded-lg text-xs bg-amber-600 hover:bg-amber-700 text-white font-medium transition cursor-pointer"
              >
                覆盖已有文件
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Diff Viewer Modal */}
      <DiffViewerModal
        isOpen={isDiffModalOpen}
        onClose={() => setIsDiffModalOpen(false)}
        workspace={currentWorkspace}
        onDownloadZip={handleDownloadZip}
        onDiagnoseDiff={(filePath) => {
          onSendAiMessage?.(`请帮我系统诊断最近对 \`${filePath}\` 的修改是否引入了潜在问题或 Bug。`);
          setIsDiffModalOpen(false);
          onClose();
        }}
      />
    </>
  );
};
