import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  SlidersHorizontal, 
  Info, 
  RotateCcw, 
  Zap, 
  MessageSquare,
  Calculator,
  ListOrdered,
  FoldVertical,
  Terminal,
  Layers,
  FileText,
  FileCode,
  Brain,
  Globe,
  Plus,
  Trash2,
  Star,
  RefreshCcw,
  Check,
  Download,
  Upload,
  FileArchive,
  Loader2,
  CloudDownload,
} from 'lucide-react';
import { ModelParameters, UserSettings, SearchEngineItem } from '../types';
import { DEFAULT_SEARCH_ENGINES } from '../services/db';
import { 
  waitForPythonRuntimeCache, 
  downloadPythonFromCdn, 
  exportPythonRuntime, 
  importPythonRuntime,
  clearPythonRuntimeCache
} from '../services/pythonRuntimeServiceWorker';

interface ParametersModalProps {
  isOpen: boolean;
  onClose: () => void;
  parameters: ModelParameters;
  onChangeParameters: (params: ModelParameters) => void;
  settings?: UserSettings;
  onSaveSettings?: (s: UserSettings) => void;
  modelName?: string;
}

export const ParametersModal: React.FC<ParametersModalProps> = ({
  isOpen,
  onClose,
  parameters,
  onChangeParameters,
  settings,
  onSaveSettings,
  modelName,
}) => {
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  const [showAddEngineForm, setShowAddEngineModal] = useState(false);
  const [newEngineName, setNewEngineName] = useState('');
  const [newEngineUrl, setNewEngineUrl] = useState('');

  // Python Runtime Management State
  const [isPythonReady, setIsPythonReady] = useState<boolean | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadStatus, setDownloadStatus] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      checkPythonStatus();
    }
  }, [isOpen]);

  const checkPythonStatus = async () => {
    try {
      const ready = await waitForPythonRuntimeCache();
      setIsPythonReady(ready);
    } catch {
      setIsPythonReady(false);
    }
  };

  const handleDownloadPython = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    setDownloadProgress(0);
    setDownloadStatus('准备开始下载...');
    
    try {
      const success = await downloadPythonFromCdn((progress, status) => {
        setDownloadProgress(progress);
        if (status) setDownloadStatus(status);
      });
      
      if (success) {
        setIsPythonReady(true);
        setTimeout(() => {
           setDownloadStatus('下载完成！环境已就绪。');
           setTimeout(() => setIsDownloading(false), 2000);
        }, 500);
      } else {
        setTimeout(() => setIsDownloading(false), 5000);
      }
    } catch (err: any) {
      setDownloadStatus(`下载失败: ${err.message}`);
      setTimeout(() => setIsDownloading(false), 5000);
    }
  };

  const handleExportPython = async () => {
    try {
      const blob = await exportPythonRuntime();
      if (!blob) {
        alert('导出失败：本地环境尚未就绪或为空。');
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `python-runtime-backup-${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
      alert('导出发生错误，请查看控制台。');
    }
  };

  const handleImportPython = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsDownloading(true);
    setDownloadProgress(50);
    setDownloadStatus('正在从备份恢复环境...');
    
    try {
      const success = await importPythonRuntime(file);
      if (success) {
        setIsPythonReady(true);
        setDownloadStatus('恢复成功！');
      } else {
        setDownloadStatus('恢复失败：备份文件无效。');
      }
    } catch (err) {
       setDownloadStatus('恢复失败：发生内部错误。');
    } finally {
       setTimeout(() => setIsDownloading(false), 2000);
       if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleClearPythonCache = async () => {
    if (window.confirm('确定要清除本地 Python 缓存吗？这将导致下次执行需要重新下载。')) {
      await clearPythonRuntimeCache();
      setIsPythonReady(false);
    }
  };

  if (!isOpen) return null;

  const searchEngines = settings?.searchEngines || DEFAULT_SEARCH_ENGINES;
  const activeSearchEngineId = settings?.activeSearchEngineId || 'bing';

  // Toggle Search Engine Enable / Disable
  const handleToggleEngineEnabled = (id: string) => {
    if (!settings || !onSaveSettings) return;
    const nextEngines = searchEngines.map(e => e.id === id ? { ...e, enabled: !e.enabled } : e);
    onSaveSettings({ ...settings, searchEngines: nextEngines });
  };

  // Set Search Engine as Primary Active
  const handleSetPrimaryEngine = (id: string) => {
    if (!settings || !onSaveSettings) return;
    const nextEngines = searchEngines.map(e => e.id === id ? { ...e, enabled: true } : e);
    onSaveSettings({ ...settings, searchEngines: nextEngines, activeSearchEngineId: id });
  };

  // Delete Search Engine from List
  const handleDeleteEngine = (id: string) => {
    if (!settings || !onSaveSettings) return;
    const nextEngines = searchEngines.filter(e => e.id !== id);
    const nextActive = activeSearchEngineId === id ? (nextEngines[0]?.id || 'bing') : activeSearchEngineId;
    onSaveSettings({ ...settings, searchEngines: nextEngines, activeSearchEngineId: nextActive });
  };

  // Add Custom Search Engine
  const handleAddCustomEngine = () => {
    if (!newEngineName.trim() || !newEngineUrl.trim() || !settings || !onSaveSettings) return;
    const newId = `custom_${Date.now()}`;
    const urlFormat = newEngineUrl.trim().includes('{query}') ? newEngineUrl.trim() : `${newEngineUrl.trim()}?q={query}`;
    const newEngine: SearchEngineItem = {
      id: newId,
      name: newEngineName.trim(),
      url: urlFormat,
      enabled: true,
      type: 'custom_rss',
      isDefault: false,
    };
    const nextEngines = [...searchEngines, newEngine];
    onSaveSettings({ ...settings, searchEngines: nextEngines });
    setNewEngineName('');
    setNewEngineUrl('');
    setShowAddEngineModal(false);
  };

  // Reset Search Engines to Bing & Google Defaults
  const handleResetSearchEngines = () => {
    if (!settings || !onSaveSettings) return;
    onSaveSettings({ ...settings, searchEngines: DEFAULT_SEARCH_ENGINES, activeSearchEngineId: 'bing' });
  };

  const updateParam = <K extends keyof ModelParameters>(key: K, value: ModelParameters[K]) => {
    onChangeParameters({
      ...parameters,
      [key]: value,
    });
  };

  const handleToggleSetting = (key: keyof UserSettings) => {
    if (!settings || !onSaveSettings) return;
    const currentVal = settings[key];
    const newVal = currentVal === undefined ? false : !currentVal;
    const updated = { ...settings, [key]: newVal };
    onSaveSettings(updated);

    if (key === 'enableStreaming') {
      updateParam('stream', newVal as boolean);
    }
  };

  const resetToDefaults = () => {
    onChangeParameters({
      stream: true,
      promptPerfect: false,
      context7: false,
      executeScript: false,
      limitMaxTokens: false,
      maxTokens: 4096,
      temperature: 0.7,
    });
    if (settings && onSaveSettings) {
      onSaveSettings({
        ...settings,
        enableStreaming: true,
        autoScroll: true,
        enableMarkdown: false,
        enableCodeHighlight: true,
        showTimestamps: true,
        renderLatex: true,
        showLineNumbers: true,
        collapseLongCode: true,
        showStreamingCursor: true,
        compactMode: false,
        boldHeadings: true,
        enableChatContextMemory: false,
      });
    }
  };

  const tooltips: Record<string, string> = {
    stream: '开启打字机逐字输出。关闭则等待整体生成完毕后一次性呈现。',
    promptPerfect: '开启后在发送给 AI 之前，由专用引擎自动将您的简短提示词重写为专业、结构清晰、完美的 Prompt 模板，提高生成质量。',
    context7: '开启后系统将采用“智能 7 轮高精度平衡窗口”，精准维持最近的 7 轮对话为全保真高对比度上下文，超出部分自动由智能摘要压缩。兼顾超长对话记忆与极低 Token 资源消耗。',
    executeScript: '开启后允许 Agent 在服务端隔离临时副本中执行 Shell、Python、Node、编译和测试命令。命令产生的文本文件会回传项目；运行产物不会保留。请仅在可信工作区中启用。',
    maxTokens: '单次回复允许生成的最大 Token 限制（4096 约合 2000 个汉字）。',
    temperature: '控制回答的多样性。0.0~0.3 严谨确定（代码/数学）；0.7~1.0 丰富发散（创意/写作）。',
    latex: '自动通过 KaTeX 引擎将数学公式/物理符号/微积分渲染为学术级排版。',
    lineNumbers: '在代码块左侧附带微弱灰度行号，长代码定位更清晰。',
    collapse: '代码超出高度时自动折叠收起，提供“展开完整代码”按钮，移动端浏览更流畅。',
    cursor: '打字机逐字生成时末尾伴随微闪的呼吸光标（▋），生成完毕自动隐去。',
    compact: '缩小消息气泡上下边距、微调字号 and 间隙，大幅提升单屏信息展示密度。',
    chatContextMemory: '允许 AI 记住历史对话中提取的重要需求与约定。关闭可大幅节省输入 Token 消耗。',
  };

  const streamVal = settings?.enableStreaming ?? parameters.stream ?? true;
  const promptPerfectVal = parameters.promptPerfect ?? false;
  const context7Val = parameters.context7 ?? false;
  const executeScriptVal = parameters.executeScript ?? false;

  return (
    <div className="parameters-modal fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 select-none animate-in fade-in duration-150">
      <div className="parameters-card bg-neutral-900 text-neutral-200 border border-neutral-800 rounded-2xl sm:rounded-3xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
        
        {/* Header - Fixed & Compact for Mobile */}
        <div className="parameters-header p-3.5 px-4 border-b border-neutral-800/90 flex items-center justify-between shrink-0 bg-neutral-900/60">
          <div className="flex items-center gap-2 min-w-0 pr-2">
            <div className="w-7 h-7 rounded-lg bg-lime-500/15 border border-lime-500/30 flex items-center justify-center text-lime-400 shrink-0">
              <SlidersHorizontal className="param-icon w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <h3 className="param-modal-title text-sm font-bold tracking-tight text-neutral-100 whitespace-nowrap">
                运行参数
              </h3>
              {modelName && (
                <p className="param-modal-sub text-[11px] text-neutral-400 truncate max-w-[180px] sm:max-w-[240px]">
                  模型：<span className="param-model-target text-lime-400 font-medium">{modelName}</span>
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={resetToDefaults}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition cursor-pointer"
              title="重置全部参数为推荐默认值"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition cursor-pointer"
              title="关闭"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-4 text-xs scrollbar-thin scrollbar-thumb-neutral-800">
          
          {/* Section 1: 模型生成参数 */}
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 text-neutral-300 font-bold text-xs pb-1 border-b border-neutral-800/80">
              <Zap className="param-icon w-3.5 h-3.5 text-lime-400" />
              <span className="param-modal-title">模型生成参数</span>
            </div>

            {/* 1. 流式输出 */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-2xs">
              <div className="space-y-0.5 pr-2">
                <div className="flex items-center gap-1.5 relative">
                  <span className="param-item-label text-xs font-semibold text-neutral-900 dark:text-neutral-100">流式输出</span>
                  <button
                    type="button"
                    onMouseEnter={() => setActiveTooltip('stream')}
                    onMouseLeave={() => setActiveTooltip(null)}
                    onClick={() => setActiveTooltip(activeTooltip === 'stream' ? null : 'stream')}
                    className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                  >
                    <Info className="w-3.5 h-3.5" />
                  </button>
                  {activeTooltip === 'stream' && (
                    <div className="absolute left-0 top-6 z-20 w-56 p-2 bg-neutral-900 border border-neutral-700 text-[11px] text-neutral-300 rounded-xl shadow-xl">
                      {tooltips.stream}
                    </div>
                  )}
                </div>
                <p className="param-item-sub text-[11px] text-neutral-500 dark:text-neutral-400">逐字实时呈现回答</p>
              </div>

              <button
                type="button"
                onClick={() => {
                  const nextVal = !streamVal;
                  updateParam('stream', nextVal);
                  if (settings && onSaveSettings) {
                    onSaveSettings({ ...settings, enableStreaming: nextVal });
                  }
                }}
                className={`param-toggle w-10 h-5 flex items-center rounded-full p-0.5 cursor-pointer transition-colors shrink-0 ${
                  streamVal ? 'bg-[#84cc16] bg-lime-500' : 'bg-neutral-300 dark:bg-neutral-800'
                }`}
              >
                <div
                  className={`param-toggle-dot bg-white dark:bg-black w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    streamVal ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* 1.5. 提示词完美优化 (Prompt Perfect) */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-2xs">
              <div className="space-y-0.5 pr-2">
                <div className="flex items-center gap-1.5 relative">
                  <span className="param-item-label text-xs font-semibold text-neutral-900 dark:text-neutral-100">Prompt Perfect 提示词优化</span>
                  <button
                    type="button"
                    onMouseEnter={() => setActiveTooltip('promptPerfect')}
                    onMouseLeave={() => setActiveTooltip(null)}
                    onClick={() => setActiveTooltip(activeTooltip === 'promptPerfect' ? null : 'promptPerfect')}
                    className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                  >
                    <Info className="w-3.5 h-3.5" />
                  </button>
                  {activeTooltip === 'promptPerfect' && (
                    <div className="absolute left-0 top-6 z-20 w-56 p-2 bg-neutral-900 border border-neutral-700 text-[11px] text-neutral-300 rounded-xl shadow-xl">
                      {tooltips.promptPerfect}
                    </div>
                  )}
                </div>
                <p className="param-item-sub text-[11px] text-neutral-500 dark:text-neutral-400">自动改写并极速提升提示词质量</p>
              </div>

              <button
                type="button"
                onClick={() => {
                  updateParam('promptPerfect', !promptPerfectVal);
                }}
                className={`param-toggle w-10 h-5 flex items-center rounded-full p-0.5 cursor-pointer transition-colors shrink-0 ${
                  promptPerfectVal ? 'bg-[#84cc16] bg-lime-500' : 'bg-neutral-300 dark:bg-neutral-800'
                }`}
              >
                <div
                  className={`param-toggle-dot bg-white dark:bg-black w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    promptPerfectVal ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* 1.6. Context 7 轮高精度历史平衡 */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-2xs">
              <div className="space-y-0.5 pr-2">
                <div className="flex items-center gap-1.5 relative">
                  <span className="param-item-label text-xs font-semibold text-neutral-900 dark:text-neutral-100">Context 7 历史平衡</span>
                  <button
                    type="button"
                    onMouseEnter={() => setActiveTooltip('context7')}
                    onMouseLeave={() => setActiveTooltip(null)}
                    onClick={() => setActiveTooltip(activeTooltip === 'context7' ? null : 'context7')}
                    className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                  >
                    <Info className="w-3.5 h-3.5" />
                  </button>
                  {activeTooltip === 'context7' && (
                    <div className="absolute left-0 top-6 z-20 w-56 p-2 bg-neutral-900 border border-neutral-700 text-[11px] text-neutral-300 rounded-xl shadow-xl">
                      {tooltips.context7}
                    </div>
                  )}
                </div>
                <p className="param-item-sub text-[11px] text-neutral-500 dark:text-neutral-400">精准锁固 7 轮高保真上下文记忆</p>
              </div>

              <button
                type="button"
                onClick={() => {
                  updateParam('context7', !context7Val);
                }}
                className={`param-toggle w-10 h-5 flex items-center rounded-full p-0.5 cursor-pointer transition-colors shrink-0 ${
                  context7Val ? 'bg-[#84cc16] bg-lime-500' : 'bg-neutral-300 dark:bg-neutral-800'
                }`}
              >
                <div
                  className={`param-toggle-dot bg-white dark:bg-black w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    context7Val ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* 1.7. 运行脚本权限 (Execute Script) */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-2xs">
              <div className="space-y-0.5 pr-2">
                <div className="flex items-center gap-1.5 relative">
                  <span className="param-item-label text-xs font-semibold text-neutral-900 dark:text-neutral-100">运行脚本与命令</span>
                  <button
                    type="button"
                    onMouseEnter={() => setActiveTooltip('executeScript')}
                    onMouseLeave={() => setActiveTooltip(null)}
                    onClick={() => setActiveTooltip(activeTooltip === 'executeScript' ? null : 'executeScript')}
                    className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                  >
                    <Info className="w-3.5 h-3.5" />
                  </button>
                  {activeTooltip === 'executeScript' && (
                    <div className="absolute left-0 top-6 z-20 w-56 p-2 bg-neutral-900 border border-neutral-700 text-[11px] text-neutral-300 rounded-xl shadow-xl">
                      {tooltips.executeScript}
                    </div>
                  )}
                </div>
                <p className="param-item-sub text-[11px] text-neutral-500 dark:text-neutral-400">允许 Agent 在终端运行脚本与编译</p>
              </div>

              <button
                type="button"
                onClick={() => {
                  updateParam('executeScript', !executeScriptVal);
                }}
                className={`param-toggle w-10 h-5 flex items-center rounded-full p-0.5 cursor-pointer transition-colors shrink-0 ${
                  executeScriptVal ? 'bg-[#84cc16] bg-lime-500' : 'bg-neutral-300 dark:bg-neutral-800'
                }`}
              >
                <div
                  className={`param-toggle-dot bg-white dark:bg-black w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    executeScriptVal ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>


            {/* 2. 采样温度 */}
            <div className="space-y-2 p-2.5 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 relative">
                  <span className="param-item-label text-xs font-semibold text-neutral-900 dark:text-neutral-100">采样温度</span>
                  <button
                    type="button"
                    onMouseEnter={() => setActiveTooltip('temperature')}
                    onMouseLeave={() => setActiveTooltip(null)}
                    onClick={() => setActiveTooltip(activeTooltip === 'temperature' ? null : 'temperature')}
                    className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                  >
                    <Info className="w-3.5 h-3.5" />
                  </button>
                  {activeTooltip === 'temperature' && (
                    <div className="absolute left-0 top-6 z-20 w-56 p-2 bg-neutral-900 border border-neutral-700 text-[11px] text-neutral-300 rounded-xl shadow-xl">
                      {tooltips.temperature}
                    </div>
                  )}
                </div>

                <input
                  type="number"
                  min={0}
                  max={2}
                  step={0.05}
                  value={parameters.temperature ?? 0.7}
                  onChange={(e) => updateParam('temperature', parseFloat(e.target.value) || 0)}
                  className="param-input w-16 text-right bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 focus:border-lime-500 text-neutral-900 dark:text-white px-2 py-0.5 rounded-lg text-xs font-mono outline-hidden"
                />
              </div>

              <div className="relative pt-1">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={parameters.temperature ?? 0.7}
                  onChange={(e) => updateParam('temperature', parseFloat(e.target.value))}
                  className="param-slider w-full h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-lime-400"
                />
                <div className="flex justify-between text-[10px] param-slider-ticks text-neutral-500 font-mono mt-1 select-none">
                  <span>0 (代码/严谨)</span>
                  <span>0.7 (默认)</span>
                  <span>1.0 (创意)</span>
                </div>
              </div>
            </div>

            {/* 3. 最大生成长度 */}
            <div className="space-y-2 p-2.5 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 relative min-w-0">
                  <span className="param-item-label text-xs font-semibold text-neutral-900 dark:text-neutral-100 truncate">最大 Token 限制</span>
                  <button
                    type="button"
                    onMouseEnter={() => setActiveTooltip('maxTokens')}
                    onMouseLeave={() => setActiveTooltip(null)}
                    onClick={() => setActiveTooltip(activeTooltip === 'maxTokens' ? null : 'maxTokens')}
                    className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 shrink-0"
                  >
                    <Info className="w-3.5 h-3.5" />
                  </button>
                  {activeTooltip === 'maxTokens' && (
                    <div className="absolute left-0 top-6 z-20 w-56 p-2 bg-neutral-900 border border-neutral-700 text-[11px] text-neutral-300 rounded-xl shadow-xl">
                      {tooltips.maxTokens}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-neutral-500 dark:text-neutral-400 font-medium">
                    {parameters.limitMaxTokens ? '开启限制' : '默认自适应 (无限制)'}
                  </span>
                  <button
                    type="button"
                    onClick={() => updateParam('limitMaxTokens', !parameters.limitMaxTokens)}
                    className={`param-toggle w-8 h-4 flex items-center rounded-full p-0.5 cursor-pointer transition-colors shrink-0 ${
                      parameters.limitMaxTokens ? 'bg-[#84cc16] bg-lime-500' : 'bg-neutral-300 dark:bg-neutral-900 border border-neutral-400 dark:border-neutral-700'
                    }`}
                  >
                    <div
                      className={`bg-white dark:bg-black w-3 h-3 rounded-full shadow-md transform transition-transform ${
                        parameters.limitMaxTokens ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {parameters.limitMaxTokens ? (
                <div className="space-y-2 pt-1 animate-in fade-in duration-100">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-neutral-500 dark:text-neutral-400">限制数值 (Tokens)</span>
                    <input
                      type="number"
                      min={1}
                      max={32768}
                      value={parameters.maxTokens ?? 4096}
                      onChange={(e) => updateParam('maxTokens', parseInt(e.target.value) || 1)}
                      className="param-input w-20 text-right bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 focus:border-lime-500 text-neutral-900 dark:text-white px-2 py-0.5 rounded-lg text-xs font-mono outline-hidden"
                    />
                  </div>

                  <div className="relative pt-1">
                    <input
                      type="range"
                      min={256}
                      max={12288}
                      step={256}
                      value={parameters.maxTokens ?? 4096}
                      onChange={(e) => updateParam('maxTokens', parseInt(e.target.value))}
                      className="param-slider w-full h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-lime-400"
                    />
                    <div className="flex justify-between text-[10px] param-slider-ticks text-neutral-500 font-mono mt-1 select-none">
                      <span>256</span>
                      <span>4096</span>
                      <span>12288</span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-neutral-500 leading-normal pl-1 pt-0.5">
                  已关闭限制。模型将不受硬性截断，由其内置配置或生成上下文自适应输出。
                </p>
              )}
            </div>

            {/* Python 环境管理 Section */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-1.5 text-neutral-300 font-bold text-xs pb-1 border-b border-neutral-800/80">
                <Terminal className="param-icon w-3.5 h-3.5 text-blue-400" />
                <span className="param-modal-title">本地 Python 环境管理</span>
                {isPythonReady === true && (
                   <span className="ml-auto text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-md border border-blue-500/30">
                     本地化就绪
                   </span>
                )}
              </div>

              <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700/80 space-y-3">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-neutral-600 dark:text-neutral-400">本地 Pyodide 运行时 (~30MB)</span>
                    <span className="text-[10px] font-mono text-neutral-500 uppercase">
                      {isPythonReady === null ? '正在检查...' : (isPythonReady ? '已缓存 (离线可用)' : '未下载')}
                    </span>
                  </div>
                  
                  {isDownloading ? (
                    <div className="space-y-2 py-1">
                      <div className="flex justify-between items-center text-[10px] text-blue-400 animate-pulse">
                        <span className="flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          {downloadStatus}
                        </span>
                        <span>{downloadProgress}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-neutral-200 dark:bg-neutral-900 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-500 transition-all duration-300 ease-out"
                          style={{ width: `${downloadProgress}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleDownloadPython}
                        className="flex items-center justify-center gap-1.5 py-2 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[11px] font-medium transition shadow-sm active:scale-95"
                      >
                        <CloudDownload className="w-3.5 h-3.5" />
                        {isPythonReady ? '重新极速下载' : '手动极速下载'}
                      </button>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center justify-center gap-1.5 py-2 px-3 bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 dark:hover:bg-neutral-600 text-neutral-800 dark:text-neutral-100 rounded-lg text-[11px] font-medium transition shadow-sm active:scale-95"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        导入备份环境
                      </button>
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleImportPython} 
                        accept=".zip" 
                        className="hidden" 
                      />
                      <button
                        type="button"
                        onClick={handleExportPython}
                        disabled={!isPythonReady}
                        className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-[11px] font-medium transition shadow-sm active:scale-95 ${
                          isPythonReady 
                            ? 'bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 dark:hover:bg-neutral-600 text-neutral-800 dark:text-neutral-100' 
                            : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400 cursor-not-allowed opacity-50'
                        }`}
                      >
                        <Download className="w-3.5 h-3.5" />
                        导出本地备份
                      </button>
                      <button
                        type="button"
                        onClick={handleClearPythonCache}
                        className="flex items-center justify-center gap-1.5 py-2 px-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg text-[11px] font-medium transition border border-red-500/20 active:scale-95"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        清除本地缓存
                      </button>
                    </div>
                  )}
                </div>
                
                <p className="text-[10px] text-neutral-500 leading-relaxed italic bg-blue-500/5 p-2 rounded-lg border border-blue-500/10">
                  提示：加速下载将通过 <span className="text-blue-400">cdn.jsdelivr.net</span> 镜像进行，大幅提升国内访问速度。环境就绪后支持离线执行 Python。
                </p>
              </div>
            </div>
          </div>

          {/* Section 2: Markdown 元素能力分散拆解 (独立粒度开关，无相互干扰) */}
          {settings && onSaveSettings && (
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between pb-1 border-b border-neutral-200 dark:border-neutral-800/80">
                <div className="flex items-center gap-1.5 text-neutral-800 dark:text-neutral-300 font-bold text-xs">
                  <FileText className="param-icon w-3.5 h-3.5 text-lime-600 dark:text-lime-400" />
                  <span className="param-modal-title">Markdown 渲染能力细分拆解</span>
                </div>
                <span className="text-[10px] text-lime-600 dark:text-lime-400 font-mono font-medium">独立原子控制</span>
              </div>

              <div className="space-y-1.5">
                {/* 1. 标题结构解析 */}
                <label className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-2xs cursor-pointer hover:border-lime-500/50 transition">
                  <div className="space-y-0.5 pr-2">
                    <span className="param-item-label text-xs font-semibold text-neutral-900 dark:text-neutral-100 block">标题结构解析 (#, ##, ###)</span>
                    <span className="param-item-sub text-[10px] text-neutral-500 dark:text-neutral-400 block">控制 `#` 转换层级 Heading 标题与字体缩放</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.mdHeadings ?? true}
                    onChange={() => handleToggleSetting('mdHeadings')}
                    className="rounded text-lime-500 h-3.5 w-3.5 shrink-0 accent-lime-500 cursor-pointer"
                  />
                </label>

                {/* 2. 行内文本样式 */}
                <label className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-2xs cursor-pointer hover:border-lime-500/50 transition">
                  <div className="space-y-0.5 pr-2">
                    <span className="param-item-label text-xs font-semibold text-neutral-900 dark:text-neutral-100 block">行内文本样式 (加粗/斜体/删除线)</span>
                    <span className="param-item-sub text-[10px] text-neutral-500 dark:text-neutral-400 block">控制 `**加粗**`、`*斜体*`、`~删除线~` 与行内代码块</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.mdTextStyle ?? true}
                    onChange={() => handleToggleSetting('mdTextStyle')}
                    className="rounded text-lime-500 h-3.5 w-3.5 shrink-0 accent-lime-500 cursor-pointer"
                  />
                </label>

                {/* 3. 列表与段落引用 */}
                <label className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-2xs cursor-pointer hover:border-lime-500/50 transition">
                  <div className="space-y-0.5 pr-2">
                    <span className="param-item-label text-xs font-semibold text-neutral-900 dark:text-neutral-100 block">列表与段落引用 (1., -, &gt;)</span>
                    <span className="param-item-sub text-[10px] text-neutral-500 dark:text-neutral-400 block">控制有序/无序列表与 `&gt;` 段落引用缩进</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.mdListsAndQuotes ?? true}
                    onChange={() => handleToggleSetting('mdListsAndQuotes')}
                    className="rounded text-lime-500 h-3.5 w-3.5 shrink-0 accent-lime-500 cursor-pointer"
                  />
                </label>

                {/* 4. 数据表格解析 */}
                <label className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-2xs cursor-pointer hover:border-lime-500/50 transition">
                  <div className="space-y-0.5 pr-2">
                    <span className="param-item-label text-xs font-semibold text-neutral-900 dark:text-neutral-100 block">数据表格排版 (| 标题 | 数据 |)</span>
                    <span className="param-item-sub text-[10px] text-neutral-500 dark:text-neutral-400 block">独立控制 Markdown 数据表格的 DOM 卡片与网格渲染</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.mdTables ?? true}
                    onChange={() => handleToggleSetting('mdTables')}
                    className="rounded text-lime-500 h-3.5 w-3.5 shrink-0 accent-lime-500 cursor-pointer"
                  />
                </label>

                {/* 5. 超链接与图片解析 */}
                <label className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-2xs cursor-pointer hover:border-lime-500/50 transition">
                  <div className="space-y-0.5 pr-2">
                    <span className="param-item-label text-xs font-semibold text-neutral-900 dark:text-neutral-100 block">超链接与嵌入图片 ([链接], ![图片])</span>
                    <span className="param-item-sub text-[10px] text-neutral-500 dark:text-neutral-400 block">控制安全超链接跳转与图片富媒体卡片展示</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.mdLinksAndImages ?? true}
                    onChange={() => handleToggleSetting('mdLinksAndImages')}
                    className="rounded text-lime-500 h-3.5 w-3.5 shrink-0 accent-lime-500 cursor-pointer"
                  />
                </label>
              </div>
            </div>
          )}

          {/* Section 3: 代码框能力细化拆解 */}
          {settings && onSaveSettings && (
            <div className="space-y-2 pt-2">
              <div className="flex items-center gap-1.5 text-neutral-800 dark:text-neutral-300 font-bold text-xs pb-1 border-b border-neutral-200 dark:border-neutral-800/80">
                <FileCode className="param-icon w-3.5 h-3.5 text-lime-600 dark:text-lime-400" />
                <span className="param-modal-title">代码框与工具栏能力细分</span>
              </div>

              <div className="space-y-1.5">
                {/* 1. 代码框总开关 */}
                <label className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-2xs cursor-pointer hover:border-lime-500/50 transition">
                  <div className="space-y-0.5 pr-2">
                    <span className="param-item-label text-xs font-semibold text-neutral-900 dark:text-neutral-100 block">启用「代码框」高级卡片容器</span>
                    <span className="param-item-sub text-[11px] text-neutral-500 dark:text-neutral-400 block">
                      开启代码块的黑质感边框与下方独立细分工具按钮
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.useCodeBox ?? true}
                    onChange={() => handleToggleSetting('useCodeBox')}
                    className="rounded text-lime-500 h-4 w-4 shrink-0 accent-lime-500 cursor-pointer"
                  />
                </label>

                {settings.useCodeBox && (
                  <div className="pl-3 space-y-1.5 border-l-2 border-lime-500/40 ml-2 animate-in slide-in-from-top-1 duration-150">
                    {/* 代码头部栏 */}
                    <label className="flex items-center justify-between p-2 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/80 dark:border-neutral-700/80 text-neutral-800 dark:text-neutral-200 cursor-pointer hover:border-neutral-300 transition">
                      <span className="param-item-label text-[11px] font-medium text-neutral-800 dark:text-neutral-200">显示代码语言头部 Bar</span>
                      <input
                        type="checkbox"
                        checked={settings.codeHeaderBar ?? true}
                        onChange={() => handleToggleSetting('codeHeaderBar')}
                        className="rounded text-lime-500 h-3.5 w-3.5 shrink-0 accent-lime-500 cursor-pointer"
                      />
                    </label>

                    {/* 复制代码按钮 */}
                    <label className="flex items-center justify-between p-2 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/80 dark:border-neutral-700/80 text-neutral-800 dark:text-neutral-200 cursor-pointer hover:border-neutral-300 transition">
                      <span className="param-item-label text-[11px] font-medium text-neutral-800 dark:text-neutral-200">显示一键复制代码按钮</span>
                      <input
                        type="checkbox"
                        checked={settings.codeShowCopyBtn ?? true}
                        onChange={() => handleToggleSetting('codeShowCopyBtn')}
                        className="rounded text-lime-500 h-3.5 w-3.5 shrink-0 accent-lime-500 cursor-pointer"
                      />
                    </label>

                    {/* 下载代码文件按钮 */}
                    <label className="flex items-center justify-between p-2 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/80 dark:border-neutral-700/80 text-neutral-800 dark:text-neutral-200 cursor-pointer hover:border-neutral-300 transition">
                      <span className="param-item-label text-[11px] font-medium text-neutral-800 dark:text-neutral-200">显示下载代码文件按钮</span>
                      <input
                        type="checkbox"
                        checked={settings.codeShowDownloadBtn ?? true}
                        onChange={() => handleToggleSetting('codeShowDownloadBtn')}
                        className="rounded text-lime-500 h-3.5 w-3.5 shrink-0 accent-lime-500 cursor-pointer"
                      />
                    </label>

                    {/* 加入工作区按钮 */}
                    <label className="flex items-center justify-between p-2 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/80 dark:border-neutral-700/80 text-neutral-800 dark:text-neutral-200 cursor-pointer hover:border-neutral-300 transition">
                      <span className="param-item-label text-[11px] font-medium text-neutral-800 dark:text-neutral-200">显示同步入工作区按钮</span>
                      <input
                        type="checkbox"
                        checked={settings.codeShowAddToWorkspaceBtn ?? true}
                        onChange={() => handleToggleSetting('codeShowAddToWorkspaceBtn')}
                        className="rounded text-lime-500 h-3.5 w-3.5 shrink-0 accent-lime-500 cursor-pointer"
                      />
                    </label>

                    {/* 代码块显示行号 */}
                    <label className="flex items-center justify-between p-2 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/80 dark:border-neutral-700/80 text-neutral-800 dark:text-neutral-200 cursor-pointer hover:border-neutral-300 transition">
                      <span className="param-item-label text-[11px] font-medium text-neutral-800 dark:text-neutral-200">显示代码行号</span>
                      <input
                        type="checkbox"
                        checked={settings.showLineNumbers ?? true}
                        onChange={() => handleToggleSetting('showLineNumbers')}
                        className="rounded text-lime-500 h-3.5 w-3.5 shrink-0 accent-lime-500 cursor-pointer"
                      />
                    </label>

                    {/* 长代码块自动限制高度 */}
                    <label className="flex items-center justify-between p-2 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/80 dark:border-neutral-700/80 text-neutral-800 dark:text-neutral-200 cursor-pointer hover:border-neutral-300 transition">
                      <span className="param-item-label text-[11px] font-medium text-neutral-800 dark:text-neutral-200">长代码块高度折叠 (≥14行)</span>
                      <input
                        type="checkbox"
                        checked={settings.collapseLongCode ?? true}
                        onChange={() => handleToggleSetting('collapseLongCode')}
                        className="rounded text-lime-500 h-3.5 w-3.5 shrink-0 accent-lime-500 cursor-pointer"
                      />
                    </label>

                    {/* 代码语法高亮 */}
                    <label className="flex items-center justify-between p-2 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/80 dark:border-neutral-700/80 text-neutral-800 dark:text-neutral-200 cursor-pointer hover:border-neutral-300 transition">
                      <span className="param-item-label text-[11px] font-medium text-neutral-800 dark:text-neutral-200">语法高亮着色 (Highlight.js)</span>
                      <input
                        type="checkbox"
                        checked={settings.enableCodeHighlight ?? true}
                        onChange={() => handleToggleSetting('enableCodeHighlight')}
                        className="rounded text-lime-500 h-3.5 w-3.5 shrink-0 accent-lime-500 cursor-pointer"
                      />
                    </label>
                  </div>
                )}

                {/* 2. 文本框开关及子能力 */}
                <label className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-2xs cursor-pointer hover:border-lime-500/50 transition">
                  <div className="space-y-0.5 pr-2">
                    <span className="param-item-label text-xs font-semibold text-neutral-900 dark:text-neutral-100 block">启用「文本框」引用段落容器</span>
                    <span className="param-item-sub text-[11px] text-neutral-500 dark:text-neutral-400 block">
                      开启引用、Blockquote 段落的卡片背景与左侧导向条
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.useTextBox ?? true}
                    onChange={() => handleToggleSetting('useTextBox')}
                    className="rounded text-lime-500 h-4 w-4 shrink-0 accent-lime-500 cursor-pointer"
                  />
                </label>

                {settings.useTextBox && (
                  <div className="pl-3 space-y-1.5 border-l-2 border-lime-500/40 ml-2 animate-in slide-in-from-top-1 duration-150">
                    <label className="flex items-center justify-between p-2 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/80 dark:border-neutral-700/80 text-neutral-800 dark:text-neutral-200 cursor-pointer hover:border-neutral-300 transition">
                      <span className="param-item-label text-[11px] font-medium text-neutral-800 dark:text-neutral-200">文本框卡片边框与导向条</span>
                      <input
                        type="checkbox"
                        checked={settings.textBoxBorder ?? true}
                        onChange={() => handleToggleSetting('textBoxBorder')}
                        className="rounded text-lime-500 h-3.5 w-3.5 shrink-0 accent-lime-500 cursor-pointer"
                      />
                    </label>
                    <label className="flex items-center justify-between p-2 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/80 dark:border-neutral-700/80 text-neutral-800 dark:text-neutral-200 cursor-pointer hover:border-neutral-300 transition">
                      <span className="param-item-label text-[11px] font-medium text-neutral-800 dark:text-neutral-200">文本框柔和背景填充</span>
                      <input
                        type="checkbox"
                        checked={settings.textBoxBackground ?? true}
                        onChange={() => handleToggleSetting('textBoxBackground')}
                        className="rounded text-lime-500 h-3.5 w-3.5 shrink-0 accent-lime-500 cursor-pointer"
                      />
                    </label>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Section 4: LaTeX 科学公式细粒度能力拆解 */}
          {settings && onSaveSettings && (
            <div className="space-y-2 pt-2">
              <div className="flex items-center gap-1.5 text-neutral-800 dark:text-neutral-300 font-bold text-xs pb-1 border-b border-neutral-200 dark:border-neutral-800/80">
                <Calculator className="param-icon w-3.5 h-3.5 text-lime-600 dark:text-lime-400" />
                <span className="param-modal-title">LaTeX 科学公式细粒度解析</span>
              </div>

              <div className="space-y-1.5">
                <label className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-2xs cursor-pointer hover:border-lime-500/50 transition">
                  <div className="space-y-0.5 pr-2">
                    <span className="param-item-label text-xs font-semibold text-neutral-900 dark:text-neutral-100 block">启用 KaTeX 公式引擎</span>
                    <span className="param-item-sub text-[11px] text-neutral-500 dark:text-neutral-400 block">学术级公式、微积分、矩阵渲染总开关</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.renderLatex ?? true}
                    onChange={() => handleToggleSetting('renderLatex')}
                    className="rounded text-lime-500 h-4 w-4 shrink-0 accent-lime-500 cursor-pointer"
                  />
                </label>

                {settings.renderLatex && (
                  <div className="pl-3 space-y-1.5 border-l-2 border-lime-500/40 ml-2 animate-in slide-in-from-top-1 duration-150">
                    <label className="flex items-center justify-between p-2 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/80 dark:border-neutral-700/80 text-neutral-800 dark:text-neutral-200 cursor-pointer hover:border-neutral-300 transition">
                      <span className="param-item-label text-[11px] font-medium text-neutral-800 dark:text-neutral-200">行内即时公式 ($...$)</span>
                      <input
                        type="checkbox"
                        checked={settings.latexInline ?? true}
                        onChange={() => handleToggleSetting('latexInline')}
                        className="rounded text-lime-500 h-3.5 w-3.5 shrink-0 accent-lime-500 cursor-pointer"
                      />
                    </label>

                    <label className="flex items-center justify-between p-2 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/80 dark:border-neutral-700/80 text-neutral-800 dark:text-neutral-200 cursor-pointer hover:border-neutral-300 transition">
                      <span className="param-item-label text-[11px] font-medium text-neutral-800 dark:text-neutral-200">块级居中公式 ($$...$$)</span>
                      <input
                        type="checkbox"
                        checked={settings.latexBlock ?? true}
                        onChange={() => handleToggleSetting('latexBlock')}
                        className="rounded text-lime-500 h-3.5 w-3.5 shrink-0 accent-lime-500 cursor-pointer"
                      />
                    </label>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Section 5: AI 回复展示与阅读偏好 */}
          {settings && onSaveSettings && (
            <div className="space-y-2 pt-2">
              <div className="flex items-center gap-1.5 text-neutral-800 dark:text-neutral-300 font-bold text-xs pb-1 border-b border-neutral-200 dark:border-neutral-800/80">
                <MessageSquare className="param-icon w-3.5 h-3.5 text-lime-600 dark:text-lime-400" />
                <span className="param-modal-title">AI 回复展示与阅读偏好</span>
              </div>

              <div className="space-y-1.5">
                {/* 1. ▋ 流式输出呼吸光标动画 */}
                <label className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-2xs cursor-pointer hover:border-lime-500/50 transition">
                  <div className="space-y-0.5 pr-2">
                    <div className="flex items-center gap-1.5">
                      <Terminal className="param-icon w-3.5 h-3.5 text-lime-600 dark:text-lime-400 shrink-0" />
                      <span className="param-item-label text-xs font-semibold text-neutral-900 dark:text-neutral-100 block">流式输出呼吸光标动画</span>
                    </div>
                    <span className="param-item-sub text-[11px] text-neutral-500 dark:text-neutral-400 block pl-5">
                      打字机实时吐字末尾伴随微闪呼吸光标（▋）
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.showStreamingCursor ?? true}
                    onChange={() => handleToggleSetting('showStreamingCursor')}
                    className="rounded text-lime-500 h-4 w-4 shrink-0 accent-lime-500 cursor-pointer"
                  />
                </label>

                {/* 2. 🔍 紧凑排版模式 */}
                <label className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-2xs cursor-pointer hover:border-lime-500/50 transition">
                  <div className="space-y-0.5 pr-2">
                    <div className="flex items-center gap-1.5">
                      <Layers className="param-icon w-3.5 h-3.5 text-lime-600 dark:text-lime-400 shrink-0" />
                      <span className="param-item-label text-xs font-semibold text-neutral-900 dark:text-neutral-100 block">紧凑排版模式 (Compact Mode)</span>
                    </div>
                    <span className="param-item-sub text-[11px] text-neutral-500 dark:text-neutral-400 block pl-5">
                      缩小消息气泡上下边距与行隙，大幅提升单屏信息密度
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.compactMode ?? false}
                    onChange={() => handleToggleSetting('compactMode')}
                    className="rounded text-lime-500 h-4 w-4 shrink-0 accent-lime-500 cursor-pointer"
                  />
                </label>

                {/* 3. 加粗纯文本标题 */}
                <label className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-2xs cursor-pointer hover:border-lime-500/50 transition">
                  <div className="space-y-0.5 pr-2">
                    <div className="flex items-center gap-1.5">
                      <SlidersHorizontal className="param-icon w-3.5 h-3.5 text-lime-600 dark:text-lime-400 shrink-0" />
                      <span className="param-item-label text-xs font-semibold text-neutral-900 dark:text-neutral-100 block">加粗纯文本标题</span>
                    </div>
                    <span className="param-item-sub text-[11px] text-neutral-500 dark:text-neutral-400 block pl-5">
                      关闭标题解析时生效，隐藏 # 前缀并高亮展示纯文本结构标题
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.boldHeadings ?? false}
                    onChange={() => handleToggleSetting('boldHeadings')}
                    className="rounded text-lime-500 h-4 w-4 shrink-0 accent-lime-500 cursor-pointer"
                  />
                </label>
              </div>
            </div>
          )}

          {/* Section: 🌐 联网搜索引擎配置 (Bing 优先 / Google 备选 / 用户自定义添加删除) */}
          {settings && onSaveSettings && (
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between pb-1 border-b border-neutral-800/80">
                <div className="flex items-center gap-1.5 text-neutral-300 font-bold text-xs">
                  <Globe className="param-icon w-3.5 h-3.5 text-lime-400" />
                  <span className="param-modal-title">联网搜索引擎配置 (Bing / Google / 自定义)</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddEngineModal(true)}
                    className="px-2 py-0.5 rounded-lg border border-lime-500/30 bg-lime-500/10 hover:bg-lime-500/20 text-lime-400 text-[11px] font-medium flex items-center gap-1 transition cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>添加搜索引擎</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleResetSearchEngines}
                    className="p-1 rounded-lg border border-neutral-800 hover:border-neutral-700 bg-neutral-800/60 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition cursor-pointer"
                    title="恢复 Bing 与 Google 默认列表"
                  >
                    <RefreshCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Form to add custom search engine */}
              {showAddEngineForm && (
                <div className="p-3 rounded-xl bg-neutral-800/90 border border-lime-500/30 space-y-2.5 animate-in fade-in duration-150">
                  <div className="text-xs font-semibold text-neutral-200 flex items-center justify-between">
                    <span>添加自定义搜索引擎</span>
                    <button
                      type="button"
                      onClick={() => setShowAddEngineModal(false)}
                      className="text-neutral-400 hover:text-neutral-200"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <input
                      type="text"
                      placeholder="引擎名称 (如: Sogou 搜狗搜索)"
                      value={newEngineName}
                      onChange={e => setNewEngineName(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-neutral-900 border border-neutral-700 text-neutral-100 placeholder-neutral-500 outline-hidden font-sans"
                    />
                    <input
                      type="text"
                      placeholder="Search / RSS 模板 URL (如: https://news.google.com/rss/search?q={query})"
                      value={newEngineUrl}
                      onChange={e => setNewEngineUrl(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-neutral-900 border border-neutral-700 text-neutral-100 placeholder-neutral-500 outline-hidden font-mono text-[11px]"
                    />
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowAddEngineModal(false)}
                        className="px-2.5 py-1 rounded-lg bg-neutral-700 hover:bg-neutral-600 text-neutral-300 text-xs transition"
                      >
                        取消
                      </button>
                      <button
                        type="button"
                        onClick={handleAddCustomEngine}
                        disabled={!newEngineName.trim() || !newEngineUrl.trim()}
                        className="px-3 py-1 rounded-lg bg-lime-500 hover:bg-lime-400 disabled:opacity-50 text-black font-medium text-xs transition shadow-xs"
                      >
                        确认添加
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Engine Cards List */}
              <div className="space-y-1.5">
                {searchEngines.map(eng => {
                  const isPrimary = activeSearchEngineId === eng.id;
                  return (
                    <div
                      key={eng.id}
                      className={`flex items-center justify-between p-2.5 rounded-xl border transition ${
                        isPrimary
                          ? 'bg-lime-500/10 border-lime-500/40 text-neutral-100'
                          : 'bg-neutral-800 border-neutral-800/80 text-neutral-300 hover:border-neutral-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                        <input
                          type="checkbox"
                          checked={eng.enabled}
                          onChange={() => handleToggleEngineEnabled(eng.id)}
                          className="rounded text-lime-500 h-4 w-4 shrink-0 accent-lime-500 cursor-pointer"
                          title="开启/关闭此搜索引擎"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-neutral-200 truncate">
                              {eng.name}
                            </span>
                            {isPrimary && (
                              <span className="px-2 py-0.2 rounded-full bg-lime-500/20 border border-lime-500/40 text-lime-400 text-[10px] font-bold shrink-0 flex items-center gap-1">
                                <Star className="w-2.5 h-2.5 fill-lime-400 text-lime-400" />
                                优先选择
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-neutral-500 font-mono truncate mt-0.5">
                            {eng.url}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {!isPrimary && (
                          <button
                            type="button"
                            onClick={() => handleSetPrimaryEngine(eng.id)}
                            className="px-2 py-1 rounded-lg border border-neutral-700 hover:border-neutral-600 bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 hover:text-white text-[11px] transition cursor-pointer"
                            title="设为第一优先搜索引擎"
                          >
                            设为优先
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteEngine(eng.id)}
                          className="p-1 rounded-lg border border-neutral-800 hover:border-red-500/40 bg-neutral-800/60 hover:bg-red-500/10 text-neutral-500 hover:text-red-400 transition cursor-pointer"
                          title="删除此搜索引擎"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section 4: 通用会话设置 */}
          {settings && onSaveSettings && (
            <div className="space-y-2 pt-2">
              <div className="flex items-center gap-1.5 text-neutral-300 font-bold text-xs pb-1 border-b border-neutral-800/80">
                <Brain className="param-icon w-3.5 h-3.5 text-lime-400" />
                <span className="param-modal-title">通用会话设置与记忆</span>
              </div>

              <div className="space-y-1.5">
                {/* 会话专属上下文记忆 (默认关闭) */}
                <label className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-800 border border-neutral-800/80 cursor-pointer hover:border-neutral-700 transition">
                  <div className="space-y-0.5 pr-2">
                    <div className="flex items-center gap-1.5">
                      <Brain className="param-icon w-3.5 h-3.5 text-lime-400 shrink-0" />
                      <span className="param-item-label text-xs font-semibold text-neutral-200 block">启用单聊专属上下文记忆</span>
                    </div>
                    <span className="param-item-sub text-[11px] text-neutral-400 block pl-5">
                      携带本窗口提取的约定与需求信息。**关闭可大幅节省输入 Token**（默认关闭）
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.enableChatContextMemory ?? false}
                    onChange={() => handleToggleSetting('enableChatContextMemory')}
                    className="rounded text-lime-500 h-4 w-4 shrink-0 accent-lime-500 cursor-pointer"
                  />
                </label>

                {/* 通用辅助设置：自动平滑滚动 */}
                <label className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-800 border border-neutral-800/80 cursor-pointer hover:border-neutral-700 transition">
                  <div className="space-y-0.5 pr-2">
                    <span className="param-item-label text-xs font-semibold text-neutral-200 block">自动平滑滚动</span>
                    <span className="param-item-sub text-[11px] text-neutral-400 block">生成新消息时窗口自动跟滚到底部</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.autoScroll}
                    onChange={() => handleToggleSetting('autoScroll')}
                    className="rounded text-lime-500 h-4 w-4 shrink-0 accent-lime-500 cursor-pointer"
                  />
                </label>

                {/* 通用辅助设置：显示消息时间戳 */}
                <label className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-800 border border-neutral-800/80 cursor-pointer hover:border-neutral-700 transition">
                  <div className="space-y-0.5 pr-2">
                    <span className="param-item-label text-xs font-semibold text-neutral-200 block">显示消息时间戳</span>
                    <span className="param-item-sub text-[11px] text-neutral-400 block">消息旁显示具体发送与生成时间</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.showTimestamps}
                    onChange={() => handleToggleSetting('showTimestamps')}
                    className="rounded text-lime-500 h-4 w-4 shrink-0 accent-lime-500 cursor-pointer"
                  />
                </label>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};