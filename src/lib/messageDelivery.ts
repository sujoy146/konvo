import { functions } from "@/lib/appwrite";
import { config } from "@/lib/config";

export interface MessageSubmission {
  messageId: string;
  recipientId: string;
  conversationId: string;
  content: string;
}

export async function createMessage(input: MessageSubmission): Promise<void> {
  if (!config.appwriteSendMessageFunctionId) {
    const error = new Error("Message delivery is not configured.") as Error & { code: number };
    error.code = 400;
    throw error;
  }

  const execution = await functions.createExecution({
    functionId: config.appwriteSendMessageFunctionId,
    body: JSON.stringify(input),
    async: false,
  });

  if (execution.responseStatusCode < 200 || execution.responseStatusCode >= 300) {
    let message = "Message could not be sent.";
    try {
      const response: unknown = JSON.parse(execution.responseBody);
      if (response && typeof response === "object" && "message" in response && typeof response.message === "string") {
        message = response.message;
      }
    } catch {
      // Keep the generic message if the function did not return JSON.
    }

    const error = new Error(message) as Error & { code: number };
    error.code = execution.responseStatusCode;
    throw error;
  }
}
