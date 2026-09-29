export const config = {
  appwriteEndpoint: process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "",
  appwriteProjectId: process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || "",
  appwriteDatabaseId: process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || "",
  appwriteProfilesCollectionId: process.env.NEXT_PUBLIC_APPWRITE_PROFILES_COLLECTION_ID || "",
  appwriteKeysCollectionId: process.env.NEXT_PUBLIC_APPWRITE_KEYS_COLLECTION_ID || "",
  appwriteMessagesCollectionId: process.env.NEXT_PUBLIC_APPWRITE_MESSAGES_COLLECTION_ID || "",
  appwriteSendMessageFunctionId: process.env.NEXT_PUBLIC_APPWRITE_SEND_MESSAGE_FUNCTION_ID || "",
  requireEmailVerification: process.env.NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION === "true",
};

// Only throw on the client if missing, or during server render if really needed.
// But Next.js might bundle this. Let's just check the most critical ones.
if (typeof window !== "undefined") {
  if (!config.appwriteEndpoint || !config.appwriteProjectId) {
    console.error("Missing required Appwrite configuration in environment variables.");
  }
}
