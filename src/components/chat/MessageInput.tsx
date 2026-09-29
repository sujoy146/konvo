import { useRef, useState } from "react";

interface MessageInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  disabledReason?: string;
}

export function MessageInput({ onSend, disabled, disabledReason }: MessageInputProps) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const trimmedText = text.trim();
  const canSend = trimmedText.length > 0 && trimmedText.length <= 2000 && !disabled;

  const handleSend = () => {
    const message = text.trim();
    if (!message || message.length > 2000 || disabled) return;
    onSend(message);
    setText("");
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    // Auto-grow textarea
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
  };

  const charsLeft = 2000 - text.trim().length;

  return (
    <div
      className="shrink-0 border-t border-white/40 bg-white/70 px-3 pt-3 backdrop-blur-md sm:px-4"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      {disabledReason && (
        <p className="text-xs text-amber-600 mb-2 text-center">{disabledReason}</p>
      )}
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          maxLength={2000}
          rows={1}
          placeholder={disabled ? "Message unavailable" : "Type a message…"}
          aria-label="Message input"
          className="min-h-11 min-w-0 flex-1 resize-none rounded-xl border border-white/60 bg-white px-3 py-2 text-base text-black placeholder-gray-500 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
          style={{ height: "auto" }}
        />
        <button
          onClick={handleSend}
          disabled={!canSend}
          aria-label="Send message"
          className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>
      {trimmedText.length > 1900 && (
        <p className={`text-xs mt-1 text-right ${charsLeft < 0 ? "text-red-500" : "text-gray-400"}`}>
          {charsLeft} characters left
        </p>
      )}
    </div>
  );
}
