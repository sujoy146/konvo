import { LocalMessage } from "@/types/message";

interface MessageBubbleProps {
  message: LocalMessage;
  isOwn: boolean;
  onRetry: (id: string) => void;
}

function formatTime(iso: string) {
  const date = new Date(iso);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function MessageBubble({ message, isOwn, onRetry }: MessageBubbleProps) {
  const isFailed = message.status === "failed";
  const isSending = message.status === "sending";
  const isDecryptError = message.decryptError;

  return (
    <div className={`flex flex-col mb-1 ${isOwn ? "items-end" : "items-start"}`}>
      {!isOwn && (
        <span className="text-xs text-gray-500 mb-1 ml-1">{message.senderName}</span>
      )}
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm shadow-sm ${
          isOwn
            ? isFailed
              ? "bg-red-100 text-red-800 border border-red-200"
              : "bg-blue-600 text-white"
            : "bg-white text-gray-900 border border-gray-100"
        } ${isSending ? "opacity-60" : ""}`}
      >
        {isDecryptError ? (
          <span className="italic text-gray-400 text-xs">
            🔒 Can&apos;t decrypt this message
          </span>
        ) : (
          <p className="whitespace-pre-wrap break-words">{message.text}</p>
        )}
      </div>
      <div className={`flex items-center mt-0.5 space-x-1.5 ${isOwn ? "flex-row-reverse space-x-reverse" : ""}`}>
        <span className="text-[10px] text-gray-400">{formatTime(message.$createdAt)}</span>
        {isOwn && isSending && (
          <span className="text-[10px] text-gray-400">Sending...</span>
        )}
        {isOwn && isFailed && (
          <button
            onClick={() => onRetry(message.$id)}
            className="text-[10px] text-red-500 hover:underline focus:outline-none"
          >
            Failed to send · Retry
          </button>
        )}
      </div>
    </div>
  );
}
