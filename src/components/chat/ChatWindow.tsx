"use client";

import { Profile } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { useMessages } from "@/hooks/useMessages";
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";

interface ChatWindowProps {
  otherUser: Profile;
  onBack: () => void;
}

export function ChatWindow({ otherUser, onBack }: ChatWindowProps) {
  const { user } = useAuth();
  const { messages, loading, error, sendMessage, retryMessage, convKey } = useMessages(otherUser);

  const noKey = !otherUser.publicKey;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="px-4 py-3 bg-white border-b border-gray-200 flex items-center shadow-sm shrink-0">
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
          <h3 className="text-base font-semibold text-gray-900 truncate">{otherUser.name}</h3>
          <p className="text-xs text-green-600 flex items-center">
            <svg className="w-3 h-3 mr-1 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            End-to-end encrypted
          </p>
        </div>
      </header>

      {/* Message list */}
      <MessageList
        messages={messages}
        currentUserId={user?.$id ?? ""}
        loading={loading}
        error={error}
        onRetry={retryMessage}
      />

      {/* Input */}
      <MessageInput
        onSend={sendMessage}
        disabled={!convKey || noKey}
        disabledReason={noKey ? "This user has no encryption key yet." : undefined}
      />
    </div>
  );
}
