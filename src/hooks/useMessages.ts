"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ID, Query } from "appwrite";
import { tablesDb, client } from "@/lib/appwrite";
import { config } from "@/lib/config";
import { useAuth } from "@/context/AuthContext";
import { getConversationId } from "@/lib/conversation";
import { createMessage } from "@/lib/messageDelivery";
import { Profile, Message } from "@/types";
import { LocalMessage, messageFromRow } from "@/types/message";
import { setLastRead, getLastRead, getUnreadCounts, setUnreadCounts } from "@/lib/storage";

const RETRY_DELAYS = [1000, 2000, 4000];

interface UseMessagesOptions {
  /**
   * Called once messages have loaded.
   * Receives the IDs of incoming messages that arrived after the last-read
   * timestamp (i.e., the ones that were "unread" before opening).
   */
  onViewed?: (unreadIds: string[], senderId: string) => void;
}

export function useMessages(otherUser: Profile | null, { onViewed }: UseMessagesOptions = {}) {
  const { user } = useAuth();

  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Track active conversationId to avoid stale state updates
  const activeConvIdRef = useRef<string | null>(null);

  // Keep a ref to messages for use in callbacks that shouldn't re-trigger effects.
  const messagesRef = useRef<LocalMessage[]>([]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Stable ref for the onViewed callback so effects don't need it as a dep.
  const onViewedRef = useRef(onViewed);
  useEffect(() => { onViewedRef.current = onViewed; }, [onViewed]);

  // Load conversation history when otherUser changes
  useEffect(() => {
    if (!user || !otherUser) {
      activeConvIdRef.current = null;
      const t = setTimeout(() => setMessages([]), 0);
      return () => clearTimeout(t);
    }

    const convId = getConversationId(user.$id, otherUser.userId);
    activeConvIdRef.current = convId;

    const load = async () => {
      setLoading(true);
      setError("");
      setMessages([]);

      try {
        const response = await tablesDb.listRows<Message>(
          config.appwriteDatabaseId,
          config.appwriteMessagesCollectionId,
          [
            Query.equal("conversationId", convId),
            Query.orderDesc("$createdAt"),
            Query.limit(50),
          ]
        );
        if (activeConvIdRef.current !== convId) return; // stale

        const rows = [...response.rows].reverse();
        const mapped = rows.map((r) => messageFromRow(r) as LocalMessage);

        setMessages(mapped);

        // Determine which messages were "unread" before opening:
        // any incoming message (from otherUser) created after lastRead[otherUser.userId].
        const lastRead = getLastRead(user.$id);
        const lastReadTime = lastRead[otherUser.userId] ?? "";
        const unreadIds = mapped
          .filter(
            (m) =>
              m.senderId === otherUser.userId &&
              m.$createdAt > lastReadTime
          )
          .map((m) => m.$id);

        // Mark as read in storage
        if (rows.length > 0) {
          const lr = getLastRead(user.$id);
          lr[otherUser.userId] = new Date().toISOString();
          setLastRead(user.$id, lr);
        }

        // Also clear any persisted unread count for this sender
        const counts = getUnreadCounts(user.$id);
        if (counts[otherUser.userId]) {
          delete counts[otherUser.userId];
          setUnreadCounts(user.$id, counts);
        }

        // Notify the chat page of which messages to highlight
        onViewedRef.current?.(unreadIds, otherUser.userId);
      } catch (err) {
        console.error("Failed to load messages", err);
        if (activeConvIdRef.current === convId) {
          setError("Failed to load messages. Please try again.");
        }
      } finally {
        if (activeConvIdRef.current === convId) setLoading(false);
      }
    };

    load();

    return () => {
      activeConvIdRef.current = null;
    };
  }, [user, otherUser]);

  // Realtime subscription — keyed on user only so it doesn't restart on
  // conversation switch. The activeConvIdRef filters events at runtime.
  useEffect(() => {
    if (!user) return;

    const channel = `tablesdb.${config.appwriteDatabaseId}.tables.${config.appwriteMessagesCollectionId}.rows`;

    const unsubscribe = client.subscribe(channel, (event) => {
      const payload = event.payload as Message;

      // Only handle create events
      if (!event.events.some((e) => e.endsWith(".create"))) return;

      // Ignore messages for other conversations
      if (payload.conversationId !== activeConvIdRef.current) return;

      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.$id === payload.$id);

        if (idx !== -1) {
          // Already present (optimistic or duplicate) — update timestamp/status
          return prev.map((m) =>
            m.$id === payload.$id
              ? { ...m, status: "sent" as const, $createdAt: payload.$createdAt }
              : m
          );
        }

        // Brand-new incoming message — no unread highlight needed since the
        // conversation is already open.
        const newMsg = messageFromRow(payload) as LocalMessage;
        return [...prev, newMsg];
      });

      // Update lastRead since the conversation is open
      const lr = getLastRead(user.$id);
      lr[payload.senderId] = new Date().toISOString();
      setLastRead(user.$id, lr);
    });

    return () => {
      unsubscribe();
    };
  }, [user]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!user || !otherUser) return;

      const trimmed = text.trim();
      if (!trimmed || trimmed.length > 2000) return;

      const convId = getConversationId(user.$id, otherUser.userId);
      const msgId = ID.unique();

      const optimistic: LocalMessage = {
        $id: msgId,
        conversationId: convId,
        senderId: user.$id,
        senderName: user.name,
        recipientId: otherUser.userId,
        $createdAt: new Date().toISOString(),
        content: trimmed,
        status: "sending",
      };
      setMessages((prev) => [...prev, optimistic]);

      const doSend = async (attempt: number): Promise<void> => {
        try {
          await createMessage({
            messageId: msgId,
            recipientId: otherUser.userId,
            conversationId: convId,
            content: trimmed,
          });

          setMessages((prev) =>
            prev.map((m) => (m.$id === msgId ? { ...m, status: "sent" } : m))
          );
        } catch (err: unknown) {
          const code = (err as { code?: number }).code;
          if (code === 409) {
            setMessages((prev) =>
              prev.map((m) => (m.$id === msgId ? { ...m, status: "sent" } : m))
            );
            return;
          }

          if (code && code >= 400 && code < 500 && code !== 429) {
            setMessages((prev) =>
              prev.map((m) => (m.$id === msgId ? { ...m, status: "failed" } : m))
            );
            return;
          }

          if (attempt < RETRY_DELAYS.length) {
            await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]));
            return doSend(attempt + 1);
          }

          setMessages((prev) =>
            prev.map((m) => (m.$id === msgId ? { ...m, status: "failed" } : m))
          );
        }
      };

      await doSend(0);
    },
    [user, otherUser]
  );

  const retryMessage = useCallback(
    async (msgId: string) => {
      if (!user || !otherUser) return;

      const msg = messagesRef.current.find((m) => m.$id === msgId);
      if (!msg) return;

      const convId = getConversationId(user.$id, otherUser.userId);

      setMessages((prev) =>
        prev.map((m) => (m.$id === msgId ? { ...m, status: "sending" } : m))
      );

      try {
        await createMessage({
          messageId: msgId,
          recipientId: otherUser.userId,
          conversationId: convId,
          content: msg.content,
        });
        setMessages((prev) =>
          prev.map((m) => (m.$id === msgId ? { ...m, status: "sent" } : m))
        );
      } catch (err: unknown) {
        const code = (err as { code?: number }).code;
        if (code === 409) {
          setMessages((prev) =>
            prev.map((m) => (m.$id === msgId ? { ...m, status: "sent" } : m))
          );
        } else {
          setMessages((prev) =>
            prev.map((m) => (m.$id === msgId ? { ...m, status: "failed" } : m))
          );
        }
      }
    },
    [user, otherUser]
  );

  return { messages, loading, error, sendMessage, retryMessage };
}
