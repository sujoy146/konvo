import { useEffect, useRef, useState } from "react";
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
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const scrollToBottom = (smooth = true) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
  };

  // Auto-scroll when messages change, unless user has scrolled up
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const isNearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 120;

    if (isNearBottom || messages[messages.length - 1]?.senderId === currentUserId) {
      scrollToBottom(messages.length > 1);
      setShowScrollBtn(false);
    } else {
      setShowScrollBtn(true);
    }
  }, [messages, currentUserId]);

  // Scroll on open
  useEffect(() => {
    scrollToBottom(false);
  }, []);

  const handleScroll = () => {
    const container = containerRef.current;
    if (!container) return;
    const isNearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 120;
    setShowScrollBtn(!isNearBottom && messages.length > 0);
  };

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
        onScroll={handleScroll}
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
        <div ref={bottomRef} className="shrink-0 h-1" />
      </div>

      {showScrollBtn && (
        <button
          onClick={() => { scrollToBottom(); setShowScrollBtn(false); }}
          className="absolute bottom-4 right-4 bg-blue-600 text-white rounded-full px-3 py-1.5 text-xs shadow-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          ↓ New messages
        </button>
      )}
    </div>
  );
}
