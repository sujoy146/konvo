import { LocalMessage } from "@/types/message";

interface MessageBubbleProps {
  message: LocalMessage;
  isOwn: boolean;
  isUnread: boolean;
  onRetry: (id: string) => void;
}

function formatTime(iso: string) {
  const date = new Date(iso);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function MessageBubble({ message, isOwn, isUnread, onRetry }: MessageBubbleProps) {
  const isFailed = message.status === "failed";
  const isSending = message.status === "sending";

  return (
    <div className={`flex flex-col mb-1 ${isOwn ? "items-end" : "items-start"}`}>
      {!isOwn && (
        <span className="text-xs text-gray-500 mb-1 ml-1">{message.senderName}</span>
      )}
      <div
        className={`max-w-[88%] break-words rounded-2xl px-4 py-2 text-sm shadow-sm transition-colors sm:max-w-[75%] ${
          isOwn
            ? isFailed
              ? "bg-red-100 text-red-800 border border-red-200"
              : "bg-blue-600/80 backdrop-blur-md text-white border border-blue-500/50 shadow-md"
            : isUnread
            ? "bg-blue-50/80 backdrop-blur-md text-gray-900 border border-blue-300/50 ring-1 ring-blue-300 shadow-sm"
            : "bg-white/60 backdrop-blur-md text-gray-900 border border-white/50 shadow-sm"
        } ${isSending ? "opacity-60" : ""}`}
      >
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
      </div>
      <div
        className={`flex items-center mt-0.5 space-x-1.5 ${
          isOwn ? "flex-row-reverse space-x-reverse" : ""
        }`}
      >
        <span className="text-[10px] text-gray-400">{formatTime(message.$createdAt)}</span>
        {isUnread && !isOwn && (
          <span className="text-[10px] text-blue-500 font-medium">New</span>
        )}
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
