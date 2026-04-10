import { MessageSquarePlus } from 'lucide-react';
import { ChatHistoryItem } from '@/components/chat/chat-history-item';
import { Button } from '@/components/ui/button';

export type SidebarChat = {
  id: string;
  title: string;
};

type SidebarProps = {
  open: boolean;
  chats: SidebarChat[];
  activeChatId?: string;
  editingChatId: string | null;
  editTitleValue: string;
  onToggle: () => void;
  onNewChat: () => void;
  onSelectChat: (id: string) => void;
  onStartRename: (id: string, title: string) => void;
  onEditTitleChange: (value: string) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onDeleteChat: (id: string) => void;
};

export function Sidebar({
  open,
  chats,
  activeChatId,
  editingChatId,
  editTitleValue,
  onToggle,
  onNewChat,
  onSelectChat,
  onStartRename,
  onEditTitleChange,
  onCommitRename,
  onCancelRename,
  onDeleteChat,
}: SidebarProps) {
  return (
    <>
      {open ? <button type="button" onClick={onToggle} className="fixed inset-0 z-20 bg-black/25 lg:hidden" aria-label="Close sidebar" /> : null}
      <aside
        className={`fixed inset-y-0 left-[72px] z-30 w-[260px] border-r border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-3 shadow-[var(--app-shadow-md)] transition-transform duration-300 ${
          open ? 'translate-x-0' : '-translate-x-[calc(100%+72px)]'
        }`}
      >
        <div className="flex h-full flex-col">
          <Button type="button" onClick={onNewChat} className="mb-3 mt-1 w-full justify-start gap-2 rounded-xl">
            <MessageSquarePlus className="h-4 w-4" />
            New Chat
          </Button>

          <div className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--app-subtle)]">
            Chat history
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto pr-1">
            {chats.map((chat) => (
              <ChatHistoryItem
                key={chat.id}
                id={chat.id}
                title={chat.title}
                active={chat.id === activeChatId}
                editing={editingChatId === chat.id}
                draftTitle={editingChatId === chat.id ? editTitleValue : chat.title}
                onSelect={onSelectChat}
                onStartEdit={onStartRename}
                onDraftChange={onEditTitleChange}
                onCommitEdit={onCommitRename}
                onCancelEdit={onCancelRename}
                onDelete={onDeleteChat}
              />
            ))}
          </div>
        </div>
      </aside>
    </>
  );
}
