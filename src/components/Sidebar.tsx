import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  Settings, 
  Star, 
  MessageSquare, 
  ChevronLeft, 
  ChevronRight, 
  Trash2, 
  Edit2, 
  Share2, 
  MoreVertical, 
  CheckSquare, 
  ShieldCheck,
  FolderOpen,
  Server
} from 'lucide-react';
import { Conversation, ModelItem } from '../types';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onDeleteConversation: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onRenameConversation: (id: string, newTitle: string) => void;
  onExportConversation: (conv: Conversation) => void;
  onOpenSettings: () => void;
  onOpenModelConfig?: () => void;
  onOpenSearch: () => void;
  onOpenBatchManage: () => void;
  models: ModelItem[];
  isMobile: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onToggle,
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewChat,
  onDeleteConversation,
  onToggleFavorite,
  onRenameConversation,
  onExportConversation,
  onOpenSettings,
  onOpenModelConfig,
  onOpenSearch,
  onOpenBatchManage,
  models,
  isMobile,
}) => {
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  // Group conversations by time
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  const todayStart = new Date().setHours(0, 0, 0, 0);
  const yesterdayStart = todayStart - oneDay;
  const last7DaysStart = todayStart - 7 * oneDay;

  const favorites = conversations.filter(c => c.isFavorite);
  const nonFavorites = conversations.filter(c => !c.isFavorite);

  const groups = {
    today: nonFavorites.filter(c => c.updatedAt >= todayStart),
    yesterday: nonFavorites.filter(c => c.updatedAt >= yesterdayStart && c.updatedAt < todayStart),
    last7Days: nonFavorites.filter(c => c.updatedAt >= last7DaysStart && c.updatedAt < yesterdayStart),
    earlier: nonFavorites.filter(c => c.updatedAt < last7DaysStart),
  };

  const startRename = (conv: Conversation, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(conv.id);
    setEditTitle(conv.title);
    setMenuOpenId(null);
  };

  const submitRename = (id: string) => {
    if (editTitle.trim()) {
      onRenameConversation(id, editTitle.trim());
    }
    setEditingId(null);
  };

  const getModelName = (modelId: string) => {
    const m = models.find(item => item.id === modelId);
    return m ? m.name : modelId;
  };

  const renderConversationItem = (conv: Conversation) => {
    const isActive = conv.id === activeConversationId;
    const isEditing = editingId === conv.id;
    const isMenuOpen = menuOpenId === conv.id;

    return (
      <div
        key={conv.id}
        onClick={() => {
          if (!isEditing) onSelectConversation(conv.id);
        }}
        className={`group relative flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all text-sm ${
          isActive
            ? 'bg-neutral-200/80 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-medium shadow-xs'
            : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800/60 hover:text-neutral-900 dark:hover:text-neutral-200'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-1">
          <MessageSquare className={`w-4 h-4 shrink-0 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-neutral-400'}`} />
          {isEditing ? (
            <input
              type="text"
              value={editTitle}
              autoFocus
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={() => submitRename(conv.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitRename(conv.id);
                if (e.key === 'Escape') setEditingId(null);
              }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-neutral-900 border border-indigo-500 rounded px-1.5 py-0.5 text-xs w-full text-neutral-900 dark:text-white outline-hidden"
            />
          ) : (
            <div className="flex flex-col min-w-0 flex-1">
              <span className="truncate text-[13px] leading-tight" title={conv.title}>
                {conv.title || '新对话'}
              </span>
              <span className="text-[11px] text-neutral-400 dark:text-neutral-500 truncate font-mono mt-0.5">
                {getModelName(conv.modelId)}
              </span>
            </div>
          )}
        </div>

        {/* Action icons */}
        {!isEditing && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(conv.id);
              }}
              className={`p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 transition ${
                conv.isFavorite ? 'text-amber-500 opacity-100' : 'text-neutral-400'
              }`}
              title={conv.isFavorite ? '取消收藏' : '收藏'}
            >
              <Star className="w-3.5 h-3.5 fill-current" />
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpenId(isMenuOpen ? null : conv.id);
                }}
                className="p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                title="更多操作"
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </button>

              {isMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpenId(null);
                    }}
                  />
                  <div
                    className="absolute right-0 top-6 w-36 bg-white dark:bg-neutral-900 rounded-xl shadow-lg border border-neutral-200 dark:border-neutral-800 py-1.5 z-40 text-xs"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={(e) => startRename(conv, e)}
                      className="w-full text-left px-3 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-2 text-neutral-700 dark:text-neutral-300"
                    >
                      <Edit2 className="w-3.5 h-3.5" /> 重命名
                    </button>
                    <button
                      onClick={() => {
                        onExportConversation(conv);
                        setMenuOpenId(null);
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-2 text-neutral-700 dark:text-neutral-300"
                    >
                      <Share2 className="w-3.5 h-3.5" /> 导出记录
                    </button>
                    <div className="border-t border-neutral-100 dark:border-neutral-800 my-1" />
                    <button
                      onClick={() => {
                        onDeleteConversation(conv.id);
                        setMenuOpenId(null);
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center gap-2"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> 删除对话
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Mobile Drawer Overlay */}
      {isMobile && isOpen && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 transition-opacity"
          onClick={onToggle}
        />
      )}

      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 flex flex-col bg-neutral-50 dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800/80 transition-all duration-300 ease-in-out shrink-0 select-none ${
          isOpen ? 'w-72 translate-x-0' : isMobile ? '-translate-x-full w-72' : 'w-0 -translate-x-full overflow-hidden border-r-0'
        }`}
      >
        {/* Top Header */}
        <div className="p-3.5 flex items-center justify-between border-b border-neutral-200/70 dark:border-neutral-800/70">
          <button
            type="button"
            onClick={onNewChat}
            className="flex-1 mr-2 flex items-center justify-center gap-2 py-2 px-3 bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-100 dark:hover:bg-white text-white dark:text-neutral-900 rounded-xl font-medium text-sm transition-all shadow-xs active:scale-[0.98]"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>新聊天</span>
          </button>

          <button
            type="button"
            onClick={onToggle}
            className="p-2 text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white rounded-xl hover:bg-neutral-200/60 dark:hover:bg-neutral-800 transition"
            title="收起侧边栏"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Search & Tools Bar */}
        <div className="px-3 pt-2.5 pb-1 flex items-center gap-1.5">
          <button
            type="button"
            onClick={onOpenSearch}
            className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neutral-200/50 dark:bg-neutral-800/50 hover:bg-neutral-200/80 dark:hover:bg-neutral-800 text-xs text-neutral-500 dark:text-neutral-400 transition"
          >
            <Search className="w-3.5 h-3.5" />
            <span>搜索聊天记录...</span>
            <kbd className="ml-auto text-[10px] font-mono opacity-60 bg-neutral-300/40 dark:bg-neutral-700/40 px-1 py-0.5 rounded">⌘K</kbd>
          </button>

          <button
            type="button"
            onClick={onOpenBatchManage}
            className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white hover:bg-neutral-200/60 dark:hover:bg-neutral-800 transition"
            title="批量管理"
          >
            <CheckSquare className="w-4 h-4" />
          </button>
        </div>

        {/* Conversation List Scrollable */}
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-4">
          {conversations.length === 0 ? (
            <div className="py-12 px-4 text-center">
              <MessageSquare className="w-8 h-8 text-neutral-300 dark:text-neutral-600 mx-auto mb-2 opacity-50" />
              <p className="text-xs text-neutral-400">暂无历史记录</p>
              <p className="text-[11px] text-neutral-400/80 mt-1">点击上方“+ 新聊天”开启对话</p>
            </div>
          ) : (
            <>
              {/* Favorites Section */}
              {favorites.length > 0 && (
                <div>
                  <div className="px-2 py-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1 uppercase tracking-wider">
                    <Star className="w-3 h-3 fill-current" />
                    <span>收藏 ({favorites.length})</span>
                  </div>
                  <div className="space-y-0.5 mt-1">
                    {favorites.map(renderConversationItem)}
                  </div>
                </div>
              )}

              {/* Today */}
              {groups.today.length > 0 && (
                <div>
                  <div className="px-2 py-1 text-[11px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
                    今天
                  </div>
                  <div className="space-y-0.5 mt-1">
                    {groups.today.map(renderConversationItem)}
                  </div>
                </div>
              )}

              {/* Yesterday */}
              {groups.yesterday.length > 0 && (
                <div>
                  <div className="px-2 py-1 text-[11px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
                    昨天
                  </div>
                  <div className="space-y-0.5 mt-1">
                    {groups.yesterday.map(renderConversationItem)}
                  </div>
                </div>
              )}

              {/* Last 7 Days */}
              {groups.last7Days.length > 0 && (
                <div>
                  <div className="px-2 py-1 text-[11px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
                    最近 7 天
                  </div>
                  <div className="space-y-0.5 mt-1">
                    {groups.last7Days.map(renderConversationItem)}
                  </div>
                </div>
              )}

              {/* Earlier */}
              {groups.earlier.length > 0 && (
                <div>
                  <div className="px-2 py-1 text-[11px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
                    更早之前
                  </div>
                  <div className="space-y-0.5 mt-1">
                    {groups.earlier.map(renderConversationItem)}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-neutral-200/70 dark:border-neutral-800/70 space-y-1.5 bg-neutral-50/50 dark:bg-neutral-900/50">
          <div className="flex items-center justify-between text-[11px] text-neutral-400 px-1 py-0.5">
            <span className="flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>数据本地运行</span>
            </span>
            <span className="text-[10px] text-neutral-400/80">IndexedDB</span>
          </div>

          {/* Dedicated AI Model Configuration Button */}
          {onOpenModelConfig && (
            <button
              type="button"
              onClick={onOpenModelConfig}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-orange-600 dark:text-orange-400 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/25 transition active:scale-[0.98]"
            >
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4" />
                <span>AI 模型配置</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-orange-500/20 text-orange-500 dark:text-orange-300 font-mono">
                服务商/Key
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenSettings}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200/60 dark:hover:bg-neutral-800 transition"
          >
            <Settings className="w-4 h-4 text-neutral-500" />
            <span>通用与外观设置</span>
          </button>
        </div>
      </aside>
    </>
  );
};
