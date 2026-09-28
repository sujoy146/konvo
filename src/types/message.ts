import { Message } from "@/types";

export type MessageStatus = "sending" | "sent" | "failed";

export interface LocalMessage {
  $id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  recipientId: string;
  $createdAt: string;
  text: string | null; // null if decryption failed
  decryptError?: boolean;
  status?: MessageStatus; // only for optimistic outgoing messages
  ciphertext?: string; // kept in memory for retries; never persisted
}

export function messageFromRow(row: Message): Omit<LocalMessage, "text" | "decryptError"> {
  return {
    $id: row.$id,
    conversationId: row.conversationId,
    senderId: row.senderId,
    senderName: row.senderName,
    recipientId: row.recipientId,
    $createdAt: row.$createdAt,
    ciphertext: row.ciphertext,
  };
}
