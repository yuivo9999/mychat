import React, { useEffect, useRef, useState } from 'react';
import { 
  Sparkles, 
  Code, 
  FileSearch, 
  PenTool, 
  Lightbulb, 
  ArrowDown,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { Message, ModelItem, UserSettings } from '../types';
import { ChatMessage } from './ChatMessage';

interface MessageListProps {
  messages: Message[];
  currentModel: ModelItem | undefined;
  settings: UserSettings;
  onRetry: (messageId: string) => void;
  onRegenerate: (messageId: string) => void;
  onContinue: (messageId: string) => void;
  onEdit: (messageId: string, newContent: string, resubmit: boolean) => void;
  onDelete: (messageId: string) => void;
  onQuote: (content: string) => void;
  onSwitchVersion: (messageId: string, versionIndex: number) => void;
  onSelectPrompt: (prompt: string) => void;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  currentModel,
  settings,
  onRetry,
  onRegenerate,
  onContinue,
  onEdit,
  onDelete,
  onQuote,
  onSwitchVersion,
  onSelectPrompt,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  // Check scroll position
  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 120;
    setShowScrollBottom(!isNearBottom);
  };

  const scrollToBottom = (smooth = true) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  };

  useEffect(() => {
    if (settings.autoScroll) {
      scrollToBottom();
    }
  }, [messages, settings.autoScroll]);

  const quickPrompts = [
    {
      icon: <Code className="w-4 h-4 text-blue-500" />,
      title: '代码审查与重构',
      desc: '请帮我审查并优化一段代码，指出潜在隐患和性能瓶颈',
    },
    {
      icon: <FileSearch className="w-4 h-4 text-emerald-500" />,
      title: '多格式文件深度分析',
      desc: '拖拽或上传 PDF、JSON 或 Markdown，提炼核心结论',
    },
    {
      icon: <PenTool className="w-4 h-4 text-purple-500" />,
      title: '专业文案与结构化提纲',
      desc: '起草一份严谨的技术架构方案或产品需求文档',
    },
    {
      icon: <Lightbulb className="w-4 h-4 text-amber-500" />,
      title: '复杂逻辑算法推导',
      desc: '逐步解析高并发、状态机或分布式一致性设计',
    },
  ];

  return (
    <div 
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto relative flex flex-col"
    >
      {messages.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 max-w-2xl mx-auto w-full text-center select-none my-auto">
          {/* Logo & Welcome */}
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20 mb-4">
            <Sparkles className="w-7 h-7" />
          </div>

          <h2 className="text-xl md:text-2xl font-bold text-neutral-800 dark:text-neutral-100 mb-1.5 tracking-tight">
            本地多模型 AI 客户端
          </h2>
          <p className="text-xs md:text-sm text-neutral-500 dark:text-neutral-400 max-w-md mb-6 leading-relaxed">
            数据本地留存，支持全球主流 AI 模型统一调用、文件分析与图片多模态理解。
          </p>

          {/* Model info pill */}
          {currentModel && (
            <div className="mb-8 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-neutral-200/50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700/60 text-xs text-neutral-600 dark:text-neutral-300">
              <Zap className="w-3.5 h-3.5 text-indigo-500" />
              <span>当前准备就绪：<strong className="font-semibold text-neutral-900 dark:text-white">{currentModel.name}</strong></span>
              {currentModel.supportsVision && (
                <span className="text-[10px] px-1.5 py-0.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-md font-medium">支持看图</span>
              )}
            </div>
          )}

          {/* Prompt Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full text-left">
            {quickPrompts.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onSelectPrompt(item.desc)}
                className="group p-3.5 rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white/60 dark:bg-neutral-900/60 hover:bg-white dark:hover:bg-neutral-800/90 hover:border-indigo-300 dark:hover:border-indigo-500/40 transition-all shadow-2xs hover:shadow-md cursor-pointer"
              >
                <div className="flex items-center gap-2.5 mb-1.5">
                  <div className="p-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 group-hover:scale-105 transition-transform">
                    {item.icon}
                  </div>
                  <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {item.title}
                  </span>
                </div>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 line-clamp-2 leading-relaxed">
                  {item.desc}
                </p>
              </button>
            ))}
          </div>

          <div className="mt-8 flex items-center gap-2 text-[11px] text-neutral-400 select-none">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>无自建数据库 · API Key 与聊天记录存储于本地浏览器</span>
          </div>
        </div>
      ) : (
        <div className="w-full max-w-4xl mx-auto divide-y divide-neutral-100 dark:divide-neutral-800/60 pb-8">
          {messages.map((msg) => (
            <ChatMessage
              key={msg.id}
              message={msg}
              settings={settings}
              onRetry={onRetry}
              onRegenerate={onRegenerate}
              onContinue={onContinue}
              onEdit={onEdit}
              onDelete={onDelete}
              onQuote={onQuote}
              onSwitchVersion={onSwitchVersion}
            />
          ))}
          <div ref={bottomRef} className="h-4" />
        </div>
      )}

      {/* Floating Scroll to Bottom Button */}
      {showScrollBottom && (
        <button
          type="button"
          onClick={() => scrollToBottom(true)}
          className="fixed bottom-28 right-6 z-30 p-2.5 rounded-full bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-700 shadow-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-all cursor-pointer"
          title="滚动到底部"
        >
          <ArrowDown className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
