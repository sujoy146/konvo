"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ID, Query, Permission, Role } from "appwrite";
import { tablesDb, client } from "@/lib/appwrite";
import { config } from "@/lib/config";
import { useAuth } from "@/context/AuthContext";
import { useEncryption } from "@/context/EncryptionContext";
import { getConversationId } from "@/lib/conversation";
import { Profile, Message } from "@/types";
import { LocalMessage, messageFromRow } from "@/types/message";
import { setLastRead, getLastRead } from "@/lib/storage";

const RETRY_DELAYS = [1000, 2000, 4000];

export function useMessages(otherUser: Profile | null) {
  const { user } = useAuth();
  const { getConversationKey, encrypt, decrypt, status: encStatus } = useEncryption();

  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [convKey, setConvKey] = useState<CryptoKey | null>(null);

  // Track active conversationId to avoid stale state updates
  const activeConvIdRef = useRef<string | null>(null);

  const decryptRow = useCallback(
    async (row: Message, key: CryptoKey): Promise<LocalMessage> => {
      const base = messageFromRow(row);
      try {
        const aad = `${row.$id}|${row.conversationId}|${row.senderId}`;
        const text = await decrypt(key, row.ciphertext, row.$id, row.conversationId, row.senderId);
        return { ...base, text };
      } catch {
        return { ...base, text: null, decryptError: true };
      }
    },
    [decrypt]
  );

  // Load conversation key and history when otherUser changes
  useEffect(() => {
    if (!user || !otherUser || encStatus !== "ready") {
      setMessages([]);
      setConvKey(null);
      return;
    }

    const convId = getConversationId(user.$id, otherUser.userId);
    activeConvIdRef.current = convId;

    const load = async () => {
      setLoading(true);
      setError("");
      setMessages([]);

      try {
        // Derive conversation key
        const key = await getConversationKey(otherUser);
        if (activeConvIdRef.current !== convId) return; // stale
        setConvKey(key);

        // Fetch last 50 messages, newest first, then reverse for display
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
        const decrypted = await Promise.all(rows.map((r) => decryptRow(r, key)));
        if (activeConvIdRef.current !== convId) return; // stale

        setMessages(decrypted);

        // Mark as read
        if (rows.length > 0) {
          const lastRead = getLastRead(user.$id);
          lastRead[otherUser.userId] = new Date().toISOString();
          setLastRead(user.$id, lastRead);
        }
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
  }, [user, otherUser, encStatus, getConversationKey, decryptRow]);

  // Realtime subscription for incoming messages
  useEffect(() => {
    if (!user || !convKey) return;

    const channel = `databases.${config.appwriteDatabaseId}.collections.${config.appwriteMessagesCollectionId}.documents`;

    const unsubscribe = client.subscribe(channel, async (event) => {
      const payload = event.payload as Message;
      // Only handle create events
      if (!event.events.some((e) => e.endsWith(".create"))) return;

      const convId = activeConvIdRef.current;

      setMessages((prev) => {
        // Replace optimistic message by $id if it exists
        const exists = prev.find((m) => m.$id === payload.$id);
        if (exists) {
          return prev.map((m) =>
            m.$id === payload.$id ? { ...m, status: "sent", $createdAt: payload.$createdAt } : m
          );
        }
        return prev;
      });

      // If not an existing optimistic message, decrypt and append
      setMessages((prev) => {
        const exists = prev.find((m) => m.$id === payload.$id && m.status === "sent");
        if (exists) return prev;

        // Append async (we'll set it after decryption)
        return prev;
      });

      if (payload.conversationId === activeConvIdRef.current) {
        // New incoming message for active conversation
        const base = messageFromRow(payload);
        const existing = messages.find((m) => m.$id === payload.$id);
        if (existing) return;

        try {
          const text = await decrypt(convKey, payload.ciphertext, payload.$id, payload.conversationId, payload.senderId);
          const newMsg: LocalMessage = { ...base, text };
          setMessages((prev) => {
            if (prev.find((m) => m.$id === payload.$id)) return prev;
            return [...prev, newMsg];
          });

          // Update lastRead since conversation is open
          if (user) {
            const lr = getLastRead(user.$id);
            lr[payload.senderId] = new Date().toISOString();
            setLastRead(user.$id, lr);
          }
        } catch {
          const newMsg: LocalMessage = { ...base, text: null, decryptError: true };
          setMessages((prev) => {
            if (prev.find((m) => m.$id === payload.$id)) return prev;
            return [...prev, newMsg];
          });
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [user, convKey, decrypt, messages]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!user || !otherUser || !convKey) return;

      const trimmed = text.trim();
      if (!trimmed || trimmed.length > 2000) return;

      const convId = getConversationId(user.$id, otherUser.userId);
      const msgId = ID.unique();

      // Encrypt once, reuse on retries
      const aad = `${msgId}|${convId}|${user.$id}`;
      const ciphertext = await encrypt(convKey, trimmed, msgId, convId, user.$id);

      // Optimistic message
      const optimistic: LocalMessage = {
        $id: msgId,
        conversationId: convId,
        senderId: user.$id,
        senderName: user.name,
        recipientId: otherUser.userId,
        $createdAt: new Date().toISOString(),
        text: trimmed,
        status: "sending",
        ciphertext,
      };
      setMessages((prev) => [...prev, optimistic]);

      const doSend = async (attempt: number): Promise<void> => {
        try {
          await tablesDb.createRow<Message>(
            config.appwriteDatabaseId,
            config.appwriteMessagesCollectionId,
            msgId,
            {
              conversationId: convId,
              senderId: user.$id,
              senderName: user.name,
              recipientId: otherUser.userId,
              ciphertext,
            } as Omit<Message, keyof import("appwrite").Models.Row> & Record<string, unknown>,
            [
              Permission.read(Role.user(user.$id)),
              Permission.read(Role.user(otherUser.userId)),
            ]
          );

          setMessages((prev) =>
            prev.map((m) => (m.$id === msgId ? { ...m, status: "sent" } : m))
          );
        } catch (err: unknown) {
          // 409 = already exists (earlier retry succeeded)
          const code = (err as { code?: number }).code;
          if (code === 409) {
            setMessages((prev) =>
              prev.map((m) => (m.$id === msgId ? { ...m, status: "sent" } : m))
            );
            return;
          }

          // Don't retry on client errors (except 429 rate limit)
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
    [user, otherUser, convKey, encrypt]
  );

  const retryMessage = useCallback(
    async (msgId: string) => {
      if (!user || !otherUser || !convKey) return;
      const msg = messages.find((m) => m.$id === msgId);
      if (!msg || !msg.ciphertext) return;

      const convId = getConversationId(user.$id, otherUser.userId);

      setMessages((prev) =>
        prev.map((m) => (m.$id === msgId ? { ...m, status: "sending" } : m))
      );

      try {
        await tablesDb.createRow<Message>(
          config.appwriteDatabaseId,
          config.appwriteMessagesCollectionId,
          msgId,
          {
            conversationId: convId,
            senderId: user.$id,
            senderName: user.name,
            recipientId: otherUser.userId,
            ciphertext: msg.ciphertext,
          } as Omit<Message, keyof import("appwrite").Models.Row> & Record<string, unknown>,
          [
            Permission.read(Role.user(user.$id)),
            Permission.read(Role.user(otherUser.userId)),
          ]
        );
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
    [user, otherUser, convKey, messages]
  );

  return { messages, loading, error, sendMessage, retryMessage, convKey };
}
