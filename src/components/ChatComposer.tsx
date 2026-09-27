import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  ArrowUp, 
  Square, 
  Paperclip, 
  Image as ImageIcon, 
  FileText, 
  X, 
  Key, 
  Sparkles, 
  SlidersHorizontal,
  FileCode,
  AlertCircle,
  Server,
  Globe
} from 'lucide-react';
import { Attachment, ModelItem, ApiKeyConfig, UserSettings, ModelParameters } from '../types';
import { parseFileToAttachment, formatFileSize } from '../services/fileParser';

interface ChatComposerProps {
  onSendMessage: (content: string, attachments: Attachment[]) => void;
  isGenerating: boolean;
  onStopGeneration: () => void;
  currentModel: ModelItem | undefined;
  currentApiKey: ApiKeyConfig | undefined;
  settings: UserSettings;
  onOpenSettings: (tab?: string) => void;
  onOpenModelConfig?: () => void;
  quotedText?: string | null;
  onClearQuote?: () => void;
  parameters: ModelParameters;
  onUpdateParameters: (params: ModelParameters) => void;
  onOpenParameters?: () => void;
  webAccessEnabled?: boolean;
  onToggleWebAccess?: (enabled: boolean) => void;
}

export const ChatComposer: React.FC<ChatComposerProps> = ({
  onSendMessage,
  isGenerating,
  onStopGeneration,
  currentModel,
  currentApiKey,
  settings,
  onOpenSettings,
  onOpenModelConfig,
  quotedText,
  onClearQuote,
  parameters,
  onUpdateParameters,
  onOpenParameters,
  webAccessEnabled = false,
  onToggleWebAccess,
}) => {
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Auto-resize textarea
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    const nextHeight = Math.min(Math.max(textarea.scrollHeight, 100), 360);
    textarea.style.height = `${nextHeight}px`;
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [content, adjustTextareaHeight]);

  // Handle quoted text insertion
  useEffect(() => {
    if (quotedText) {
      setContent(prev => {
        const quotePrefix = quotedText.split('\n').map(l => `> ${l}`).join('\n');
        return prev ? `${prev}\n\n${quotePrefix}\n\n` : `${quotePrefix}\n\n`;
      });
      onClearQuote?.();
      textareaRef.current?.focus();
    }
  }, [quotedText, onClearQuote]);

  // Handle file uploads
  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setIsProcessingFiles(true);
    try {
      const parsed: Attachment[] = [];
      for (let i = 0; i < fileList.length; i++) {
        const f = fileList[i];
        const att = await parseFileToAttachment(f);
        parsed.push(att);
      }
      setAttachments(prev => [...prev, ...parsed]);
    } catch (err) {
      console.error('File parsing error:', err);
    } finally {
      setIsProcessingFiles(false);
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  // Clipboard paste (image & text files)
  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const filesToProcess: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === 'file') {
        const file = items[i].getAsFile();
        if (file) filesToProcess.push(file);
      }
    }

    if (filesToProcess.length > 0) {
      e.preventDefault();
      setIsProcessingFiles(true);
      const parsed: Attachment[] = [];
      for (const f of filesToProcess) {
        const att = await parseFileToAttachment(f);
        parsed.push(att);
      }
      setAttachments(prev => [...prev, ...parsed]);
      setIsProcessingFiles(false);
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await handleFiles(e.dataTransfer.files);
    }
  };

  // Send action
  const handleSend = () => {
    if (isGenerating) {
      onStopGeneration();
      return;
    }

    const trimmed = content.trim();
    if (!trimmed && attachments.length === 0) return;

    // Check API Key
    if (!currentApiKey || !currentApiKey.apiKey?.trim()) {
      alert('未检测到有效的 API Key！请点击底部或右上角设置并填入对应模型的 API Key。');
      onOpenSettings('keys');
      return;
    }

    onSendMessage(trimmed, attachments);
    setContent('');
    setAttachments([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = '100px';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (settings.enterToSend) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    } else {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSend();
      }
    }
  };

  const hasApiKey = !!currentApiKey?.apiKey?.trim();
  const canSend = (content.trim().length > 0 || attachments.length > 0) && !isGenerating;

  return (
    <div className="w-full max-w-4xl mx-auto px-3 md:px-6 pb-4 pt-1 shrink-0 relative select-none">
      {/* Missing Key Warning Prompt */}
      {!hasApiKey && (
        <div 
          onClick={() => (onOpenModelConfig ? onOpenModelConfig() : onOpenSettings('keys'))}
          className="mb-2 p-2 px-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-400 flex items-center justify-between cursor-pointer hover:bg-amber-500/15 transition"
        >
          <div className="flex items-center gap-2">
            <Key className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span>尚未配置 <strong>{currentModel?.providerId.toUpperCase() || '当前模型'}</strong> 的 API Key，将无法发送请求。</span>
          </div>
          <span className="font-semibold underline shrink-0 text-orange-600 dark:text-orange-400">点击进入 AI 模型配置 →</span>
        </div>
      )}

      {/* Main Composer Box */}
      <div 
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative flex flex-col rounded-2xl border bg-white dark:bg-neutral-900 transition-all shadow-md ${
          isDragging 
            ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/20 dark:bg-indigo-950/20' 
            : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700'
        }`}
      >
        {/* Drag & Drop Overlay */}
        {isDragging && (
          <div className="absolute inset-0 z-20 rounded-2xl bg-indigo-600/10 dark:bg-indigo-500/20 backdrop-blur-2xs flex flex-col items-center justify-center pointer-events-none border-2 border-dashed border-indigo-500">
            <Paperclip className="w-8 h-8 text-indigo-600 dark:text-indigo-400 animate-bounce mb-1" />
            <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">松开鼠标以上传文件或图片</p>
          </div>
        )}

        {/* Half-height streamlined toolbar (Icon-only, no text clutter) */}
        <div className="flex items-center justify-between px-3 py-1 border-b border-neutral-100 dark:border-neutral-800/80 bg-neutral-50/70 dark:bg-neutral-900/60 rounded-t-2xl">
          {/* Reasoning Toggle: Minimalist switch */}
          <div 
            onClick={() => onUpdateParameters({ ...parameters, enableReasoning: !parameters.enableReasoning })}
            className="flex items-center gap-1.5 cursor-pointer select-none"
            title={parameters.enableReasoning ? '深度推理: 已开启 (Reasoning ON)' : '深度推理: 已关闭 (Reasoning OFF)'}
          >
            <Sparkles className={`w-3.5 h-3.5 ${parameters.enableReasoning ? 'text-[#84cc16]' : 'text-neutral-400'}`} />
            <div className="flex items-center bg-neutral-200 dark:bg-neutral-800 p-0.5 rounded-full text-[9px] font-bold border border-neutral-300/60 dark:border-neutral-700/60">
              <span className={`px-1.5 py-0.2 rounded-full transition-all ${!parameters.enableReasoning ? 'bg-white dark:bg-neutral-950 text-neutral-900 dark:text-white shadow-xs' : 'text-neutral-400'}`}>
                OFF
              </span>
              <span className={`px-1.5 py-0.2 rounded-full transition-all ${parameters.enableReasoning ? 'bg-[#84cc16] text-black shadow-xs' : 'text-neutral-400'}`}>
                ON
              </span>
            </div>
          </div>

          {/* Parameters & Model Config Buttons (Icon-only) */}
          <div className="flex items-center gap-1">
            {onOpenModelConfig && (
              <button
                type="button"
                onClick={onOpenModelConfig}
                className="p-1 rounded-lg hover:bg-orange-500/15 text-orange-600 dark:text-orange-400 transition cursor-pointer"
                title="AI 模型与服务商配置"
              >
                <Server className="w-3.5 h-3.5 text-orange-500" />
              </button>
            )}

            <button
              type="button"
              onClick={onOpenParameters}
              className="p-1 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:text-[#84cc16] dark:hover:text-[#84cc16] transition cursor-pointer"
              title="模型运行参数 (Parameters)"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#84cc16]" />
            </button>
          </div>
        </div>

        {/* Attachments Preview Tray */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 p-3 pb-1 border-b border-neutral-100 dark:border-neutral-800/80">
            {attachments.map((att) => (
              <div 
                key={att.id}
                className="relative group flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700/80 bg-neutral-50 dark:bg-neutral-800 text-xs shadow-2xs"
              >
                {att.type.startsWith('image/') && att.dataUrl ? (
                  <img src={att.dataUrl} alt={att.name} className="w-7 h-7 object-cover rounded-lg shrink-0" />
                ) : (
                  <div className="w-7 h-7 rounded-lg bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center shrink-0">
                    <FileText className="w-3.5 h-3.5 text-indigo-500" />
                  </div>
                )}
                <div className="min-w-0 pr-2">
                  <p className="font-medium text-neutral-800 dark:text-neutral-200 truncate max-w-[120px] text-xs">
                    {att.name}
                  </p>
                  <p className="text-[10px] text-neutral-400">
                    {formatFileSize(att.size)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeAttachment(att.id)}
                  className="p-1 rounded-full text-neutral-400 hover:text-red-500 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition"
                  title="移除附件"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Text Area (Double Height - min 100px) */}
        <div className="p-3 pt-2 pb-1">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={
              isGenerating 
                ? 'AI 正在生成中...' 
                : !hasApiKey
                ? '请先配置 API Key，或在此输入您的问题...'
                : '给 AI 发送消息... (Enter 发送，Shift + Enter 换行，支持粘贴图片与拖入文件)'
            }
            rows={3}
            className="w-full bg-transparent resize-none border-0 text-sm text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 outline-hidden leading-relaxed min-h-[100px] max-h-[360px] font-sans"
          />
        </div>

        {/* Bottom Toolbar Row */}
        <div className="px-3 pb-2.5 pt-1 flex items-center justify-between">
          {/* Left Buttons: Attachments & Tools */}
          <div className="flex items-center gap-1">
            {/* Hidden Inputs */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => handleFiles(e.target.files)}
              multiple
              className="hidden"
            />
            <input
              type="file"
              ref={imageInputRef}
              accept="image/*"
              onChange={(e) => handleFiles(e.target.files)}
              multiple
              className="hidden"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 rounded-xl text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition flex items-center gap-1 text-xs"
              title="上传文档/代码/文件 (TXT, PDF, MD, JSON, CSV, DOCX)"
            >
              <Paperclip className="w-4 h-4" />
              <span className="hidden sm:inline text-[11px]">附件</span>
            </button>

            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              className="p-2 rounded-xl text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition flex items-center gap-1 text-xs"
              title="上传图片 (PNG, JPG, WEBP, GIF)"
            >
              <ImageIcon className="w-4 h-4" />
              <span className="hidden sm:inline text-[11px]">图片</span>
            </button>

            {/* 访问网络按钮 (默认关闭) */}
            <button
              type="button"
              onClick={() => onToggleWebAccess?.(!webAccessEnabled)}
              className={`p-2 rounded-xl transition flex items-center gap-1.5 text-xs select-none cursor-pointer ${
                webAccessEnabled
                  ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 hover:bg-blue-500/20 font-medium shadow-2xs'
                  : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
              title={
                webAccessEnabled
                  ? '访问网络 (已开启): AI 回答时将自动检索最新网络资料与网页'
                  : '访问网络 (默认关闭): 点击开启允许 AI 检索互联网资料与网页来回答问题'
              }
            >
              <Globe className={`w-4 h-4 ${webAccessEnabled ? 'text-blue-600 dark:text-blue-400' : ''}`} />
              <span className="hidden sm:inline text-[11px]">访问网络</span>
              {webAccessEnabled && (
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              )}
            </button>
          </div>

          {/* Right Action: Send or Stop */}
          <div className="flex items-center gap-2">
            {content.length > 0 && (
              <span className="text-[11px] text-neutral-400 font-mono hidden sm:inline">
                {content.length} 字
              </span>
            )}

            {isGenerating ? (
              <button
                type="button"
                onClick={onStopGeneration}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-xs transition active:scale-95 cursor-pointer animate-pulse"
                title="停止生成"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>停止</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSend}
                disabled={!canSend}
                className={`p-2 rounded-xl flex items-center justify-center transition-all shadow-xs ${
                  canSend
                    ? 'bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-100 dark:hover:bg-white text-white dark:text-neutral-900 active:scale-95 cursor-pointer'
                    : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-600 cursor-not-allowed'
                }`}
                title={canSend ? '发送消息' : '请输入内容'}
              >
                <ArrowUp className="w-4 h-4 stroke-[2.5]" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="mt-1.5 text-center text-[10px] text-neutral-400 select-none">
        按 {settings.enterToSend ? 'Enter 发送，Shift + Enter 换行' : 'Ctrl / ⌘ + Enter 发送'} · 仅向目标模型发起必要推理请求
      </div>
    </div>
  );
};
