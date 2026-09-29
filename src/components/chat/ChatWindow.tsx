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
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="px-4 py-3 bg-white/30 backdrop-blur-md border-b border-white/30 flex items-center shadow-sm shrink-0">
        <button
          className="md:hidden mr-3 text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
          onClick={onBack}
          aria-label="Back to users list"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-black truncate">{otherUser.name}</h3>
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
