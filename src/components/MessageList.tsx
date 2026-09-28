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
        <div className="flex-1" />
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
