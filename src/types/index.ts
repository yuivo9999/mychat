export type Role = 'user' | 'assistant' | 'system';

export type ProviderType = 
  | 'openai'
  | 'gemini'
  | 'deepseek'
  | 'moonshot'
  | 'qwen'
  | 'zhipu'
  | 'siliconflow'
  | 'openrouter'
  | 'nvidia'
  | 'custom';

export interface ProviderDefinition {
  id: ProviderType | string;
  name: string;
  description: string;
  icon: string;
  defaultBaseUrl: string;
  isCustom?: boolean;
  enabled: boolean;
}

export interface ApiKeyConfig {
  id: string;
  providerId: string;
  label: string;
  apiKey: string;
  baseUrl?: string;
  isDefault?: boolean;
  createdAt: number;
}

export interface ModelItem {
  id: string; // Unique storage ID, e.g. "openai::gpt-4o" or "gemini-3.8-flash"
  rawModelId?: string; // The raw model ID sent to the provider API, e.g. "gpt-4o"
  name: string;
  providerId: string;
  description?: string;
  supportsVision: boolean;
  supportsFiles: boolean;
  supportsStreaming: boolean;
  contextWindow?: number;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  systemPrompt?: string;
  customHeaders?: Record<string, string>;
  isCustom?: boolean;
}

export interface Attachment {
  id: string;
  name: string;
  size: number;
  type: string;
  dataUrl?: string; // For images & preview
  extractedText?: string; // For text/code/document files
  base64Data?: string; // Raw base64 if needed
}

export interface MessageVersion {
  content: string;
  timestamp: number;
  model?: string;
}

export * from './workspace';
import { WorkspaceFile, Workspace, WorkspaceSnapshot, FileDiffItem, ChatContext, ToolCallExecution } from './workspace';

export interface WebSearchResultItem {
  title: string;
  url: string;
  snippet: string;
}

export interface ThinkingStep {
  id: string;
  icon?: 'github' | 'lightning' | 'search' | 'code' | 'database' | 'brain' | 'file';
  title: string;
  status: 'pending' | 'running' | 'completed';
  timestamp?: number;
}

export interface Message {
  id: string;
  role: Role;
  content: string;
  timestamp: number;
  model?: string;
  providerId?: string;
  attachments?: Attachment[];
  status?: 'sending' | 'streaming' | 'completed' | 'error';
  errorMessage?: string;
  versions?: MessageVersion[];
  currentVersionIndex?: number;
  webSearchResults?: WebSearchResultItem[];
  thinkingSteps?: ThinkingStep[];
  toolCalls?: ToolCallExecution[];
  modifiedFiles?: string[];
}

export interface ModelParameters {
  enableReasoning?: boolean; // 深度推理 (Reasoning)
  stream?: boolean; // 流式传输 (Stream)
  limitMaxTokens?: boolean; // 是否限制最大 Token 数限制
  maxTokens?: number; // 最大 Token 数 (Max Tokens)
  temperature?: number; // 温度 / 随机性 (Temperature)
  topP?: number; // 核采样 (Top P)
  frequencyPenalty?: number; // 频率惩罚 (Frequency Penalty)
  presencePenalty?: number; // 存在惩罚 (Presence Penalty)
  stop?: string; // 停止词 (Stop)
  seed?: number; // 随机种子 (Seed)
}

export type ProjectMemoryMode = 'default' | 'isolated';

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  memoryMode: ProjectMemoryMode; // 'default': 访问外部聊天记忆，反之亦然; 'isolated': 仅限项目记忆
  description?: string;
  customInstructions?: string; // 自定义指令
  sharedMemory?: {
    summary?: string;
    keyPoints?: string[];
  };
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  modelId: string;
  providerId: string;
  apiKeyId?: string;
  isFavorite?: boolean;
  isPinned?: boolean; // 置顶聊天
  projectId?: string; // 归档所属项目 ID（若已归档至某项目，存此 ID；未归档或已离档则为空）
  category?: string;
  systemPrompt?: string;
  parameters?: ModelParameters;
  webAccessEnabled?: boolean;
  agentMode?: boolean; // 启用 Agent 自动化工作区模式
  workspaceId?: string; // 关联绑定的工作区 ID (Chat A 和 Chat B 可绑定同一工作区，但聊天记忆严格隔离)
  chatContext?: ChatContext; // 当前 Chat 独占的会话上下文记忆（工作笔记、任务状态、需求，不与其它 Chat 共享）
  messages: Message[];
}

export interface UserSettings {
  theme: 'light' | 'dark' | 'system' | 'classic1' | 'classic2' | 'modern1' | 'sangtian-shanhe' | string;
  fontSize: 'compact' | 'standard' | 'spacious';
  enterToSend: boolean;
  autoScroll: boolean;
  showTimestamps: boolean;
  showModelName: boolean;
  enableStreaming: boolean;
  enableMarkdown: boolean;
  enableCodeHighlight: boolean;
  // 5 Features for AI Reply Presentation & Reading
  renderLatex?: boolean; // 🧮 LaTeX 数学与科学公式渲染
  showLineNumbers?: boolean; // 🔢 代码块显示行号
  collapseLongCode?: boolean; // 📱 长代码块自动限制高度 / 折叠
  showStreamingCursor?: boolean; // ▋ 流式输出呼吸光标动画
  compactMode?: boolean; // 🔍 紧凑排版模式
  boldHeadings?: boolean; // #️⃣ 加粗标题：加粗纯文本里的结构化标题（#，## 等）
  enableChatContextMemory?: boolean; // 🧠 启用单聊专属上下文记忆
  defaultProviderId: string;
  defaultModelId: string;
  defaultSystemPrompt: string;
  requestTimeout: number; // in seconds
  corsProxyUrl?: string;
  sidebarOpen: boolean;
}

export type ConnectionStatus = 'unconfigured' | 'configured' | 'requesting' | 'success' | 'error';
