import { 
  WorkspaceFile, 
  ProjectMemoryItem, 
  ToolCallExecution, 
  ThinkingStep 
} from '../types';
import { 
  searchWorkspaceFiles, 
  applyEditToFile, 
  normalizePath, 
  getLanguageFromPath 
} from './workspace';
import { performWebSearch, buildWebSearchContext } from './webSearch';

// Define Tool Definition Schemas for Prompts & Function Calling
export const WORKSPACE_TOOLS_SPEC = [
  {
    name: 'list_files',
    description: '列出工作区中的所有文件和目录列表及大致大小',
    parameters: {
      type: 'object',
      properties: {
        path_prefix: { type: 'string', description: '可选，路径前缀过滤，如 "src/"' },
      },
    },
  },
  {
    name: 'read_file',
    description: '读取工作区中某个具体文件的文本内容',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '工作区中文件的相对路径，如 "src/App.tsx"' },
        start_line: { type: 'number', description: '可选，起始行号 (1-indexed)' },
        end_line: { type: 'number', description: '可选，结束行号' },
      },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    description: '创建新文件或完全覆盖写入文件内容到工作区',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '目标文件相对路径，如 "src/components/Header.tsx"' },
        content: { type: 'string', description: '要写入的完整文件内容' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'edit_file',
    description: '精确局部替换工作区文件中的某一段文本或代码块',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '目标文件路径' },
        target_content: { type: 'string', description: '原文件中必须完全精确匹配的既有代码块' },
        replacement_content: { type: 'string', description: '替换后的新代码块' },
      },
      required: ['path', 'target_content', 'replacement_content'],
    },
  },
  {
    name: 'search_files',
    description: '在工作区全部代码文件中全文搜索关键词、函数名或文本',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '搜索关键词，如 "handleLogin" 或 "db.ts"' },
      },
      required: ['query'],
    },
  },
  {
    name: 'delete_file',
    description: '从工作区中删除一个文件',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '要删除的文件路径' },
      },
      required: ['path'],
    },
  },
  {
    name: 'update_memory',
    description: '记录或更新项目长期记忆（如架构决策、关键逻辑约定、数据库表结构或重要规约）',
    parameters: {
      type: 'object',
      properties: {
        key: { type: 'string', description: '记忆唯一标识键，如 "auth_pattern" 或 "state_management"' },
        title: { type: 'string', description: '简短标题' },
        content: { type: 'string', description: '详细记忆内容' },
        category: { 
          type: 'string', 
          enum: ['architecture', 'decision', 'guideline', 'history', 'note'], 
          description: '记忆分类' 
        },
      },
      required: ['key', 'title', 'content'],
    },
  },
  {
    name: 'web_search',
    description: '进行联网实时搜索外部权威技术文档、库用法或最新资料',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '联网搜索查询词' },
      },
      required: ['query'],
    },
  },
];

// Build System Prompt containing workspace summary, project memory and tool call format
export function buildAgentSystemPrompt(
  workspaceFiles: WorkspaceFile[],
  projectMemories: ProjectMemoryItem[],
  customSystemPrompt?: string
): string {
  const fileListText = workspaceFiles.length === 0
    ? '（当前工作区暂无文件）'
    : workspaceFiles
        .map(f => `- ${f.path} (${Math.round(f.size / 1024 * 10) / 10} KB, ${f.language || 'text'})`)
        .join('\n');

  const memoryText = projectMemories.length === 0
    ? '（暂无专门项目记忆）'
    : projectMemories
        .map(m => `### [${m.category.toUpperCase()}] ${m.title} (${m.key})\n${m.content}`)
        .join('\n\n');

  return `${customSystemPrompt || '你是一个资深全栈工程师与自主执行 Agent。'}

你拥有对当前项目工作区（Workspace）直接阅读、搜索、修改代码以及沉淀项目记忆的全部工具权限。

## 当前工作区文件概览 (${workspaceFiles.length} 个文件):
${fileListText}

## 项目长期记忆 (Project Memory):
${memoryText}

## 你的工作流程与能力:
用户提出任务后，请遵循自主 Agent 执行循环：
1. **分析任务**：仔细审查用户意图与工作区上下文。
2. **主动调用工具探索**：如需了解代码细节，调用 \`read_file\` 或 \`search_files\` 查阅关键文件。
3. **精准修改与验证**：使用 \`edit_file\` 进行局部精准修改，或使用 \`write_file\` 创建新文件/全量重写。修改时务必保证代码完整、优雅、无语法错误。
4. **沉淀项目记忆**：如果做出了重要的架构变更、新增了规范或核心逻辑，调用 \`update_memory\` 将决策记录到项目记忆库中。
5. **任务完成**：当所有文件修改完毕后，总结修改了哪些文件、做了哪些改进，并告知用户可直接重新打包下载。

## 工具调用格式（Tool Calling Protocol）:
当你决定调用工具时，请直接输出形如下方的标准 JSON 工具调用代码块（可以一次输出一个或多个工具调用）：
\`\`\`tool_call
{
  "tool": "read_file",
  "args": {
    "path": "src/App.tsx"
  }
}
\`\`\`
或
\`\`\`tool_call
{
  "tool": "edit_file",
  "args": {
    "path": "src/router.ts",
    "target_content": "const routes = [];",
    "replacement_content": "const routes = [{ path: '/', component: Home }];"
  }
}
\`\`\`
可调用的工具包括：
- list_files({ path_prefix? })
- read_file({ path, start_line?, end_line? })
- write_file({ path, content })
- edit_file({ path, target_content, replacement_content })
- search_files({ query })
- delete_file({ path })
- update_memory({ key, title, content, category? })
- web_search({ query })

如果已经完成所有工具调用，不需要再调用工具，请直接用清晰、得体的中文向用户汇报结果！`;
}

// Extract tool calls from AI response string (supports ```tool_call ... ``` or JSON object blocks)
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

  // 2. Fallback: match inline JSON object if tool_call block was not formatted with markdown
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

// Execute a single tool call against local Workspace and Memory state
export async function executeWorkspaceTool(
  toolName: string,
  args: Record<string, any>,
  workspaceFiles: WorkspaceFile[],
  projectMemories: ProjectMemoryItem[]
): Promise<{
  result: any;
  updatedFiles: WorkspaceFile[];
  updatedMemories: ProjectMemoryItem[];
  diff?: { path: string; oldContent?: string; newContent?: string };
  errorMessage?: string;
  stepIcon?: ThinkingStep['icon'];
  stepTitle: string;
}> {
  let updatedFiles = [...workspaceFiles];
  let updatedMemories = [...projectMemories];

  switch (toolName) {
    case 'list_files': {
      const prefix = args.path_prefix ? normalizePath(args.path_prefix) : '';
      const filtered = updatedFiles
        .filter(f => !prefix || f.path.startsWith(prefix))
        .map(f => ({ path: f.path, sizeBytes: f.size, language: f.language }));
      return {
        result: { totalFiles: filtered.length, files: filtered },
        updatedFiles,
        updatedMemories,
        stepIcon: 'github',
        stepTitle: `审查工作区目录（共 ${filtered.length} 个文件）`,
      };
    }

    case 'read_file': {
      const targetPath = normalizePath(args.path || '');
      const file = updatedFiles.find(f => f.path.toLowerCase() === targetPath.toLowerCase());
      if (!file) {
        return {
          result: null,
          updatedFiles,
          updatedMemories,
          errorMessage: `未找到文件: "${args.path}"`,
          stepIcon: 'file',
          stepTitle: `尝试读取文件: ${args.path} (未找到)`,
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
        result: {
          path: file.path,
          size: file.size,
          content,
        },
        updatedFiles,
        updatedMemories,
        stepIcon: 'code',
        stepTitle: `读取工作区文件: ${file.path}`,
      };
    }

    case 'search_files': {
      const query = String(args.query || '');
      const searchRes = searchWorkspaceFiles(updatedFiles, query);
      const matchCount = searchRes.reduce((acc, cur) => acc + cur.matches.length, 0);
      return {
        result: { query, matchedFiles: searchRes.length, matches: searchRes },
        updatedFiles,
        updatedMemories,
        stepIcon: 'search',
        stepTitle: `搜索代码库: "${query}"（匹配 ${searchRes.length} 个文件）`,
      };
    }

    case 'write_file': {
      const targetPath = normalizePath(args.path || '');
      const newContent = String(args.content || '');
      const existingIdx = updatedFiles.findIndex(f => f.path.toLowerCase() === targetPath.toLowerCase());
      let oldContent: string | undefined;

      if (existingIdx >= 0) {
        oldContent = updatedFiles[existingIdx].content;
        updatedFiles[existingIdx] = {
          ...updatedFiles[existingIdx],
          content: newContent,
          size: newContent.length,
          updatedAt: Date.now(),
          isModifiedByAgent: true,
          originalContent: updatedFiles[existingIdx].originalContent || oldContent,
        };
      } else {
        updatedFiles.push({
          id: `file_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          path: targetPath,
          content: newContent,
          language: getLanguageFromPath(targetPath),
          size: newContent.length,
          updatedAt: Date.now(),
          isModifiedByAgent: true,
        });
      }

      return {
        result: { success: true, path: targetPath, size: newContent.length },
        updatedFiles,
        updatedMemories,
        diff: { path: targetPath, oldContent, newContent },
        stepIcon: 'code',
        stepTitle: existingIdx >= 0 ? `覆盖修改文件: ${targetPath}` : `新建文件: ${targetPath}`,
      };
    }

    case 'edit_file': {
      const targetPath = normalizePath(args.path || '');
      const fileIndex = updatedFiles.findIndex(f => f.path.toLowerCase() === targetPath.toLowerCase());
      if (fileIndex === -1) {
        return {
          result: null,
          updatedFiles,
          updatedMemories,
          errorMessage: `修改失败: 找不到文件 "${args.path}"`,
          stepIcon: 'code',
          stepTitle: `修改文件失败: 找不到 ${args.path}`,
        };
      }

      const file = updatedFiles[fileIndex];
      const editResult = applyEditToFile(file.content, args.target_content, args.replacement_content);

      if (!editResult.success) {
        return {
          result: null,
          updatedFiles,
          updatedMemories,
          errorMessage: editResult.error,
          stepIcon: 'code',
          stepTitle: `精确修改 ${file.path} 匹配失败`,
        };
      }

      const oldContent = file.content;
      updatedFiles[fileIndex] = {
        ...file,
        content: editResult.newContent,
        size: editResult.newContent.length,
        updatedAt: Date.now(),
        isModifiedByAgent: true,
        originalContent: file.originalContent || oldContent,
      };

      return {
        result: { success: true, path: file.path },
        updatedFiles,
        updatedMemories,
        diff: { path: file.path, oldContent, newContent: editResult.newContent },
        stepIcon: 'code',
        stepTitle: `修改文件: ${file.path}`,
      };
    }

    case 'delete_file': {
      const targetPath = normalizePath(args.path || '');
      const countBefore = updatedFiles.length;
      updatedFiles = updatedFiles.filter(f => f.path.toLowerCase() !== targetPath.toLowerCase());
      const deleted = updatedFiles.length < countBefore;

      return {
        result: { success: deleted, path: targetPath },
        updatedFiles,
        updatedMemories,
        stepIcon: 'code',
        stepTitle: deleted ? `删除工作区文件: ${targetPath}` : `尝试删除不存在的文件: ${targetPath}`,
      };
    }

    case 'update_memory': {
      const key = String(args.key || `mem_${Date.now()}`);
      const title = String(args.title || key);
      const content = String(args.content || '');
      const category = (args.category || 'note') as ProjectMemoryItem['category'];

      const existingIdx = updatedMemories.findIndex(m => m.key === key);
      if (existingIdx >= 0) {
        updatedMemories[existingIdx] = {
          ...updatedMemories[existingIdx],
          title,
          content,
          category,
          updatedAt: Date.now(),
          source: 'agent',
        };
      } else {
        updatedMemories.push({
          id: `mem_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          key,
          title,
          content,
          category,
          updatedAt: Date.now(),
          source: 'agent',
        });
      }

      return {
        result: { success: true, key, title },
        updatedFiles,
        updatedMemories,
        stepIcon: 'brain',
        stepTitle: `记录项目记忆: ${title} (${key})`,
      };
    }

    case 'web_search': {
      const query = String(args.query || '');
      const searchRes = await performWebSearch(query);
      const snippetContext = buildWebSearchContext(searchRes);
      return {
        result: {
          query,
          resultsCount: searchRes.results.length,
          context: snippetContext,
        },
        updatedFiles,
        updatedMemories,
        stepIcon: 'lightning',
        stepTitle: `已搜索 ${searchRes.results.length} 个网站: "${query}"`,
      };
    }

    default:
      return {
        result: null,
        updatedFiles,
        updatedMemories,
        errorMessage: `未知工具名称: ${toolName}`,
        stepIcon: 'github',
        stepTitle: `尝试调用未知工具: ${toolName}`,
      };
  }
}
