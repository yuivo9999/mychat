import React, { useState } from 'react';
import { 
  Menu, 
  Plus, 
  ChevronDown, 
  ExternalLink, 
  Download, 
  Trash2, 
  MoreVertical, 
  Check, 
  Key, 
  Settings, 
  Sparkles, 
  Activity, 
  AlertCircle,
  CheckCircle2,
  Clock,
  HelpCircle,
  Copy,
  SlidersHorizontal,
  Server,
  Folder,
  Bot
} from 'lucide-react';
import { Conversation, ModelItem, ProviderDefinition, ApiKeyConfig, ConnectionStatus } from '../types';

interface TopBarProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onNewChat: () => void;
  currentConversation: Conversation | null;
  models: ModelItem[];
  providers: ProviderDefinition[];
  apiKeys: ApiKeyConfig[];
  selectedModelId: string;
  onSelectModel: (modelId: string) => void;
  selectedApiKeyId: string | undefined;
  onSelectApiKey: (keyId: string) => void;
  connectionStatus: ConnectionStatus;
  statusMessage?: string;
  onExportChat: () => void;
  onClearChat: () => void;
  onOpenSettings: (initialTab?: string) => void;
  onOpenModelConfig?: () => void;
  onRenameChat: (newTitle: string) => void;
  onCopyAllChat: () => void;
  onOpenParameters?: () => void;
  isReasoningEnabled?: boolean;
  workspaceFilesCount?: number;
  workspaceName?: string;
  modifiedFilesCount?: number;
  onOpenWorkspace?: () => void;
  agentMode?: boolean;
  onToggleAgentMode?: (enabled: boolean) => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  sidebarOpen,
  onToggleSidebar,
  onNewChat,
  currentConversation,
  models,
  providers,
  apiKeys,
  selectedModelId,
  onSelectModel,
  selectedApiKeyId,
  onSelectApiKey,
  connectionStatus,
  statusMessage,
  onExportChat,
  onClearChat,
  onOpenSettings,
  onOpenModelConfig,
  onRenameChat,
  onCopyAllChat,
  onOpenParameters,
  isReasoningEnabled,
  workspaceFilesCount = 0,
  workspaceName,
  modifiedFilesCount = 0,
  onOpenWorkspace,
  agentMode = true,
  onToggleAgentMode,
}) => {
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [keyDropdownOpen, setKeyDropdownOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [searchModelQuery, setSearchModelQuery] = useState('');

  const currentModel = models.find(m => m.id === selectedModelId) || models[0];
  const currentProvider = providers.find(p => p.id === currentModel?.providerId);
  const currentKey = apiKeys.find(k => k.id === selectedApiKeyId);

  // Filter models for dropdown
  const filteredModels = models.filter(m => {
    if (!searchModelQuery) return true;
    const q = searchModelQuery.toLowerCase();
    const p = providers.find(prov => prov.id === m.providerId);
    return (
      m.name.toLowerCase().includes(q) ||
      m.id.toLowerCase().includes(q) ||
      (p && p.name.toLowerCase().includes(q))
    );
  });

  // Group models by provider strictly respecting provider order
  const modelsByProvider: Record<string, ModelItem[]> = {};
  for (const p of providers) {
    const pModels = filteredModels.filter(m => m.providerId === p.id);
    if (pModels.length > 0) {
      modelsByProvider[p.id] = pModels;
    }
  }
  for (const m of filteredModels) {
    if (!modelsByProvider[m.providerId]) {
      modelsByProvider[m.providerId] = [m];
    }
  }

  // Get keys for current provider
  const availableKeysForProvider = apiKeys.filter(
    k => k.providerId === currentModel?.providerId
  );

  const getStatusBadge = () => {
    switch (connectionStatus) {
      case 'requesting':
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-medium border border-blue-500/20">
            <Activity className="w-3.5 h-3.5 animate-pulse text-blue-500" />
            <span>请求中...</span>
          </div>
        );
      case 'configured':
      case 'success':
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-medium border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span>已就绪</span>
          </div>
        );
      case 'error':
        return (
          <button
            onClick={() => onOpenSettings('keys')}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 text-xs font-medium border border-red-500/20 transition"
            title={statusMessage || '请求出错'}
          >
            <AlertCircle className="w-3.5 h-3.5 text-red-500" />
            <span>连接异常</span>
          </button>
        );
      case 'unconfigured':
      default:
        return (
          <button
            onClick={() => onOpenSettings('keys')}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-medium border border-amber-500/20 transition cursor-pointer"
            title="点击配置 API Key"
          >
            <Key className="w-3.5 h-3.5 text-amber-500" />
            <span>未配置 Key</span>
          </button>
        );
    }
  };

  return (
    <header className="h-14 border-b border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md px-3 md:px-4 flex items-center justify-between shrink-0 z-20 select-none">
      {/* Left Area: Toggle & Title */}
      <div className="flex items-center gap-2 min-w-0">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="p-2 rounded-xl text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
          title={sidebarOpen ? '收起侧边栏' : '展开侧边栏'}
        >
          <Menu className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onNewChat}
          className="hidden sm:flex items-center gap-1 p-1.5 px-2.5 text-xs font-medium rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
          title="创建新聊天"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>新聊天</span>
        </button>

        <div className="h-4 w-[1px] bg-neutral-200 dark:bg-neutral-800 mx-1 hidden sm:block" />

        <div className="min-w-0 flex items-center gap-1.5">
          <span 
            className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 truncate max-w-[140px] md:max-w-[240px] cursor-pointer hover:underline decoration-neutral-400 underline-offset-2"
            title="点击重命名"
            onClick={() => {
              const current = currentConversation?.title || '新对话';
              const next = prompt('输入新的对话标题:', current);
              if (next && next.trim()) onRenameChat(next.trim());
            }}
          >
            {currentConversation?.title || '新对话'}
          </span>
        </div>
      </div>

      {/* Center Area: Quick Model Pill */}
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setModelDropdownOpen(!modelDropdownOpen);
            setKeyDropdownOpen(false);
            setMoreMenuOpen(false);
          }}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 hover:bg-neutral-100 dark:bg-neutral-800/70 dark:hover:bg-neutral-800 transition shadow-2xs cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
          <div className="flex flex-col text-left">
            <span className="text-xs font-mono font-semibold text-neutral-800 dark:text-neutral-200 leading-tight">
              {currentModel?.id || '选择模型'}
            </span>
            <span className="text-[10px] text-neutral-400 leading-none">
              {currentProvider?.name || 'AI 模型'}{currentModel?.name && currentModel?.name !== currentModel?.id ? ` · ${currentModel.name}` : ''}
            </span>
          </div>
          <ChevronDown className={`w-3.5 h-3.5 text-neutral-400 transition-transform ${modelDropdownOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Model Picker Dropdown */}
        {modelDropdownOpen && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setModelDropdownOpen(false)} />
            <div className="absolute left-1/2 -translate-x-1/2 top-12 w-80 max-h-[460px] overflow-hidden flex flex-col bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 z-40">
              {/* Search input */}
              <div className="p-2.5 border-b border-neutral-100 dark:border-neutral-800">
                <input
                  type="text"
                  placeholder="搜索模型名称或提供商..."
                  value={searchModelQuery}
                  onChange={(e) => setSearchModelQuery(e.target.value)}
                  className="w-full text-xs bg-neutral-100 dark:bg-neutral-800 rounded-lg px-3 py-2 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 outline-hidden"
                  autoFocus
                />
              </div>

              {/* Models grouped by provider */}
              <div className="overflow-y-auto p-1.5 flex-1 divide-y divide-neutral-100 dark:divide-neutral-800/60">
                {Object.keys(modelsByProvider).length === 0 ? (
                  <div className="p-4 text-center text-xs text-neutral-400">无匹配模型</div>
                ) : (
                  Object.entries(modelsByProvider).map(([providerId, pModels]) => {
                    const prov = providers.find(p => p.id === providerId);
                    return (
                      <div key={providerId} className="py-1">
                        <div className="px-2.5 py-1 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                          {prov?.name || providerId}
                        </div>
                        <div className="space-y-0.5">
                          {pModels.map((m) => {
                            const isSelected = m.id === selectedModelId;
                            return (
                              <button
                                key={m.id}
                                onClick={() => {
                                  onSelectModel(m.id);
                                  setModelDropdownOpen(false);
                                }}
                                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left text-xs transition ${
                                  isSelected
                                    ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-medium'
                                    : 'hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                                }`}
                              >
                                <div className="min-w-0 pr-2">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-mono font-medium truncate">{m.id}</span>
                                    {m.supportsVision && (
                                      <span className="text-[9px] px-1 py-0.2 bg-neutral-200 dark:bg-neutral-700 rounded text-neutral-600 dark:text-neutral-300 shrink-0">视觉</span>
                                    )}
                                  </div>
                                  {m.name && m.name !== m.id && (
                                    <div className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
                                      {m.name}
                                    </div>
                                  )}
                                  {m.description && (
                                    <p className="text-[10px] text-neutral-400 dark:text-neutral-500 truncate mt-0.5">{m.description}</p>
                                  )}
                                </div>
                                {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Bottom quick action */}
              <div className="p-2 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50 flex items-center justify-between text-xs">
                {onOpenModelConfig ? (
                  <button
                    type="button"
                    onClick={() => {
                      setModelDropdownOpen(false);
                      onOpenModelConfig();
                    }}
                    className="text-orange-600 dark:text-orange-400 hover:underline flex items-center gap-1 text-[11px] font-medium"
                  >
                    <Server className="w-3 h-3" />
                    <span>AI 模型与服务商配置</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setModelDropdownOpen(false);
                      onOpenSettings('models');
                    }}
                    className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 text-[11px]"
                  >
                    <Settings className="w-3 h-3" />
                    <span>管理自定义模型</span>
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Right Area: Key Switcher, Connection Status, Fast Actions & More */}
      <div className="flex items-center gap-2">
        {/* Status Badge */}
        <div className="hidden sm:block">
          {getStatusBadge()}
        </div>

        {/* Quick API Key switch if multiple keys */}
        {availableKeysForProvider.length > 1 && (
          <div className="relative hidden md:block">
            <button
              onClick={() => {
                setKeyDropdownOpen(!keyDropdownOpen);
                setModelDropdownOpen(false);
                setMoreMenuOpen(false);
              }}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
              title="切换当前提供商的 API Key"
            >
              <Key className="w-3.5 h-3.5 text-neutral-400" />
              <span className="max-w-[80px] truncate">{currentKey?.label || '默认 Key'}</span>
              <ChevronDown className="w-3 h-3 opacity-60" />
            </button>

            {keyDropdownOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setKeyDropdownOpen(false)} />
                <div className="absolute right-0 top-8 w-48 bg-white dark:bg-neutral-900 rounded-xl shadow-xl border border-neutral-200 dark:border-neutral-800 py-1 z-40 text-xs">
                  <div className="px-3 py-1 font-semibold text-[10px] text-neutral-400 uppercase">
                    切换 {currentProvider?.name} Key
                  </div>
                  {availableKeysForProvider.map(k => (
                    <button
                      key={k.id}
                      onClick={() => {
                        onSelectApiKey(k.id);
                        setKeyDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 ${
                        k.id === selectedApiKeyId ? 'text-indigo-600 font-medium' : 'text-neutral-700 dark:text-neutral-300'
                      }`}
                    >
                      <span className="truncate">{k.label}</span>
                      {k.id === selectedApiKeyId && <Check className="w-3.5 h-3.5" />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Agent Mode Switch Button */}
        {onToggleAgentMode && (
          <button
            type="button"
            onClick={() => onToggleAgentMode(!agentMode)}
            className={`hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-medium transition cursor-pointer ${
              agentMode
                ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30 font-semibold'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700'
            }`}
            title={agentMode ? '当前为 Agent 自动化模式：AI 会自主调用工具读写工作区' : '点击开启 Agent 自动化模式'}
          >
            <Bot className={`w-3.5 h-3.5 ${agentMode ? 'text-purple-500' : 'text-neutral-400'}`} />
            <span>Agent 模式</span>
            <span className={`w-1.5 h-1.5 rounded-full ${agentMode ? 'bg-purple-500 animate-pulse' : 'bg-neutral-400'}`} />
          </button>
        )}

        {/* AI Workspace Button */}
        {onOpenWorkspace && (
          <button
            type="button"
            onClick={onOpenWorkspace}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800/80 bg-indigo-50/80 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-xs font-medium transition cursor-pointer shadow-2xs"
            title="打开工作区面板（管理文件、查看改动 Diff、打包下载 ZIP）"
          >
            <Folder className="w-3.5 h-3.5 text-indigo-500" />
            <span className="truncate max-w-[120px]">
              {workspaceName || '工作区'}
            </span>
            {workspaceFilesCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-indigo-600 text-white text-[10px] font-bold">
                {workspaceFilesCount}
              </span>
            )}
            {modifiedFilesCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[10px] font-bold" title={`${modifiedFilesCount} 个文件已修改`}>
                {modifiedFilesCount}改
              </span>
            )}
          </button>
        )}

        {/* Open in new window button */}
        <button
          type="button"
          onClick={() => window.open(window.location.href, '_blank')}
          className="p-2 rounded-xl text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition hidden lg:block"
          title="在新窗口打开客户端"
        >
          <ExternalLink className="w-4 h-4" />
        </button>

        {/* Export chat button */}
        <button
          type="button"
          onClick={onExportChat}
          className="p-2 rounded-xl text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition hidden sm:block"
          title="导出当前聊天"
        >
          <Download className="w-4 h-4" />
        </button>

        {/* More actions menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setMoreMenuOpen(!moreMenuOpen);
              setModelDropdownOpen(false);
              setKeyDropdownOpen(false);
            }}
            className="p-2 rounded-xl text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
            title="更多功能"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {moreMenuOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setMoreMenuOpen(false)} />
              <div className="absolute right-0 top-10 w-48 bg-white dark:bg-neutral-900 rounded-2xl shadow-xl border border-neutral-200 dark:border-neutral-800 py-1.5 z-40 text-xs">
                <button
                  onClick={() => {
                    setMoreMenuOpen(false);
                    onExportChat();
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-2 text-neutral-700 dark:text-neutral-300"
                >
                  <Download className="w-4 h-4" /> 导出当前对话
                </button>
                {onOpenParameters && (
                  <button
                    onClick={() => {
                      setMoreMenuOpen(false);
                      onOpenParameters();
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-2 text-neutral-700 dark:text-neutral-300"
                  >
                    <SlidersHorizontal className="w-4 h-4 text-neutral-500" /> 高级运行参数
                  </button>
                )}
                <button
                  onClick={() => {
                    setMoreMenuOpen(false);
                    onCopyAllChat();
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-2 text-neutral-700 dark:text-neutral-300"
                >
                  <Copy className="w-4 h-4" /> 复制对话全文
                </button>
                <button
                  onClick={() => {
                    setMoreMenuOpen(false);
                    window.open(window.location.href, '_blank');
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-2 text-neutral-700 dark:text-neutral-300"
                >
                  <ExternalLink className="w-4 h-4" /> 新窗口独立运行
                </button>
                <div className="border-t border-neutral-100 dark:border-neutral-800 my-1" />
                <button
                  onClick={() => {
                    setMoreMenuOpen(false);
                    onClearChat();
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" /> 清空当前消息
                </button>
                <div className="border-t border-neutral-100 dark:border-neutral-800 my-1" />
                {onOpenModelConfig && (
                  <button
                    onClick={() => {
                      setMoreMenuOpen(false);
                      onOpenModelConfig();
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-2 text-orange-600 dark:text-orange-400 font-medium"
                  >
                    <Server className="w-4 h-4" /> AI 模型配置
                  </button>
                )}
                {onOpenParameters && (
                  <button
                    onClick={() => {
                      setMoreMenuOpen(false);
                      onOpenParameters();
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-2 text-neutral-700 dark:text-neutral-300"
                  >
                    <SlidersHorizontal className="w-4 h-4 text-[#84cc16]" /> 模型运行参数 (Parameters)
                  </button>
                )}
                <button
                  onClick={() => {
                    setMoreMenuOpen(false);
                    onOpenSettings('chat');
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-2 text-neutral-700 dark:text-neutral-300"
                >
                  <Settings className="w-4 h-4" /> 通用与外观设置
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
