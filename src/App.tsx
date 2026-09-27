import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  Conversation, 
  Message, 
  Attachment, 
  ModelItem, 
  ProviderDefinition, 
  ApiKeyConfig, 
  UserSettings, 
  ConnectionStatus,
  ModelParameters,
  WebSearchResultItem,
  ThinkingStep,
  Workspace,
  WorkspaceFile,
  ChatContext,
  ToolCallExecution
} from './types';
import { 
  getWorkspaces,
  saveWorkspace,
  deleteWorkspace,
  createEmptyWorkspace,
  createWorkspaceSnapshot,
  packageWorkspaceToZip,
  getModifiedFilesAgainstOriginal
} from './services/workspaceService';
import { 
  updateChatContext, 
  prepareChatHistoryWithLocalCompaction 
} from './services/chatContextService';
import { 
  buildAgentSystemPrompt, 
  extractToolCallsFromResponse, 
  executeWorkspaceTool, 
  cleanResponseText 
} from './services/agentEngine';
import { WorkspaceDrawer } from './components/WorkspaceDrawer';
import { 
  getConversations, 
  saveConversation, 
  deleteConversation, 
  clearAllConversations,
  getApiKeys,
  saveApiKey,
  deleteApiKey,
  clearAllApiKeys,
  getModels,
  saveModel,
  deleteModel,
  getProviders,
  saveProvider,
  deleteProvider,
  restoreDefaultProviders,
  getUserSettings,
  saveUserSettings,
  resetAllData,
  DEFAULT_SETTINGS
} from './services/db';
import { getAdapterForProvider } from './services/adapters';
import { performWebSearch, buildWebSearchContext } from './services/webSearch';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { MessageList } from './components/MessageList';
import { ChatComposer } from './components/ChatComposer';
import { SettingsModal } from './components/SettingsModal';
import { SearchModal } from './components/SearchModal';
import { ExportModal } from './components/ExportModal';
import { BatchManageModal } from './components/BatchManageModal';
import { ParametersModal } from './components/ParametersModal';
import { AiModelConfigModal } from './components/AiModelConfigModal';

const DEFAULT_PARAMETERS: ModelParameters = {
  enableReasoning: false,
  stream: true,
  maxTokens: 4096,
  temperature: 0.5,
  topP: 1,
  frequencyPenalty: 0,
  presencePenalty: 0,
  stop: '',
  seed: 0,
};

export default function App() {
  // Core Entities State
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [models, setModels] = useState<ModelItem[]>([]);
  const [providers, setProviders] = useState<ProviderDefinition[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKeyConfig[]>([]);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);

  // Active Selections
  const [selectedModelId, setSelectedModelId] = useState<string>('deepseek-ai/deepseek-v4.1-flash');
  const [selectedApiKeyId, setSelectedApiKeyId] = useState<string | undefined>();

  // Runtime State
  const [isGenerating, setIsGenerating] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('unconfigured');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [quotedText, setQuotedText] = useState<string | null>(null);

  // Modals
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<string>('providers');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isBatchOpen, setIsBatchOpen] = useState(false);
  const [isParametersOpen, setIsParametersOpen] = useState(false);
  const [isModelConfigOpen, setIsModelConfigOpen] = useState(false);

  // Model Parameters State (Reasoning, Stream, Max Tokens, Temp, Top P, Penalties, Stop, Seed)
  const [parameters, setParameters] = useState<ModelParameters>(DEFAULT_PARAMETERS);

  // Web Access State (访问网络, 默认关闭 false)
  const [webAccessEnabled, setWebAccessEnabled] = useState(false);

  // AI Workspace State (Strictly decoupled from Chat Memory)
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | undefined>(undefined);
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);
  const [agentMode, setAgentMode] = useState(true);

  // Layout & Responsive
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Abort Controller ref for stopping generation
  const abortControllerRef = useRef<AbortController | null>(null);

  // Check viewport width
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setSidebarOpen(false);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Theme synchronization
  useEffect(() => {
    const root = document.documentElement;
    const isDark =
      settings.theme === 'dark' ||
      (settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [settings.theme]);

  // Initial Data Load
  useEffect(() => {
    async function init() {
      try {
        const [settingsResult, providersResult, modelsResult, keysResult, conversationsResult, workspacesResult] =
          await Promise.allSettled([
            getUserSettings(),
            getProviders(),
            getModels(),
            getApiKeys(),
            getConversations(),
            getWorkspaces(),
          ]);

        const loadedSettings = settingsResult.status === 'fulfilled' ? settingsResult.value : DEFAULT_SETTINGS;
        const loadedProviders = providersResult.status === 'fulfilled' ? providersResult.value : [];
        const loadedModels = modelsResult.status === 'fulfilled' ? modelsResult.value : [];
        const loadedKeys = keysResult.status === 'fulfilled' ? keysResult.value : [];
        const loadedConversations = conversationsResult.status === 'fulfilled' ? conversationsResult.value : [];
        let loadedWorkspaces: Workspace[] = workspacesResult.status === 'fulfilled' ? (workspacesResult.value as Workspace[]) : [];

        // If no workspace exists yet, create an initial clean project workspace
        if (loadedWorkspaces.length === 0) {
          const initialWs = createEmptyWorkspace('我的工作区');
          await saveWorkspace(initialWs);
          loadedWorkspaces = [initialWs];
        }

        setSettings(loadedSettings);
        setProviders(loadedProviders);
        setModels(loadedModels);
        setApiKeys(loadedKeys);
        setConversations(loadedConversations);
        setWorkspaces(loadedWorkspaces);
        setActiveWorkspaceId(loadedWorkspaces[0]?.id);

        const initialModel =
          loadedModels.find(m => m.id === loadedSettings.defaultModelId) || loadedModels[0];
        if (initialModel) {
          setSelectedModelId(initialModel.id);
        }

        if (loadedConversations.length > 0) {
          setActiveConversationId(loadedConversations[0].id);
        }
      } catch (err) {
        console.error('Failed to initialize local database:', err);
      }
    }
    init();
  }, []);

  // Sync selected API key when model changes
  useEffect(() => {
    const currentModel = models.find(m => m.id === selectedModelId);
    if (!currentModel) return;

    const matchedKeys = apiKeys.filter(k => k.providerId === currentModel.providerId);
    if (matchedKeys.length > 0) {
      const defaultKey = matchedKeys.find(k => k.isDefault) || matchedKeys[0];
      setSelectedApiKeyId(defaultKey.id);
      setConnectionStatus('configured');
    } else {
      setSelectedApiKeyId(undefined);
      setConnectionStatus('unconfigured');
    }
  }, [selectedModelId, apiKeys, models]);

  // Current active conversation
  const currentConversation = conversations.find(c => c.id === activeConversationId) || null;
  const currentModel = models.find(m => m.id === selectedModelId) || models[0];
  const currentApiKey = apiKeys.find(k => k.id === selectedApiKeyId);

  // Resolved active workspace for current chat or selection
  const currentWorkspace: Workspace | null = useMemo(() => {
    if (currentConversation?.workspaceId) {
      const matched = workspaces.find(w => w.id === currentConversation.workspaceId);
      if (matched) return matched;
    }
    if (activeWorkspaceId) {
      const matched = workspaces.find(w => w.id === activeWorkspaceId);
      if (matched) return matched;
    }
    return workspaces[0] || null;
  }, [workspaces, currentConversation?.workspaceId, activeWorkspaceId]);

  // Count modified files against original baseline
  const modifiedFilesCountAgainstOriginal = useMemo(() => {
    if (!currentWorkspace) return 0;
    return getModifiedFilesAgainstOriginal(currentWorkspace).length;
  }, [currentWorkspace]);

  // Sync parameters, web access, and workspace binding when active conversation switches
  useEffect(() => {
    if (currentConversation?.parameters) {
      setParameters({ ...DEFAULT_PARAMETERS, ...currentConversation.parameters });
    } else {
      setParameters(DEFAULT_PARAMETERS);
    }
    if (currentConversation?.webAccessEnabled !== undefined) {
      setWebAccessEnabled(currentConversation.webAccessEnabled);
    } else {
      setWebAccessEnabled(false);
    }
    if (currentConversation?.agentMode !== undefined) {
      setAgentMode(currentConversation.agentMode);
    } else {
      setAgentMode(true);
    }
    if (currentConversation?.workspaceId) {
      setActiveWorkspaceId(currentConversation.workspaceId);
    }
  }, [activeConversationId]);

  // Workspace CRUD handlers
  const handleSaveWorkspaceState = async (updatedWs: Workspace) => {
    await saveWorkspace(updatedWs);
    setWorkspaces(prev => {
      const idx = prev.findIndex(w => w.id === updatedWs.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = updatedWs;
        return copy;
      }
      return [updatedWs, ...prev];
    });
  };

  const handleSelectWorkspaceForCurrentChat = async (workspaceId: string) => {
    setActiveWorkspaceId(workspaceId);
    if (currentConversation) {
      const updatedConv = {
        ...currentConversation,
        workspaceId,
        updatedAt: Date.now(),
      };
      await saveConversation(updatedConv);
      setConversations(prev => prev.map(c => c.id === updatedConv.id ? updatedConv : c));
    }
  };

  const handleDeleteWorkspaceSafe = async (workspaceId: string) => {
    if (confirm('确认删除此工作区？注意：删除工作区仅移除该项目文件，绝不会影响任何聊天记录。')) {
      await deleteWorkspace(workspaceId);
      const remaining = workspaces.filter(w => w.id !== workspaceId);
      setWorkspaces(remaining);
      setActiveWorkspaceId(remaining[0]?.id);
    }
  };

  const handleDownloadWorkspaceZipAction = async () => {
    if (!currentWorkspace || Object.keys(currentWorkspace.files).length === 0) {
      alert('当前工作区没有可下载的文件');
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
      alert(`打包下载失败: ${err.message || '未知错误'}`);
    }
  };

  const handleToggleAgentMode = (enabled: boolean) => {
    setAgentMode(enabled);
  };

  const handleUpdateParameters = (newParams: ModelParameters) => {
    setParameters(newParams);
    if (currentConversation) {
      const updated = { ...currentConversation, parameters: newParams, updatedAt: Date.now() };
      saveConversation(updated);
      setConversations(prev => prev.map(c => c.id === updated.id ? updated : c));
    }
  };

  // Toggle Web Access (默认关闭)
  const handleToggleWebAccess = (enabled: boolean) => {
    setWebAccessEnabled(enabled);
    if (currentConversation) {
      const updated = {
        ...currentConversation,
        webAccessEnabled: enabled,
        updatedAt: Date.now(),
      };
      saveConversation(updated);
      setConversations(prev => prev.map(c => c.id === updated.id ? updated : c));
    }
  };

  // New Chat Action
  const handleNewChat = useCallback(() => {
    const newConv: Conversation = {
      id: `conv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      title: '新对话',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      modelId: selectedModelId,
      providerId: currentModel?.providerId || DEFAULT_SETTINGS.defaultProviderId,
      apiKeyId: selectedApiKeyId,
      parameters: parameters,
      webAccessEnabled: false, // 默认关闭
      messages: [],
    };

    setConversations(prev => [newConv, ...prev]);
    setActiveConversationId(newConv.id);
    setWebAccessEnabled(false);
    saveConversation(newConv);

    if (isMobile) {
      setSidebarOpen(false);
    }
  }, [selectedModelId, currentModel, selectedApiKeyId, parameters, isMobile]);

  const handleSelectModel = (id: string) => {
    const model = models.find(m => m.id === id);
    if (!model) return;

    const providerKeys = apiKeys.filter(k => k.providerId === model.providerId);
    const nextApiKeyId = providerKeys.find(k => k.isDefault)?.id || providerKeys[0]?.id;

    setSelectedModelId(id);
    setSelectedApiKeyId(nextApiKeyId);
    setConnectionStatus(nextApiKeyId ? 'configured' : 'unconfigured');

    if (currentConversation) {
      const updated = {
        ...currentConversation,
        modelId: model.id,
        providerId: model.providerId,
        apiKeyId: nextApiKeyId,
        updatedAt: Date.now(),
      };
      saveConversation(updated);
      setConversations(prev => prev.map(c => c.id === updated.id ? updated : c));
    }
  };

  // Keyboard Shortcuts (⌘K search, ⌘N new chat)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        handleNewChat();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNewChat]);

  // Stop Generation
  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
    setConnectionStatus('configured');
  };

  // Send Message Core Engine
  const handleSendMessage = async (
    text: string,
    attachments: Attachment[],
    conversationOverride?: Conversation,
  ) => {
    if (isGenerating) return;
    if (!currentModel) {
      alert('当前没有可用模型，请先进入设置检查模型配置。');
      setIsModelConfigOpen(true);
      return;
    }
    if (!currentApiKey) {
      alert('未找到适用的 API Key，请先进入设置填写。');
      setIsSettingsOpen(true);
      setSettingsTab('keys');
      return;
    }

    let targetConv = conversationOverride || currentConversation;
    // Auto-create conversation if none exists
    if (!targetConv) {
      const newConv: Conversation = {
        id: `conv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        title: text.slice(0, 24) || '新对话',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        modelId: selectedModelId,
        providerId: currentModel.providerId,
        apiKeyId: selectedApiKeyId,
        parameters,
        messages: [],
      };
      targetConv = newConv;
      setConversations(prev => [newConv, ...prev]);
      setActiveConversationId(newConv.id);
    }

    const userMessage: Message = {
      id: `msg_u_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
      attachments,
    };

    const initialThinkingSteps: ThinkingStep[] = [
      {
        id: `step_analyze_${Date.now()}`,
        icon: 'github',
        title: '获取上下文并分析模型交互配置',
        status: 'completed',
      },
    ];

    if (attachments && attachments.length > 0) {
      initialThinkingSteps.push({
        id: `step_att_${Date.now()}`,
        icon: 'code',
        title: `审查解析多模态附件数据（${attachments.length} 个文件）`,
        status: 'completed',
      });
    }

    if (webAccessEnabled) {
      initialThinkingSteps.push({
        id: `step_search_${Date.now()}`,
        icon: 'lightning',
        title: '正在联网检索最新网页与参考资料...',
        status: 'running',
      });
    } else {
      initialThinkingSteps.push({
        id: `step_engine_${Date.now()}`,
        icon: 'github',
        title: `调用 ${currentModel.name} 推理引擎并准备输出`,
        status: 'running',
      });
    }

    let currentThinkingSteps = [...initialThinkingSteps];

    const assistantMsgId = `msg_a_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const assistantMessage: Message = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      model: currentModel.name,
      providerId: currentModel.providerId,
      status: 'streaming',
      thinkingSteps: currentThinkingSteps,
      versions: [{ content: '', timestamp: Date.now(), model: currentModel?.name }],
      currentVersionIndex: 0,
    };

    // Auto-title on first message
    const isFirst = targetConv.messages.length === 0;
    const nextTitle = isFirst ? (text.slice(0, 26) || '新对话') : targetConv.title;

    const updatedMessages = [...targetConv.messages, userMessage, assistantMessage];
    const updatedConv: Conversation = {
      ...targetConv,
      title: nextTitle,
      updatedAt: Date.now(),
      modelId: currentModel.id,
      providerId: currentModel.providerId,
      apiKeyId: selectedApiKeyId,
      parameters: targetConv.parameters || parameters,
      webAccessEnabled,
      messages: updatedMessages,
    };

    // Persist the initial streaming state before starting the request.
    setConversations(prev => prev.map(c => c.id === updatedConv.id ? updatedConv : c));
    await saveConversation(updatedConv);

    setIsGenerating(true);
    setConnectionStatus('requesting');
    setStatusMessage('正在请求 AI 生成...');

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const adapter = getAdapterForProvider(currentModel.providerId);
    let accumulatedText = '';

    // Web Search Grounding (if 访问网络 is enabled)
    let webResults: WebSearchResultItem[] = [];
    let webContext = '';

    if (webAccessEnabled) {
      setStatusMessage('正在联网检索最新网页与资料...');
      try {
        const searchRes = await performWebSearch(text);
        if (searchRes.results.length > 0 || searchRes.pageContents.length > 0) {
          webResults = searchRes.results;
          webContext = buildWebSearchContext(searchRes);

          // Update thinking steps with search result count (精确还原图片展示)
          const updatedSteps: ThinkingStep[] = currentThinkingSteps.map(s => {
            if (s.id.startsWith('step_search_')) {
              return {
                ...s,
                icon: 'lightning',
                title: `已搜索 ${webResults.length} 个网站`,
                status: 'completed',
              };
            }
            return s;
          });

          if (searchRes.pageContents.length > 0) {
            updatedSteps.push({
              id: `step_page_${Date.now()}`,
              icon: 'search',
              title: `审查并读取 ${searchRes.pageContents.length} 个目标网页正文`,
              status: 'completed',
            });
          }

          updatedSteps.push({
            id: `step_engine_${Date.now()}`,
            icon: 'github',
            title: `调用 ${currentModel.name} 推理引擎并组织回答`,
            status: 'running',
          });

          currentThinkingSteps = updatedSteps;

          setConversations(prev => prev.map(c => {
            if (c.id !== updatedConv.id) return c;
            return {
              ...c,
              messages: c.messages.map(m => m.id === assistantMsgId ? { ...m, thinkingSteps: updatedSteps } : m),
            };
          }));
        }
      } catch (searchErr) {
        console.warn('Web search error:', searchErr);
      }
    }

    try {
      const activeParams = updatedConv.parameters || parameters;
      const baseSystemPrompt = targetConv.systemPrompt || settings.defaultSystemPrompt;
      let effectiveSystemPrompt = webContext
        ? (baseSystemPrompt ? `${baseSystemPrompt}\n\n${webContext}` : webContext)
        : baseSystemPrompt;

      let wsToOperate: Workspace | null = currentWorkspace ? JSON.parse(JSON.stringify(currentWorkspace)) : null;

      // If Agent Mode is enabled, inject workspace tools protocol and THIS chat's isolated context
      if (agentMode && wsToOperate) {
        effectiveSystemPrompt = buildAgentSystemPrompt(
          wsToOperate,
          targetConv.chatContext,
          effectiveSystemPrompt
        );
      }

      setStatusMessage(agentMode ? 'Agent 正在分析任务与工作区...' : 'AI 正在组织回答...');

      const executedToolCalls: ToolCallExecution[] = [];
      const modifiedPaths = new Set<string>();

      // Prepare local compaction for THIS single chat (Chat A never shares history with Chat B)
      const { compactedSummary, effectiveMessages } = prepareChatHistoryWithLocalCompaction(targetConv.messages);
      let currentHistoryMessages = [...effectiveMessages, userMessage];

      if (compactedSummary) {
        currentHistoryMessages = [
          {
            id: `msg_compact_${Date.now()}`,
            role: 'system' as any,
            content: compactedSummary,
            timestamp: Date.now(),
          },
          ...currentHistoryMessages,
        ];
      }

      let turn = 0;
      const maxAgentTurns = agentMode && wsToOperate ? 6 : 1;
      let finalFullText = '';

      while (turn < maxAgentTurns) {
        let turnAccumulatedText = '';

        await adapter.sendMessage(
          {
            model: currentModel,
            apiKeyConfig: currentApiKey,
            messages: currentHistoryMessages,
            systemPrompt: effectiveSystemPrompt,
            temperature: currentModel.temperature,
            maxTokens: currentModel.maxTokens,
            topP: currentModel.topP,
            parameters: activeParams,
            abortSignal: abortController.signal,
            timeoutSeconds: settings.requestTimeout,
          },
          settings.enableStreaming ? {
            onChunk: (chunk: string) => {
              turnAccumulatedText += chunk;
              const displayContent = cleanResponseText(turnAccumulatedText);
              const completedSteps = currentThinkingSteps.map(s => ({ ...s, status: 'completed' as const }));

              setConversations(prev => prev.map(c => {
                if (c.id !== updatedConv.id) return c;
                return {
                  ...c,
                  messages: c.messages.map(m => {
                    if (m.id !== assistantMsgId) return m;
                    const versions = [...(m.versions || [])];
                    if (versions.length > 0) {
                      versions[versions.length - 1] = {
                        ...versions[versions.length - 1],
                        content: displayContent,
                      };
                    }
                    return {
                      ...m,
                      content: displayContent,
                      status: 'streaming',
                      versions,
                      thinkingSteps: completedSteps,
                      toolCalls: executedToolCalls.length > 0 ? [...executedToolCalls] : undefined,
                      modifiedFiles: modifiedPaths.size > 0 ? Array.from(modifiedPaths) : undefined,
                      webSearchResults: webResults.length > 0 ? webResults : undefined,
                    };
                  }),
                };
              }));
            },
            onFinish: (fullText: string) => {
              turnAccumulatedText = fullText;
            },
          } : undefined
        );

        finalFullText = turnAccumulatedText;

        // Check if response contains tool calls
        if (agentMode && wsToOperate) {
          const detectedToolCalls = extractToolCallsFromResponse(turnAccumulatedText);

          if (detectedToolCalls.length > 0) {
            const toolResultsForPrompt: string[] = [];

            for (const tc of detectedToolCalls) {
              const execId = `tool_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
              setStatusMessage(`Agent 正在执行: ${tc.tool}...`);

              const outcome = await executeWorkspaceTool(tc.tool, tc.args, wsToOperate);
              wsToOperate = outcome.updatedWorkspace;

              if (outcome.diff?.path) {
                modifiedPaths.add(outcome.diff.path);
              }

              executedToolCalls.push({
                id: execId,
                toolName: tc.tool,
                args: tc.args,
                result: outcome.result,
                status: outcome.errorMessage ? 'error' : 'success',
                errorMessage: outcome.errorMessage,
                diff: outcome.diff,
                timestamp: Date.now(),
              });

              // Add a ThinkingStep to UI log
              currentThinkingSteps.push({
                id: `step_exec_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
                icon: outcome.stepIcon || 'github',
                title: outcome.stepTitle,
                status: 'completed',
              });

              toolResultsForPrompt.push(
                `- 工具: ${tc.tool}\n  参数: ${JSON.stringify(tc.args)}\n  执行结果: ${JSON.stringify(outcome.result || outcome.errorMessage || '成功')}`
              );
            }

            // Sync updated workspace to state
            await handleSaveWorkspaceState(wsToOperate);

            // Append assistant response and tool feedback to conversation history for next turn
            currentHistoryMessages.push({
              id: `msg_agent_turn_${turn}_${Date.now()}`,
              role: 'assistant',
              content: turnAccumulatedText,
              timestamp: Date.now(),
            });

            currentHistoryMessages.push({
              id: `msg_tool_feedback_${turn}_${Date.now()}`,
              role: 'user',
              content: `[工作区工具执行结果反馈]\n${toolResultsForPrompt.join('\n\n')}\n\n请审查执行结果。若还需查看其他文件、修改代码或对比 diff，请继续输出工具调用；若全部任务已完成，请给出结构化的中文总结，列出本次修改了哪些文件与改动内容。注意：你无法运行代码，提醒用户自行在本地运行测试。`,
              timestamp: Date.now(),
            });

            turn++;
            setStatusMessage(`Agent 正在进行第 ${turn + 1} 轮推理与验证...`);
            continue; // Continue loop
          }
        }

        // If no tool calls or agent mode disabled, break loop
        break;
      }

      // If files were modified in workspace, create a version snapshot (v2, v3...)
      if (wsToOperate && modifiedPaths.size > 0) {
        wsToOperate = createWorkspaceSnapshot(
          wsToOperate,
          `AI修改: ${text.slice(0, 24) || '批量代码修改'}`,
          'agent'
        );
        await handleSaveWorkspaceState(wsToOperate);
      }

      // Clean final answer
      let cleanedFinalAnswer = cleanResponseText(finalFullText);
      if (modifiedPaths.size > 0) {
        cleanedFinalAnswer += `\n\n> 📦 **项目工作区已更新**：AI 已修改文件 \`${Array.from(modifiedPaths).join('`, `')}\`。\n> ⚠️ **运行与测试提示**：AI 仅负责分析与修改代码，未在云端运行任何代码或执行测试。请您在本地运行并测试代码；若遇到报错，请将错误信息贴回本聊天中，AI 将继续为您排查修复。`;
      }

      // Update THIS chat's isolated private context memory
      const updatedChatContext = updateChatContext(
        targetConv.chatContext,
        text,
        cleanedFinalAnswer,
        Array.from(modifiedPaths)
      );

      const finalCompletedSteps = currentThinkingSteps.map(s => ({ ...s, status: 'completed' as const }));
      setConversations(prev => prev.map(c => {
        if (c.id !== updatedConv.id) return c;
        const finalMessages = c.messages.map(m => {
          if (m.id !== assistantMsgId) return m;
          const versions = [...(m.versions || [])];
          if (versions.length > 0) {
            versions[versions.length - 1].content = cleanedFinalAnswer;
          }
          return {
            ...m,
            content: cleanedFinalAnswer,
            status: 'completed' as const,
            versions,
            thinkingSteps: finalCompletedSteps,
            toolCalls: executedToolCalls.length > 0 ? executedToolCalls : undefined,
            modifiedFiles: modifiedPaths.size > 0 ? Array.from(modifiedPaths) : undefined,
            webSearchResults: webResults.length > 0 ? webResults : m.webSearchResults,
          };
        });
        const finalConv = { 
          ...c, 
          messages: finalMessages,
          workspaceId: wsToOperate?.id || c.workspaceId,
          chatContext: updatedChatContext,
          updatedAt: Date.now() 
        };
        saveConversation(finalConv);
        return finalConv;
      }));

      setConnectionStatus('success');
      setStatusMessage('响应完成');
    } catch (err: any) {
      if (err.name === 'AbortError' || err.message?.includes('停止生成')) {
        // User aborted
        setConversations(prev => prev.map(c => {
          if (c.id !== updatedConv.id) return c;
          const finalMessages = c.messages.map(m => {
            if (m.id !== assistantMsgId) return m;
            return {
              ...m,
              content: accumulatedText || '（已手动停止生成）',
              status: 'completed' as const,
            };
          });
          const finalConv = { ...c, messages: finalMessages };
          saveConversation(finalConv);
          return finalConv;
        }));
        setConnectionStatus('configured');
      } else {
        // Error occurred
        console.error('AI Request Error:', err);
        const errMsg = err.message || '网络请求错误，请检查网络或 API 配置。';
        setConversations(prev => prev.map(c => {
          if (c.id !== updatedConv.id) return c;
          const finalMessages = c.messages.map(m => {
            if (m.id !== assistantMsgId) return m;
            return {
              ...m,
              status: 'error' as const,
              errorMessage: errMsg,
            };
          });
          const finalConv = { ...c, messages: finalMessages };
          saveConversation(finalConv);
          return finalConv;
        }));
        setConnectionStatus('error');
        setStatusMessage(errMsg);
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  // Retry Assistant Message
  const handleRetry = async (messageId: string) => {
    if (!currentConversation || isGenerating || !currentApiKey || !currentModel) return;

    const msgIndex = currentConversation.messages.findIndex(m => m.id === messageId);
    if (msgIndex === -1) return;

    const prevMessages = currentConversation.messages.slice(0, msgIndex);
    const targetMsg = currentConversation.messages[msgIndex];

    setIsGenerating(true);
    setConnectionStatus('requesting');
    setStatusMessage('正在重新生成...');

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    const adapter = getAdapterForProvider(currentModel.providerId);
    let accumulatedText = '';

    const retryThinkingSteps: ThinkingStep[] = [
      {
        id: `step_retry_${Date.now()}`,
        icon: 'github',
        title: '获取历史上下文并重新配置模型',
        status: 'completed',
      },
      {
        id: `step_retry_engine_${Date.now()}`,
        icon: 'github',
        title: `调用 ${currentModel.name} 推理引擎重新生成`,
        status: 'running',
      },
    ];

    // Persist the streaming state before the network request.
    const streamingConversation = {
      ...currentConversation,
      messages: currentConversation.messages.map(m =>
        m.id === messageId
          ? { ...m, content: '', status: 'streaming' as const, errorMessage: undefined, thinkingSteps: retryThinkingSteps }
          : m
      ),
      updatedAt: Date.now(),
    };
    setConversations(prev => prev.map(c => c.id === streamingConversation.id ? streamingConversation : c));
    await saveConversation(streamingConversation);

    try {
      const activeParams = currentConversation.parameters || parameters;
      await adapter.sendMessage(
        {
          model: currentModel,
          apiKeyConfig: currentApiKey,
          messages: prevMessages,
          systemPrompt: currentConversation.systemPrompt || settings.defaultSystemPrompt,
          temperature: currentModel.temperature,
          maxTokens: currentModel.maxTokens,
          topP: currentModel.topP,
          parameters: activeParams,
          abortSignal: abortController.signal,
          timeoutSeconds: settings.requestTimeout,
        },
        settings.enableStreaming ? {
          onChunk: (chunk: string) => {
            accumulatedText += chunk;
            const completedSteps = retryThinkingSteps.map(s => ({ ...s, status: 'completed' as const }));
            setConversations(prev => prev.map(c => {
              if (c.id !== currentConversation.id) return c;
              return {
                ...c,
                messages: c.messages.map(m => m.id === messageId ? { ...m, content: accumulatedText, status: 'streaming', thinkingSteps: completedSteps } : m),
              };
            }));
          },
        } : undefined
      );

      // Save success
      const finalSteps = retryThinkingSteps.map(s => ({ ...s, status: 'completed' as const }));
      setConversations(prev => prev.map(c => {
        if (c.id !== currentConversation.id) return c;
        const updated = {
          ...c,
          messages: c.messages.map(m => m.id === messageId ? { ...m, content: accumulatedText, status: 'completed' as const, thinkingSteps: finalSteps } : m),
          updatedAt: Date.now(),
        };
        saveConversation(updated);
        return updated;
      }));
      setConnectionStatus('success');
    } catch (err: any) {
      const isAborted = err?.name === 'AbortError' || err?.message?.includes('停止生成');
      setConversations(prev => prev.map(c => {
        if (c.id !== currentConversation.id) return c;
        const updated = {
          ...c,
          messages: c.messages.map(m => {
            if (m.id !== messageId) return m;
            if (isAborted) {
              return {
                ...m,
                content: accumulatedText || '（已手动停止生成）',
                status: 'completed' as const,
              };
            }
            return {
              ...m,
              status: 'error' as const,
              errorMessage: err?.message || '重试失败',
            };
          }),
          updatedAt: Date.now(),
        };
        saveConversation(updated);
        return updated;
      }));
      setConnectionStatus(isAborted ? 'configured' : 'error');
      if (!isAborted) setStatusMessage(err?.message || '重试失败');
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  // Regenerate (Preserves past version!)
  const handleRegenerate = async (messageId: string) => {
    if (!currentConversation || isGenerating || !currentApiKey || !currentModel) return;

    const msgIndex = currentConversation.messages.findIndex(m => m.id === messageId);
    if (msgIndex === -1) return;

    const targetMsg = currentConversation.messages[msgIndex];

    // If it's a user message, resend from here
    if (targetMsg.role === 'user') {
      const trimmedMessages = currentConversation.messages.slice(0, msgIndex + 1);
      const assistantMsgId = `msg_a_${Date.now()}`;
      const regenThinkingSteps: ThinkingStep[] = [
        {
          id: `step_analyze_${Date.now()}`,
          icon: 'github',
          title: '获取上下文并分析模型交互配置',
          status: 'completed',
        },
        {
          id: `step_engine_${Date.now()}`,
          icon: 'github',
          title: `调用 ${currentModel.name} 推理引擎重新生成`,
          status: 'running',
        },
      ];

      const assistantMessage: Message = {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        model: currentModel.name,
        providerId: currentModel.providerId,
        status: 'streaming',
        thinkingSteps: regenThinkingSteps,
        versions: [{ content: '', timestamp: Date.now(), model: currentModel.name }],
        currentVersionIndex: 0,
      };

      const updatedConv = {
        ...currentConversation,
        messages: [...trimmedMessages, assistantMessage],
        updatedAt: Date.now(),
      };
      setConversations(prev => prev.map(c => c.id === updatedConv.id ? updatedConv : c));
      await saveConversation(updatedConv);

      // Trigger generation
      setIsGenerating(true);
      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      const adapter = getAdapterForProvider(currentModel.providerId);
      let accumulatedText = '';

      try {
        await adapter.sendMessage(
          {
            model: currentModel,
            apiKeyConfig: currentApiKey,
            messages: trimmedMessages,
            systemPrompt: currentConversation.systemPrompt || settings.defaultSystemPrompt,
            temperature: currentModel.temperature,
            maxTokens: currentModel.maxTokens,
            topP: currentModel.topP,
            parameters: currentConversation.parameters || parameters,
            abortSignal: abortController.signal,
            timeoutSeconds: settings.requestTimeout,
          },
          settings.enableStreaming ? {
            onChunk: (chunk: string) => {
              accumulatedText += chunk;
              const completedSteps = regenThinkingSteps.map(s => ({ ...s, status: 'completed' as const }));
              setConversations(prev => prev.map(c => {
                if (c.id !== updatedConv.id) return c;
                const messages = c.messages.map(m => {
                  if (m.id !== assistantMsgId) return m;
                  const versions = [...(m.versions || [])];
                  if (versions.length > 0) {
                    versions[0] = { ...versions[0], content: accumulatedText };
                  }
                  return { ...m, content: accumulatedText, status: 'streaming' as const, versions, thinkingSteps: completedSteps };
                });
                return { ...c, messages, updatedAt: Date.now() };
              }));
            },
            onFinish: (fullText: string) => {
              accumulatedText = fullText;
            },
          } : undefined
        );

        const finalSteps = regenThinkingSteps.map(s => ({ ...s, status: 'completed' as const }));
        setConversations(prev => prev.map(c => {
          if (c.id !== updatedConv.id) return c;
          const finalC = {
            ...c,
            messages: c.messages.map(m => {
              if (m.id !== assistantMsgId) return m;
              const versions = [...(m.versions || [])];
              if (versions.length > 0) {
                versions[0] = { ...versions[0], content: accumulatedText };
              }
              return { ...m, content: accumulatedText, status: 'completed' as const, versions, thinkingSteps: finalSteps };
            }),
            updatedAt: Date.now(),
          };
          saveConversation(finalC);
          return finalC;
        }));
      } catch (err: any) {
        const isAborted = err?.name === 'AbortError' || err?.message?.includes('停止生成');
        setConversations(prev => prev.map(c => {
          if (c.id !== updatedConv.id) return c;
          const finalMessages = c.messages.map(m => {
            if (m.id !== assistantMsgId) return m;
            if (isAborted) {
              return {
                ...m,
                content: accumulatedText || '（已手动停止生成）',
                status: 'completed' as const,
                versions: [{
                  content: accumulatedText || '（已手动停止生成）',
                  timestamp: m.versions?.[0]?.timestamp ?? Date.now(),
                  model: m.versions?.[0]?.model,
                }],
              };
            }
            return { ...m, status: 'error' as const, errorMessage: err?.message || '重新生成失败' };
          });
          const finalC = { ...c, messages: finalMessages, updatedAt: Date.now() };
          saveConversation(finalC);
          return finalC;
        }));
        setConnectionStatus(isAborted ? 'configured' : 'error');
        if (!isAborted) setStatusMessage(err?.message || '重新生成失败');
      } finally {
        setIsGenerating(false);
        abortControllerRef.current = null;
      }
      return;
    }

    // It's an assistant message: append a new version to its versions array!
    const prevVersions = targetMsg.versions || [{ content: targetMsg.content, timestamp: targetMsg.timestamp, model: targetMsg.model }];
    const newVersionIndex = prevVersions.length;

    const prevMessages = currentConversation.messages.slice(0, msgIndex);
    setIsGenerating(true);
    setConnectionStatus('requesting');

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    const adapter = getAdapterForProvider(currentModel.providerId);
    let accumulatedText = '';

    const versionThinkingSteps: ThinkingStep[] = [
      {
        id: `step_analyze_${Date.now()}`,
        icon: 'github',
        title: '获取上下文并分析模型交互配置',
        status: 'completed',
      },
      {
        id: `step_engine_${Date.now()}`,
        icon: 'github',
        title: `调用 ${currentModel.name} 推理引擎生成新版本`,
        status: 'running',
      },
    ];

    setConversations(prev => prev.map(c => {
      if (c.id !== currentConversation.id) return c;
      return {
        ...c,
        messages: c.messages.map(m => {
          if (m.id !== messageId) return m;
          return {
            ...m,
            content: '',
            status: 'streaming',
            thinkingSteps: versionThinkingSteps,
            versions: [...prevVersions, { content: '', timestamp: Date.now(), model: currentModel.name }],
            currentVersionIndex: newVersionIndex,
          };
        }),
        updatedAt: Date.now(),
      };
    }));

    const streamingConversation = {
      ...currentConversation,
      messages: currentConversation.messages.map(m => {
        if (m.id !== messageId) return m;
        return {
          ...m,
          content: '',
          status: 'streaming' as const,
          thinkingSteps: versionThinkingSteps,
          versions: [...prevVersions, { content: '', timestamp: Date.now(), model: currentModel.name }],
          currentVersionIndex: newVersionIndex,
        };
      }),
      updatedAt: Date.now(),
    };
    await saveConversation(streamingConversation);

    try {
      const activeParams = currentConversation.parameters || parameters;
      await adapter.sendMessage(
        {
          model: currentModel,
          apiKeyConfig: currentApiKey,
          messages: prevMessages,
          systemPrompt: currentConversation.systemPrompt || settings.defaultSystemPrompt,
          temperature: currentModel.temperature,
          maxTokens: currentModel.maxTokens,
          topP: currentModel.topP,
          parameters: activeParams,
          abortSignal: abortController.signal,
          timeoutSeconds: settings.requestTimeout,
        },
        settings.enableStreaming ? {
          onChunk: (chunk: string) => {
            accumulatedText += chunk;
            const completedSteps = versionThinkingSteps.map(s => ({ ...s, status: 'completed' as const }));
            setConversations(prev => prev.map(c => {
              if (c.id !== currentConversation.id) return c;
              return {
                ...c,
                messages: c.messages.map(m => {
                  if (m.id !== messageId) return m;
                  const v = [...(m.versions || [])];
                  v[newVersionIndex] = { content: accumulatedText, timestamp: Date.now(), model: currentModel.name };
                  return { ...m, content: accumulatedText, versions: v, thinkingSteps: completedSteps };
                }),
              };
            }));
          },
        } : undefined
      );

      const finalSteps = versionThinkingSteps.map(s => ({ ...s, status: 'completed' as const }));
      setConversations(prev => prev.map(c => {
        if (c.id !== currentConversation.id) return c;
        const finalC = {
          ...c,
          messages: c.messages.map(m => {
            if (m.id !== messageId) return m;
            const v = [...(m.versions || [])];
            v[newVersionIndex] = { content: accumulatedText, timestamp: Date.now(), model: currentModel.name };
            return { ...m, content: accumulatedText, status: 'completed' as const, versions: v, thinkingSteps: finalSteps };
          }),
          updatedAt: Date.now(),
        };
        saveConversation(finalC);
        return finalC;
      }));
      setConnectionStatus('success');
    } catch (err: any) {
      const isAborted = err?.name === 'AbortError' || err?.message?.includes('停止生成');
      setConversations(prev => prev.map(c => {
        if (c.id !== currentConversation.id) return c;
        const failed = {
          ...c,
          messages: c.messages.map(m =>
            m.id === messageId
              ? isAborted
                ? { ...m, content: accumulatedText || '（已手动停止生成）', status: 'completed' as const }
                : { ...m, status: 'error' as const, errorMessage: err?.message || '重新生成失败' }
              : m
          ),
          updatedAt: Date.now(),
        };
        saveConversation(failed);
        return failed;
      }));
      setConnectionStatus(isAborted ? 'configured' : 'error');
      if (!isAborted) setStatusMessage(err?.message || '重新生成失败');
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  // Continue generation for a specific incomplete assistant answer.
  const handleContinue = (messageId: string) => {
    if (!currentConversation || isGenerating) return;

    const messageIndex = currentConversation.messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return;

    const targetMessage = currentConversation.messages[messageIndex];
    if (targetMessage.role !== 'assistant') return;

    // Continue from the selected answer only. Do not accidentally include
    // later messages when the conversation contains multiple turns.
    const continuationBase: Conversation = {
      ...currentConversation,
      messages: currentConversation.messages.slice(0, messageIndex + 1),
      updatedAt: Date.now(),
    };

    void handleSendMessage(
      '请从上次回答的结尾紧接着继续往下生成，不要重复前面的内容。',
      [],
      continuationBase,
    );
  };

  // Edit message content
  const handleEditMessage = async (messageId: string, newContent: string, resubmit: boolean) => {
    if (!currentConversation) return;

    if (!resubmit) {
      setConversations(prev => prev.map(c => {
        if (c.id !== currentConversation.id) return c;
        const updated = {
          ...c,
          messages: c.messages.map(m => m.id === messageId ? { ...m, content: newContent } : m),
          updatedAt: Date.now(),
        };
        saveConversation(updated);
        return updated;
      }));
    } else {
      // Find index
      const msgIndex = currentConversation.messages.findIndex(m => m.id === messageId);
      if (msgIndex === -1) return;

      const trimmed = currentConversation.messages.slice(0, msgIndex);
      const editedUserMsg: Message = {
        ...currentConversation.messages[msgIndex],
        content: newContent,
      };

      const editedConversation: Conversation = {
        ...currentConversation,
        messages: [...trimmed, editedUserMsg],
        updatedAt: Date.now(),
      };

      setConversations(prev => prev.map(c => c.id === editedConversation.id ? editedConversation : c));
      await saveConversation(editedConversation);

      // Resend from the edited history instead of the stale React closure.
      const resendBase: Conversation = {
        ...editedConversation,
        messages: trimmed,
      };
      handleSendMessage(newContent, editedUserMsg.attachments || [], resendBase);
    }
  };

  // Switch versions
  const handleSwitchVersion = (messageId: string, versionIndex: number) => {
    if (!currentConversation) return;
    setConversations(prev => prev.map(c => {
      if (c.id !== currentConversation.id) return c;
      const updated = {
        ...c,
        messages: c.messages.map(m => {
          if (m.id !== messageId || !m.versions || !m.versions[versionIndex]) return m;
          return {
            ...m,
            content: m.versions[versionIndex].content,
            currentVersionIndex: versionIndex,
          };
        }),
      };
      saveConversation(updated);
      return updated;
    }));
  };

  // Delete message
  const handleDeleteMessage = (messageId: string) => {
    if (!currentConversation) return;
    setConversations(prev => prev.map(c => {
      if (c.id !== currentConversation.id) return c;
      const updated = {
        ...c,
        messages: c.messages.filter(m => m.id !== messageId),
        updatedAt: Date.now(),
      };
      saveConversation(updated);
      return updated;
    }));
  };

  // Delete conversation
  const handleDeleteConversation = async (id: string) => {
    await deleteConversation(id);
    setConversations(prev => {
      const updated = prev.filter(c => c.id !== id);
      if (activeConversationId === id) {
        setActiveConversationId(updated.length > 0 ? updated[0].id : null);
      }
      return updated;
    });
  };

  // Toggle favorite
  const handleToggleFavorite = async (id: string) => {
    const target = conversations.find(c => c.id === id);
    if (!target) return;
    const updated = { ...target, isFavorite: !target.isFavorite };
    await saveConversation(updated);
    setConversations(prev => prev.map(c => c.id === id ? updated : c));
  };

  // Rename conversation
  const handleRenameConversation = async (id: string, newTitle: string) => {
    const target = conversations.find(c => c.id === id);
    if (!target) return;
    const updated = { ...target, title: newTitle, updatedAt: Date.now() };
    await saveConversation(updated);
    setConversations(prev => prev.map(c => c.id === id ? updated : c));
  };

  // Clear messages in current conversation
  const handleClearChat = async () => {
    if (!currentConversation) return;
    if (confirm('确认清空当前对话的所有消息记录？')) {
      const updated = { ...currentConversation, messages: [], updatedAt: Date.now() };
      await saveConversation(updated);
      setConversations(prev => prev.map(c => c.id === updated.id ? updated : c));
    }
  };

  // Copy full chat text
  const handleCopyAllChat = () => {
    if (!currentConversation) return;
    let full = `# ${currentConversation.title}\n\n`;
    for (const msg of currentConversation.messages) {
      full += `[${msg.role === 'user' ? '用户' : msg.model || 'AI'}]:\n${msg.content}\n\n`;
    }
    navigator.clipboard.writeText(full);
    alert('已成功复制对话全文至剪贴板！');
  };

  // Batch delete
  const handleBatchDelete = async (ids: string[]) => {
    await Promise.all(ids.map(id => deleteConversation(id)));
    setConversations(prev => {
      const remaining = prev.filter(c => !ids.includes(c.id));
      if (activeConversationId && ids.includes(activeConversationId)) {
        setActiveConversationId(remaining.length > 0 ? remaining[0].id : null);
      }
      return remaining;
    });
  };

  // Batch favorite
  const handleBatchFavorite = async (ids: string[], isFavorite: boolean) => {
    for (const id of ids) {
      const conv = conversations.find(c => c.id === id);
      if (conv) {
        const updated = { ...conv, isFavorite };
        await saveConversation(updated);
      }
    }
    setConversations(prev => prev.map(c => ids.includes(c.id) ? { ...c, isFavorite } : c));
  };

  // Settings Handlers
  const handleSaveApiKeyConfig = async (key: ApiKeyConfig) => {
    await saveApiKey(key);
    const updatedKeys = await getApiKeys();
    setApiKeys(updatedKeys);
    setSelectedApiKeyId(key.id);
    setConnectionStatus('configured');
  };

  const handleDeleteApiKeyConfig = async (id: string) => {
    await deleteApiKey(id);
    const updatedKeys = await getApiKeys();
    setApiKeys(updatedKeys);
    if (selectedApiKeyId === id) {
      setSelectedApiKeyId(updatedKeys[0]?.id);
    }
  };

  const handleSaveModelItem = async (model: ModelItem) => {
    await saveModel(model);
    const updated = await getModels();
    setModels(updated);
  };

  const handleDeleteModelItem = async (id: string) => {
    await deleteModel(id);
    const updated = await getModels();
    setModels(updated);
  };

  const handleSaveProviderDef = async (provider: ProviderDefinition) => {
    await saveProvider(provider);
    const updated = await getProviders();
    setProviders(updated);
  };

  const handleDeleteProviderDef = async (id: string) => {
    await deleteProvider(id);
    const updated = await getProviders();
    setProviders(updated);
  };

  const handleRestoreDefaultProviders = async () => {
    await restoreDefaultProviders();
    const [loadedProviders, loadedModels, loadedKeys] = await Promise.all([
      getProviders(),
      getModels(),
      getApiKeys(),
    ]);
    setProviders(loadedProviders);
    setModels(loadedModels);
    setApiKeys(loadedKeys);
    if (!selectedModelId || !loadedModels.some(m => m.id === selectedModelId)) {
      setSelectedModelId('deepseek-ai/deepseek-v4.1-flash');
    }
  };

  const handleSaveSettingsObj = async (newSettings: UserSettings) => {
    await saveUserSettings(newSettings);
    setSettings(newSettings);
  };

  const handleImportConversations = async (imported: Conversation[]) => {
    for (const c of imported) {
      await saveConversation(c);
    }
    const updated = await getConversations();
    setConversations(updated);
    if (updated.length > 0) setActiveConversationId(updated[0].id);
  };

  const handleClearAllConversations = async () => {
    await clearAllConversations();
    setConversations([]);
    setActiveConversationId(null);
  };

  const handleClearAllApiKeys = async () => {
    await clearAllApiKeys();
    setApiKeys([]);
    setSelectedApiKeyId(undefined);
    setConnectionStatus('unconfigured');
  };

  const handleResetAllData = async () => {
    await resetAllData();
    const [loadedSettings, loadedProviders, loadedModels, loadedKeys, loadedConversations] = await Promise.all([
      getUserSettings(),
      getProviders(),
      getModels(),
      getApiKeys(),
      getConversations(),
    ]);
    setSettings(loadedSettings);
    setProviders(loadedProviders);
    setModels(loadedModels);
    setApiKeys(loadedKeys);
    setConversations(loadedConversations);
    setSelectedApiKeyId(undefined);
    setConnectionStatus('unconfigured');
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 font-sans">
      {/* Left Collapsible Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={(id) => {
          setActiveConversationId(id);
          if (isMobile) setSidebarOpen(false);
        }}
        onNewChat={handleNewChat}
        onDeleteConversation={handleDeleteConversation}
        onToggleFavorite={handleToggleFavorite}
        onRenameConversation={handleRenameConversation}
        onExportConversation={() => setIsExportOpen(true)}
        onOpenSettings={() => {
          setSettingsTab('chat');
          setIsSettingsOpen(true);
        }}
        onOpenModelConfig={() => setIsModelConfigOpen(true)}
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenBatchManage={() => setIsBatchOpen(true)}
        models={models}
        isMobile={isMobile}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        {/* Top Header Bar */}
        <TopBar
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          onNewChat={handleNewChat}
          currentConversation={currentConversation}
          models={models}
          providers={providers}
          apiKeys={apiKeys}
          selectedModelId={selectedModelId}
          onSelectModel={handleSelectModel}
          selectedApiKeyId={selectedApiKeyId}
          onSelectApiKey={(id) => setSelectedApiKeyId(id)}
          connectionStatus={connectionStatus}
          statusMessage={statusMessage}
          onExportChat={() => setIsExportOpen(true)}
          onClearChat={handleClearChat}
          onOpenSettings={(tab) => {
            if (tab) setSettingsTab(tab);
            setIsSettingsOpen(true);
          }}
          onOpenModelConfig={() => setIsModelConfigOpen(true)}
          onRenameChat={(newTitle) => {
            if (currentConversation) handleRenameConversation(currentConversation.id, newTitle);
          }}
          onCopyAllChat={handleCopyAllChat}
          onOpenParameters={() => setIsParametersOpen(true)}
          isReasoningEnabled={parameters.enableReasoning}
          workspaceFilesCount={currentWorkspace ? Object.keys(currentWorkspace.files).length : 0}
          workspaceName={currentWorkspace?.name}
          modifiedFilesCount={modifiedFilesCountAgainstOriginal}
          onOpenWorkspace={() => setIsWorkspaceOpen(true)}
          agentMode={agentMode}
          onToggleAgentMode={handleToggleAgentMode}
        />

        {/* Message Stream Central Area */}
        <MessageList
          messages={currentConversation?.messages || []}
          currentModel={currentModel}
          settings={settings}
          onRetry={handleRetry}
          onRegenerate={handleRegenerate}
          onContinue={handleContinue}
          onEdit={handleEditMessage}
          onDelete={handleDeleteMessage}
          onQuote={(q) => setQuotedText(q)}
          onSwitchVersion={handleSwitchVersion}
          onSelectPrompt={(p) => handleSendMessage(p, [])}
          onDownloadWorkspaceZip={handleDownloadWorkspaceZipAction}
        />

        {/* Large AI Composer Input Area */}
        <ChatComposer
          onSendMessage={handleSendMessage}
          isGenerating={isGenerating}
          onStopGeneration={handleStopGeneration}
          currentModel={currentModel}
          currentApiKey={currentApiKey}
          settings={settings}
          onOpenSettings={(tab) => {
            if (tab) setSettingsTab(tab);
            setIsSettingsOpen(true);
          }}
          onOpenModelConfig={() => setIsModelConfigOpen(true)}
          quotedText={quotedText}
          onClearQuote={() => setQuotedText(null)}
          parameters={parameters}
          onUpdateParameters={handleUpdateParameters}
          onOpenParameters={() => setIsParametersOpen(true)}
          webAccessEnabled={webAccessEnabled}
          onToggleWebAccess={handleToggleWebAccess}
        />
      </div>

      {/* Dedicated AI Model Configuration Modal (Matches user screenshots) */}
      <AiModelConfigModal
        isOpen={isModelConfigOpen}
        onClose={() => setIsModelConfigOpen(false)}
        providers={providers}
        onSaveProvider={handleSaveProviderDef}
        onDeleteProvider={handleDeleteProviderDef}
        onRestoreDefaultProviders={handleRestoreDefaultProviders}
        apiKeys={apiKeys}
        onSaveApiKey={handleSaveApiKeyConfig}
        onDeleteApiKey={handleDeleteApiKeyConfig}
        models={models}
        onSaveModel={handleSaveModelItem}
        onDeleteModel={handleDeleteModelItem}
        settings={settings}
        onSaveSettings={handleSaveSettingsObj}
        currentModelId={selectedModelId}
        onSelectModel={handleSelectModel}
        selectedApiKeyId={selectedApiKeyId}
        onSelectApiKey={(id) => setSelectedApiKeyId(id)}
      />

      {/* Parameters Settings Modal (Matches user screenshot) */}
      <ParametersModal
        isOpen={isParametersOpen}
        onClose={() => setIsParametersOpen(false)}
        parameters={parameters}
        onChangeParameters={handleUpdateParameters}
        modelName={currentModel?.name}
      />

      {/* Settings Modal (8 Tabs) */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        initialTab={settingsTab}
        onOpenModelConfig={() => setIsModelConfigOpen(true)}
        providers={providers}
        onSaveProvider={handleSaveProviderDef}
        onDeleteProvider={handleDeleteProviderDef}
        apiKeys={apiKeys}
        onSaveApiKey={handleSaveApiKeyConfig}
        onDeleteApiKey={handleDeleteApiKeyConfig}
        models={models}
        onSaveModel={handleSaveModelItem}
        onDeleteModel={handleDeleteModelItem}
        settings={settings}
        onSaveSettings={handleSaveSettingsObj}
        conversations={conversations}
        onImportConversations={handleImportConversations}
        onClearAllConversations={handleClearAllConversations}
        onClearAllApiKeys={handleClearAllApiKeys}
        onResetAllData={handleResetAllData}
      />

      {/* Deep Search Modal */}
      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        conversations={conversations}
        onSelectConversation={(id) => {
          setActiveConversationId(id);
          if (isMobile) setSidebarOpen(false);
        }}
        models={models}
      />

      {/* Export Format Modal */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        conversation={currentConversation}
        models={models}
      />

      {/* Batch Management Modal */}
      <BatchManageModal
        isOpen={isBatchOpen}
        onClose={() => setIsBatchOpen(false)}
        conversations={conversations}
        onBatchDelete={handleBatchDelete}
        onBatchFavorite={handleBatchFavorite}
        models={models}
      />

      {/* AI Workspace and Project Memory Drawer */}
      <WorkspaceDrawer
        isOpen={isWorkspaceOpen}
        onClose={() => setIsWorkspaceOpen(false)}
        workspaces={workspaces}
        activeWorkspaceId={currentWorkspace?.id}
        onSelectWorkspace={handleSelectWorkspaceForCurrentChat}
        onSaveWorkspace={handleSaveWorkspaceState}
        onDeleteWorkspace={handleDeleteWorkspaceSafe}
      />
    </div>
  );
}
