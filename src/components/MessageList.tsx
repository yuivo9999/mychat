import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown } from 'lucide-react';
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
  onDownloadWorkspaceZip?: () => void;
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
  onDownloadWorkspaceZip,
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

  return (
    <div 
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto relative flex flex-col"
    >
      {messages.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-xl mx-auto w-full text-center select-none my-auto space-y-6 animate-in fade-in duration-500">
          {/* Central Motif for Warm Vermilion Textile / Empty Chat */}
          <div className="space-y-3">
            <div className="inline-flex items-center justify-center px-3.5 py-1 rounded-md bg-[#A52C28]/10 border border-[#A52C28]/25 text-[#A52C28] text-xs font-serif tracking-widest shadow-2xs">
              人遇轻嘗
            </div>
            <h2 className="text-xl md:text-2xl font-bold font-serif text-neutral-800 dark:text-neutral-200 tracking-wide">
              今天想从哪里开始？
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 font-serif max-w-md mx-auto leading-relaxed">
              输入任意问题、上传文档代码，或在下方开启 Agent 智能工作区探索。
            </p>
          </div>

          {/* Quick Prompt Suggestions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full pt-2">
            {[
              { title: '分析与优化代码', desc: '深度审查代码逻辑并提出重构建议' },
              { title: '撰写技术文档', desc: '根据项目结构整理清晰的架构说明' },
              { title: '多文件协同思考', desc: '围绕工作区中的多个模块进行交叉分析' },
              { title: '头脑风暴与构想', desc: '梳理产品创意与核心技术实现路径' },
            ].map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onSelectPrompt(item.title + '：' + item.desc)}
                className="p-3 text-left rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white/60 dark:bg-neutral-800/40 hover:bg-white dark:hover:bg-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 transition shadow-2xs group cursor-pointer"
              >
                <div className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 group-hover:text-[#A52C28] transition-colors">
                  {item.title}
                </div>
                <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 truncate">
                  {item.desc}
                </div>
              </button>
            ))}
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
              onDownloadWorkspaceZip={onDownloadWorkspaceZip}
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
