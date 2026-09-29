"use client";

/**
 * Page-level Realtime listener for incoming messages.
 * Runs independently of which conversation is open.
 * Calls back with (senderId, messageId, createdAt) for every incoming message
 * so the caller can decide whether to increment unread counts.
 */

import { useEffect } from "react";
import { client } from "@/lib/appwrite";
import { config } from "@/lib/config";
import { Message } from "@/types";

interface PageRealtimeOptions {
  myId: string;
  /** Return true if this senderId's conversation is currently open (skip unread increment). */
  isConversationOpen: (senderId: string) => boolean;
  onIncoming: (senderId: string, messageId: string, createdAt: string) => void;
}

export function usePageRealtime({ myId, isConversationOpen, onIncoming }: PageRealtimeOptions) {
  useEffect(() => {
    if (!myId) return;

    const channel = `tablesdb.${config.appwriteDatabaseId}.tables.${config.appwriteMessagesCollectionId}.rows`;

    const unsubscribe = client.subscribe(channel, (event) => {
      // Only care about new messages
      if (!event.events.some((e) => e.endsWith(".create"))) return;

      const payload = event.payload as Message;

      // Only care about messages addressed to me that I didn't send
      if (payload.recipientId !== myId) return;
      if (payload.senderId === myId) return;

      // If the conversation with this sender is already open, skip —
      // useMessages will handle it (and mark as read automatically).
      if (isConversationOpen(payload.senderId)) return;

      onIncoming(payload.senderId, payload.$id, payload.$createdAt);
    });

    return () => {
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myId]);
}
