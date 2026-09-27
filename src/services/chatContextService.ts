import { ChatContext, Message } from '../types';

// Initialize a clean, independent ChatContext for a single chat
export function createDefaultChatContext(): ChatContext {
  return {
    userRequirements: [],
    importantDecisions: [],
    recentChanges: [],
    lastModifiedFiles: [],
  };
}

// Build string representation of the current Chat's private context
export function formatChatContextPrompt(context?: ChatContext): string {
  if (!context) return '';

  const sections: string[] = [];

  if (context.currentTask) {
    sections.push(`### 当前会话进行中任务:\n${context.currentTask}`);
  }

  if (context.userRequirements && context.userRequirements.length > 0) {
    sections.push(`### 本会话用户核心要求:\n${context.userRequirements.map(r => `- ${r}`).join('\n')}`);
  }

  if (context.importantDecisions && context.importantDecisions.length > 0) {
    sections.push(`### 本会话关键决策与约定:\n${context.importantDecisions.map(d => `- ${d}`).join('\n')}`);
  }

  if (context.lastModifiedFiles && context.lastModifiedFiles.length > 0) {
    sections.push(`### 本会话最近涉及与修改的文件:\n${context.lastModifiedFiles.map(f => `- ${f}`).join('\n')}`);
  }

  if (sections.length === 0) return '';

  return `\n## 当前单聊会话专属上下文 (Chat Private Memory):\n${sections.join('\n\n')}\n`;
}

// Update the current Chat's context after an interaction turn
export function updateChatContext(
  prevContext: ChatContext | undefined,
  userText: string,
  _aiResponseText: string,
  modifiedFiles: string[] = []
): ChatContext {
  const ctx: ChatContext = prevContext ? { ...prevContext } : createDefaultChatContext();

  // If user prompt sets or refines requirements
  if (userText.trim().length > 0 && userText.length < 180) {
    // Keep up to 6 key requirements
    const trimmed = userText.trim();
    if (!ctx.userRequirements.includes(trimmed)) {
      ctx.userRequirements = [...ctx.userRequirements.slice(-5), trimmed];
    }
  }

  // Update current task
  ctx.currentTask = userText.slice(0, 100);

  // Update modified files in this chat
  if (modifiedFiles.length > 0) {
    const combined = Array.from(new Set([...ctx.lastModifiedFiles, ...modifiedFiles]));
    ctx.lastModifiedFiles = combined.slice(-15);
  }

  return ctx;
}

// Compact older messages within the SAME chat to avoid token overflow
export function prepareChatHistoryWithLocalCompaction(
  messages: Message[],
  maxRecentCount = 12
): { compactedSummary?: string; effectiveMessages: Message[] } {
  if (messages.length <= maxRecentCount) {
    return { effectiveMessages: messages };
  }

  // Split into older messages to summarize and recent messages to keep intact
  const olderMessages = messages.slice(0, messages.length - maxRecentCount);
  const recentMessages = messages.slice(messages.length - maxRecentCount);

  // Extract older user requests & touched files for this single chat
  const olderTopics = olderMessages
    .filter(m => m.role === 'user')
    .map(m => m.content.slice(0, 60))
    .slice(-4);

  const olderModified = Array.from(
    new Set(
      olderMessages
        .filter(m => m.modifiedFiles && m.modifiedFiles.length > 0)
        .flatMap(m => m.modifiedFiles!)
    )
  );

  const compactedSummary = `[本会话前期历史压缩摘要]\n- 讨论过的问题与任务: ${olderTopics.join('； ') || '无'}\n- 曾修改的文件: ${olderModified.join(', ') || '无'}`;

  return {
    compactedSummary,
    effectiveMessages: recentMessages,
  };
}
