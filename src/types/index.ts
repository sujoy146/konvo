import { Models } from "appwrite";

export interface Profile extends Models.Document {
  userId: string;
  name: string;
  email: string;
  publicKey: string;
}

export interface KeyVault extends Models.Document {
  publicKey: string;
  salt: string;
  iv: string;
  wrappedPrivateKey: string;
  iterations: number;
}

export interface Message extends Models.Document {
  conversationId: string;
  senderId: string;
  senderName: string;
  recipientId: string;
  ciphertext: string;
}
