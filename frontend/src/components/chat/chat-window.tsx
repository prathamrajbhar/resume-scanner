import { ChatLogMessage } from '@/types/resume';

type ChatWindowProps = {
  messages: ChatLogMessage[];
};

export function ChatWindow({ messages }: ChatWindowProps) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-3 overflow-y-auto px-4 pb-40 pt-6">
      {messages.map((message) => (
        <article
          key={message.id}
          className={`max-w-[92%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
            message.role === 'user'
              ? 'ml-auto bg-[var(--app-brand)] text-white'
              : message.role === 'system'
                ? 'bg-[var(--app-brand-soft)] text-[var(--app-brand)]'
                : 'bg-[var(--app-surface-elevated)] text-[var(--app-text)]'
          }`}
        >
          {message.content}
        </article>
      ))}
    </div>
  );
}
