import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Conversation, 
  Message, 
  Attachment, 
  ModelItem, 
  ProviderDefinition, 
  ApiKeyConfig, 
  UserSettings, 
  ConnectionStatus,
  ModelParameters
} from './types';
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

        // Pick initial model
        const initialModel = loadedModels.find(m => m.id === loadedSettings.defaultModelId) || loadedModels[0];
        if (initialModel) {
          setSelectedModelId(initialModel.id);
        }

        // Pick initial conversation or create one
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

  // Sync parameters with current conversation
  useEffect(() => {
    if (currentConversation?.parameters) {
      setParameters({ ...DEFAULT_PARAMETERS, ...currentConversation.parameters });
    } else {
      setParameters(DEFAULT_PARAMETERS);
    }
  }, [activeConversationId]);

  const handleUpdateParameters = (newParams: ModelParameters) => {
    setParameters(newParams);
    if (currentConversation) {
      const updated = { ...currentConversation, parameters: newParams, updatedAt: Date.now() };
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
      providerId: currentModel?.providerId || 'google',
      apiKeyId: selectedApiKeyId,
      parameters: parameters,
      messages: [],
    };

    setConversations(prev => [newConv, ...prev]);
    setActiveConversationId(newConv.id);
    saveConversation(newConv);

    if (isMobile) {
      setSidebarOpen(false);
    }
  }, [selectedModelId, currentModel, selectedApiKeyId, isMobile]);

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
  const handleSendMessage = async (text: string, attachments: Attachment[]) => {
    if (isGenerating) return;

    let targetConv = currentConversation;
    // Auto-create conversation if none exists
    if (!targetConv) {
      const newConv: Conversation = {
        id: `conv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        title: text.slice(0, 24) || '新对话',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        modelId: selectedModelId,
        providerId: currentModel?.providerId || 'google',
        apiKeyId: selectedApiKeyId,
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

    const assistantMsgId = `msg_a_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const assistantMessage: Message = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      model: currentModel?.name || selectedModelId,
      providerId: currentModel?.providerId,
      status: 'streaming',
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
      modelId: selectedModelId,
      messages: updatedMessages,
    };

    // Update state & persist
    setConversations(prev => prev.map(c => c.id === updatedConv.id ? updatedConv : c));
    saveConversation(updatedConv);

    // Call AI Adapter
    if (!currentApiKey) {
      alert('未找到适用的 API Key，请先进入设置填写。');
      setIsSettingsOpen(true);
      setSettingsTab('keys');
      return;
    }

    setIsGenerating(true);
    setConnectionStatus('requesting');
    setStatusMessage('正在请求 AI 生成...');

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const adapter = getAdapterForProvider(currentModel.providerId);
    let accumulatedText = '';

    try {
      const activeParams = targetConv.parameters || parameters;
      await adapter.sendMessage(
        {
          model: currentModel,
          apiKeyConfig: currentApiKey,
          messages: [...targetConv.messages, userMessage],
          systemPrompt: targetConv.systemPrompt || settings.defaultSystemPrompt,
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
                      content: accumulatedText,
                    };
                  }
                  return {
                    ...m,
                    content: accumulatedText,
                    status: 'streaming',
                    versions,
                  };
                }),
              };
            }));
          },
          onFinish: (fullText: string) => {
            accumulatedText = fullText;
          },
        } : undefined
      );

      // Generation successful
      setConversations(prev => prev.map(c => {
        if (c.id !== updatedConv.id) return c;
        const finalMessages = c.messages.map(m => {
          if (m.id !== assistantMsgId) return m;
          const versions = [...(m.versions || [])];
          if (versions.length > 0) {
            versions[versions.length - 1].content = accumulatedText;
          }
          return {
            ...m,
            content: accumulatedText,
            status: 'completed' as const,
            versions,
          };
        });
        const finalConv = { ...c, messages: finalMessages, updatedAt: Date.now() };
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
    if (!currentConversation || isGenerating || !currentApiKey) return;

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

    // Set message to streaming
    setConversations(prev => prev.map(c => {
      if (c.id !== currentConversation.id) return c;
      return {
        ...c,
        messages: c.messages.map(m => m.id === messageId ? { ...m, content: '', status: 'streaming', errorMessage: undefined } : m),
      };
    }));

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
            setConversations(prev => prev.map(c => {
              if (c.id !== currentConversation.id) return c;
              return {
                ...c,
                messages: c.messages.map(m => m.id === messageId ? { ...m, content: accumulatedText, status: 'streaming' } : m),
              };
            }));
          },
        } : undefined
      );

      // Save success
      setConversations(prev => prev.map(c => {
        if (c.id !== currentConversation.id) return c;
        const updated = {
          ...c,
          messages: c.messages.map(m => m.id === messageId ? { ...m, content: accumulatedText, status: 'completed' as const } : m),
          updatedAt: Date.now(),
        };
        saveConversation(updated);
        return updated;
      }));
      setConnectionStatus('success');
    } catch (err: any) {
      const errMsg = err.message || '重试失败';
      setConversations(prev => prev.map(c => {
        if (c.id !== currentConversation.id) return c;
        const updated = {
          ...c,
          messages: c.messages.map(m => m.id === messageId ? { ...m, status: 'error' as const, errorMessage: errMsg } : m),
        };
        saveConversation(updated);
        return updated;
      }));
      setConnectionStatus('error');
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  // Regenerate (Preserves past version!)
  const handleRegenerate = async (messageId: string) => {
    if (!currentConversation || isGenerating || !currentApiKey) return;

    const msgIndex = currentConversation.messages.findIndex(m => m.id === messageId);
    if (msgIndex === -1) return;

    const targetMsg = currentConversation.messages[msgIndex];

    // If it's a user message, resend from here
    if (targetMsg.role === 'user') {
      const trimmedMessages = currentConversation.messages.slice(0, msgIndex + 1);
      const assistantMsgId = `msg_a_${Date.now()}`;
      const assistantMessage: Message = {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        model: currentModel.name,
        providerId: currentModel.providerId,
        status: 'streaming',
      };

      const updatedConv = {
        ...currentConversation,
        messages: [...trimmedMessages, assistantMessage],
        updatedAt: Date.now(),
      };
      setConversations(prev => prev.map(c => c.id === updatedConv.id ? updatedConv : c));

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
            abortSignal: abortController.signal,
          },
          {
            onChunk: (chunk) => {
              accumulatedText += chunk;
              setConversations(prev => prev.map(c => {
                if (c.id !== updatedConv.id) return c;
                return {
                  ...c,
                  messages: c.messages.map(m => m.id === assistantMsgId ? { ...m, content: accumulatedText } : m),
                };
              }));
            },
          }
        );

        setConversations(prev => prev.map(c => {
          if (c.id !== updatedConv.id) return c;
          const finalC = {
            ...c,
            messages: c.messages.map(m => m.id === assistantMsgId ? { ...m, content: accumulatedText, status: 'completed' as const } : m),
          };
          saveConversation(finalC);
          return finalC;
        }));
      } catch (err: any) {
        setConversations(prev => prev.map(c => {
          if (c.id !== updatedConv.id) return c;
          return {
            ...c,
            messages: c.messages.map(m => m.id === assistantMsgId ? { ...m, status: 'error' as const, errorMessage: err.message } : m),
          };
        }));
      } finally {
        setIsGenerating(false);
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
            versions: [...prevVersions, { content: '', timestamp: Date.now(), model: currentModel.name }],
            currentVersionIndex: newVersionIndex,
          };
        }),
      };
    }));

    try {
      const activeParams = currentConversation.parameters || parameters;
      await adapter.sendMessage(
        {
          model: currentModel,
          apiKeyConfig: currentApiKey,
          messages: prevMessages,
          systemPrompt: currentConversation.systemPrompt || settings.defaultSystemPrompt,
          parameters: activeParams,
          abortSignal: abortController.signal,
        },
        {
          onChunk: (chunk) => {
            accumulatedText += chunk;
            setConversations(prev => prev.map(c => {
              if (c.id !== currentConversation.id) return c;
              return {
                ...c,
                messages: c.messages.map(m => {
                  if (m.id !== messageId) return m;
                  const v = [...(m.versions || [])];
                  v[newVersionIndex] = { content: accumulatedText, timestamp: Date.now(), model: currentModel.name };
                  return { ...m, content: accumulatedText, versions: v };
                }),
              };
            }));
          },
        }
      );

      setConversations(prev => prev.map(c => {
        if (c.id !== currentConversation.id) return c;
        const finalC = {
          ...c,
          messages: c.messages.map(m => {
            if (m.id !== messageId) return m;
            const v = [...(m.versions || [])];
            v[newVersionIndex] = { content: accumulatedText, timestamp: Date.now(), model: currentModel.name };
            return { ...m, content: accumulatedText, status: 'completed' as const, versions: v };
          }),
        };
        saveConversation(finalC);
        return finalC;
      }));
      setConnectionStatus('success');
    } catch (err: any) {
      setConversations(prev => prev.map(c => {
        if (c.id !== currentConversation.id) return c;
        return {
          ...c,
          messages: c.messages.map(m => m.id === messageId ? { ...m, status: 'error' as const, errorMessage: err.message } : m),
        };
      }));
      setConnectionStatus('error');
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  // Continue generation for incomplete answers
  const handleContinue = (messageId: string) => {
    handleSendMessage('请从上次回答的结尾紧接着继续往下生成，不要重复前面的内容。', []);
  };

  // Edit message content
  const handleEditMessage = (messageId: string, newContent: string, resubmit: boolean) => {
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

      setConversations(prev => prev.map(c => {
        if (c.id !== currentConversation.id) return c;
        const updated = {
          ...c,
          messages: [...trimmed, editedUserMsg],
          updatedAt: Date.now(),
        };
        saveConversation(updated);
        return updated;
      }));

      // Resend
      handleSendMessage(newContent, editedUserMsg.attachments || []);
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
          onSelectModel={(id) => {
            setSelectedModelId(id);
            if (currentConversation) {
              const updated = { ...currentConversation, modelId: id };
              saveConversation(updated);
              setConversations(prev => prev.map(c => c.id === updated.id ? updated : c));
            }
          }}
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
        onSelectModel={(id) => {
          setSelectedModelId(id);
          if (currentConversation) {
            const updated = { ...currentConversation, modelId: id };
            saveConversation(updated);
            setConversations(prev => prev.map(c => c.id === updated.id ? updated : c));
          }
        }}
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
    </div>
  );
}
