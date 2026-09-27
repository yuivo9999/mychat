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
  id: string; // e.g. "gpt-4o", "gemini-2.5-flash", "claude-3-5-sonnet-20241022"
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
}

export interface ModelParameters {
  enableReasoning?: boolean; // 深度推理 (Reasoning)
  stream?: boolean; // 流式传输 (Stream)
  maxTokens?: number; // 最大 Token 数 (Max Tokens)
  temperature?: number; // 温度 / 随机性 (Temperature)
  topP?: number; // 核采样 (Top P)
  frequencyPenalty?: number; // 频率惩罚 (Frequency Penalty)
  presencePenalty?: number; // 存在惩罚 (Presence Penalty)
  stop?: string; // 停止词 (Stop)
  seed?: number; // 随机种子 (Seed)
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
  category?: string;
  systemPrompt?: string;
  parameters?: ModelParameters;
  messages: Message[];
}

export interface UserSettings {
  theme: 'light' | 'dark' | 'system';
  fontSize: 'compact' | 'standard' | 'spacious';
  enterToSend: boolean;
  autoScroll: boolean;
  showTimestamps: boolean;
  showModelName: boolean;
  enableStreaming: boolean;
  enableMarkdown: boolean;
  enableCodeHighlight: boolean;
  defaultProviderId: string;
  defaultModelId: string;
  defaultSystemPrompt: string;
  requestTimeout: number; // in seconds
  corsProxyUrl?: string;
  sidebarOpen: boolean;
}

export type ConnectionStatus = 'unconfigured' | 'configured' | 'requesting' | 'success' | 'error';
