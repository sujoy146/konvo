import { useEffect, useRef } from "react";
import { LocalMessage } from "@/types/message";
import { MessageBubble } from "./MessageBubble";
import { Spinner } from "../ui/Spinner";

interface MessageListProps {
  messages: LocalMessage[];
  currentUserId: string;
  loading: boolean;
  error: string;
  onRetry: (id: string) => void;
  /** IDs of messages that were unread when this conversation was opened. */
  openedUnreadIds: Set<string>;
}

export function MessageList({
  messages,
  currentUserId,
  loading,
  error,
  onRetry,
  openedUnreadIds,
}: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Keep the newest message in view whenever history or a live message arrives.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.scrollTo({
      top: container.scrollHeight,
      behavior: messages.length > 1 ? "smooth" : "auto",
    });
  }, [messages]);

  if (loading) {
    return (
      <div className="flex h-full min-h-0 w-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full min-h-0 w-full items-center justify-center p-4 text-center text-sm text-red-500">
        {error}
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex h-full min-h-0 w-full items-center justify-center text-sm text-gray-500">
        No messages yet. Say hello! 👋
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-0 w-full overflow-hidden">
      <div
        ref={containerRef}
        role="log"
        aria-live="polite"
        aria-label="Messages"
        className="absolute inset-0 overflow-y-auto p-4 space-y-0.5 flex flex-col"
      >
        {messages.map((msg) => (
          <MessageBubble
            key={msg.$id}
            message={msg}
            isOwn={msg.senderId === currentUserId}
            isUnread={openedUnreadIds.has(msg.$id)}
            onRetry={onRetry}
          />
        ))}
      </div>
    </div>
  );
}
