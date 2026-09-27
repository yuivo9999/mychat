import React, { useState } from 'react';
import { X, SlidersHorizontal, Info, RotateCcw } from 'lucide-react';
import { ModelParameters } from '../types';

interface ParametersModalProps {
  isOpen: boolean;
  onClose: () => void;
  parameters: ModelParameters;
  onChangeParameters: (params: ModelParameters) => void;
  modelName?: string;
}

export const ParametersModal: React.FC<ParametersModalProps> = ({
  isOpen,
  onClose,
  parameters,
  onChangeParameters,
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

  const resetToDefaults = () => {
    onChangeParameters({
      enableReasoning: false,
      stream: true,
      maxTokens: 4096,
      temperature: 0.7,
      topP: 1,
      frequencyPenalty: 0,
      presencePenalty: 0,
      stop: '',
      seed: undefined,
    });
  };

  // Tooltip descriptions in Chinese
  const tooltips: Record<string, string> = {
    stream: '开启打字机逐字实时输出。关闭后将等待模型全部生成完毕后一次性返回。',
    maxTokens: '单次回复所允许生成的最大 Token 数量。1000 Token 约合 750 个英文单词或 500 个汉字。',
    temperature: '控制回答的多样性与随机性。0.0~0.3 严谨确定，适合编程、计算；0.7~1.0 创意丰富，适合写作与发散思考。',
    topP: '核采样阈值。例如设置为 0.5 时，模型只从累积概率前 50% 的候选词库中选择，与温度结合调整表达广度。',
    frequencyPenalty: '频率惩罚。数值越高（-2.0 到 2.0），越强烈降低已经反复出现过的词语被再次选中的概率，有效避免车轱辘话。',
    presencePenalty: '存在惩罚。只要某个词或概念在上下文中出现过，就给予惩罚（-2.0 到 2.0），鼓励模型引入全新话题与概念。',
    stop: '停止序列。当模型在生成内容中遇到此字符或单词时，将立即中断并终止生成。',
    seed: '随机数种子。若输入相同的种子数字且保持所有参数一致，模型将尽可能输出高度确定一致的回答。留空则由系统随机。',
    reasoning: '深度思考/思维链模式。让模型在作答前展示深刻推导与推理过程，适合解决高难度数学、科学与复杂逻辑。',
  };

  return (
    <div className="parameters-modal fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 md:p-4 select-none animate-in fade-in duration-150">
      <div className="bg-[#121212] text-[#f4f4f5] border border-neutral-800 rounded-3xl w-full max-w-lg shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="p-4 md:px-5 border-b border-neutral-800/90 flex items-center justify-between shrink-0 bg-[#161616]">
          <div className="flex items-center gap-2.5">
            <SlidersHorizontal className="w-5 h-5 text-[#84cc16]" />
            <div>
              <h3 className="text-base font-bold tracking-wide flex items-center gap-2 text-white">
                <span>参数设置</span>
                <span className="text-xs text-neutral-400 font-mono font-normal">Parameters</span>
              </h3>
              {modelName && (
                <p className="text-[11px] text-neutral-400 truncate max-w-[240px]">
                  作用于：{modelName}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={resetToDefaults}
              className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800/80 transition"
              title="重置为默认参数"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800/80 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body Controls */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          {/* 1. Stream (流式传输) */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 relative">
              <span className="text-sm font-semibold text-neutral-200">流式传输</span>
              <span className="text-xs text-neutral-500 font-mono">Stream</span>
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
                <div className="absolute left-0 top-6 z-20 w-64 p-2.5 bg-neutral-900 border border-neutral-700 text-xs text-neutral-300 rounded-xl shadow-xl">
                  {tooltips.stream}
                </div>
              )}
            </div>

            {/* Toggle Switch (Green when ON) */}
            <button
              type="button"
              onClick={() => updateParam('stream', !(parameters.stream ?? true))}
              className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                (parameters.stream ?? true) ? 'bg-[#84cc16]' : 'bg-neutral-800'
              }`}
            >
              <div
                className={`bg-black w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  (parameters.stream ?? true) ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* 2. Max Tokens (最大 Token 数) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 relative">
                <span className="text-sm font-semibold text-neutral-200">最大生成长度</span>
                <span className="text-xs text-neutral-500 font-mono">Max Tokens</span>
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
                  <div className="absolute left-0 top-6 z-20 w-64 p-2.5 bg-neutral-900 border border-neutral-700 text-xs text-neutral-300 rounded-xl shadow-xl">
                    {tooltips.maxTokens}
                  </div>
                )}
              </div>

              {/* Number Input Box */}
              <input
                type="number"
                min={1}
                max={32768}
                value={parameters.maxTokens ?? 4096}
                onChange={(e) => updateParam('maxTokens', parseInt(e.target.value) || 1)}
                className="w-24 text-right bg-[#181818] border border-neutral-800 focus:border-[#84cc16] text-white px-3 py-1.5 rounded-xl text-sm font-mono outline-hidden"
              />
            </div>

            {/* Slider with green fill */}
            <div className="relative pt-1">
              <input
                type="range"
                min={1}
                max={12288}
                step={1}
                value={parameters.maxTokens ?? 4096}
                onChange={(e) => updateParam('maxTokens', parseInt(e.target.value))}
                className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-[#84cc16]"
              />
              <div className="flex justify-between text-[11px] text-neutral-500 font-mono mt-1 select-none">
                <span>1</span>
                <span>4096</span>
                <span>8192</span>
                <span>12288</span>
              </div>
            </div>
          </div>

          {/* 3. Temperature (温度) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 relative">
                <span className="text-sm font-semibold text-neutral-200">采样温度</span>
                <span className="text-xs text-neutral-500 font-mono">Temperature</span>
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
                  <div className="absolute left-0 top-6 z-20 w-64 p-2.5 bg-neutral-900 border border-neutral-700 text-xs text-neutral-300 rounded-xl shadow-xl">
                    {tooltips.temperature}
                  </div>
                )}
              </div>

              <input
                type="number"
                min={0}
                max={2}
                step={0.05}
                value={parameters.temperature ?? 0.5}
                onChange={(e) => updateParam('temperature', parseFloat(e.target.value) || 0)}
                className="w-24 text-right bg-[#181818] border border-neutral-800 focus:border-[#84cc16] text-white px-3 py-1.5 rounded-xl text-sm font-mono outline-hidden"
              />
            </div>

            <div className="relative pt-1">
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={parameters.temperature ?? 0.5}
                onChange={(e) => updateParam('temperature', parseFloat(e.target.value))}
                className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-[#84cc16]"
              />
              <div className="flex justify-between text-[11px] text-neutral-500 font-mono mt-1 select-none">
                <span>0</span>
                <span>0.25</span>
                <span>0.5</span>
                <span>0.75</span>
                <span>1</span>
              </div>
            </div>
          </div>

          {/* 4. Top P (核采样) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 relative">
                <span className="text-sm font-semibold text-neutral-200">核采样</span>
                <span className="text-xs text-neutral-500 font-mono">Top P</span>
                <button
                  type="button"
                  onMouseEnter={() => setActiveTooltip('topP')}
                  onMouseLeave={() => setActiveTooltip(null)}
                  onClick={() => setActiveTooltip(activeTooltip === 'topP' ? null : 'topP')}
                  className="text-neutral-500 hover:text-neutral-300"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
                {activeTooltip === 'topP' && (
                  <div className="absolute left-0 top-6 z-20 w-64 p-2.5 bg-neutral-900 border border-neutral-700 text-xs text-neutral-300 rounded-xl shadow-xl">
                    {tooltips.topP}
                  </div>
                )}
              </div>

              <input
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={parameters.topP ?? 1}
                onChange={(e) => updateParam('topP', parseFloat(e.target.value) || 0)}
                className="w-24 text-right bg-[#181818] border border-neutral-800 focus:border-[#84cc16] text-white px-3 py-1.5 rounded-xl text-sm font-mono outline-hidden"
              />
            </div>

            <div className="relative pt-1">
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={parameters.topP ?? 1}
                onChange={(e) => updateParam('topP', parseFloat(e.target.value))}
                className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-[#84cc16]"
              />
              <div className="flex justify-between text-[11px] text-neutral-500 font-mono mt-1 select-none">
                <span>0</span>
                <span>0.25</span>
                <span>0.5</span>
                <span>0.75</span>
                <span>1</span>
              </div>
            </div>
          </div>

          {/* 5. Frequency Penalty (频率惩罚) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 relative">
                <span className="text-sm font-semibold text-neutral-200">频率惩罚</span>
                <span className="text-xs text-neutral-500 font-mono">Frequency Penalty</span>
                <button
                  type="button"
                  onMouseEnter={() => setActiveTooltip('frequencyPenalty')}
                  onMouseLeave={() => setActiveTooltip(null)}
                  onClick={() => setActiveTooltip(activeTooltip === 'frequencyPenalty' ? null : 'frequencyPenalty')}
                  className="text-neutral-500 hover:text-neutral-300"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
                {activeTooltip === 'frequencyPenalty' && (
                  <div className="absolute left-0 top-6 z-20 w-64 p-2.5 bg-neutral-900 border border-neutral-700 text-xs text-neutral-300 rounded-xl shadow-xl">
                    {tooltips.frequencyPenalty}
                  </div>
                )}
              </div>

              <input
                type="number"
                min={-2}
                max={2}
                step={0.1}
                value={parameters.frequencyPenalty ?? 0}
                onChange={(e) => updateParam('frequencyPenalty', parseFloat(e.target.value) || 0)}
                className="w-24 text-right bg-[#181818] border border-neutral-800 focus:border-[#84cc16] text-white px-3 py-1.5 rounded-xl text-sm font-mono outline-hidden"
              />
            </div>

            <div className="relative pt-1">
              <input
                type="range"
                min={-2}
                max={2}
                step={0.1}
                value={parameters.frequencyPenalty ?? 0}
                onChange={(e) => updateParam('frequencyPenalty', parseFloat(e.target.value))}
                className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-[#84cc16]"
              />
              <div className="flex justify-between text-[11px] text-neutral-500 font-mono mt-1 select-none">
                <span>-2</span>
                <span>-1</span>
                <span>0</span>
                <span>1</span>
                <span>2</span>
              </div>
            </div>
          </div>

          {/* 6. Presence Penalty (存在惩罚) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 relative">
                <span className="text-sm font-semibold text-neutral-200">存在惩罚</span>
                <span className="text-xs text-neutral-500 font-mono">Presence Penalty</span>
                <button
                  type="button"
                  onMouseEnter={() => setActiveTooltip('presencePenalty')}
                  onMouseLeave={() => setActiveTooltip(null)}
                  onClick={() => setActiveTooltip(activeTooltip === 'presencePenalty' ? null : 'presencePenalty')}
                  className="text-neutral-500 hover:text-neutral-300"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
                {activeTooltip === 'presencePenalty' && (
                  <div className="absolute left-0 top-6 z-20 w-64 p-2.5 bg-neutral-900 border border-neutral-700 text-xs text-neutral-300 rounded-xl shadow-xl">
                    {tooltips.presencePenalty}
                  </div>
                )}
              </div>

              <input
                type="number"
                min={-2}
                max={2}
                step={0.1}
                value={parameters.presencePenalty ?? 0}
                onChange={(e) => updateParam('presencePenalty', parseFloat(e.target.value) || 0)}
                className="w-24 text-right bg-[#181818] border border-neutral-800 focus:border-[#84cc16] text-white px-3 py-1.5 rounded-xl text-sm font-mono outline-hidden"
              />
            </div>

            <div className="relative pt-1">
              <input
                type="range"
                min={-2}
                max={2}
                step={0.1}
                value={parameters.presencePenalty ?? 0}
                onChange={(e) => updateParam('presencePenalty', parseFloat(e.target.value))}
                className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-[#84cc16]"
              />
              <div className="flex justify-between text-[11px] text-neutral-500 font-mono mt-1 select-none">
                <span>-2</span>
                <span>-1</span>
                <span>0</span>
                <span>1</span>
                <span>2</span>
              </div>
            </div>
          </div>

          {/* 7. Stop Sequences (停止词) */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 relative">
              <span className="text-sm font-semibold text-neutral-200">停止词</span>
              <span className="text-xs text-neutral-500 font-mono">Stop</span>
              <button
                type="button"
                onMouseEnter={() => setActiveTooltip('stop')}
                onMouseLeave={() => setActiveTooltip(null)}
                onClick={() => setActiveTooltip(activeTooltip === 'stop' ? null : 'stop')}
                className="text-neutral-500 hover:text-neutral-300"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
              {activeTooltip === 'stop' && (
                <div className="absolute left-0 top-6 z-20 w-64 p-2.5 bg-neutral-900 border border-neutral-700 text-xs text-neutral-300 rounded-xl shadow-xl">
                  {tooltips.stop}
                </div>
              )}
            </div>

            <input
              type="text"
              placeholder="输入停止标记词，例如: <|im_end|> 或 END"
              value={parameters.stop || ''}
              onChange={(e) => updateParam('stop', e.target.value)}
              className="w-full bg-[#181818] border border-neutral-800 focus:border-[#84cc16] text-white px-3.5 py-2.5 rounded-xl text-xs font-mono outline-hidden placeholder-neutral-600"
            />
          </div>

          {/* 8. Seed (随机种子) */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 relative">
              <span className="text-sm font-semibold text-neutral-200">随机种子</span>
              <span className="text-xs text-neutral-500 font-mono">Seed</span>
              <button
                type="button"
                onMouseEnter={() => setActiveTooltip('seed')}
                onMouseLeave={() => setActiveTooltip(null)}
                onClick={() => setActiveTooltip(activeTooltip === 'seed' ? null : 'seed')}
                className="text-neutral-500 hover:text-neutral-300"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
              {activeTooltip === 'seed' && (
                <div className="absolute left-0 top-6 z-20 w-64 p-2.5 bg-neutral-900 border border-neutral-700 text-xs text-neutral-300 rounded-xl shadow-xl">
                  {tooltips.seed}
                </div>
              )}
            </div>

            <input
              type="number"
              placeholder="留空则随机，如: 0, 42, 12345"
              value={parameters.seed !== undefined ? parameters.seed : ''}
              onChange={(e) => {
                const val = e.target.value.trim();
                updateParam('seed', val === '' ? undefined : parseInt(val));
              }}
              className="w-full bg-[#181818] border border-neutral-800 focus:border-[#84cc16] text-white px-3.5 py-2.5 rounded-xl text-xs font-mono outline-hidden placeholder-neutral-600"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 md:px-5 border-t border-neutral-800 bg-[#161616] flex items-center justify-between">
          <span className="text-[11px] text-neutral-400">
            参数已实时保存并应用于后续请求
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#84cc16] hover:bg-[#72b012] text-black font-semibold text-xs transition active:scale-95 cursor-pointer shadow-md"
          >
            完成设置
          </button>
        </div>
      </div>
    </div>
  );
};
