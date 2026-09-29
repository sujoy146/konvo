import { Message } from "@/types";

export type MessageStatus = "sending" | "sent" | "failed";

export interface LocalMessage {
  $id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  recipientId: string;
  $createdAt: string;
  content: string;
  status?: MessageStatus; // only for optimistic outgoing messages
}

export function messageFromRow(row: Message): Omit<LocalMessage, "status"> {
  return {
    $id: row.$id,
    conversationId: row.conversationId,
    senderId: row.senderId,
    senderName: row.senderName,
    recipientId: row.recipientId,
    $createdAt: row.$createdAt,
    content: row.content,
  };
}
