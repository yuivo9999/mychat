import React, { useState } from 'react';
import { 
  X, 
  Layers, 
  Key, 
  Bot, 
  Sparkles, 
  Sliders, 
  Palette, 
  Database, 
  ShieldAlert, 
  Plus, 
  Trash2, 
  Edit2, 
  Eye, 
  EyeOff, 
  Check, 
  RotateCw, 
  Download, 
  Upload, 
  AlertTriangle,
  CheckCircle2,
  HardDrive
} from 'lucide-react';
import { 
  ProviderDefinition, 
  ApiKeyConfig, 
  ModelItem, 
  UserSettings, 
  Conversation 
} from '../types';
import { getAdapterForProvider } from '../services/adapters';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: string;
  onOpenModelConfig?: () => void;
  providers: ProviderDefinition[];
  onSaveProvider: (p: ProviderDefinition) => Promise<void>;
  onDeleteProvider: (id: string) => Promise<void>;
  apiKeys: ApiKeyConfig[];
  onSaveApiKey: (key: ApiKeyConfig) => Promise<void>;
  onDeleteApiKey: (id: string) => Promise<void>;
  models: ModelItem[];
  onSaveModel: (m: ModelItem) => Promise<void>;
  onDeleteModel: (id: string) => Promise<void>;
  settings: UserSettings;
  onSaveSettings: (s: UserSettings) => Promise<void>;
  conversations: Conversation[];
  onImportConversations: (imported: Conversation[]) => Promise<void>;
  onClearAllConversations: () => Promise<void>;
  onClearAllApiKeys: () => Promise<void>;
  onResetAllData: () => Promise<void>;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'providers',
  onOpenModelConfig,
  providers,
  onSaveProvider,
  onDeleteProvider,
  apiKeys,
  onSaveApiKey,
  onDeleteApiKey,
  models,
  onSaveModel,
  onDeleteModel,
  settings,
  onSaveSettings,
  conversations,
  onImportConversations,
  onClearAllConversations,
  onClearAllApiKeys,
  onResetAllData,
}) => {
  const [activeTab, setActiveTab] = useState(initialTab);

  // API Key Form State
  const [editingKeyId, setEditingKeyId] = useState<string | null>(null);
  const [keyProviderId, setKeyProviderId] = useState(providers[0]?.id || 'nvidia');
  const [keyLabel, setKeyLabel] = useState('');
  const [keyValue, setKeyValue] = useState('');
  const [keyBaseUrl, setKeyBaseUrl] = useState('');
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});
  const [testingKeyId, setTestingKeyId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null);

  // Model Form State
  const [editingModelId, setEditingModelId] = useState<string | null>(null);
  const [modelFormId, setModelFormId] = useState('');
  const [modelFormName, setModelFormName] = useState('');
  const [modelFormProviderId, setModelFormProviderId] = useState(providers[0]?.id || 'nvidia');
  const [modelFormVision, setModelFormVision] = useState(false);
  const [modelFormStreaming, setModelFormStreaming] = useState(true);
  const [modelFormTemp, setModelFormTemp] = useState<number>(0.7);
  const [modelFormMaxTokens, setModelFormMaxTokens] = useState<number>(4096);
  const [modelFormSystemPrompt, setModelFormSystemPrompt] = useState('');

  // Provider Form State
  const [newProvName, setNewProvName] = useState('');
  const [newProvBaseUrl, setNewProvBaseUrl] = useState('');
  const [newProvDesc, setNewProvDesc] = useState('');

  if (!isOpen) return null;

  const toggleKeyVisibility = (id: string) => {
    setVisibleKeys(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Handle API Key Save
  const handleSaveKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyValue.trim()) return;

    const newKeyConfig: ApiKeyConfig = {
      id: editingKeyId || `key_${Date.now()}`,
      providerId: keyProviderId,
      label: keyLabel.trim() || `${keyProviderId} Key`,
      apiKey: keyValue.trim(),
      baseUrl: keyBaseUrl.trim() || undefined,
      createdAt: Date.now(),
      isDefault: apiKeys.filter(k => k.providerId === keyProviderId).length === 0,
    };

    await onSaveApiKey(newKeyConfig);
    // Reset form
    setEditingKeyId(null);
    setKeyLabel('');
    setKeyValue('');
    setKeyBaseUrl('');
  };

  const handleEditKey = (key: ApiKeyConfig) => {
    setEditingKeyId(key.id);
    setKeyProviderId(key.providerId);
    setKeyLabel(key.label);
    setKeyValue(key.apiKey);
    setKeyBaseUrl(key.baseUrl || '');
  };

  // Test API Key connection
  const handleTestKey = async (key: ApiKeyConfig) => {
    setTestingKeyId(key.id);
    setTestResult(null);

    const adapter = getAdapterForProvider(key.providerId);
    // Find a model for testing
    const testModel = models.find(m => m.providerId === key.providerId);
    const result = await adapter.testConnection(key, testModel?.id);

    setTestResult({
      id: key.id,
      success: result.success,
      message: result.message,
    });
    setTestingKeyId(null);
  };

  // Handle Model Save
  const handleSaveModel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modelFormId.trim() || !modelFormName.trim()) return;

    const newModel: ModelItem = {
      id: modelFormId.trim(),
      name: modelFormName.trim(),
      providerId: modelFormProviderId,
      supportsVision: modelFormVision,
      supportsFiles: true,
      supportsStreaming: modelFormStreaming,
      temperature: modelFormTemp,
      maxTokens: modelFormMaxTokens,
      systemPrompt: modelFormSystemPrompt.trim() || undefined,
      isCustom: true,
    };

    await onSaveModel(newModel);
    setEditingModelId(null);
    setModelFormId('');
    setModelFormName('');
    setModelFormSystemPrompt('');
  };

  const handleEditModel = (m: ModelItem) => {
    setEditingModelId(m.id);
    setModelFormId(m.id);
    setModelFormName(m.name);
    setModelFormProviderId(m.providerId);
    setModelFormVision(m.supportsVision);
    setModelFormStreaming(m.supportsStreaming);
    setModelFormTemp(m.temperature ?? 0.7);
    setModelFormMaxTokens(m.maxTokens ?? 4096);
    setModelFormSystemPrompt(m.systemPrompt || '');
  };

  // Export conversations JSON
  const handleExportAllChats = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(conversations, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', dataStr);
    dlAnchor.setAttribute('download', `omnichat-backup-${new Date().toISOString().slice(0, 10)}.json`);
    dlAnchor.click();
  };

  // Import conversations JSON
  const handleImportChatsFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (Array.isArray(imported)) {
          await onImportConversations(imported);
          alert(`成功恢复导入 ${imported.length} 个历史对话！`);
        } else {
          alert('导入格式错误：必须为聊天记录 JSON 数组');
        }
      } catch (err: any) {
        alert(`导入解析失败: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  // Export Config
  const handleExportConfig = () => {
    const configData = {
      apiKeys,
      models: models.filter(m => m.isCustom),
      providers: providers.filter(p => p.isCustom),
      settings,
    };
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(configData, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', dataStr);
    dlAnchor.setAttribute('download', `omnichat-config-${new Date().toISOString().slice(0, 10)}.json`);
    dlAnchor.click();
  };

  // Import Config
  const handleImportConfigFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.apiKeys) {
          for (const k of parsed.apiKeys) await onSaveApiKey(k);
        }
        if (parsed.models) {
          for (const m of parsed.models) await onSaveModel(m);
        }
        if (parsed.settings) {
          await onSaveSettings(parsed.settings);
        }
        alert('配置已成功还原！');
      } catch (err: any) {
        alert(`配置恢复失败: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  const tabs = [
    { id: 'providers', label: '1. AI 提供商', icon: Layers },
    { id: 'keys', label: '2. API Key', icon: Key },
    { id: 'models', label: '3. 模型管理', icon: Bot },
    { id: 'default', label: '4. 默认模型', icon: Sparkles },
    { id: 'chat', label: '5. 聊天设置', icon: Sliders },
    { id: 'appearance', label: '6. 外观风格', icon: Palette },
    { id: 'data', label: '7. 数据管理', icon: Database },
    { id: 'advanced', label: '8. 高级设置', icon: ShieldAlert },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 md:p-6 select-none animate-in fade-in duration-200">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl w-full max-w-4xl h-[88vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 md:px-6 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between shrink-0 bg-neutral-50/50 dark:bg-neutral-900/50">
          <div>
            <h2 className="text-base md:text-lg font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-indigo-500" />
              <span>客户端系统设置</span>
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              本地化优先 · 数据与 API Key 均保存在当前浏览器本地
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-200/60 dark:hover:bg-neutral-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Left Tab Nav & Right Content */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
          {/* Navigation Sidebar */}
          <nav className="w-full md:w-52 border-b md:border-b-0 md:border-r border-neutral-200 dark:border-neutral-800 p-2 md:p-3 flex md:flex-col gap-1 overflow-x-auto md:overflow-y-auto shrink-0 bg-neutral-50/30 dark:bg-neutral-950/20">
            {onOpenModelConfig && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenModelConfig();
                }}
                className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-orange-600 dark:text-orange-400 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 transition mb-1 text-left shrink-0"
              >
                <span>⚡ 打开 AI 模型独立配置</span>
                <span className="text-[10px]">→</span>
              </button>
            )}
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2.5 px-3 py-2 md:py-2.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 shadow-xs'
                      : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200/60 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-200'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Tab Content Panels */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
            {/* 1. AI 提供商 */}
            {activeTab === 'providers' && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">AI 提供商分组管理</h3>
                  <p className="text-xs text-neutral-500 mt-1">
                    系统内置主流大模型提供商支持，您可以启用/禁用提供商，或新增自定义 OpenAI 兼容接口。
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {providers.map((p) => (
                    <div
                      key={p.id}
                      className="p-3.5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/40 flex items-start justify-between"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-neutral-900 dark:text-neutral-100 truncate">{p.name}</span>
                          {p.isCustom && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-500">自定义</span>
                          )}
                        </div>
                        <p className="text-[11px] text-neutral-400 mt-1 line-clamp-2 leading-relaxed">{p.description}</p>
                        <p className="text-[10px] text-neutral-400/80 font-mono mt-1.5 truncate">{p.defaultBaseUrl || '无需 Base URL'}</p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {p.isCustom && (
                          <button
                            type="button"
                            onClick={() => onDeleteProvider(p.id)}
                            className="p-1 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                            title="删除自定义提供商"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <input
                          type="checkbox"
                          checked={p.enabled}
                          onChange={(e) => onSaveProvider({ ...p, enabled: e.target.checked })}
                          className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                          title="启用/禁用"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add Custom Provider Form */}
                <div className="p-4 rounded-2xl border border-dashed border-neutral-300 dark:border-neutral-700 bg-neutral-50/30 dark:bg-neutral-900/30 space-y-3">
                  <h4 className="text-xs font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5" />
                    <span>添加自定义 API 提供商 (OpenAI 兼容协议)</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="提供商名称 (例如: 公司内网网关 / 自建 vLLM)"
                      value={newProvName}
                      onChange={(e) => setNewProvName(e.target.value)}
                      className="text-xs p-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
                    />
                    <input
                      type="text"
                      placeholder="Base URL (例如: https://my-gateway.com/v1)"
                      value={newProvBaseUrl}
                      onChange={(e) => setNewProvBaseUrl(e.target.value)}
                      className="text-xs p-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="描述说明 (选填)"
                    value={newProvDesc}
                    onChange={(e) => setNewProvDesc(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      if (!newProvName.trim()) return;
                      const customP: ProviderDefinition = {
                        id: `custom_${Date.now()}`,
                        name: newProvName.trim(),
                        defaultBaseUrl: newProvBaseUrl.trim(),
                        description: newProvDesc.trim() || '用户自建兼容端点',
                        icon: 'Sliders',
                        isCustom: true,
                        enabled: true,
                      };
                      await onSaveProvider(customP);
                      setNewProvName('');
                      setNewProvBaseUrl('');
                      setNewProvDesc('');
                    }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs"
                  >
                    保存提供商
                  </button>
                </div>
              </div>
            )}

            {/* 2. API Key 管理 */}
            {activeTab === 'keys' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">API Key 本地凭证管理</h3>
                  <p className="text-xs text-neutral-500 mt-1">
                    API Key 仅保存在当前浏览器的 IndexedDB 中，不会上传至任何中转服务器。支持针对同一提供商配置多个 API Key 并在聊天界面自由切换。
                  </p>
                </div>

                {/* API Key Form */}
                <form onSubmit={handleSaveKey} className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30 space-y-3">
                  <h4 className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                    {editingKeyId ? '修改 API Key' : '添加新的 API Key'}
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-neutral-500 mb-1">所属 AI 提供商</label>
                      <select
                        value={keyProviderId}
                        onChange={(e) => setKeyProviderId(e.target.value)}
                        className="w-full text-xs p-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
                      >
                        {providers.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-neutral-500 mb-1">自定义名称 (标签)</label>
                      <input
                        type="text"
                        placeholder="例如: 个人专用 / 备用 Key"
                        value={keyLabel}
                        onChange={(e) => setKeyLabel(e.target.value)}
                        className="w-full text-xs p-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-neutral-500 mb-1">API Key 密钥</label>
                    <input
                      type="password"
                      placeholder="sk-..."
                      value={keyValue}
                      onChange={(e) => setKeyValue(e.target.value)}
                      required
                      className="w-full text-xs p-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-neutral-500 mb-1">自定义 API Base URL / 代理地址 (选填，留空使用官方默认地址)</label>
                    <input
                      type="text"
                      placeholder="https://api.openai.com/v1"
                      value={keyBaseUrl}
                      onChange={(e) => setKeyBaseUrl(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white font-mono"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="submit"
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs"
                    >
                      {editingKeyId ? '保存修改' : '保存 API Key'}
                    </button>
                    {editingKeyId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingKeyId(null);
                          setKeyLabel('');
                          setKeyValue('');
                          setKeyBaseUrl('');
                        }}
                        className="px-3 py-2 rounded-xl text-xs text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-800"
                      >
                        取消
                      </button>
                    )}
                  </div>
                </form>

                {/* API Keys List */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                    已保存的 API Key ({apiKeys.length})
                  </h4>

                  {apiKeys.length === 0 ? (
                    <div className="p-6 text-center border border-dashed border-neutral-200 dark:border-neutral-800 rounded-2xl text-xs text-neutral-400">
                      尚未添加任何 API Key。请在上方表单添加您获取的 Key。
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {apiKeys.map((k) => {
                        const isVisible = visibleKeys[k.id];
                        const prov = providers.find(p => p.id === k.providerId);
                        const isTesting = testingKeyId === k.id;
                        const tResult = testResult?.id === k.id ? testResult : null;

                        return (
                          <div
                            key={k.id}
                            className="p-3.5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-2 shadow-2xs"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-xs text-neutral-900 dark:text-neutral-100">{k.label}</span>
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500 font-medium">
                                  {prov?.name || k.providerId}
                                </span>
                                {k.isDefault && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">
                                    默认
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleTestKey(k)}
                                  disabled={isTesting}
                                  className="px-2.5 py-1 text-xs rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 flex items-center gap-1 transition"
                                >
                                  <RotateCw className={`w-3 h-3 ${isTesting ? 'animate-spin' : ''}`} />
                                  <span>{isTesting ? '测试中...' : '测试连接'}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => toggleKeyVisibility(k.id)}
                                  className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                                  title={isVisible ? '隐藏' : '显示完整 Key'}
                                >
                                  {isVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleEditKey(k)}
                                  className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                                  title="编辑"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onDeleteApiKey(k.id)}
                                  className="p-1.5 rounded-lg text-neutral-400 hover:text-red-500"
                                  title="删除"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Masked Key Display */}
                            <div className="text-[11px] font-mono text-neutral-500 bg-neutral-50 dark:bg-neutral-950 p-2 rounded-xl overflow-x-auto">
                              {isVisible ? k.apiKey : `${k.apiKey.slice(0, 6)}••••••••••••••••••••${k.apiKey.slice(-4)}`}
                            </div>

                            {k.baseUrl && (
                              <div className="text-[10px] text-neutral-400 font-mono">
                                Base URL: {k.baseUrl}
                              </div>
                            )}

                            {/* Test Result Message */}
                            {tResult && (
                              <div className={`p-2 rounded-xl text-xs flex items-center gap-1.5 ${
                                tResult.success 
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' 
                                  : 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
                              }`}>
                                {tResult.success ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
                                <span>{tResult.message}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 3. 模型管理 */}
            {activeTab === 'models' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">AI 模型参数与清单</h3>
                  <p className="text-xs text-neutral-500 mt-1">
                    管理各模型的多模态视觉、流式输出、默认温度、上下文窗口与系统预设提示词 (System Prompt)。
                  </p>
                </div>

                {/* Model edit form */}
                <form onSubmit={handleSaveModel} className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30 space-y-3">
                  <h4 className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                    {editingModelId ? `编辑模型: ${editingModelId}` : '添加自定义新模型'}
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-neutral-500 mb-1">模型 ID (API 请求参数)</label>
                      <input
                        type="text"
                        placeholder="例如: gpt-4.5-preview / deepseek-ai/DeepSeek-V3"
                        value={modelFormId}
                        onChange={(e) => setModelFormId(e.target.value)}
                        required
                        className="w-full text-xs p-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-neutral-500 mb-1">显示名称</label>
                      <input
                        type="text"
                        placeholder="例如: GPT 4.5 Preview"
                        value={modelFormName}
                        onChange={(e) => setModelFormName(e.target.value)}
                        required
                        className="w-full text-xs p-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-neutral-500 mb-1">所属提供商</label>
                      <select
                        value={modelFormProviderId}
                        onChange={(e) => setModelFormProviderId(e.target.value)}
                        className="w-full text-xs p-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
                      >
                        {providers.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-neutral-500 mb-1">默认 Temperature ({modelFormTemp})</label>
                      <input
                        type="range"
                        min="0"
                        max="2"
                        step="0.1"
                        value={modelFormTemp}
                        onChange={(e) => setModelFormTemp(parseFloat(e.target.value))}
                        className="w-full accent-indigo-600"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-neutral-500 mb-1">最大 Token 数 (Max Tokens)</label>
                      <input
                        type="number"
                        value={modelFormMaxTokens}
                        onChange={(e) => setModelFormMaxTokens(parseInt(e.target.value) || 4096)}
                        className="w-full text-xs p-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-4 py-1">
                    <label className="flex items-center gap-1.5 text-xs text-neutral-700 dark:text-neutral-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={modelFormVision}
                        onChange={(e) => setModelFormVision(e.target.checked)}
                        className="rounded text-indigo-600 h-4 w-4"
                      />
                      <span>支持图片视觉分析 (Vision)</span>
                    </label>

                    <label className="flex items-center gap-1.5 text-xs text-neutral-700 dark:text-neutral-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={modelFormStreaming}
                        onChange={(e) => setModelFormStreaming(e.target.checked)}
                        className="rounded text-indigo-600 h-4 w-4"
                      />
                      <span>支持打字机流式输出 (Streaming)</span>
                    </label>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-neutral-500 mb-1">专属系统预设词 (System Prompt - 选填)</label>
                    <textarea
                      value={modelFormSystemPrompt}
                      onChange={(e) => setModelFormSystemPrompt(e.target.value)}
                      placeholder="留空则使用全局默认系统设定..."
                      rows={2}
                      className="w-full text-xs p-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white font-sans"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="submit"
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs"
                    >
                      {editingModelId ? '更新模型配置' : '保存新模型'}
                    </button>
                    {editingModelId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingModelId(null);
                          setModelFormId('');
                          setModelFormName('');
                          setModelFormSystemPrompt('');
                        }}
                        className="px-3 py-2 rounded-xl text-xs text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-800"
                      >
                        取消编辑
                      </button>
                    )}
                  </div>
                </form>

                {/* Model items grid */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                    全部已配置模型 ({models.length})
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[400px] overflow-y-auto p-1">
                    {models.map((m) => {
                      const prov = providers.find(p => p.id === m.providerId);
                      return (
                        <div
                          key={m.id}
                          className="p-3 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex items-start justify-between shadow-2xs"
                        >
                          <div className="min-w-0 pr-2">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-xs text-neutral-900 dark:text-neutral-100 truncate">{m.name}</span>
                              {m.supportsVision && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 font-medium">视觉</span>
                              )}
                            </div>
                            <p className="text-[10px] text-neutral-400 font-mono mt-0.5 truncate">{m.id}</p>
                            <span className="text-[10px] text-neutral-400 mt-1 inline-block">
                              {prov?.name || m.providerId}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleEditModel(m)}
                              className="p-1 rounded text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                              title="编辑参数"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            {m.isCustom && (
                              <button
                                type="button"
                                onClick={() => onDeleteModel(m.id)}
                                className="p-1 rounded text-neutral-400 hover:text-red-500"
                                title="删除自定义模型"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* 4. 默认模型 */}
            {activeTab === 'default' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">默认模型与全局系统提示词</h3>
                  <p className="text-xs text-neutral-500 mt-1">
                    新建聊天时自动优先采用的默认模型和初始人格设定。
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                      默认选用的 AI 模型
                    </label>
                    <select
                      value={settings.defaultModelId}
                      onChange={(e) => onSaveSettings({ ...settings, defaultModelId: e.target.value })}
                      className="w-full text-xs p-3 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
                    >
                      {models.map(m => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({providers.find(p => p.id === m.providerId)?.name || m.providerId})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                      全局默认 System Prompt (系统提示词)
                    </label>
                    <textarea
                      value={settings.defaultSystemPrompt}
                      onChange={(e) => onSaveSettings({ ...settings, defaultSystemPrompt: e.target.value })}
                      rows={5}
                      className="w-full text-xs p-3 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white leading-relaxed font-sans"
                    />
                    <p className="text-[11px] text-neutral-400 mt-1">
                      此提示词将作为对话上下文的系统指令发送给模型，指导 AI 的语言风格与专业深度。
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 5. 聊天设置 */}
            {activeTab === 'chat' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">聊天交互与渲染选项</h3>
                  <p className="text-xs text-neutral-500 mt-1">
                    配置消息发送快捷键、渲染行为与排版方式。
                  </p>
                </div>

                <div className="space-y-3">
                  <label className="flex items-center justify-between p-3.5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30 cursor-pointer">
                    <div>
                      <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 block">Enter 键直接发送</span>
                      <span className="text-[11px] text-neutral-400">开启后按 Enter 发送，Shift + Enter 换行；关闭后按 Ctrl/⌘ + Enter 发送</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.enterToSend}
                      onChange={(e) => onSaveSettings({ ...settings, enterToSend: e.target.checked })}
                      className="rounded text-indigo-600 h-4 w-4"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3.5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30 cursor-pointer">
                    <div>
                      <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 block">新消息自动平滑滚动</span>
                      <span className="text-[11px] text-neutral-400">当 AI 生成或接收新消息时，聊天窗口自动跟随滚动到底部</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.autoScroll}
                      onChange={(e) => onSaveSettings({ ...settings, autoScroll: e.target.checked })}
                      className="rounded text-indigo-600 h-4 w-4"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3.5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30 cursor-pointer">
                    <div>
                      <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 block">启用打字机流式输出 (Streaming)</span>
                      <span className="text-[11px] text-neutral-400">AI 逐字逐句实时返回结果；若关闭则等待整体生成完毕后一次性呈现</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.enableStreaming}
                      onChange={(e) => onSaveSettings({ ...settings, enableStreaming: e.target.checked })}
                      className="rounded text-indigo-600 h-4 w-4"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3.5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30 cursor-pointer">
                    <div>
                      <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 block">Markdown 与表格富文本解析</span>
                      <span className="text-[11px] text-neutral-400">将 AI 输出的标题、加粗、列表与表格格式化为精美样式</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.enableMarkdown}
                      onChange={(e) => onSaveSettings({ ...settings, enableMarkdown: e.target.checked })}
                      className="rounded text-indigo-600 h-4 w-4"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3.5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30 cursor-pointer">
                    <div>
                      <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 block">代码块语法高亮与工具栏</span>
                      <span className="text-[11px] text-neutral-400">显示语言标签、一键复制整段代码及直接导出代码文件</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.enableCodeHighlight}
                      onChange={(e) => onSaveSettings({ ...settings, enableCodeHighlight: e.target.checked })}
                      className="rounded text-indigo-600 h-4 w-4"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3.5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30 cursor-pointer">
                    <div>
                      <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 block">显示消息发送时间戳</span>
                      <span className="text-[11px] text-neutral-400">在消息标题旁展示具体的对话时间</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.showTimestamps}
                      onChange={(e) => onSaveSettings({ ...settings, showTimestamps: e.target.checked })}
                      className="rounded text-indigo-600 h-4 w-4"
                    />
                  </label>
                </div>
              </div>
            )}

            {/* 6. 外观风格 */}
            {activeTab === 'appearance' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">主题与排版风格</h3>
                  <p className="text-xs text-neutral-500 mt-1">
                    调整深浅色主题与整体阅读密度。
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-2">色彩模式</label>
                    <div className="grid grid-cols-3 gap-3">
                      {(['light', 'dark', 'system'] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => onSaveSettings({ ...settings, theme: t })}
                          className={`p-3.5 rounded-2xl border text-center text-xs font-medium transition ${
                            settings.theme === t
                              ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold'
                              : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                          }`}
                        >
                          {t === 'light' ? '☀️ 浅色明亮' : t === 'dark' ? '🌙 深色夜间' : '💻 跟随系统'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-2">排版密度</label>
                    <div className="grid grid-cols-3 gap-3">
                      {(['compact', 'standard', 'spacious'] as const).map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => onSaveSettings({ ...settings, fontSize: d })}
                          className={`p-3 rounded-2xl border text-center text-xs font-medium transition ${
                            settings.fontSize === d
                              ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold'
                              : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                          }`}
                        >
                          {d === 'compact' ? '紧凑布局' : d === 'standard' ? '标准舒适' : '宽松易读'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 7. 数据管理 */}
            {activeTab === 'data' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">数据备份与清理</h3>
                  <p className="text-xs text-neutral-500 mt-1">
                    所有聊天记录、文件元数据与 API 密钥完全保存在当前设备浏览器本地，您可以随时导出离线备份或全量导入。
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30 space-y-3">
                    <h4 className="text-xs font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                      <Download className="w-4 h-4 text-indigo-500" />
                      <span>备份聊天记录</span>
                    </h4>
                    <p className="text-[11px] text-neutral-400">将全部 {conversations.length} 个对话以标准化 JSON 文件导出保存到本地磁盘。</p>
                    <button
                      type="button"
                      onClick={handleExportAllChats}
                      className="w-full py-2 bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-100 dark:hover:bg-white text-white dark:text-neutral-900 rounded-xl text-xs font-semibold transition"
                    >
                      导出全部历史记录 (JSON)
                    </button>
                  </div>

                  <div className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30 space-y-3">
                    <h4 className="text-xs font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                      <Upload className="w-4 h-4 text-indigo-500" />
                      <span>恢复聊天记录</span>
                    </h4>
                    <p className="text-[11px] text-neutral-400">从之前导出的 JSON 备份中还原会话列表与全部历史版本。</p>
                    <label className="w-full py-2 bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 rounded-xl text-xs font-semibold transition flex items-center justify-center cursor-pointer">
                      <span>选择并导入备份 JSON</span>
                      <input type="file" accept=".json" onChange={handleImportChatsFile} className="hidden" />
                    </label>
                  </div>

                  <div className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30 space-y-3">
                    <h4 className="text-xs font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                      <Download className="w-4 h-4 text-emerald-500" />
                      <span>导出系统配置</span>
                    </h4>
                    <p className="text-[11px] text-neutral-400">导出自定义模型、自定义 API 提供商及 API Key 配置清单。</p>
                    <button
                      type="button"
                      onClick={handleExportConfig}
                      className="w-full py-2 border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200 rounded-xl text-xs font-semibold transition"
                    >
                      导出配置备份
                    </button>
                  </div>

                  <div className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30 space-y-3">
                    <h4 className="text-xs font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                      <Upload className="w-4 h-4 text-emerald-500" />
                      <span>导入系统配置</span>
                    </h4>
                    <p className="text-[11px] text-neutral-400">导入并在本地覆盖还原系统配置项。</p>
                    <label className="w-full py-2 border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200 rounded-xl text-xs font-semibold transition flex items-center justify-center cursor-pointer">
                      <span>导入配置备份 JSON</span>
                      <input type="file" accept=".json" onChange={handleImportConfigFile} className="hidden" />
                    </label>
                  </div>
                </div>

                {/* Danger Zone */}
                <div className="p-4 rounded-2xl border border-red-200 dark:border-red-900/60 bg-red-50/30 dark:bg-red-950/20 space-y-3">
                  <h4 className="text-xs font-bold text-red-600 dark:text-red-400 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" />
                    <span>危险操作与数据清空</span>
                  </h4>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={async () => {
                        if (confirm('确认清空全部聊天历史记录？此操作不可逆！')) {
                          await onClearAllConversations();
                          alert('已清空全部聊天历史记录。');
                        }
                      }}
                      className="px-3 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-medium transition"
                    >
                      清空全部历史对话
                    </button>

                    <button
                      type="button"
                      onClick={async () => {
                        if (confirm('确认清除保存在本地的全部 API Key？')) {
                          await onClearAllApiKeys();
                          alert('已清除所有 API Key。');
                        }
                      }}
                      className="px-3 py-2 rounded-xl border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/40 text-xs font-medium transition"
                    >
                      清除全部本地 API Key
                    </button>

                    <button
                      type="button"
                      onClick={async () => {
                        if (confirm('警告：此操作将清空本地数据库并恢复初始预设！是否继续？')) {
                          await onResetAllData();
                          alert('系统已恢复初始出厂设置。');
                        }
                      }}
                      className="px-3 py-2 rounded-xl border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/40 text-xs font-medium transition"
                    >
                      恢复出厂初始预设
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 8. 高级设置 */}
            {activeTab === 'advanced' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">网络与高级参数</h3>
                  <p className="text-xs text-neutral-500 mt-1">
                    调整请求超时时长与关于浏览器直接调用第三方 API 的 CORS 跨域须知。
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                      请求超时时间 ({settings.requestTimeout} 秒)
                    </label>
                    <input
                      type="range"
                      min="15"
                      max="300"
                      step="5"
                      value={settings.requestTimeout}
                      onChange={(e) => onSaveSettings({ ...settings, requestTimeout: parseInt(e.target.value) || 60 })}
                      className="w-full accent-indigo-600"
                    />
                    <div className="flex justify-between text-[10px] text-neutral-400 font-mono mt-1">
                      <span>15s (极速)</span>
                      <span>60s (标准)</span>
                      <span>300s (适合长思考推理模型)</span>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30 space-y-2">
                    <h4 className="text-xs font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                      <HardDrive className="w-4 h-4 text-indigo-500" />
                      <span>CORS 跨域说明</span>
                    </h4>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
                      由于本应用为 <strong>100% 浏览器本地运行客户端</strong>，浏览器向未配置 CORS 头的第三方 API 发起直接请求时，可能受到浏览器的跨域同源策略限制。
                      如遇到网络跨域报错，建议：
                    </p>
                    <ul className="text-[11px] text-neutral-500 dark:text-neutral-400 list-disc pl-4 space-y-1">
                      <li>使用开放了 CORS 的 API 网关 (如 OpenRouter, SiliconFlow, 智谱开放平台, DeepSeek 等)</li>
                      <li>在设置对应 API Key 时填入您自建的反向代理 Base URL (如 Cloudflare Worker 代理)</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
