import { Models } from "appwrite";

export interface Profile extends Models.Row {
  userId: string;
  name: string;
  email: string;
}


export interface Message extends Models.Row {
  conversationId: string;
  senderId: string;
  senderName: string;
  recipientId: string;
  content: string;
}
