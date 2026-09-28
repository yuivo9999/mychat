import { Project, Conversation } from '../types';

/**
 * Format the shared Project Memory prompt for inclusion in the model's system prompt.
 * Multiple chat windows inside the same project share this collective memory.
 */
export function formatProjectMemoryPrompt(
  project: Project,
  projectConversations: Conversation[],
  currentConvId?: string
): string {
  const sections: string[] = [];

  // 1. Basic Project Identity & Mode
  sections.push(
    `### 所属项目: 【${project.name}】\n` +
    `- **记忆隔离模式**: ${
      project.memoryMode === 'isolated' 
        ? '仅限项目记忆 (此项目只能访问自己的记忆，记忆对外部独立聊天不可见)' 
        : '默认记忆 (此项目与常规聊天记忆互通)'
    }\n` +
    `- **项目内会话总数**: ${projectConversations.length} 个协同聊天窗口`
  );

  // 2. Custom Project Instructions (if specified)
  if (project.customInstructions?.trim()) {
    sections.push(`### 项目全局自定义指令:\n${project.customInstructions.trim()}`);
  }

  // 3. Project Shared Summary / Memory Points
  if (project.sharedMemory?.summary?.trim()) {
    sections.push(`### 项目共享背景与全局共识:\n${project.sharedMemory.summary.trim()}`);
  }

  if (project.sharedMemory?.keyPoints && project.sharedMemory.keyPoints.length > 0) {
    sections.push(
      `### 项目核心关键约定与决策点:\n` +
      project.sharedMemory.keyPoints.map(kp => `- ${kp}`).join('\n')
    );
  }

  // 4. Summaries of other conversations in this same project (Collective project knowledge)
  const peerConversations = projectConversations.filter(c => c.id !== currentConvId);
  const peerSummaries: string[] = [];

  for (const peer of peerConversations) {
    const chatTitle = peer.title || '无标题会话';
    const reqs = peer.chatContext?.userRequirements || [];
    const decisions = peer.chatContext?.importantDecisions || [];
    const task = peer.chatContext?.currentTask;

    if (task || reqs.length > 0 || decisions.length > 0) {
      const details: string[] = [];
      if (task) details.push(`最近议题: ${task}`);
      if (reqs.length > 0) details.push(`要点: ${reqs.slice(-2).join('; ')}`);
      if (decisions.length > 0) details.push(`结论: ${decisions.slice(-2).join('; ')}`);
      peerSummaries.push(`- **会话「${chatTitle}」**: ${details.join(' | ')}`);
    }
  }

  if (peerSummaries.length > 0) {
    sections.push(
      `### 项目内同组其它聊天窗口共享记忆:\n` +
      peerSummaries.join('\n') +
      `\n*(提示: 你可以无缝参考同项目其它聊天窗口已确认的信息与共识。)*`
    );
  }

  if (sections.length === 0) return '';

  return (
    `\n========================================\n` +
    `## 项目共享记忆库 (Project Shared Memory)\n` +
    `========================================\n` +
    sections.join('\n\n') +
    `\n========================================\n`
  );
}

/**
 * Extract / update collective project memory from conversations inside the project
 */
export function updateProjectCollectiveMemory(
  project: Project,
  projectConversations: Conversation[]
): Project {
  const allDecisions = new Set<string>(project.sharedMemory?.keyPoints || []);

  for (const conv of projectConversations) {
    const decisions = conv.chatContext?.importantDecisions || [];
    decisions.forEach(d => allDecisions.add(d));
  }

  return {
    ...project,
    updatedAt: Date.now(),
    sharedMemory: {
      ...project.sharedMemory,
      keyPoints: Array.from(allDecisions).slice(-15),
    },
  };
}
