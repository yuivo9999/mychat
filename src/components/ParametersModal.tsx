import React, { useState } from 'react';
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
  Check
} from 'lucide-react';
import { ModelParameters, UserSettings, SearchEngineItem } from '../types';
import { DEFAULT_SEARCH_ENGINES } from '../services/db';

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
    maxTokens: '单次回复允许生成的最大 Token 限制（4096 约合 2000 个汉字）。',
    temperature: '控制回答的多样性。0.0~0.3 严谨确定（代码/数学）；0.7~1.0 丰富发散（创意/写作）。',
    latex: '自动通过 KaTeX 引擎将数学公式/物理符号/微积分渲染为学术级排版。',
    lineNumbers: '在代码块左侧附带微弱灰度行号，长代码定位更清晰。',
    collapse: '代码超出高度时自动折叠收起，提供“展开完整代码”按钮，移动端浏览更流畅。',
    cursor: '打字机逐字生成时末尾伴随微闪的呼吸光标（▋），生成完毕自动隐去。',
    compact: '缩小消息气泡上下边距、微调字号和间隙，大幅提升单屏信息展示密度。',
    chatContextMemory: '允许 AI 记住历史对话中提取的重要需求与约定。关闭可大幅节省输入 Token 消耗。',
  };

  const streamVal = settings?.enableStreaming ?? parameters.stream ?? true;

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
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-800 border border-neutral-800/80">
              <div className="space-y-0.5 pr-2">
                <div className="flex items-center gap-1.5 relative">
                  <span className="param-item-label text-xs font-semibold text-neutral-100">流式输出</span>
                  <button
                    type="button"
                    onMouseEnter={() => setActiveTooltip('stream')}
                    onMouseLeave={() => setActiveTooltip(null)}
                    onClick={() => setActiveTooltip(activeTooltip === 'stream' ? null : 'stream')}
                    className="text-neutral-500 hover:text-neutral-300"
                  >
                    <Info className="w-3.5 h-3.5" />
                  </button>
                  {activeTooltip === 'stream' && (
                    <div className="absolute left-0 top-6 z-20 w-56 p-2 bg-neutral-900 border border-neutral-700 text-[11px] text-neutral-300 rounded-xl shadow-xl">
                      {tooltips.stream}
                    </div>
                  )}
                </div>
                <p className="param-item-sub text-[11px] text-neutral-400">逐字实时呈现回答</p>
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
                  streamVal ? 'bg-[#84cc16] bg-lime-500' : 'bg-neutral-800'
                }`}
              >
                <div
                  className={`bg-black w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    streamVal ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* 2. 采样温度 */}
            <div className="space-y-2 p-2.5 rounded-xl bg-neutral-800 border border-neutral-800/80">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 relative">
                  <span className="param-item-label text-xs font-semibold text-neutral-200">采样温度</span>
                  <button
                    type="button"
                    onMouseEnter={() => setActiveTooltip('temperature')}
                    onMouseLeave={() => setActiveTooltip(null)}
                    onClick={() => setActiveTooltip(activeTooltip === 'temperature' ? null : 'temperature')}
                    className="text-neutral-500 hover:text-neutral-300"
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
                  className="param-input w-16 text-right bg-neutral-900 border border-neutral-700 focus:border-lime-500 text-white px-2 py-0.5 rounded-lg text-xs font-mono outline-hidden"
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
                  className="param-slider w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-lime-400"
                />
                <div className="flex justify-between text-[10px] param-slider-ticks text-neutral-500 font-mono mt-1 select-none">
                  <span>0 (代码/严谨)</span>
                  <span>0.7 (默认)</span>
                  <span>1.0 (创意)</span>
                </div>
              </div>
            </div>

            {/* 3. 最大生成长度 */}
            <div className="space-y-2 p-2.5 rounded-xl bg-neutral-800 border border-neutral-800/80">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 relative min-w-0">
                  <span className="param-item-label text-xs font-semibold text-neutral-200 truncate">最大 Token 限制</span>
                  <button
                    type="button"
                    onMouseEnter={() => setActiveTooltip('maxTokens')}
                    onMouseLeave={() => setActiveTooltip(null)}
                    onClick={() => setActiveTooltip(activeTooltip === 'maxTokens' ? null : 'maxTokens')}
                    className="text-neutral-500 hover:text-neutral-300 shrink-0"
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
                  <span className="text-[10px] text-neutral-400 font-medium">
                    {parameters.limitMaxTokens ? '开启限制' : '默认自适应 (无限制)'}
                  </span>
                  <button
                    type="button"
                    onClick={() => updateParam('limitMaxTokens', !parameters.limitMaxTokens)}
                    className={`param-toggle w-8 h-4 flex items-center rounded-full p-0.5 cursor-pointer transition-colors shrink-0 ${
                      parameters.limitMaxTokens ? 'bg-[#84cc16] bg-lime-500' : 'bg-neutral-900 border border-neutral-700'
                    }`}
                  >
                    <div
                      className={`bg-black w-3 h-3 rounded-full shadow-md transform transition-transform ${
                        parameters.limitMaxTokens ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {parameters.limitMaxTokens ? (
                <div className="space-y-2 pt-1 animate-in fade-in duration-100">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-neutral-400">限制数值 (Tokens)</span>
                    <input
                      type="number"
                      min={1}
                      max={32768}
                      value={parameters.maxTokens ?? 4096}
                      onChange={(e) => updateParam('maxTokens', parseInt(e.target.value) || 1)}
                      className="param-input w-20 text-right bg-neutral-900 border border-neutral-700 focus:border-lime-500 text-white px-2 py-0.5 rounded-lg text-xs font-mono outline-hidden"
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
                      className="param-slider w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-lime-400"
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
          </div>

          {/* Section 2: AI 回复展示与阅读偏好 (5大高价值功能) */}
          {settings && onSaveSettings && (
            <div className="space-y-2 pt-2">
              <div className="flex items-center gap-1.5 text-neutral-300 font-bold text-xs pb-1 border-b border-neutral-800/80">
                <MessageSquare className="param-icon w-3.5 h-3.5 text-lime-400" />
                <span className="param-modal-title">AI 回复展示与阅读偏好</span>
              </div>

              <div className="space-y-1.5">
                {/* 1. 🧮 LaTeX 数学与科学公式渲染 */}
                <label className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-800 border border-neutral-800/80 cursor-pointer hover:border-neutral-700 transition">
                  <div className="space-y-0.5 pr-2">
                    <div className="flex items-center gap-1.5">
                      <Calculator className="param-icon w-3.5 h-3.5 text-lime-400 shrink-0" />
                      <span className="param-item-label text-xs font-semibold text-neutral-200 block">LaTeX 数学与科学公式渲染</span>
                    </div>
                    <span className="param-item-sub text-[11px] text-neutral-400 block pl-5">
                      KaTeX 引擎渲染微积分、矩阵与学术级公式
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.renderLatex ?? true}
                    onChange={() => handleToggleSetting('renderLatex')}
                    className="rounded text-lime-500 h-4 w-4 shrink-0 accent-lime-500 cursor-pointer"
                  />
                </label>

                {/* 4. ▋ 流式输出呼吸光标动画 */}
                <label className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-800 border border-neutral-800/80 cursor-pointer hover:border-neutral-700 transition">
                  <div className="space-y-0.5 pr-2">
                    <div className="flex items-center gap-1.5">
                      <Terminal className="param-icon w-3.5 h-3.5 text-lime-400 shrink-0" />
                      <span className="param-item-label text-xs font-semibold text-neutral-200 block">流式输出呼吸光标动画</span>
                    </div>
                    <span className="param-item-sub text-[11px] text-neutral-400 block pl-5">
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

                {/* 5. 🔍 紧凑排版模式 */}
                <label className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-800 border border-neutral-800/80 cursor-pointer hover:border-neutral-700 transition">
                  <div className="space-y-0.5 pr-2">
                    <div className="flex items-center gap-1.5">
                      <Layers className="param-icon w-3.5 h-3.5 text-lime-400 shrink-0" />
                      <span className="param-item-label text-xs font-semibold text-neutral-200 block">紧凑排版模式 (Compact Mode)</span>
                    </div>
                    <span className="param-item-sub text-[11px] text-neutral-400 block pl-5">
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

                {/* Markdown 表格解析 */}
                <label className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-800 border border-neutral-800/80 cursor-pointer hover:border-neutral-700 transition">
                  <div className="space-y-0.5 pr-2">
                    <div className="flex items-center gap-1.5">
                      <FileText className="param-icon w-3.5 h-3.5 text-lime-400 shrink-0" />
                      <span className="param-item-label text-xs font-semibold text-neutral-200 block">Markdown 表格解析</span>
                    </div>
                    <span className="param-item-sub text-[11px] text-neutral-400 block pl-5">
                      仅完美格式化呈现数据表格，其余多余富文本样式一律保持原生纯文本展示
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.onlyParseMarkdownTables ?? false}
                    onChange={() => handleToggleSetting('onlyParseMarkdownTables')}
                    className="rounded text-lime-500 h-4 w-4 shrink-0 accent-lime-500 cursor-pointer"
                  />
                </label>

                {/* 加粗标题 (纯文本结构优化) */}
                <label className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-800 border border-neutral-800/80 cursor-pointer hover:border-neutral-700 transition">
                  <div className="space-y-0.5 pr-2">
                    <div className="flex items-center gap-1.5">
                      <SlidersHorizontal className="param-icon w-3.5 h-3.5 text-lime-400 shrink-0" />
                      <span className="param-item-label text-xs font-semibold text-neutral-200 block">加粗纯文本标题</span>
                    </div>
                    <span className="param-item-sub text-[11px] text-neutral-400 block pl-5">
                      关闭 Markdown 解析时，自动隐藏 # 前缀，并为结构化标题加上自适应高反差色块背景
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.boldHeadings ?? false}
                    onChange={() => handleToggleSetting('boldHeadings')}
                    className="rounded text-lime-500 h-4 w-4 shrink-0 accent-lime-500 cursor-pointer"
                  />
                </label>

                {/* 代码块语法高亮与工具栏 */}
              </div>
            </div>
          )}

          {/* Section 3: 代码与 Markdown 边框工具配置 */}
          {settings && onSaveSettings && (
            <div className="space-y-2 pt-2">
              <div className="flex items-center gap-1.5 text-neutral-300 font-bold text-xs pb-1 border-b border-neutral-800/80">
                <FileCode className="param-icon w-3.5 h-3.5 text-lime-400" />
                <span className="param-modal-title">代码框、文本框及 Markdown 框开关</span>
              </div>

               <div className="space-y-1.5">
                {/* 1. 代码框开关 */}
                <label className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-800 border border-neutral-800/80 cursor-pointer hover:border-neutral-700 transition">
                  <div className="space-y-0.5 pr-2">
                    <span className="param-item-label text-xs font-semibold text-neutral-200 block">启用「代码框」容器</span>
                    <span className="param-item-sub text-[11px] text-neutral-400 block">
                      开启代码块的高级黑色卡片边框、语言标识与复制/下载/加号工具栏
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
                  <div className="pl-4 space-y-1.5 border-l border-neutral-800 ml-2 animate-in slide-in-from-top-1 duration-150">
                    {/* 代码块显示行号 */}
                    <label className="flex items-center justify-between p-2 rounded-xl bg-neutral-800/40 border border-neutral-800/60 cursor-pointer hover:border-neutral-700 transition">
                      <div className="space-y-0.5 pr-2">
                        <span className="param-item-label text-[11px] font-medium text-neutral-300 block">代码块显示行号</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.showLineNumbers ?? true}
                        onChange={() => handleToggleSetting('showLineNumbers')}
                        className="rounded text-lime-500 h-3.5 w-3.5 shrink-0 accent-lime-500 cursor-pointer"
                      />
                    </label>

                    {/* 长代码块自动限制高度 */}
                    <label className="flex items-center justify-between p-2 rounded-xl bg-neutral-800/40 border border-neutral-800/60 cursor-pointer hover:border-neutral-700 transition">
                      <div className="space-y-0.5 pr-2">
                        <span className="param-item-label text-[11px] font-medium text-neutral-300 block">长代码块自动折叠</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.collapseLongCode ?? true}
                        onChange={() => handleToggleSetting('collapseLongCode')}
                        className="rounded text-lime-500 h-3.5 w-3.5 shrink-0 accent-lime-500 cursor-pointer"
                      />
                    </label>
                  </div>
                )}

                {/* 2. 文本框开关 */}
                <label className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-800 border border-neutral-800/80 cursor-pointer hover:border-neutral-700 transition">
                  <div className="space-y-0.5 pr-2">
                    <span className="param-item-label text-xs font-semibold text-neutral-200 block">启用「文本框」容器</span>
                    <span className="param-item-sub text-[11px] text-neutral-400 block">
                      开启引用、普通文本引用段落（Blockquote）的卡片背景与左侧导向条
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.useTextBox ?? true}
                    onChange={() => handleToggleSetting('useTextBox')}
                    className="rounded text-lime-500 h-4 w-4 shrink-0 accent-lime-500 cursor-pointer"
                  />
                </label>

                {/* 3. Markdown 解析框开关 */}
                <label className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-800 border border-neutral-800/80 cursor-pointer hover:border-neutral-700 transition">
                  <div className="space-y-0.5 pr-2">
                    <span className="param-item-label text-xs font-semibold text-neutral-200 block">启用「Markdown」富文本渲染框</span>
                    <span className="param-item-sub text-[11px] text-neutral-400 block">
                      开启后，将文本转换为排版优美的标题、斜体加粗、数学公式、表格等格式
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.enableMarkdown}
                    onChange={() => handleToggleSetting('enableMarkdown')}
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
