import { ChatContext, Message, ToolCallExecution, DiagnosisContext } from '../types';

// Initialize a clean, independent ChatContext for a single chat
export function createDefaultChatContext(): ChatContext {
  return {
    userRequirements: [],
    importantDecisions: [],
    recentChanges: [],
    lastModifiedFiles: [],
  };
}

// Detect user's intent regarding code diagnosis and repair
export function detectDiagnosisIntent(
  userText: string,
  prevContext?: ChatContext
): {
  isDiagnosis: boolean;
  isContinuation: boolean;
  isFixRequest: boolean;
  isDiffDiagnosis: boolean;
  isScopeNarrow: boolean;
  isScopeExpand: boolean;
  targetHint?: string;
} {
  const text = userText.trim();
  const lower = text.toLowerCase();

  // 1. Fix request: explicit instruction to apply code patch or fix
  const fixKeywords = [
    '修复它', '帮我修复', '帮我修好', '修一下', '应用修复', '按照建议修改', 
    '开始修复', '应用刚才的建议', '修复这个问题', '请修复', '请修改', '改一下代码'
  ];
  const isFixRequest = fixKeywords.some(k => text.includes(k));
  if (isFixRequest) {
    return {
      isDiagnosis: false,
      isContinuation: false,
      isFixRequest: true,
      isDiffDiagnosis: false,
      isScopeNarrow: false,
      isScopeExpand: false,
    };
  }

  // 2. Diff diagnosis: inspect recent git/workspace changes
  const diffKeywords = [
    '检查我刚刚修改', '检查刚才修改', '检查最新修改', '检查改动', 
    '检查修改的地方', '检查diff', '审查修改', '审查diff', '检查刚改的代码'
  ];
  const isDiffDiagnosis = diffKeywords.some(k => text.includes(k));

  // 3. Continuation of diagnosis
  const continuationKeywords = [
    '继续检查', '继续诊断', '还有没有其他问题', '还有别的问题吗', 
    '继续排查', '深入分析', '还有其他bug吗', '查一下其他路径'
  ];
  const isContinuation = continuationKeywords.some(k => text.includes(k)) && !!prevContext?.diagnosisContext;

  // 4. Narrow or expand diagnosis scope
  const narrowKeywords = ['主要怀疑', '只看', '聚焦在', '单独检查', '缩小范围', '只检查'];
  const isScopeNarrow = narrowKeywords.some(k => text.includes(k));

  const expandKeywords = ['扩大范围', '检查相关api', '检查上游', '检查下游', '顺便查一下', '关联文件'];
  const isScopeExpand = expandKeywords.some(k => text.includes(k));

  // 5. General code diagnosis intent
  const diagnosisKeywords = [
    '检查', '诊断', '排查', '找一下问题', '找一下bug', '有没有bug', 
    '为什么失效', '为何报错', '报错', '崩溃', '不工作', '点击无反应', 
    '偶尔失效', '逻辑错误', '帮我看看这段代码', '怀疑这里有问题', '代码审查', 
    '分析代码错误', '审查这个函数', '审查这个组件', '找bug', '帮我查一下'
  ];

  // Pure explanation filter (e.g. "这个函数是干什么的" vs "这个函数是不是有bug")
  const isPureExplanation = 
    (text.includes('是什么意思') || text.includes('是干什么') || text.includes('用来做什') || text.startsWith('解释一下')) &&
    !text.includes('bug') && !text.includes('错误') && !text.includes('问题') && !text.includes('失效') && !text.includes('检查') && !text.includes('诊断');

  const hasDiagnosisKeyword = diagnosisKeywords.some(k => lower.includes(k));
  const isDiagnosis = (hasDiagnosisKeyword && !isPureExplanation) || isContinuation || isDiffDiagnosis || isScopeNarrow || isScopeExpand;

  return {
    isDiagnosis,
    isContinuation,
    isFixRequest: false,
    isDiffDiagnosis,
    isScopeNarrow,
    isScopeExpand,
    targetHint: text.slice(0, 120),
  };
}

// Build string representation of the current Chat's private context
export function formatChatContextPrompt(context?: ChatContext): string {
  if (!context) return '';

  const sections: string[] = [];

  if (context.currentTask) {
    sections.push(`### 当前会话进行中任务:\n${context.currentTask}`);
  }

  // Formatted Code Diagnosis Memory
  if (context.diagnosisContext) {
    const d = context.diagnosisContext;
    const diagLines: string[] = [
      `- **诊断目标**: ${d.target} (深度: ${d.depth})`,
      `- **已检查文件**: ${d.checkedFiles.length > 0 ? d.checkedFiles.join(', ') : '暂无'}`,
      `- **已检查函数/模块**: ${d.checkedFunctions.length > 0 ? d.checkedFunctions.join(', ') : '暂无'}`,
    ];
    if (d.relatedFiles.length > 0) {
      diagLines.push(`- **直接关联文件**: ${d.relatedFiles.join(', ')}`);
    }
    if (d.confirmedIssues.length > 0) {
      diagLines.push(`- **已确认的问题**: ${d.confirmedIssues.join('； ')}`);
    }
    if (d.ruledOutIssues.length > 0) {
      diagLines.push(`- **已排除/验证正常的部分**: ${d.ruledOutIssues.join('； ')}`);
    }
    if (d.unresolvedQuestions.length > 0) {
      diagLines.push(`- **待查/存疑路径**: ${d.unresolvedQuestions.join('； ')}`);
    }
    if (d.lastConclusion) {
      diagLines.push(`- **上次诊断结论**: ${d.lastConclusion}`);
    }
    diagLines.push(`- **注意**: 延续诊断时，无需重复检索已检查文件，请重点追踪尚未覆盖的依赖路径与调用链。`);

    sections.push(`### 本会话当前代码诊断工作记忆 (Diagnosis Context):\n${diagLines.join('\n')}`);
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
  aiResponseText: string,
  modifiedFiles: string[] = [],
  toolCalls: ToolCallExecution[] = []
): ChatContext {
  const ctx: ChatContext = prevContext ? { ...prevContext } : createDefaultChatContext();

  // If user prompt sets or refines requirements
  if (userText.trim().length > 0 && userText.length < 180) {
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

  // Update diagnosis context if this turn involved code diagnosis
  const diagIntent = detectDiagnosisIntent(userText, prevContext);
  if (diagIntent.isDiagnosis || (toolCalls.some(t => ['search_code', 'read_file', 'get_file_diff'].includes(t.toolName)) && !modifiedFiles.length)) {
    const readPaths: string[] = [];
    const searchedQueries: string[] = [];

    for (const tc of toolCalls) {
      if (tc.toolName === 'read_file' && tc.args?.path) {
        readPaths.push(tc.args.path);
      } else if (tc.toolName === 'search_code' && tc.args?.query) {
        searchedQueries.push(tc.args.query);
      } else if (tc.toolName === 'search_files' && tc.args?.query) {
        searchedQueries.push(tc.args.query);
      }
    }

    const prevDiag = ctx.diagnosisContext;
    const depth: 'target' | 'related' | 'deep' = diagIntent.isScopeExpand
      ? 'deep'
      : diagIntent.isScopeNarrow
      ? 'target'
      : prevDiag?.depth || 'related';

    // Parse conclusion from AI response text
    let conclusion: DiagnosisContext['lastConclusion'] = 'pending';
    if (aiResponseText.includes('发现明确问题') || aiResponseText.includes('发现 1 个明确问题') || aiResponseText.includes('发现问题')) {
      conclusion = 'confirmed_bug';
    } else if (aiResponseText.includes('暂未发现明确代码错误') || aiResponseText.includes('未发现明确错误')) {
      conclusion = 'no_bug_found';
    } else if (aiResponseText.includes('无法确认') || aiResponseText.includes('潜在风险') || aiResponseText.includes('存疑')) {
      conclusion = 'unconfirmed';
    }

    const updatedCheckedFiles = Array.from(new Set([...(prevDiag?.checkedFiles || []), ...readPaths]));
    const updatedCheckedFuncs = Array.from(new Set([...(prevDiag?.checkedFunctions || []), ...searchedQueries]));

    ctx.diagnosisContext = {
      target: diagIntent.isContinuation ? (prevDiag?.target || userText.slice(0, 80)) : userText.slice(0, 80),
      depth,
      checkedFiles: updatedCheckedFiles.slice(-20),
      checkedFunctions: updatedCheckedFuncs.slice(-20),
      relatedFiles: prevDiag?.relatedFiles || [],
      suspectedIssues: prevDiag?.suspectedIssues || [],
      confirmedIssues: conclusion === 'confirmed_bug' ? [aiResponseText.slice(0, 100)] : (prevDiag?.confirmedIssues || []),
      ruledOutIssues: conclusion === 'no_bug_found' ? [userText.slice(0, 80)] : (prevDiag?.ruledOutIssues || []),
      unresolvedQuestions: conclusion === 'unconfirmed' ? [aiResponseText.slice(0, 100)] : (prevDiag?.unresolvedQuestions || []),
      lastConclusion: conclusion,
      lastReportSummary: aiResponseText.slice(0, 150),
      updatedAt: Date.now(),
    };
  } else if (diagIntent.isFixRequest && ctx.diagnosisContext) {
    // If fix request succeeded, mark conclusion resolved
    ctx.diagnosisContext.lastConclusion = 'pending';
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
