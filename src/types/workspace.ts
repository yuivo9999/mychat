export interface WorkspaceFile {
  id: string;
  path: string; // e.g. "src/index.ts", "package.json"
  content: string;
  language?: string;
  size: number;
  updatedAt: number;
  isModifiedByAgent?: boolean;
  originalContent?: string; // Content before agent modification
}

export type MemoryCategory = 'architecture' | 'decision' | 'guideline' | 'history' | 'note';

export interface ProjectMemoryItem {
  id: string;
  key: string; // e.g. "tech_stack", "auth_flow", "database_schema"
  title: string;
  content: string;
  category: MemoryCategory;
  updatedAt: number;
  source?: 'user' | 'agent';
}

export interface ToolCallExecution {
  id: string;
  toolName: string;
  args: Record<string, any>;
  result?: any;
  status: 'running' | 'success' | 'error';
  errorMessage?: string;
  diff?: {
    path: string;
    oldContent?: string;
    newContent?: string;
  };
  timestamp: number;
}

export interface AgentExecutionState {
  isAgentRunning: boolean;
  currentTurn: number;
  maxTurns: number;
  statusText: string;
  toolCalls: ToolCallExecution[];
}
