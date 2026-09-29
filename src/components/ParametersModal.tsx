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
  Layers
} from 'lucide-react';
import { ModelParameters, UserSettings } from '../types';

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

  if (!isOpen) return null;

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
      maxTokens: 4096,
      temperature: 0.7,
    });
    if (settings && onSaveSettings) {
      onSaveSettings({
        ...settings,
        enableStreaming: true,
        autoScroll: true,
        enableMarkdown: true,
        enableCodeHighlight: true,
        showTimestamps: true,
        renderLatex: true,
        showLineNumbers: true,
        collapseLongCode: true,
        showStreamingCursor: true,
        compactMode: false,
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
  };

  const streamVal = settings?.enableStreaming ?? parameters.stream ?? true;

  return (
    <div className="parameters-modal fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 select-none animate-in fade-in duration-150">
      <div className="parameters-card bg-[#121212] text-[#f4f4f5] border border-neutral-800 rounded-2xl sm:rounded-3xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
        
        {/* Header - Fixed & Compact for Mobile */}
        <div className="p-3.5 px-4 border-b border-neutral-800/90 flex items-center justify-between shrink-0 bg-[#161616]">
          <div className="flex items-center gap-2 min-w-0 pr-2">
            <div className="w-7 h-7 rounded-lg bg-lime-500/15 border border-lime-500/30 flex items-center justify-center text-lime-400 shrink-0">
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold tracking-tight text-white whitespace-nowrap">
                运行参数
              </h3>
              {modelName && (
                <p className="text-[11px] text-neutral-400 truncate max-w-[180px] sm:max-w-[240px]">
                  模型：<span className="text-lime-400 font-medium">{modelName}</span>
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
              <Zap className="w-3.5 h-3.5 text-lime-400" />
              <span>模型生成参数</span>
            </div>

            {/* 1. 流式输出 */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#181818] border border-neutral-800/80">
              <div className="space-y-0.5 pr-2">
                <div className="flex items-center gap-1.5 relative">
                  <span className="text-xs font-semibold text-neutral-100">流式输出</span>
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
                <p className="text-[11px] text-neutral-400">逐字实时呈现回答</p>
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
                className={`w-10 h-5 flex items-center rounded-full p-0.5 cursor-pointer transition-colors shrink-0 ${
                  streamVal ? 'bg-lime-500' : 'bg-neutral-800'
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
            <div className="space-y-2 p-2.5 rounded-xl bg-[#181818] border border-neutral-800/80">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 relative">
                  <span className="text-xs font-semibold text-neutral-200">采样温度</span>
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
                  className="w-16 text-right bg-[#121212] border border-neutral-700 focus:border-lime-500 text-white px-2 py-0.5 rounded-lg text-xs font-mono outline-hidden"
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
                  className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-lime-400"
                />
                <div className="flex justify-between text-[10px] text-neutral-500 font-mono mt-1 select-none">
                  <span>0 (代码/严谨)</span>
                  <span>0.7 (默认)</span>
                  <span>1.0 (创意)</span>
                </div>
              </div>
            </div>

            {/* 3. 最大生成长度 */}
            <div className="space-y-2 p-2.5 rounded-xl bg-[#181818] border border-neutral-800/80">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 relative">
                  <span className="text-xs font-semibold text-neutral-200">最大长度</span>
                  <button
                    type="button"
                    onMouseEnter={() => setActiveTooltip('maxTokens')}
                    onMouseLeave={() => setActiveTooltip(null)}
                    onClick={() => setActiveTooltip(activeTooltip === 'maxTokens' ? null : 'maxTokens')}
                    className="text-neutral-500 hover:text-neutral-300"
                  >
                    <Info className="w-3.5 h-3.5" />
                  </button>
                  {activeTooltip === 'maxTokens' && (
                    <div className="absolute left-0 top-6 z-20 w-56 p-2 bg-neutral-900 border border-neutral-700 text-[11px] text-neutral-300 rounded-xl shadow-xl">
                      {tooltips.maxTokens}
                    </div>
                  )}
                </div>

                <input
                  type="number"
                  min={1}
                  max={32768}
                  value={parameters.maxTokens ?? 4096}
                  onChange={(e) => updateParam('maxTokens', parseInt(e.target.value) || 1)}
                  className="w-16 text-right bg-[#121212] border border-neutral-700 focus:border-lime-500 text-white px-2 py-0.5 rounded-lg text-xs font-mono outline-hidden"
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
                  className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-lime-400"
                />
                <div className="flex justify-between text-[10px] text-neutral-500 font-mono mt-1 select-none">
                  <span>256</span>
                  <span>4096</span>
                  <span>12288</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: AI 回复展示与阅读偏好 (5大高价值功能) */}
          {settings && onSaveSettings && (
            <div className="space-y-2 pt-2">
              <div className="flex items-center gap-1.5 text-neutral-300 font-bold text-xs pb-1 border-b border-neutral-800/80">
                <MessageSquare className="w-3.5 h-3.5 text-lime-400" />
                <span>AI 回复展示与阅读偏好</span>
              </div>

              <div className="space-y-1.5">
                {/* 1. 🧮 LaTeX 数学与科学公式渲染 */}
                <label className="flex items-center justify-between p-2.5 rounded-xl bg-[#181818] border border-neutral-800/80 cursor-pointer hover:border-neutral-700 transition">
                  <div className="space-y-0.5 pr-2">
                    <div className="flex items-center gap-1.5">
                      <Calculator className="w-3.5 h-3.5 text-lime-400 shrink-0" />
                      <span className="text-xs font-semibold text-neutral-200 block">LaTeX 数学与科学公式渲染</span>
                    </div>
                    <span className="text-[11px] text-neutral-400 block pl-5">
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

                {/* 2. 🔢 代码块显示行号 */}
                <label className="flex items-center justify-between p-2.5 rounded-xl bg-[#181818] border border-neutral-800/80 cursor-pointer hover:border-neutral-700 transition">
                  <div className="space-y-0.5 pr-2">
                    <div className="flex items-center gap-1.5">
                      <ListOrdered className="w-3.5 h-3.5 text-lime-400 shrink-0" />
                      <span className="text-xs font-semibold text-neutral-200 block">代码块显示行号 (Line Numbers)</span>
                    </div>
                    <span className="text-[11px] text-neutral-400 block pl-5">
                      代码左侧附带灰度行号，长代码沟通与对比更清晰
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.showLineNumbers ?? true}
                    onChange={() => handleToggleSetting('showLineNumbers')}
                    className="rounded text-lime-500 h-4 w-4 shrink-0 accent-lime-500 cursor-pointer"
                  />
                </label>

                {/* 3. 📱 长代码块自动限制高度 / 折叠 */}
                <label className="flex items-center justify-between p-2.5 rounded-xl bg-[#181818] border border-neutral-800/80 cursor-pointer hover:border-neutral-700 transition">
                  <div className="space-y-0.5 pr-2">
                    <div className="flex items-center gap-1.5">
                      <FoldVertical className="w-3.5 h-3.5 text-lime-400 shrink-0" />
                      <span className="text-xs font-semibold text-neutral-200 block">长代码块自动折叠限制高度</span>
                    </div>
                    <span className="text-[11px] text-neutral-400 block pl-5">
                      超长代码自动收起并提供“展开代码”按钮，移动端尤其顺畅
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.collapseLongCode ?? true}
                    onChange={() => handleToggleSetting('collapseLongCode')}
                    className="rounded text-lime-500 h-4 w-4 shrink-0 accent-lime-500 cursor-pointer"
                  />
                </label>

                {/* 4. ▋ 流式输出呼吸光标动画 */}
                <label className="flex items-center justify-between p-2.5 rounded-xl bg-[#181818] border border-neutral-800/80 cursor-pointer hover:border-neutral-700 transition">
                  <div className="space-y-0.5 pr-2">
                    <div className="flex items-center gap-1.5">
                      <Terminal className="w-3.5 h-3.5 text-lime-400 shrink-0" />
                      <span className="text-xs font-semibold text-neutral-200 block">流式输出呼吸光标动画</span>
                    </div>
                    <span className="text-[11px] text-neutral-400 block pl-5">
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
                <label className="flex items-center justify-between p-2.5 rounded-xl bg-[#181818] border border-neutral-800/80 cursor-pointer hover:border-neutral-700 transition">
                  <div className="space-y-0.5 pr-2">
                    <div className="flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-lime-400 shrink-0" />
                      <span className="text-xs font-semibold text-neutral-200 block">紧凑排版模式 (Compact Mode)</span>
                    </div>
                    <span className="text-[11px] text-neutral-400 block pl-5">
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

                {/* 通用辅助设置：自动平滑滚动 */}
                <label className="flex items-center justify-between p-2.5 rounded-xl bg-[#181818] border border-neutral-800/80 cursor-pointer hover:border-neutral-700 transition">
                  <div className="space-y-0.5 pr-2">
                    <span className="text-xs font-semibold text-neutral-200 block">自动平滑滚动</span>
                    <span className="text-[11px] text-neutral-400 block">生成新消息时窗口自动跟滚到底部</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.autoScroll}
                    onChange={() => handleToggleSetting('autoScroll')}
                    className="rounded text-lime-500 h-4 w-4 shrink-0 accent-lime-500 cursor-pointer"
                  />
                </label>

                {/* 通用辅助设置：显示消息时间戳 */}
                <label className="flex items-center justify-between p-2.5 rounded-xl bg-[#181818] border border-neutral-800/80 cursor-pointer hover:border-neutral-700 transition">
                  <div className="space-y-0.5 pr-2">
                    <span className="text-xs font-semibold text-neutral-200 block">显示消息时间戳</span>
                    <span className="text-[11px] text-neutral-400 block">消息旁显示具体发送与生成时间</span>
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
