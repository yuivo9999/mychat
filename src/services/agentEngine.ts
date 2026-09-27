import { 
  Workspace, 
  WorkspaceFile, 
  ToolCallExecution, 
  validateSafeRelativePath 
} from '../types/workspace';
import { ThinkingStep } from '../types';
import { 
  searchWorkspaceCode, 
  getWorkspaceDirectoryTree, 
  computeDiffBetweenFileSnapshots 
} from './workspaceService';
import { formatChatContextPrompt } from './chatContextService';
import { ChatContext } from '../types/workspace';

// AI Tool Calling Specification for Workspace operations (Strictly non-executing!)
export const WORKSPACE_TOOLS_SPEC = [
  {
    name: 'list_files',
    description: '列出工作区中的文件相对路径与大小。用于初步了解文件布局。',
    parameters: {
      type: 'object',
      properties: {
        path_prefix: { type: 'string', description: '可选，目录前缀，如 "src/"' },
      },
    },
  },
  {
    name: 'get_workspace_tree',
    description: '获取整个工作区的完整文件树目录概览。',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'read_file',
    description: '按需读取工作区中指定代码文件的文本内容。支持指定行号范围。',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '文件相对路径，如 "src/App.tsx"' },
        start_line: { type: 'number', description: '可选起始行号 (1-indexed)' },
        end_line: { type: 'number', description: '可选结束行号' },
      },
      required: ['path'],
    },
  },
  {
    name: 'search_files',
    description: '根据文件名或路径搜索工作区中的相关文件。',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '文件名或路径关键词，如 "router" 或 "config"' },
      },
      required: ['query'],
    },
  },
  {
    name: 'search_code',
    description: '在工作区全部代码文件中全文搜索关键词、函数名或变量声明，返回匹配行号和内容。',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '代码检索关键词，如 "handleSubmit" 或 "API_URL"' },
      },
      required: ['query'],
    },
  },
  {
    name: 'patch_file',
    description: '对文件进行精确的局部代码块替换（优先使用 Patch 方式，避免无脑重写整个大文件造成代码遗失）。',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '目标文件相对路径' },
        target_content: { type: 'string', description: '文件中必须完全精确匹配的现有代码块' },
        replacement_content: { type: 'string', description: '替换后的新代码块' },
      },
      required: ['path', 'target_content', 'replacement_content'],
    },
  },
  {
    name: 'write_file',
    description: '全量写入文件内容（适用于新文件或必要的大规模重构）。',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '目标文件相对路径' },
        content: { type: 'string', description: '要写入的完整文件内容' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'create_file',
    description: '在工作区中创建新文件。',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '新建文件的路径，如 "src/types/api.ts"' },
        content: { type: 'string', description: '初始文件内容' },
      },
      required: ['path'],
    },
  },
  {
    name: 'delete_file',
    description: '从工作区中删除指定文件。',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '要删除的文件路径' },
      },
      required: ['path'],
    },
  },
  {
    name: 'rename_file',
    description: '重命名工作区中的文件。',
    parameters: {
      type: 'object',
      properties: {
        old_path: { type: 'string', description: '原文件路径' },
        new_path: { type: 'string', description: '新文件路径' },
      },
      required: ['old_path', 'new_path'],
    },
  },
  {
    name: 'get_file_diff',
    description: '查看指定文件自上一个版本或原始版本以来的修改对比差异。',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '文件相对路径' },
      },
      required: ['path'],
    },
  },
  {
    name: 'get_workspace_diff',
    description: '查看整个工作区中所有已修改、新增和删除的文件清单与差异。',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
];

// Build System Prompt containing workspace summary and strict constraints
export function buildAgentSystemPrompt(
  workspace: Workspace | null,
  chatContext?: ChatContext,
  baseSystemPrompt?: string
): string {
  const customPrompt = baseSystemPrompt || '你是一个专业严谨的高级编程助手。';

  const workspaceSummary = workspace
    ? `## 当前绑定的工作区: ${workspace.name} (版本: v${workspace.currentVersion})
- 文件总数: ${Object.keys(workspace.files).length} 个
- 工作区文件结构摘要:
${getWorkspaceDirectoryTree(workspace).slice(0, 1500)}${Object.keys(workspace.files).length > 25 ? '\n... (更多文件可使用 list_files 或 search_files 查看)' : ''}`
    : '## 当前暂未绑定工作区（您可以回答普通问题，或提醒用户在右上角创建/上传 ZIP 工作区）。';

  const chatPrivateMemory = formatChatContextPrompt(chatContext);

  return `${customPrompt}

${workspaceSummary}
${chatPrivateMemory}
## 核心运行原则与边界声明（必须严格遵守）:
1. **不执行项目代码**：本环境是一个安全纯净的代码分析与修改工作区。你绝对不能也无法在服务器端执行任何代码、命令行、测试、npm run/test 等。
2. **职责分工**：你负责阅读、搜索代码并做出精确优雅的修改；由用户在本地自行运行和测试。若用户测试遇到错误，用户会将错误信息贴回本聊天中由你继续分析与修改。
3. **按需查阅，最小修改**：
   - 严禁盲目把整个项目文件一次性全部读取；请先用 \`search_code\` 或 \`search_files\` 定位关键文件，再用 \`read_file\` 读取对应文件。
   - 优先使用 \`patch_file\` 进行局部的最小精准替换，避免全量重写大文件导致代码遗失或产生污染。
4. **工具调用协议 (Tool Calling)**：
   若需查看、搜索或修改工作区文件，请以标准 tool_call 代码块输出工具调用（可单次调用或批次调用）：
\`\`\`tool_call
{
  "tool": "search_code",
  "args": {
    "query": "loginButton"
  }
}
\`\`\`
或
\`\`\`tool_call
{
  "tool": "patch_file",
  "args": {
    "path": "src/App.tsx",
    "target_content": "const color = 'blue';",
    "replacement_content": "const color = 'red';"
  }
}
\`\`\`
可使用的工具：
- list_files({ path_prefix? })
- get_workspace_tree()
- read_file({ path, start_line?, end_line? })
- search_files({ query })
- search_code({ query })
- patch_file({ path, target_content, replacement_content })
- write_file({ path, content })
- create_file({ path, content? })
- delete_file({ path })
- rename_file({ old_path, new_path })
- get_file_diff({ path })
- get_workspace_diff()

当所有必要修改已完成无需再调用工具时，请直接给出清晰、结构化的中文说明，列出本次修改了哪些文件、做了哪些调整，并友好提醒用户自行在本地运行测试。`;
}

// Extract tool calls from AI response string
export function extractToolCallsFromResponse(text: string): { tool: string; args: Record<string, any> }[] {
  const toolCalls: { tool: string; args: Record<string, any> }[] = [];

  // 1. Match ```tool_call ... ``` blocks
  const toolCallBlockRegex = /```(?:tool_call|json:tool_call|tool)\s*([\s\S]*?)```/gi;
  let match: RegExpExecArray | null;

  while ((match = toolCallBlockRegex.exec(text)) !== null) {
    const rawJson = match[1].trim();
    try {
      const parsed = JSON.parse(rawJson);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && (item.tool || item.name)) {
            toolCalls.push({
              tool: item.tool || item.name,
              args: item.args || item.parameters || item.arguments || {},
            });
          }
        }
      } else if (parsed && (parsed.tool || parsed.name)) {
        toolCalls.push({
          tool: parsed.tool || parsed.name,
          args: parsed.args || parsed.parameters || parsed.arguments || {},
        });
      }
    } catch {
      // Continue to next match
    }
  }

  // 2. Fallback: match inline JSON object if markdown block was omitted
  if (toolCalls.length === 0) {
    const inlineJsonRegex = /\{\s*"tool"\s*:\s*"([a-zA-Z0-9_]+)"\s*,\s*"args"\s*:\s*(\{[\s\S]*?\})\s*\}/g;
    while ((match = inlineJsonRegex.exec(text)) !== null) {
      try {
        const toolName = match[1];
        const args = JSON.parse(match[2]);
        toolCalls.push({ tool: toolName, args });
      } catch {
        // Ignore
      }
    }
  }

  return toolCalls;
}

// Clean response text by removing tool_call blocks for neat presentation to user
export function cleanResponseText(text: string): string {
  return text
    .replace(/```(?:tool_call|json:tool_call|tool)\s*[\s\S]*?```/gi, '')
    .trim();
}

// Execute a Workspace tool strictly inside the bound Workspace
export async function executeWorkspaceTool(
  toolName: string,
  args: Record<string, any>,
  workspace: Workspace
): Promise<{
  result: any;
  updatedWorkspace: Workspace;
  diff?: { path: string; oldContent?: string; newContent?: string };
  errorMessage?: string;
  stepIcon: ThinkingStep['icon'];
  stepTitle: string;
}> {
  let ws = { ...workspace, files: { ...workspace.files } };

  switch (toolName) {
    case 'list_files': {
      const prefix = args.path_prefix ? args.path_prefix.replace(/^\/+/, '').trim() : '';
      const list = Object.keys(ws.files)
        .filter(p => !prefix || p.startsWith(prefix))
        .sort()
        .map(p => ({ path: p, size: ws.files[p].size, isBinary: ws.files[p].isBinary }));

      return {
        result: { total: list.length, files: list },
        updatedWorkspace: ws,
        stepIcon: 'github',
        stepTitle: `审查工作区目录（共 ${list.length} 个文件）`,
      };
    }

    case 'get_workspace_tree': {
      const tree = getWorkspaceDirectoryTree(ws);
      return {
        result: { tree },
        updatedWorkspace: ws,
        stepIcon: 'github',
        stepTitle: `获取工作区文件树（${Object.keys(ws.files).length} 个文件）`,
      };
    }

    case 'read_file': {
      const pathVal = validateSafeRelativePath(args.path || '');
      if (!pathVal.valid) {
        return {
          result: null,
          updatedWorkspace: ws,
          errorMessage: pathVal.error,
          stepIcon: 'file',
          stepTitle: `读取文件拒绝: ${pathVal.error}`,
        };
      }

      const file = ws.files[pathVal.normalizedPath];
      if (!file) {
        return {
          result: null,
          updatedWorkspace: ws,
          errorMessage: `未找到文件: "${pathVal.normalizedPath}"`,
          stepIcon: 'file',
          stepTitle: `尝试读取文件: ${pathVal.normalizedPath} (未找到)`,
        };
      }

      if (file.isBinary) {
        return {
          result: { path: file.path, isBinary: true, message: '该文件为二进制文件，无法作为文本读取' },
          updatedWorkspace: ws,
          stepIcon: 'file',
          stepTitle: `读取文件: ${file.path} (二进制)`,
        };
      }

      let content = file.content;
      if (args.start_line || args.end_line) {
        const lines = content.split('\n');
        const start = Math.max(1, args.start_line || 1);
        const end = Math.min(lines.length, args.end_line || lines.length);
        content = lines.slice(start - 1, end).join('\n');
      }

      return {
        result: { path: file.path, size: file.size, content },
        updatedWorkspace: ws,
        stepIcon: 'code',
        stepTitle: `读取工作区文件: ${file.path}`,
      };
    }

    case 'search_files': {
      const query = String(args.query || '').toLowerCase();
      const matched = Object.keys(ws.files)
        .filter(p => p.toLowerCase().includes(query))
        .sort();

      return {
        result: { query, matchedCount: matched.length, files: matched },
        updatedWorkspace: ws,
        stepIcon: 'search',
        stepTitle: `搜索文件名: "${query}" (匹配 ${matched.length} 个)`,
      };
    }

    case 'search_code': {
      const query = String(args.query || '');
      const matches = searchWorkspaceCode(ws, query);
      return {
        result: { query, matchCount: matches.length, matches },
        updatedWorkspace: ws,
        stepIcon: 'search',
        stepTitle: `搜索代码库: "${query}" (匹配 ${matches.length} 处)`,
      };
    }

    case 'patch_file': {
      const pathVal = validateSafeRelativePath(args.path || '');
      if (!pathVal.valid) {
        return {
          result: null,
          updatedWorkspace: ws,
          errorMessage: pathVal.error,
          stepIcon: 'code',
          stepTitle: `路径拒绝: ${pathVal.error}`,
        };
      }

      const filePath = pathVal.normalizedPath;
      const file = ws.files[filePath];
      if (!file) {
        return {
          result: null,
          updatedWorkspace: ws,
          errorMessage: `修改失败: 找不到文件 "${filePath}"`,
          stepIcon: 'code',
          stepTitle: `修改文件失败: 找不到 ${filePath}`,
        };
      }

      const original = file.content;
      const target = String(args.target_content || '');
      const replacement = String(args.replacement_content || '');

      if (!original.includes(target)) {
        // Fallback for line-ending normalization
        const normOriginal = original.replace(/\r\n/g, '\n');
        const normTarget = target.replace(/\r\n/g, '\n');
        if (normOriginal.includes(normTarget)) {
          const idx = normOriginal.indexOf(normTarget);
          const newContent = normOriginal.slice(0, idx) + replacement + normOriginal.slice(idx + normTarget.length);
          ws.files[filePath] = {
            ...file,
            content: newContent,
            size: newContent.length,
            updatedAt: Date.now(),
          };
          return {
            result: { success: true, path: filePath },
            updatedWorkspace: ws,
            diff: { path: filePath, oldContent: target, newContent: replacement },
            stepIcon: 'code',
            stepTitle: `修改文件 (Patch): ${filePath}`,
          };
        }

        return {
          result: null,
          updatedWorkspace: ws,
          errorMessage: `局部匹配失败: 在目标文件中未找到指定的精确代码块`,
          stepIcon: 'code',
          stepTitle: `精确修改 ${filePath} 匹配失败`,
        };
      }

      const idx = original.indexOf(target);
      const newContent = original.slice(0, idx) + replacement + original.slice(idx + target.length);
      ws.files[filePath] = {
        ...file,
        content: newContent,
        size: newContent.length,
        updatedAt: Date.now(),
      };

      return {
        result: { success: true, path: filePath },
        updatedWorkspace: ws,
        diff: { path: filePath, oldContent: target, newContent: replacement },
        stepIcon: 'code',
        stepTitle: `修改文件 (Patch): ${filePath}`,
      };
    }

    case 'write_file': {
      const pathVal = validateSafeRelativePath(args.path || '');
      if (!pathVal.valid) {
        return {
          result: null,
          updatedWorkspace: ws,
          errorMessage: pathVal.error,
          stepIcon: 'code',
          stepTitle: `路径拒绝: ${pathVal.error}`,
        };
      }

      const filePath = pathVal.normalizedPath;
      const newContent = String(args.content || '');
      const existing = ws.files[filePath];
      const oldContent = existing ? existing.content : undefined;

      ws.files[filePath] = {
        path: filePath,
        content: newContent,
        isBinary: false,
        size: newContent.length,
        updatedAt: Date.now(),
      };

      return {
        result: { success: true, path: filePath, size: newContent.length },
        updatedWorkspace: ws,
        diff: { path: filePath, oldContent, newContent },
        stepIcon: 'code',
        stepTitle: existing ? `覆盖修改文件: ${filePath}` : `新建写入文件: ${filePath}`,
      };
    }

    case 'create_file': {
      const pathVal = validateSafeRelativePath(args.path || '');
      if (!pathVal.valid) {
        return {
          result: null,
          updatedWorkspace: ws,
          errorMessage: pathVal.error,
          stepIcon: 'code',
          stepTitle: `创建路径拒绝: ${pathVal.error}`,
        };
      }

      const filePath = pathVal.normalizedPath;
      const initialContent = String(args.content || '');

      ws.files[filePath] = {
        path: filePath,
        content: initialContent,
        isBinary: false,
        size: initialContent.length,
        updatedAt: Date.now(),
      };

      return {
        result: { success: true, path: filePath },
        updatedWorkspace: ws,
        diff: { path: filePath, newContent: initialContent },
        stepIcon: 'code',
        stepTitle: `创建文件: ${filePath}`,
      };
    }

    case 'delete_file': {
      const pathVal = validateSafeRelativePath(args.path || '');
      if (!pathVal.valid) {
        return {
          result: null,
          updatedWorkspace: ws,
          errorMessage: pathVal.error,
          stepIcon: 'code',
          stepTitle: `删除路径拒绝: ${pathVal.error}`,
        };
      }

      const filePath = pathVal.normalizedPath;
      const existing = ws.files[filePath];
      if (existing) {
        delete ws.files[filePath];
      }

      return {
        result: { success: !!existing, path: filePath },
        updatedWorkspace: ws,
        diff: existing ? { path: filePath, oldContent: existing.content } : undefined,
        stepIcon: 'code',
        stepTitle: existing ? `删除工作区文件: ${filePath}` : `尝试删除不存在的文件: ${filePath}`,
      };
    }

    case 'rename_file': {
      const oldVal = validateSafeRelativePath(args.old_path || '');
      const newVal = validateSafeRelativePath(args.new_path || '');
      if (!oldVal.valid || !newVal.valid) {
        const err = oldVal.error || newVal.error;
        return {
          result: null,
          updatedWorkspace: ws,
          errorMessage: err,
          stepIcon: 'code',
          stepTitle: `重命名路径拒绝: ${err}`,
        };
      }

      const oldF = ws.files[oldVal.normalizedPath];
      if (!oldF) {
        return {
          result: null,
          updatedWorkspace: ws,
          errorMessage: `找不到原文件: "${oldVal.normalizedPath}"`,
          stepIcon: 'code',
          stepTitle: `重命名失败: 找不到 ${oldVal.normalizedPath}`,
        };
      }

      delete ws.files[oldVal.normalizedPath];
      ws.files[newVal.normalizedPath] = {
        ...oldF,
        path: newVal.normalizedPath,
        updatedAt: Date.now(),
      };

      return {
        result: { success: true, from: oldVal.normalizedPath, to: newVal.normalizedPath },
        updatedWorkspace: ws,
        stepIcon: 'code',
        stepTitle: `重命名文件: ${oldVal.normalizedPath} -> ${newVal.normalizedPath}`,
      };
    }

    case 'get_file_diff': {
      const pathVal = validateSafeRelativePath(args.path || '');
      const filePath = pathVal.normalizedPath;
      const originalFile = ws.originalSnapshot.files[filePath];
      const currentFile = ws.files[filePath];

      return {
        result: {
          path: filePath,
          originalExists: !!originalFile,
          currentExists: !!currentFile,
          isModified: originalFile?.content !== currentFile?.content,
          originalContentSample: originalFile?.content?.slice(0, 1000),
          currentContentSample: currentFile?.content?.slice(0, 1000),
        },
        updatedWorkspace: ws,
        stepIcon: 'code',
        stepTitle: `查阅文件改动对比: ${filePath}`,
      };
    }

    case 'get_workspace_diff': {
      const diffs = computeDiffBetweenFileSnapshots(ws.originalSnapshot.files, ws.files);
      return {
        result: {
          totalModified: diffs.length,
          modifiedList: diffs.map(d => ({ path: d.path, type: d.type })),
        },
        updatedWorkspace: ws,
        stepIcon: 'code',
        stepTitle: `检查工作区整体改动差异 (${diffs.length} 个文件变动)`,
      };
    }

    default:
      return {
        result: null,
        updatedWorkspace: ws,
        errorMessage: `未知工具名称: ${toolName}`,
        stepIcon: 'github',
        stepTitle: `尝试调用未知工具: ${toolName}`,
      };
  }
}
