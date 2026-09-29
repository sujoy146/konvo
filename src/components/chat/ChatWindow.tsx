"use client";

import { useCallback } from "react";
import { Profile } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { useMessages } from "@/hooks/useMessages";
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";

interface ChatWindowProps {
  otherUser: Profile;
  onBack: () => void;
  /** IDs of messages that were unread when this conversation was opened. */
  openedUnreadIds: Set<string>;
  /** Called once messages load with the ids that were unread + the senderId. */
  onConversationViewed: (unreadIds: string[], senderId: string) => void;
}

export function ChatWindow({
  otherUser,
  onBack,
  openedUnreadIds,
  onConversationViewed,
}: ChatWindowProps) {
  const { user } = useAuth();

  const handleViewed = useCallback(
    (unreadIds: string[], senderId: string) => {
      onConversationViewed(unreadIds, senderId);
    },
    [onConversationViewed]
  );

  const { messages, loading, error, sendMessage, retryMessage } = useMessages(otherUser, {
    onViewed: handleViewed,
  });

  return (
    <div
      className="absolute inset-0 grid min-h-0 min-w-0"
      style={{ gridTemplateRows: "auto minmax(0, 1fr) auto" }}
    >
      {/* Header */}
      <header className="flex min-h-16 shrink-0 items-center border-b border-white/30 bg-white/50 px-3 py-2 shadow-sm backdrop-blur-md sm:px-4">
        <button
          type="button"
          className="mr-2 inline-flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-xl text-gray-600 hover:bg-white/60 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 md:hidden"
          onClick={onBack}
          aria-label="Back to users list"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="flex-1 min-w-0">
          <h3 className="truncate text-base font-semibold text-black">{otherUser.name}</h3>
        </div>
      </header>

      {/* Message list */}
      <MessageList
        messages={messages}
        currentUserId={user?.$id ?? ""}
        loading={loading}
        error={error}
        onRetry={retryMessage}
        openedUnreadIds={openedUnreadIds}
      />

      {/* Input */}
      <MessageInput onSend={sendMessage} />
    </div>
  );
}
