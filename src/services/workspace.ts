import JSZip from 'jszip';
import { WorkspaceFile, ProjectMemoryItem } from '../types/workspace';

// Detect file language by extension
export function getLanguageFromPath(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    json: 'json',
    html: 'html',
    css: 'css',
    scss: 'scss',
    md: 'markdown',
    py: 'python',
    java: 'java',
    go: 'go',
    rs: 'rust',
    cpp: 'cpp',
    c: 'c',
    sh: 'bash',
    yaml: 'yaml',
    yml: 'yaml',
    sql: 'sql',
    txt: 'plaintext',
  };
  return map[ext] || 'plaintext';
}

// Convert uploaded standard files into WorkspaceFile objects
export async function parseUploadedFilesToWorkspace(files: FileList | File[]): Promise<WorkspaceFile[]> {
  const result: WorkspaceFile[] = [];
  const fileArray = Array.from(files);

  for (const file of fileArray) {
    if (file.name.endsWith('.zip')) {
      const zipFiles = await importZipToWorkspace(file);
      result.push(...zipFiles);
    } else {
      try {
        const text = await file.text();
        const path = file.webkitRelativePath || file.name;
        // Ignore binary or huge junk files
        if (text.includes('\0')) continue;
        result.push({
          id: `file_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          path: normalizePath(path),
          content: text,
          language: getLanguageFromPath(path),
          size: file.size,
          updatedAt: Date.now(),
        });
      } catch (err) {
        console.warn(`Failed reading text from ${file.name}:`, err);
      }
    }
  }

  return result;
}

// Unzip a .zip archive into WorkspaceFile array
export async function importZipToWorkspace(zipBlob: Blob): Promise<WorkspaceFile[]> {
  const zip = new JSZip();
  const loaded = await zip.loadAsync(zipBlob);
  const files: WorkspaceFile[] = [];

  for (const [relativePath, zipEntry] of Object.entries(loaded.files)) {
    if (zipEntry.dir) continue;
    // Skip hidden files, system files, and node_modules
    if (
      relativePath.startsWith('__MACOSX') || 
      relativePath.includes('/.git/') || 
      relativePath.startsWith('.git/') ||
      relativePath.includes('node_modules/') ||
      relativePath.endsWith('.DS_Store')
    ) {
      continue;
    }

    try {
      const content = await zipEntry.async('text');
      // Ignore binary files containing null bytes
      if (content.includes('\0')) continue;

      files.push({
        id: `file_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        path: normalizePath(relativePath),
        content,
        language: getLanguageFromPath(relativePath),
        size: content.length,
        updatedAt: Date.now(),
      });
    } catch {
      // Binary or unreadable, ignore
    }
  }

  return files;
}

// Re-package all Workspace files into a .zip archive and trigger download
export async function exportAndDownloadWorkspaceZip(
  files: WorkspaceFile[], 
  projectName = 'mychat-workspace'
): Promise<void> {
  const zip = new JSZip();

  for (const file of files) {
    zip.file(file.path, file.content);
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${projectName}-${new Date().toISOString().slice(0, 10)}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Normalize relative paths (e.g., remove leading slash, replace backslashes)
export function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\/+/, '').trim();
}

// Search files in workspace
export function searchWorkspaceFiles(
  files: WorkspaceFile[], 
  query: string
): { path: string; matches: { line: number; text: string }[] }[] {
  if (!query) return [];
  const lowerQuery = query.toLowerCase();
  const results: { path: string; matches: { line: number; text: string }[] }[] = [];

  for (const file of files) {
    const lines = file.content.split('\n');
    const matches: { line: number; text: string }[] = [];
    lines.forEach((lineText, idx) => {
      if (lineText.toLowerCase().includes(lowerQuery)) {
        matches.push({
          line: idx + 1,
          text: lineText.trim().slice(0, 150),
        });
      }
    });

    if (matches.length > 0 || file.path.toLowerCase().includes(lowerQuery)) {
      results.push({
        path: file.path,
        matches: matches.slice(0, 10), // Limit matches per file
      });
    }
  }

  return results;
}

// Edit file content with target and replacement substring
export function applyEditToFile(
  original: string,
  targetContent: string,
  replacementContent: string
): { success: boolean; newContent: string; error?: string } {
  if (!original.includes(targetContent)) {
    // Try normalized whitespace fallback
    const normOriginal = original.replace(/\r\n/g, '\n');
    const normTarget = targetContent.replace(/\r\n/g, '\n');
    if (normOriginal.includes(normTarget)) {
      const idx = normOriginal.indexOf(normTarget);
      const newContent = normOriginal.slice(0, idx) + replacementContent + normOriginal.slice(idx + normTarget.length);
      return { success: true, newContent };
    }
    return {
      success: false,
      newContent: original,
      error: `在目标文件中未找到指定的精确匹配代码块: "${targetContent.slice(0, 60)}..."`,
    };
  }

  const idx = original.indexOf(targetContent);
  const newContent = original.slice(0, idx) + replacementContent + original.slice(idx + targetContent.length);
  return { success: true, newContent };
}

// Default Project Memory initial templates
export const DEFAULT_PROJECT_MEMORIES: ProjectMemoryItem[] = [
  {
    id: 'mem_arch',
    key: 'architecture',
    title: '项目架构概览',
    category: 'architecture',
    content: '当前项目工作区包含前端 SPA 与核心服务组件，采用模块化设计与 TypeScript 类型系统。',
    updatedAt: Date.now(),
    source: 'agent',
  },
  {
    id: 'mem_rules',
    key: 'code_conventions',
    title: '代码规范与约定',
    category: 'guideline',
    content: '1. 保持代码整洁且无报错\n2. 优先使用小而专一的纯函数与类型声明\n3. 修改文件时保留已有逻辑与向后兼容。',
    updatedAt: Date.now(),
    source: 'agent',
  },
];
